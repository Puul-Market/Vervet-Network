import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttestationType,
  AuditActorType,
  DestinationStatus,
  Prisma,
  VerificationStatus as AttestationVerificationStatus,
  VerificationStatus,
  WebhookEventType,
} from '@prisma/client';
import { NormalizationService } from '../common/normalization/normalization.service';
import {
  EncryptedSubmissionService,
  type PartnerEncryptedSubmissionPolicy,
} from '../common/security/encrypted-submission.service';
import type { EncryptedFieldDto } from '../common/security/encrypted-field.dto';
import { AuditService } from '../audit/audit.service';
import { buildBlindIndex } from '../common/security/blind-index.util';
import { sealString } from '../common/security/sealed-data.util';
import type { EnvironmentVariables } from '../config/environment';
import { PartnersService } from '../partners/partners.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecipientsService } from '../recipients/recipients.service';
import { RequestHardeningService } from '../security/request-hardening.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  buildCanonicalAttestationInput,
  hashAttestationPayload,
  serializeAttestationPayload,
  verifyAttestationSignature,
} from './attestation-payload';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { CreateAttestationDto } from './dto/create-attestation.dto';

interface NormalizedAttestationFields {
  address: string;
  assetCode: string;
  assetSymbol: string;
  canonicalPayload: string;
  chain: string;
  contractAddress: string;
  memo: string;
  partnerSlug: string;
  payloadHash: string;
  recipientIdentifier: string;
}

interface AttestationTiming {
  effectiveFrom: Date;
  expiresAt: Date | null;
  issuedAt: Date;
}

type ResolvedCreateAttestationDto = Omit<
  CreateAttestationDto,
  'recipientIdentifier' | 'address'
> & {
  recipientIdentifier: string;
  address: string;
};

@Injectable()
export class AttestationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly partnersService: PartnersService,
    private readonly recipientsService: RecipientsService,
    private readonly normalizationService: NormalizationService,
    private readonly encryptedSubmissionService: EncryptedSubmissionService,
    private readonly requestHardeningService: RequestHardeningService,
    private readonly webhooksService: WebhooksService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async createAttestation(
    createAttestationDto: CreateAttestationDto,
    authenticatedPartner: AuthenticatedPartner,
    requestReplayHeaders: {
      requestNonce: string | undefined;
      requestTimestamp: string | undefined;
    },
  ) {
    let normalizedFields: NormalizedAttestationFields | null = null;
    let materializedSensitiveFields: Pick<
      ResolvedCreateAttestationDto,
      'recipientIdentifier' | 'address'
    > | null = null;

    try {
      const loadEncryptedSubmissionPolicy =
        this.createEncryptedSubmissionPolicyLoader(
          authenticatedPartner.partnerId,
        );
      const resolvedCreateAttestationDto =
        await this.resolveSensitiveAttestationFields(
          createAttestationDto,
          loadEncryptedSubmissionPolicy,
        );
      materializedSensitiveFields = {
        recipientIdentifier: resolvedCreateAttestationDto.recipientIdentifier,
        address: resolvedCreateAttestationDto.address,
      };
      normalizedFields = this.normalizeAttestationFields(
        resolvedCreateAttestationDto,
      );
      const normalizedAttestationFields = normalizedFields;

      if (
        normalizedAttestationFields.partnerSlug !==
        authenticatedPartner.partnerSlug
      ) {
        throw new ForbiddenException(
          'Authenticated partner does not match the attestation partner slug.',
        );
      }

      const signingKey = await this.partnersService.getActiveSigningKey(
        authenticatedPartner.partnerId,
        createAttestationDto.keyId,
      );

      if (signingKey.algorithm !== createAttestationDto.algorithm) {
        throw new BadRequestException(
          `Signing key '${createAttestationDto.keyId}' does not match algorithm '${createAttestationDto.algorithm}'.`,
        );
      }

      const signatureIsValid = verifyAttestationSignature(
        resolvedCreateAttestationDto.algorithm,
        signingKey.publicKeyPem,
        normalizedAttestationFields.canonicalPayload,
        resolvedCreateAttestationDto.signature,
      );

      if (!signatureIsValid) {
        throw new UnauthorizedException(
          'Attestation signature verification failed.',
        );
      }

      await this.requestHardeningService.assertAttestationReplayProtection({
        authenticatedPartner,
        requestNonce: requestReplayHeaders.requestNonce,
        requestTimestamp: requestReplayHeaders.requestTimestamp,
        requestHash: normalizedAttestationFields.payloadHash,
      });

      const existingAttestation =
        await this.prismaService.attestation.findUnique({
          where: {
            partnerId_sequenceNumber: {
              partnerId: authenticatedPartner.partnerId,
              sequenceNumber: BigInt(createAttestationDto.sequenceNumber),
            },
          },
        });

      if (existingAttestation) {
        if (
          existingAttestation.payloadHash !==
          normalizedAttestationFields.payloadHash
        ) {
          throw new ConflictException(
            `Sequence number '${createAttestationDto.sequenceNumber}' was already used for a different attestation.`,
          );
        }

        return {
          id: existingAttestation.id,
          verificationStatus: existingAttestation.verificationStatus,
          sequenceNumber: existingAttestation.sequenceNumber.toString(),
        };
      }

      const timing = this.parseAttestationTiming(resolvedCreateAttestationDto);

      const result = await this.prismaService.$transaction(
        async (transaction) => {
          const corridor = await this.resolveAttestationCorridor(
            transaction,
            resolvedCreateAttestationDto,
            normalizedAttestationFields,
          );

          const recipient = await this.recipientsService.upsertRecipient(
            {
              partnerId: authenticatedPartner.partnerId,
              externalRecipientId:
                resolvedCreateAttestationDto.recipientExternalId,
              displayName: resolvedCreateAttestationDto.recipientDisplayName,
            },
            transaction,
          );
          const identifier = await this.recipientsService.upsertIdentifier(
            {
              partnerId: authenticatedPartner.partnerId,
              recipientId: recipient.id,
              kind: resolvedCreateAttestationDto.identifierKind,
              value: resolvedCreateAttestationDto.recipientIdentifier,
            },
            transaction,
          );

          const destination = await this.applyDestinationAttestation(
            transaction,
            resolvedCreateAttestationDto,
            corridor.assetNetwork.id,
            recipient.id,
            normalizedAttestationFields,
            timing,
          );

          const attestation = await transaction.attestation.create({
            data: {
              partnerId: authenticatedPartner.partnerId,
              signingKeyId: signingKey.id,
              attestationType: resolvedCreateAttestationDto.attestationType,
              recipientId: recipient.id,
              identifierId: identifier.id,
              assetNetworkId: corridor.assetNetwork.id,
              destinationId: destination.id,
              recipientIdentifierSnapshot: identifier.normalizedValue,
              displayNameSnapshot: recipient.displayName,
              addressRaw: resolvedCreateAttestationDto.address,
              addressNormalized: normalizedAttestationFields.address,
              memoValue: normalizedAttestationFields.memo,
              canonicalPayload: normalizedAttestationFields.canonicalPayload,
              payload: JSON.parse(
                normalizedAttestationFields.canonicalPayload,
              ) as Prisma.InputJsonValue,
              payloadHash: normalizedAttestationFields.payloadHash,
              signature: resolvedCreateAttestationDto.signature.trim(),
              sequenceNumber: BigInt(
                resolvedCreateAttestationDto.sequenceNumber,
              ),
              issuedAt: timing.issuedAt,
              effectiveFrom: timing.effectiveFrom,
              expiresAt: timing.expiresAt,
              verificationStatus: VerificationStatus.VERIFIED,
              verifiedAt: new Date(),
            },
          });

          await this.auditService.recordEvent(
            {
              actorType: AuditActorType.PARTNER,
              actorPartnerId: authenticatedPartner.partnerId,
              subjectPartnerId: authenticatedPartner.partnerId,
              actorIdentifier: authenticatedPartner.actorIdentifier,
              action: 'attestation.ingested',
              entityType: 'Attestation',
              entityId: attestation.id,
              summary: `Ingested ${resolvedCreateAttestationDto.attestationType.toLowerCase()} attestation for '${identifier.normalizedValue}'.`,
              metadata: {
                attestationType: resolvedCreateAttestationDto.attestationType,
                recipientIdentifier: identifier.normalizedValue,
                chain: corridor.chain.slug,
                asset: corridor.asset.symbol,
                destinationId: destination.id,
                sequenceNumber: resolvedCreateAttestationDto.sequenceNumber,
              },
            },
            transaction,
          );

          const webhookEventType =
            resolvedCreateAttestationDto.attestationType ===
            AttestationType.DESTINATION_REVOCATION
              ? WebhookEventType.DESTINATION_REVOKED
              : WebhookEventType.DESTINATION_UPDATED;

          await this.webhooksService.enqueuePartnerWebhookEvent(
            {
              partnerId: authenticatedPartner.partnerId,
              eventType: webhookEventType,
              payload: this.buildAttestationWebhookPayload(
                webhookEventType,
                authenticatedPartner.partnerSlug,
                attestation.id,
                resolvedCreateAttestationDto.attestationType,
                identifier.normalizedValue,
                recipient.displayName,
                corridor.chain.slug,
                corridor.asset.symbol,
                destination.addressRaw,
                destination.memoValue,
                destination.expiresAt?.toISOString() ?? null,
                attestation.verificationStatus,
                attestation.sequenceNumber.toString(),
              ),
            },
            transaction,
          );

          return {
            id: attestation.id,
            partner: authenticatedPartner.partnerSlug,
            partnerId: authenticatedPartner.partnerId,
            recipientIdentifier: identifier.normalizedValue,
            recipientDisplayName: recipient.displayName,
            attestationType: resolvedCreateAttestationDto.attestationType,
            chain: corridor.chain.slug,
            asset: corridor.asset.symbol,
            address: destination.addressRaw,
            memo: destination.memoValue,
            expiresAt: destination.expiresAt?.toISOString() ?? null,
            status: attestation.verificationStatus,
            sequenceNumber: attestation.sequenceNumber.toString(),
          };
        },
      );
      void this.webhooksService
        .processPendingDeliveries({
          limit: 25,
        })
        .catch(() => undefined);

      return {
        id: result.id,
        partner: result.partner,
        recipientIdentifier: result.recipientIdentifier,
        chain: result.chain,
        asset: result.asset,
        address: result.address,
        status: result.status,
        sequenceNumber: result.sequenceNumber,
      };
    } catch (error: unknown) {
      await this.recordFailedAttestationIngestion(
        createAttestationDto,
        authenticatedPartner,
        error,
        normalizedFields,
        materializedSensitiveFields,
      );
      throw error;
    }
  }

  private normalizeAttestationFields(
    createAttestationDto: ResolvedCreateAttestationDto,
  ): NormalizedAttestationFields {
    const partnerSlug = this.normalizationService.normalizePartnerSlug(
      createAttestationDto.partnerSlug,
    );
    const chain = this.normalizationService.normalizeChain(
      createAttestationDto.chain,
    );
    const recipientIdentifier = this.normalizationService.normalizeIdentifier(
      createAttestationDto.recipientIdentifier,
    );
    const assetCode = this.normalizationService.normalizeAssetCode(
      createAttestationDto.assetCode,
    );
    const assetSymbol = this.normalizationService.normalizeAssetSymbol(
      createAttestationDto.assetSymbol,
    );
    const contractAddress = this.normalizationService.normalizeContractAddress(
      chain,
      createAttestationDto.contractAddress,
    );
    const address = this.normalizationService.normalizeAddress(
      chain,
      createAttestationDto.address,
    );
    const memo = this.normalizationService.normalizeMemo(
      createAttestationDto.memo,
    );
    const canonicalPayload = serializeAttestationPayload(
      buildCanonicalAttestationInput(createAttestationDto, {
        partnerSlug,
        recipientIdentifier,
        chain,
        assetCode,
        assetSymbol,
        contractAddress,
        address,
        memo,
      }),
    );

    return {
      address,
      assetCode,
      assetSymbol,
      canonicalPayload,
      chain,
      contractAddress,
      memo,
      partnerSlug,
      payloadHash: hashAttestationPayload(canonicalPayload),
      recipientIdentifier,
    };
  }

  private parseAttestationTiming(
    createAttestationDto: CreateAttestationDto,
  ): AttestationTiming {
    const issuedAt = new Date(createAttestationDto.issuedAt);
    const effectiveFrom = new Date(createAttestationDto.effectiveFrom);
    const expiresAt = createAttestationDto.expiresAt
      ? new Date(createAttestationDto.expiresAt)
      : null;

    if (issuedAt > effectiveFrom) {
      throw new BadRequestException(
        'effectiveFrom must be the same as or later than issuedAt.',
      );
    }

    return {
      effectiveFrom,
      expiresAt,
      issuedAt,
    };
  }

  private async resolveAttestationCorridor(
    transaction: Prisma.TransactionClient,
    createAttestationDto: CreateAttestationDto,
    normalizedFields: NormalizedAttestationFields,
  ) {
    const chain = await transaction.chain.findFirst({
      where: {
        slug: normalizedFields.chain,
        isActive: true,
      },
    });

    if (!chain) {
      throw new BadRequestException(
        `Chain '${createAttestationDto.chain.trim()}' is not enabled for attestation ingestion.`,
      );
    }

    const asset = await transaction.asset.findFirst({
      where: {
        code: normalizedFields.assetCode,
        symbol: normalizedFields.assetSymbol,
        isActive: true,
      },
    });

    if (!asset) {
      throw new BadRequestException(
        `Asset '${createAttestationDto.assetCode.trim()}' is not enabled for attestation ingestion.`,
      );
    }

    const assetNetwork = await transaction.assetNetwork.findFirst({
      where: {
        assetId: asset.id,
        chainId: chain.id,
        contractAddressNormalized: normalizedFields.contractAddress,
        standard: createAttestationDto.tokenStandard,
        isActive: true,
      },
    });

    if (!assetNetwork) {
      throw new BadRequestException(
        'The asset-network corridor is not enabled for attestation ingestion.',
      );
    }

    if (
      createAttestationDto.decimals !== undefined &&
      assetNetwork.decimals !== createAttestationDto.decimals
    ) {
      throw new BadRequestException(
        'Attestation decimals do not match the registered asset-network corridor.',
      );
    }

    return {
      asset,
      assetNetwork,
      chain,
    };
  }

  private async applyDestinationAttestation(
    transaction: Prisma.TransactionClient,
    createAttestationDto: ResolvedCreateAttestationDto,
    assetNetworkId: string,
    recipientId: string,
    normalizedFields: NormalizedAttestationFields,
    timing: AttestationTiming,
  ) {
    let destination = await transaction.recipientDestination.findUnique({
      where: {
        recipientId_assetNetworkId_addressNormalized_memoValue: {
          recipientId,
          assetNetworkId,
          addressNormalized: normalizedFields.address,
          memoValue: normalizedFields.memo,
        },
      },
    });

    if (
      createAttestationDto.attestationType ===
      AttestationType.DESTINATION_REVOCATION
    ) {
      if (!destination) {
        throw new BadRequestException(
          'Cannot revoke a destination that is not registered for the recipient.',
        );
      }

      return transaction.recipientDestination.update({
        where: { id: destination.id },
        data: {
          status: DestinationStatus.REVOKED,
          isDefault: false,
          revokedAt: timing.effectiveFrom,
          expiresAt: timing.expiresAt,
          lastAttestedAt: timing.issuedAt,
        },
      });
    }

    await transaction.recipientDestination.updateMany({
      where: {
        recipientId,
        assetNetworkId,
        status: DestinationStatus.ACTIVE,
        NOT: {
          addressNormalized: normalizedFields.address,
          memoValue: normalizedFields.memo,
        },
      },
      data: {
        status: DestinationStatus.REVOKED,
        isDefault: false,
        revokedAt: timing.effectiveFrom,
      },
    });

    destination = await transaction.recipientDestination.upsert({
      where: {
        recipientId_assetNetworkId_addressNormalized_memoValue: {
          recipientId,
          assetNetworkId,
          addressNormalized: normalizedFields.address,
          memoValue: normalizedFields.memo,
        },
      },
      update: {
        addressRaw: createAttestationDto.address,
        addressRawCiphertext: this.sealOptionalString(
          createAttestationDto.address,
        ),
        addressNormalizedBlindIndex: this.buildAddressBlindIndex(
          normalizedFields.address,
        ),
        status: DestinationStatus.ACTIVE,
        isDefault: true,
        effectiveFrom: timing.effectiveFrom,
        lastAttestedAt: timing.issuedAt,
        expiresAt: timing.expiresAt,
        revokedAt: null,
      },
      create: {
        recipientId,
        assetNetworkId,
        addressRaw: createAttestationDto.address,
        addressRawCiphertext: this.sealOptionalString(
          createAttestationDto.address,
        ),
        addressNormalized: normalizedFields.address,
        addressNormalizedBlindIndex: this.buildAddressBlindIndex(
          normalizedFields.address,
        ),
        memoValue: normalizedFields.memo,
        status: DestinationStatus.ACTIVE,
        isDefault: true,
        effectiveFrom: timing.effectiveFrom,
        lastAttestedAt: timing.issuedAt,
        expiresAt: timing.expiresAt,
      },
    });

    return destination;
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

  private buildAddressBlindIndex(normalizedAddress: string): string {
    return buildBlindIndex(
      normalizedAddress,
      this.configService.get('BLIND_INDEX_MASTER_SECRET', {
        infer: true,
      }),
    );
  }

  private buildAttestationWebhookPayload(
    webhookEventType: WebhookEventType,
    partner: string,
    attestationId: string,
    attestationType: AttestationType,
    recipientIdentifier: string,
    recipientDisplayName: string | null,
    chain: string,
    asset: string,
    address: string,
    memo: string,
    expiresAt: string | null,
    status: VerificationStatus,
    sequenceNumber: string,
  ): Prisma.InputJsonValue {
    return {
      eventType: webhookEventType,
      occurredAt: new Date().toISOString(),
      partner,
      recipientIdentifier,
      recipientDisplayName,
      attestationType,
      chain,
      asset,
      address,
      memo,
      expiresAt,
      attestationId,
      status,
      sequenceNumber,
    };
  }

  async listPartnerAttestations(
    partnerId: string,
    params: {
      asset?: string;
      attestationType?: AttestationType;
      chain?: string;
      limit: number;
      recipientId?: string;
      recipientIdentifier?: string;
      verificationStatus?: AttestationVerificationStatus;
    },
  ) {
    const attestations = await this.prismaService.attestation.findMany({
      where: {
        partnerId,
        ...(params.attestationType
          ? {
              attestationType: params.attestationType,
            }
          : {}),
        ...(params.recipientId
          ? {
              recipientId: params.recipientId,
            }
          : {}),
        ...(params.recipientIdentifier
          ? {
              recipientIdentifierSnapshot:
                this.normalizationService.normalizeIdentifier(
                  params.recipientIdentifier,
                ),
            }
          : {}),
        ...(params.verificationStatus
          ? {
              verificationStatus: params.verificationStatus,
            }
          : {}),
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
                        code: this.normalizationService.normalizeAssetCode(
                          params.asset,
                        ),
                      },
                    }
                  : {}),
              },
            }
          : {}),
      },
      include: {
        recipient: true,
        destination: true,
        assetNetwork: {
          include: {
            asset: true,
            chain: true,
          },
        },
        signingKey: true,
      },
      orderBy: [{ issuedAt: 'desc' }, { sequenceNumber: 'desc' }],
      take: params.limit,
    });

    return attestations.map((attestation) => ({
      id: attestation.id,
      attestationType: attestation.attestationType,
      verificationStatus: attestation.verificationStatus,
      recipientId: attestation.recipientId,
      recipientExternalId: attestation.recipient.externalRecipientId,
      recipientDisplayName: attestation.displayNameSnapshot,
      recipientIdentifier: attestation.recipientIdentifierSnapshot,
      chain: attestation.assetNetwork?.chain.slug ?? null,
      assetCode: attestation.assetNetwork?.asset.code ?? null,
      assetSymbol: attestation.assetNetwork?.asset.symbol ?? null,
      address: attestation.addressRaw,
      memo: attestation.memoValue || null,
      destinationId: attestation.destinationId,
      destinationStatus: attestation.destination?.status ?? null,
      keyId: attestation.signingKey.keyId,
      sequenceNumber: attestation.sequenceNumber.toString(),
      issuedAt: attestation.issuedAt.toISOString(),
      effectiveFrom: attestation.effectiveFrom.toISOString(),
      expiresAt: attestation.expiresAt?.toISOString() ?? null,
      verifiedAt: attestation.verifiedAt?.toISOString() ?? null,
      ingestedAt: attestation.ingestedAt.toISOString(),
    }));
  }

  async getPartnerAttestation(partnerId: string, attestationId: string) {
    const attestation = await this.prismaService.attestation.findFirst({
      where: {
        id: attestationId,
        partnerId,
      },
      include: {
        recipient: true,
        identifier: true,
        destination: true,
        assetNetwork: {
          include: {
            asset: true,
            chain: true,
          },
        },
        signingKey: true,
        supersedes: {
          select: {
            id: true,
          },
        },
        supersededBy: {
          select: {
            id: true,
          },
          orderBy: {
            issuedAt: 'desc',
          },
        },
      },
    });

    if (!attestation) {
      return null;
    }

    return {
      id: attestation.id,
      attestationType: attestation.attestationType,
      verificationStatus: attestation.verificationStatus,
      canonicalPayload: attestation.canonicalPayload,
      payload: attestation.payload,
      payloadHash: attestation.payloadHash,
      signature: attestation.signature,
      partnerId: attestation.partnerId,
      recipient: {
        id: attestation.recipient.id,
        externalRecipientId: attestation.recipient.externalRecipientId,
        displayName: attestation.displayNameSnapshot,
        identifier: attestation.recipientIdentifierSnapshot,
      },
      identifier: attestation.identifier
        ? {
            id: attestation.identifier.id,
            kind: attestation.identifier.kind,
            rawValue: attestation.identifier.rawValue,
            normalizedValue: attestation.identifier.normalizedValue,
          }
        : null,
      destination: attestation.destination
        ? {
            id: attestation.destination.id,
            address: attestation.destination.addressRaw,
            normalizedAddress: attestation.destination.addressNormalized,
            memoValue: attestation.destination.memoValue || null,
            status: attestation.destination.status,
          }
        : null,
      assetNetwork: attestation.assetNetwork
        ? {
            id: attestation.assetNetwork.id,
            chain: attestation.assetNetwork.chain.slug,
            chainDisplayName: attestation.assetNetwork.chain.displayName,
            assetCode: attestation.assetNetwork.asset.code,
            assetSymbol: attestation.assetNetwork.asset.symbol,
            tokenStandard: attestation.assetNetwork.standard,
          }
        : null,
      signingKey: {
        id: attestation.signingKey.id,
        keyId: attestation.signingKey.keyId,
        algorithm: attestation.signingKey.algorithm,
        fingerprint: attestation.signingKey.fingerprint,
      },
      sequenceNumber: attestation.sequenceNumber.toString(),
      issuedAt: attestation.issuedAt.toISOString(),
      effectiveFrom: attestation.effectiveFrom.toISOString(),
      expiresAt: attestation.expiresAt?.toISOString() ?? null,
      verifiedAt: attestation.verifiedAt?.toISOString() ?? null,
      revokedAt: attestation.revokedAt?.toISOString() ?? null,
      ingestedAt: attestation.ingestedAt.toISOString(),
      supersedesAttestationId: attestation.supersedes?.id ?? null,
      supersededByAttestationIds: attestation.supersededBy.map(
        (nextAttestation) => nextAttestation.id,
      ),
    };
  }

  private async recordFailedAttestationIngestion(
    createAttestationDto: CreateAttestationDto,
    authenticatedPartner: AuthenticatedPartner,
    error: unknown,
    normalizedFields: NormalizedAttestationFields | null,
    materializedSensitiveFields: Pick<
      ResolvedCreateAttestationDto,
      'recipientIdentifier' | 'address'
    > | null,
  ) {
    try {
      const auditContext = this.buildAuditActorContext(authenticatedPartner);
      const recipientIdentifier =
        normalizedFields?.recipientIdentifier ??
        materializedSensitiveFields?.recipientIdentifier ??
        this.describeSubmittedSensitiveValue({
          plainValue: createAttestationDto.recipientIdentifier,
          encryptedValue: createAttestationDto.recipientIdentifierEncrypted,
          encryptedLabel: '[encrypted recipient identifier]',
          missingLabel: '[missing recipient identifier]',
        });

      await this.auditService.recordEvent({
        actorType: auditContext.actorType,
        actorPartnerId: auditContext.actorPartnerId,
        subjectPartnerId: authenticatedPartner.partnerId,
        actorIdentifier: auditContext.actorIdentifier,
        action: 'attestation.ingest_failed',
        entityType: 'AttestationIngestion',
        entityId:
          normalizedFields?.payloadHash ??
          `${authenticatedPartner.partnerId}:${createAttestationDto.sequenceNumber}`,
        summary: `Rejected ${createAttestationDto.attestationType.toLowerCase()} attestation for '${recipientIdentifier}'.`,
        metadata: {
          algorithm: createAttestationDto.algorithm,
          asset:
            normalizedFields?.assetSymbol ??
            createAttestationDto.assetSymbol.trim(),
          assetCode:
            normalizedFields?.assetCode ??
            createAttestationDto.assetCode.trim(),
          attestationType: createAttestationDto.attestationType,
          chain: normalizedFields?.chain ?? createAttestationDto.chain.trim(),
          error: this.stringifyError(error),
          keyId: createAttestationDto.keyId.trim(),
          partnerSlug:
            normalizedFields?.partnerSlug ?? createAttestationDto.partnerSlug,
          recipientExternalId: createAttestationDto.recipientExternalId.trim(),
          recipientIdentifier,
          sequenceNumber: createAttestationDto.sequenceNumber,
        },
      });
    } catch {
      return;
    }
  }

  private buildAuditActorContext(authenticatedPartner: AuthenticatedPartner): {
    actorIdentifier: string;
    actorPartnerId: string;
    actorType: AuditActorType;
  } {
    return {
      actorType:
        authenticatedPartner.actorType === 'PARTNER_USER'
          ? AuditActorType.USER
          : AuditActorType.PARTNER,
      actorPartnerId: authenticatedPartner.partnerId,
      actorIdentifier: authenticatedPartner.actorIdentifier,
    };
  }

  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown attestation ingestion error.';
  }

  private async resolveSensitiveAttestationFields(
    createAttestationDto: CreateAttestationDto,
    loadEncryptedSubmissionPolicy: () => Promise<PartnerEncryptedSubmissionPolicy>,
  ): Promise<ResolvedCreateAttestationDto> {
    const recipientIdentifier = await this.readSensitiveInput({
      plainValue: createAttestationDto.recipientIdentifier,
      encryptedValue: createAttestationDto.recipientIdentifierEncrypted,
      loadEncryptedSubmissionPolicy,
      fieldLabel: 'Recipient identifier',
      maxLength: 128,
    });
    const address = await this.readSensitiveInput({
      plainValue: createAttestationDto.address,
      encryptedValue: createAttestationDto.addressEncrypted,
      loadEncryptedSubmissionPolicy,
      fieldLabel: 'Address',
    });

    return {
      ...createAttestationDto,
      recipientIdentifier,
      address,
    };
  }

  private async readSensitiveInput(params: {
    plainValue: string | null | undefined;
    encryptedValue: EncryptedFieldDto | null | undefined;
    loadEncryptedSubmissionPolicy: () => Promise<PartnerEncryptedSubmissionPolicy>;
    fieldLabel: string;
    maxLength?: number;
  }): Promise<string> {
    const plainValue = params.plainValue?.trim() || null;

    if (plainValue && params.encryptedValue) {
      throw new BadRequestException(
        `${params.fieldLabel} must be submitted either as plaintext or encrypted, not both.`,
      );
    }

    if (!plainValue && !params.encryptedValue) {
      throw new BadRequestException(`${params.fieldLabel} is required.`);
    }

    const value = params.encryptedValue
      ? this.encryptedSubmissionService.openField(
          params.encryptedValue,
          await params.loadEncryptedSubmissionPolicy(),
          params.fieldLabel,
        )
      : plainValue;

    if (!value || value.trim().length === 0) {
      throw new BadRequestException(`${params.fieldLabel} is required.`);
    }

    const trimmedValue = value.trim();

    if (
      params.maxLength !== undefined &&
      trimmedValue.length > params.maxLength
    ) {
      throw new BadRequestException(
        `${params.fieldLabel} must be at most ${params.maxLength} characters.`,
      );
    }

    return trimmedValue;
  }

  private createEncryptedSubmissionPolicyLoader(partnerId: string) {
    let encryptedSubmissionPolicyPromise: Promise<PartnerEncryptedSubmissionPolicy> | null =
      null;

    return () => {
      if (!encryptedSubmissionPolicyPromise) {
        encryptedSubmissionPolicyPromise =
          this.encryptedSubmissionService.getPartnerPolicy(partnerId);
      }

      return encryptedSubmissionPolicyPromise;
    };
  }

  private describeSubmittedSensitiveValue(params: {
    plainValue: string | null | undefined;
    encryptedValue: EncryptedFieldDto | null | undefined;
    encryptedLabel: string;
    missingLabel: string;
  }): string {
    const plainValue = params.plainValue?.trim();

    if (plainValue) {
      return plainValue;
    }

    if (params.encryptedValue) {
      return params.encryptedLabel;
    }

    return params.missingLabel;
  }
}
