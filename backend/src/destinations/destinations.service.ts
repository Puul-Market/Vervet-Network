import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DestinationStatus, Prisma, VerificationStatus } from '@prisma/client';
import { NormalizationService } from '../common/normalization/normalization.service';
import { buildBlindIndex } from '../common/security/blind-index.util';
import {
  openSealedString,
  sealString,
} from '../common/security/sealed-data.util';
import type { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ListDestinationsDto } from './dto/list-destinations.dto';
import { ReplaceDestinationDto } from './dto/replace-destination.dto';

@Injectable()
export class DestinationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly normalizationService: NormalizationService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async listPartnerDestinations(
    partnerId: string,
    params: ListDestinationsDto,
  ) {
    const destinations = await this.prismaService.recipientDestination.findMany(
      {
        where: {
          recipient: {
            partnerId,
          },
          recipientId: params.recipientId?.trim(),
          status: params.status,
          ...(params.chain || params.asset
            ? {
                assetNetwork: {
                  ...(params.chain
                    ? {
                        chain: {
                          slug: this.normalizationService.normalizeChain(
                            params.chain,
                          ),
                        },
                      }
                    : {}),
                  ...(params.asset
                    ? {
                        asset: {
                          OR: [
                            {
                              code: this.normalizationService.normalizeAssetCode(
                                params.asset,
                              ),
                            },
                            {
                              symbol:
                                this.normalizationService.normalizeAssetSymbol(
                                  params.asset,
                                ),
                            },
                          ],
                        },
                      }
                    : {}),
                },
              }
            : {}),
        },
        include: {
          recipient: {
            select: {
              id: true,
              externalRecipientId: true,
              displayName: true,
              displayNameCiphertext: true,
            },
          },
          assetNetwork: {
            include: {
              asset: true,
              chain: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: params.limit ?? 50,
      },
    );

    const destinationIds = destinations.map((destination) => destination.id);
    const latestAttestations = destinationIds.length
      ? await this.prismaService.attestation.findMany({
          where: {
            destinationId: {
              in: destinationIds,
            },
          },
          orderBy: {
            issuedAt: 'desc',
          },
          select: {
            id: true,
            destinationId: true,
            verificationStatus: true,
            issuedAt: true,
            expiresAt: true,
          },
        })
      : [];

    return destinations.map((destination) =>
      this.serializeDestination(
        destination,
        latestAttestations.find(
          (attestation) => attestation.destinationId === destination.id,
        ) ?? null,
      ),
    );
  }

  async getPartnerDestination(partnerId: string, destinationId: string) {
    const destination = await this.prismaService.recipientDestination.findFirst(
      {
        where: {
          id: destinationId,
          recipient: {
            partnerId,
          },
        },
        include: {
          recipient: {
            select: {
              id: true,
              externalRecipientId: true,
              displayName: true,
              displayNameCiphertext: true,
            },
          },
          assetNetwork: {
            include: {
              asset: true,
              chain: true,
            },
          },
        },
      },
    );

    if (!destination) {
      return null;
    }

    const [attestations, recentUsage] = await Promise.all([
      this.prismaService.attestation.findMany({
        where: {
          destinationId,
        },
        orderBy: {
          issuedAt: 'desc',
        },
        take: 20,
        select: {
          id: true,
          attestationType: true,
          verificationStatus: true,
          issuedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
      this.prismaService.resolutionRequest.findMany({
        where: {
          requesterPartnerId: partnerId,
          resolvedDestinationId: destinationId,
        },
        orderBy: {
          requestedAt: 'desc',
        },
        take: 20,
        select: {
          id: true,
          queryType: true,
          outcome: true,
          riskLevel: true,
          recommendation: true,
          requestedAt: true,
        },
      }),
    ]);

    const latestAttestation = attestations[0] ?? null;

    return {
      ...this.serializeDestination(destination, latestAttestation),
      attestationHistory: attestations.map((attestation) => ({
        id: attestation.id,
        attestationType: attestation.attestationType,
        verificationStatus: attestation.verificationStatus,
        issuedAt: attestation.issuedAt.toISOString(),
        expiresAt: attestation.expiresAt?.toISOString() ?? null,
        revokedAt: attestation.revokedAt?.toISOString() ?? null,
      })),
      recentUsage: recentUsage.map((request) => ({
        id: request.id,
        queryType: request.queryType,
        outcome: request.outcome,
        riskLevel: request.riskLevel,
        recommendation: request.recommendation,
        requestedAt: request.requestedAt.toISOString(),
      })),
    };
  }

  async createPartnerDestination(
    partnerId: string,
    createDestinationDto: CreateDestinationDto,
  ) {
    const assetNetwork = await this.findAssetNetwork(
      createDestinationDto.chain,
      createDestinationDto.asset,
    );
    const recipient = await this.prismaService.recipient.findFirst({
      where: {
        id: createDestinationDto.recipientId.trim(),
        partnerId,
      },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient was not found for the partner.');
    }

    const normalizedAddress = this.normalizationService.normalizeAddress(
      assetNetwork.chain.slug,
      createDestinationDto.address,
    );
    const addressNormalizedBlindIndex =
      this.buildAddressBlindIndex(normalizedAddress);
    const memoValue = createDestinationDto.memoValue?.trim() ?? '';
    const effectiveFrom = createDestinationDto.effectiveFrom
      ? new Date(createDestinationDto.effectiveFrom)
      : new Date();
    const expiresAt = createDestinationDto.expiresAt
      ? new Date(createDestinationDto.expiresAt)
      : null;

    if (expiresAt && expiresAt <= effectiveFrom) {
      throw new BadRequestException('Destination validity window is invalid.');
    }

    const existingDestination =
      await this.prismaService.recipientDestination.findFirst({
        where: {
          recipientId: recipient.id,
          assetNetworkId: assetNetwork.id,
          memoValue,
          OR: [
            {
              addressNormalizedBlindIndex,
            },
            {
              addressNormalized: normalizedAddress,
            },
          ],
        },
      });

    if (existingDestination) {
      throw new ConflictException(
        'That destination already exists for this recipient and asset network.',
      );
    }

    const createdDestination = await this.prismaService.$transaction(
      async (transaction) => {
        if (createDestinationDto.isDefault) {
          await transaction.recipientDestination.updateMany({
            where: {
              recipientId: recipient.id,
              assetNetworkId: assetNetwork.id,
              isDefault: true,
            },
            data: {
              isDefault: false,
            },
          });
        }

        return transaction.recipientDestination.create({
          data: {
            recipientId: recipient.id,
            assetNetworkId: assetNetwork.id,
            addressRaw: createDestinationDto.address.trim(),
            addressRawCiphertext: this.sealOptionalString(
              createDestinationDto.address.trim(),
            ),
            addressNormalized: normalizedAddress,
            addressNormalizedBlindIndex,
            memoValue,
            status: DestinationStatus.PENDING,
            isDefault: createDestinationDto.isDefault ?? false,
            effectiveFrom,
            expiresAt,
          },
          select: {
            id: true,
          },
        });
      },
    );

    const destination = await this.getPartnerDestination(
      partnerId,
      createdDestination.id,
    );

    if (!destination) {
      throw new NotFoundException('Created destination could not be loaded.');
    }

    return destination;
  }

  async revokePartnerDestination(partnerId: string, destinationId: string) {
    const destination = await this.prismaService.recipientDestination.findFirst(
      {
        where: {
          id: destinationId,
          recipient: {
            partnerId,
          },
        },
      },
    );

    if (!destination) {
      throw new NotFoundException('Destination was not found for the partner.');
    }

    if (destination.status === DestinationStatus.REVOKED) {
      throw new ConflictException('Destination is already revoked.');
    }

    await this.prismaService.recipientDestination.update({
      where: {
        id: destination.id,
      },
      data: {
        status: DestinationStatus.REVOKED,
        revokedAt: new Date(),
        expiresAt: new Date(),
        isDefault: false,
      },
    });

    const revokedDestination = await this.getPartnerDestination(
      partnerId,
      destination.id,
    );

    if (!revokedDestination) {
      throw new NotFoundException('Revoked destination could not be loaded.');
    }

    return revokedDestination;
  }

  async replacePartnerDestination(
    partnerId: string,
    destinationId: string,
    replaceDestinationDto: ReplaceDestinationDto,
  ) {
    const existingDestination =
      await this.prismaService.recipientDestination.findFirst({
        where: {
          id: destinationId,
          recipient: {
            partnerId,
          },
        },
        include: {
          assetNetwork: {
            include: {
              asset: true,
              chain: true,
            },
          },
        },
      });

    if (!existingDestination) {
      throw new NotFoundException('Destination was not found for the partner.');
    }

    const createdDestination = await this.createPartnerDestination(partnerId, {
      recipientId: existingDestination.recipientId,
      chain:
        replaceDestinationDto.chain ??
        existingDestination.assetNetwork.chain.slug,
      asset:
        replaceDestinationDto.asset ??
        existingDestination.assetNetwork.asset.symbol,
      address: replaceDestinationDto.address,
      memoValue: replaceDestinationDto.memoValue,
      isDefault:
        replaceDestinationDto.isDefault ?? existingDestination.isDefault,
      effectiveFrom: replaceDestinationDto.effectiveFrom,
      expiresAt: replaceDestinationDto.expiresAt,
    });

    await this.prismaService.recipientDestination.update({
      where: {
        id: existingDestination.id,
      },
      data: {
        status: DestinationStatus.REVOKED,
        revokedAt: new Date(),
        expiresAt: new Date(),
        isDefault: false,
      },
    });

    return createdDestination;
  }

  private async findAssetNetwork(chainInput: string, assetInput: string) {
    const chainSlug = this.normalizationService.normalizeChain(chainInput);
    const assetCode = this.normalizationService.normalizeAssetCode(assetInput);
    const assetSymbol =
      this.normalizationService.normalizeAssetSymbol(assetInput);
    const assetNetwork = await this.prismaService.assetNetwork.findFirst({
      where: {
        isActive: true,
        chain: {
          slug: chainSlug,
          isActive: true,
        },
        asset: {
          OR: [{ code: assetCode }, { symbol: assetSymbol }],
        },
      },
      include: {
        asset: true,
        chain: true,
      },
    });

    if (!assetNetwork) {
      throw new NotFoundException(
        `Asset network '${assetInput}' on '${chainInput}' is not registered.`,
      );
    }

    return assetNetwork;
  }

  private serializeDestination(
    destination: Prisma.RecipientDestinationGetPayload<{
      include: {
        recipient: {
          select: {
            id: true;
            externalRecipientId: true;
            displayName: true;
            displayNameCiphertext: true;
          };
        };
        assetNetwork: {
          include: {
            asset: true;
            chain: true;
          };
        };
      };
    }>,
    latestAttestation: {
      id: string;
      verificationStatus: VerificationStatus;
      issuedAt: Date;
      expiresAt: Date | null;
    } | null,
  ) {
    return {
      id: destination.id,
      recipient: {
        id: destination.recipient.id,
        externalRecipientId: destination.recipient.externalRecipientId,
        displayName: this.readProtectedString(
          destination.recipient.displayName,
          destination.recipient.displayNameCiphertext,
        ),
      },
      address: this.readProtectedString(
        destination.addressRaw,
        destination.addressRawCiphertext,
      ),
      normalizedAddress: destination.addressNormalized,
      memoValue: destination.memoValue || null,
      status: destination.status,
      isDefault: destination.isDefault,
      effectiveFrom: destination.effectiveFrom.toISOString(),
      expiresAt: destination.expiresAt?.toISOString() ?? null,
      revokedAt: destination.revokedAt?.toISOString() ?? null,
      lastAttestedAt: destination.lastAttestedAt?.toISOString() ?? null,
      assetNetwork: {
        id: destination.assetNetwork.id,
        assetCode: destination.assetNetwork.asset.code,
        assetSymbol: destination.assetNetwork.asset.symbol,
        chain: destination.assetNetwork.chain.slug,
        chainDisplayName: destination.assetNetwork.chain.displayName,
        tokenStandard: destination.assetNetwork.standard,
        contractAddress: destination.assetNetwork.contractAddressRaw,
      },
      latestAttestation: latestAttestation
        ? {
            id: latestAttestation.id,
            verificationStatus: latestAttestation.verificationStatus,
            issuedAt: latestAttestation.issuedAt.toISOString(),
            expiresAt: latestAttestation.expiresAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  private sealOptionalString(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    return sealString(
      value,
      this.configService.get('DATA_ENCRYPTION_MASTER_SECRET', {
        infer: true,
      }),
    );
  }

  private readProtectedString(
    plaintextValue: string | null | undefined,
    ciphertextValue: string | null | undefined,
  ): string | null {
    if (typeof plaintextValue === 'string' && plaintextValue.length > 0) {
      return plaintextValue;
    }

    if (!ciphertextValue) {
      return null;
    }

    return openSealedString(
      ciphertextValue,
      this.configService.get('DATA_ENCRYPTION_MASTER_SECRET', {
        infer: true,
      }),
    );
  }

  private buildAddressBlindIndex(normalizedAddress: string): string {
    return buildBlindIndex(
      normalizedAddress,
      this.configService.get('BLIND_INDEX_MASTER_SECRET', {
        infer: true,
      }),
    );
  }
}
