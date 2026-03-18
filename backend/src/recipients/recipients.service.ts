import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DestinationStatus,
  IdentifierKind,
  IdentifierStatus,
  IdentifierVisibility,
  PartnerStatus,
  Prisma,
  RecipientStatus,
} from '@prisma/client';
import { NormalizationService } from '../common/normalization/normalization.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';

interface UpsertRecipientParams {
  partnerId: string;
  externalRecipientId: string;
  displayName?: string;
}

interface UpsertIdentifierParams {
  partnerId: string;
  recipientId: string;
  kind: IdentifierKind;
  value: string;
}

interface ActiveDestinationsParams {
  recipientId: string;
  assetNetworkId: string;
  now: Date;
}

interface ListPartnerRecipientsParams {
  limit: number;
  search?: string;
  status?: RecipientStatus;
}

@Injectable()
export class RecipientsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly normalizationService: NormalizationService,
  ) {}

  async upsertRecipient(
    params: UpsertRecipientParams,
    database: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    const externalRecipientId = params.externalRecipientId.trim();
    const displayName = params.displayName?.trim() || null;

    return database.recipient.upsert({
      where: {
        partnerId_externalRecipientId: {
          partnerId: params.partnerId,
          externalRecipientId,
        },
      },
      update: {
        displayName,
        status: RecipientStatus.ACTIVE,
      },
      create: {
        partnerId: params.partnerId,
        externalRecipientId,
        displayName,
        status: RecipientStatus.ACTIVE,
      },
    });
  }

  async upsertIdentifier(
    params: UpsertIdentifierParams,
    database: Prisma.TransactionClient | PrismaService = this.prismaService,
  ) {
    const normalizedValue = this.normalizationService.normalizeIdentifier(
      params.value,
    );

    return database.recipientIdentifier.upsert({
      where: {
        partnerId_kind_normalizedValue: {
          partnerId: params.partnerId,
          kind: params.kind,
          normalizedValue,
        },
      },
      update: {
        recipientId: params.recipientId,
        rawValue: params.value.trim(),
        status: IdentifierStatus.ACTIVE,
        visibility: IdentifierVisibility.RESOLVABLE,
        isPrimary: true,
        verifiedAt: new Date(),
      },
      create: {
        recipientId: params.recipientId,
        partnerId: params.partnerId,
        kind: params.kind,
        rawValue: params.value.trim(),
        normalizedValue,
        status: IdentifierStatus.ACTIVE,
        visibility: IdentifierVisibility.RESOLVABLE,
        isPrimary: true,
        verifiedAt: new Date(),
      },
    });
  }

  async findResolvableIdentifier(normalizedIdentifier: string) {
    return this.prismaService.recipientIdentifier.findFirst({
      where: {
        normalizedValue: normalizedIdentifier,
        status: IdentifierStatus.ACTIVE,
        visibility: IdentifierVisibility.RESOLVABLE,
        recipient: {
          status: RecipientStatus.ACTIVE,
          partner: {
            status: PartnerStatus.ACTIVE,
          },
        },
      },
      include: {
        recipient: {
          include: {
            partner: true,
          },
        },
      },
    });
  }

  async getActiveDestinations(params: ActiveDestinationsParams) {
    return this.prismaService.recipientDestination.findMany({
      where: {
        recipientId: params.recipientId,
        assetNetworkId: params.assetNetworkId,
        status: DestinationStatus.ACTIVE,
        effectiveFrom: {
          lte: params.now,
        },
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: params.now,
            },
          },
        ],
      },
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          lastAttestedAt: 'desc',
        },
      ],
    });
  }

  async listPartnerRecipients(
    partnerId: string,
    params: ListPartnerRecipientsParams,
  ) {
    const now = new Date();
    const recipients = await this.prismaService.recipient.findMany({
      where: {
        partnerId,
        ...(params.status
          ? {
              status: params.status,
            }
          : {}),
        ...this.buildRecipientSearchWhere(params.search),
      },
      include: {
        identifiers: {
          orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
        },
        destinations: {
          where: this.buildCurrentDestinationWhere(now),
          include: {
            assetNetwork: {
              include: {
                asset: true,
                chain: true,
              },
            },
          },
          orderBy: [{ isDefault: 'desc' }, { lastAttestedAt: 'desc' }],
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: params.limit,
    });

    return recipients.map((recipient) => this.serializeRecipient(recipient));
  }

  async getPartnerRecipient(partnerId: string, recipientId: string) {
    const now = new Date();
    const recipient = await this.prismaService.recipient.findFirst({
      where: {
        id: recipientId,
        partnerId,
      },
      include: {
        identifiers: {
          orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
        },
        destinations: {
          where: this.buildCurrentDestinationWhere(now),
          include: {
            assetNetwork: {
              include: {
                asset: true,
                chain: true,
              },
            },
          },
          orderBy: [{ isDefault: 'desc' }, { lastAttestedAt: 'desc' }],
        },
      },
    });

    if (!recipient) {
      return null;
    }

    const [recentAttestations, recentVerificationAttempts] = await Promise.all([
      this.prismaService.attestation.findMany({
        where: {
          recipientId,
          partnerId,
        },
        orderBy: {
          issuedAt: 'desc',
        },
        take: 10,
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
          resolvedRecipientId: recipientId,
          requesterPartnerId: partnerId,
        },
        orderBy: {
          requestedAt: 'desc',
        },
        take: 10,
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

    return {
      ...this.serializeRecipient(recipient),
      recentAttestations: recentAttestations.map((attestation) => ({
        id: attestation.id,
        attestationType: attestation.attestationType,
        verificationStatus: attestation.verificationStatus,
        issuedAt: attestation.issuedAt.toISOString(),
        expiresAt: attestation.expiresAt?.toISOString() ?? null,
        revokedAt: attestation.revokedAt?.toISOString() ?? null,
      })),
      recentVerificationAttempts: recentVerificationAttempts.map((request) => ({
        id: request.id,
        queryType: request.queryType,
        outcome: request.outcome,
        riskLevel: request.riskLevel,
        recommendation: request.recommendation,
        requestedAt: request.requestedAt.toISOString(),
      })),
    };
  }

  async createPartnerRecipient(
    partnerId: string,
    createRecipientDto: CreateRecipientDto,
  ) {
    const externalRecipientId = createRecipientDto.externalRecipientId.trim();
    const primaryIdentifier = createRecipientDto.primaryIdentifier.trim();
    const displayName = createRecipientDto.displayName?.trim() || null;
    const identifierKind =
      createRecipientDto.identifierKind ?? IdentifierKind.PARTNER_HANDLE;
    const visibility =
      createRecipientDto.visibility ?? IdentifierVisibility.RESOLVABLE;

    if (externalRecipientId.length === 0) {
      throw new BadRequestException('Recipient identifier is required.');
    }

    if (primaryIdentifier.length === 0) {
      throw new BadRequestException('Primary identifier is required.');
    }

    const existingRecipient = await this.prismaService.recipient.findUnique({
      where: {
        partnerId_externalRecipientId: {
          partnerId,
          externalRecipientId,
        },
      },
    });

    if (existingRecipient) {
      throw new ConflictException(
        `Recipient '${externalRecipientId}' already exists for this partner.`,
      );
    }

    const normalizedIdentifier =
      this.normalizationService.normalizeIdentifier(primaryIdentifier);
    const existingIdentifier =
      await this.prismaService.recipientIdentifier.findUnique({
        where: {
          partnerId_kind_normalizedValue: {
            partnerId,
            kind: identifierKind,
            normalizedValue: normalizedIdentifier,
          },
        },
      });

    if (existingIdentifier) {
      throw new ConflictException(
        `Identifier '${primaryIdentifier}' is already registered for this partner.`,
      );
    }

    const createdRecipient = await this.prismaService.$transaction(
      async (transaction) => {
        const recipient = await transaction.recipient.create({
          data: {
            partnerId,
            externalRecipientId,
            displayName,
            status: RecipientStatus.ACTIVE,
            profile: createRecipientDto.profile as Prisma.InputJsonValue,
          },
          select: {
            id: true,
          },
        });

        await transaction.recipientIdentifier.create({
          data: {
            partnerId,
            recipientId: recipient.id,
            kind: identifierKind,
            rawValue: primaryIdentifier,
            normalizedValue: normalizedIdentifier,
            status: IdentifierStatus.ACTIVE,
            visibility,
            isPrimary: true,
            verifiedAt: new Date(),
          },
        });

        return recipient;
      },
    );

    const hydratedRecipient = await this.getPartnerRecipient(
      partnerId,
      createdRecipient.id,
    );

    if (!hydratedRecipient) {
      throw new NotFoundException('Created recipient could not be loaded.');
    }

    return hydratedRecipient;
  }

  async updatePartnerRecipient(
    partnerId: string,
    recipientId: string,
    updateRecipientDto: UpdateRecipientDto,
  ) {
    const existingRecipient = await this.prismaService.recipient.findFirst({
      where: {
        id: recipientId,
        partnerId,
      },
    });

    if (!existingRecipient) {
      throw new NotFoundException('Recipient was not found for the partner.');
    }

    const updateData: Prisma.RecipientUpdateInput = {};

    if (updateRecipientDto.displayName !== undefined) {
      const displayName = updateRecipientDto.displayName.trim();
      updateData.displayName = displayName.length > 0 ? displayName : null;
    }

    if (updateRecipientDto.profile !== undefined) {
      updateData.profile = updateRecipientDto.profile;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one recipient field must be updated.',
      );
    }

    await this.prismaService.recipient.update({
      where: {
        id: existingRecipient.id,
      },
      data: updateData,
    });

    const updatedRecipient = await this.getPartnerRecipient(
      partnerId,
      recipientId,
    );

    if (!updatedRecipient) {
      throw new NotFoundException('Updated recipient could not be loaded.');
    }

    return updatedRecipient;
  }

  async disablePartnerRecipient(partnerId: string, recipientId: string) {
    const recipient = await this.prismaService.recipient.findFirst({
      where: {
        id: recipientId,
        partnerId,
      },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient was not found for the partner.');
    }

    if (recipient.status !== RecipientStatus.ACTIVE) {
      throw new ConflictException('Recipient is already inactive.');
    }

    await this.prismaService.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        status: RecipientStatus.SUSPENDED,
      },
    });

    const updatedRecipient = await this.getPartnerRecipient(
      partnerId,
      recipientId,
    );

    if (!updatedRecipient) {
      throw new NotFoundException('Updated recipient could not be loaded.');
    }

    return updatedRecipient;
  }

  private buildRecipientSearchWhere(
    search?: string,
  ): Prisma.RecipientWhereInput {
    if (!search) {
      return {};
    }

    const trimmedSearch = search.trim();

    if (!trimmedSearch) {
      return {};
    }

    const normalizedSearch = trimmedSearch.toLowerCase();

    return {
      OR: [
        {
          externalRecipientId: {
            contains: trimmedSearch,
            mode: 'insensitive',
          },
        },
        {
          displayName: {
            contains: trimmedSearch,
            mode: 'insensitive',
          },
        },
        {
          identifiers: {
            some: {
              OR: [
                {
                  rawValue: {
                    contains: trimmedSearch,
                    mode: 'insensitive',
                  },
                },
                {
                  normalizedValue: {
                    contains: normalizedSearch,
                  },
                },
              ],
            },
          },
        },
      ],
    };
  }

  private buildCurrentDestinationWhere(
    now: Date,
  ): Prisma.RecipientDestinationWhereInput {
    return {
      status: DestinationStatus.ACTIVE,
      effectiveFrom: {
        lte: now,
      },
      OR: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            gt: now,
          },
        },
      ],
    };
  }

  private serializeRecipient(
    recipient: Prisma.RecipientGetPayload<{
      include: {
        identifiers: true;
        destinations: {
          include: {
            assetNetwork: {
              include: {
                asset: true;
                chain: true;
              };
            };
          };
        };
      };
    }>,
  ) {
    return {
      id: recipient.id,
      externalRecipientId: recipient.externalRecipientId,
      displayName: recipient.displayName,
      status: recipient.status,
      profile: recipient.profile,
      createdAt: recipient.createdAt.toISOString(),
      updatedAt: recipient.updatedAt.toISOString(),
      activeDestinationsCount: recipient.destinations.length,
      identifiers: recipient.identifiers.map((identifier) => ({
        id: identifier.id,
        kind: identifier.kind,
        rawValue: identifier.rawValue,
        normalizedValue: identifier.normalizedValue,
        status: identifier.status,
        visibility: identifier.visibility,
        isPrimary: identifier.isPrimary,
        verifiedAt: identifier.verifiedAt?.toISOString() ?? null,
        expiresAt: identifier.expiresAt?.toISOString() ?? null,
        updatedAt: identifier.updatedAt.toISOString(),
      })),
      currentDestinations: recipient.destinations.map((destination) => ({
        id: destination.id,
        address: destination.addressRaw,
        memo: destination.memoValue || null,
        status: destination.status,
        isDefault: destination.isDefault,
        effectiveFrom: destination.effectiveFrom.toISOString(),
        expiresAt: destination.expiresAt?.toISOString() ?? null,
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
      })),
    };
  }
}
