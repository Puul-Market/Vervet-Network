import { Injectable } from '@nestjs/common';
import {
  AttestationType,
  DeliveryStatus,
  DestinationStatus,
  PartnerFeedHealthStatus,
  Prisma,
  SigningKeyStatus,
  VerificationStatus,
  WebhookStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const destinationFreshnessWindowDays = 14;
const attestationExpiryWindowDays = 7;
const recentOperationalWindowDays = 7;

@Injectable()
export class DataFeedHealthService {
  constructor(private readonly prismaService: PrismaService) {}

  async getPartnerDataFeedHealth(partnerId: string) {
    const now = new Date();
    const recentWindowStart = new Date(
      now.getTime() - recentOperationalWindowDays * 24 * 60 * 60 * 1000,
    );
    const destinationFreshnessThreshold = new Date(
      now.getTime() - destinationFreshnessWindowDays * 24 * 60 * 60 * 1000,
    );
    const attestationExpiryThreshold = new Date(
      now.getTime() + attestationExpiryWindowDays * 24 * 60 * 60 * 1000,
    );

    const activeDestinationWhere: Prisma.RecipientDestinationWhereInput = {
      recipient: {
        partnerId,
      },
      status: DestinationStatus.ACTIVE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    const staleDestinationWhere: Prisma.RecipientDestinationWhereInput = {
      recipient: {
        partnerId,
      },
      status: DestinationStatus.ACTIVE,
      OR: [
        { lastAttestedAt: null },
        { lastAttestedAt: { lt: destinationFreshnessThreshold } },
        {
          expiresAt: {
            not: null,
            lte: attestationExpiryThreshold,
          },
        },
      ],
    };

    const activeVerifiedAttestationWhere: Prisma.AttestationWhereInput = {
      partnerId,
      verificationStatus: VerificationStatus.VERIFIED,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    const staleAttestationWhere: Prisma.AttestationWhereInput = {
      partnerId,
      OR: [
        {
          verificationStatus: VerificationStatus.EXPIRED,
        },
        {
          verificationStatus: VerificationStatus.VERIFIED,
          revokedAt: null,
          expiresAt: {
            not: null,
            lte: attestationExpiryThreshold,
          },
        },
      ],
    };

    const [
      partner,
      activeDestinationCount,
      activeAttestationCount,
      activeSigningKeyCount,
      activeWebhookCount,
      lastAttestation,
      lastRevocation,
      staleDestinationCount,
      staleDestinations,
      staleAttestationCount,
      staleAttestations,
      totalDeliveryCount7d,
      failedDeliveryCount7d,
      pendingDeliveryCount,
      recentTrustEvents,
      recentDeliveryFailures,
      recentIngestionAuditLogs,
      recentIngestionSuccessCount7d,
      recentIngestionFailureCount7d,
      recentWebhookTestFailures,
      grantedProductionCorridors,
      activeDestinationCountsByCorridor,
      staleDestinationCountsByCorridor,
      verifiedAttestationCountsByCorridor,
      staleAttestationCountsByCorridor,
      recentIngestionCountsByCorridor,
      lastAttestationByCorridor,
      lastRevocationByCorridor,
    ] = await Promise.all([
      this.prismaService.partner.findUniqueOrThrow({
        where: {
          id: partnerId,
        },
        select: {
          id: true,
          slug: true,
          displayName: true,
          onboardingStage: true,
          feedHealthStatus: true,
          productionEnabled: true,
          sandboxEnabled: true,
          webhooksEnabled: true,
        },
      }),
      this.prismaService.recipientDestination.count({
        where: activeDestinationWhere,
      }),
      this.prismaService.attestation.count({
        where: activeVerifiedAttestationWhere,
      }),
      this.prismaService.partnerSigningKey.count({
        where: {
          partnerId,
          status: SigningKeyStatus.ACTIVE,
          revokedAt: null,
        },
      }),
      this.prismaService.webhookEndpoint.count({
        where: {
          partnerId,
          status: {
            in: [WebhookStatus.ACTIVE, WebhookStatus.PAUSED],
          },
        },
      }),
      this.prismaService.attestation.findFirst({
        where: {
          partnerId,
        },
        orderBy: {
          ingestedAt: 'desc',
        },
        select: {
          ingestedAt: true,
        },
      }),
      this.prismaService.attestation.findFirst({
        where: {
          partnerId,
          revokedAt: {
            not: null,
          },
        },
        orderBy: {
          revokedAt: 'desc',
        },
        select: {
          revokedAt: true,
        },
      }),
      this.prismaService.recipientDestination.count({
        where: staleDestinationWhere,
      }),
      this.prismaService.recipientDestination.findMany({
        where: staleDestinationWhere,
        include: {
          recipient: {
            select: {
              id: true,
              externalRecipientId: true,
              displayName: true,
            },
          },
          assetNetwork: {
            include: {
              asset: {
                select: {
                  symbol: true,
                },
              },
              chain: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: [{ lastAttestedAt: 'asc' }, { updatedAt: 'asc' }],
        take: 8,
      }),
      this.prismaService.attestation.count({
        where: staleAttestationWhere,
      }),
      this.prismaService.attestation.findMany({
        where: staleAttestationWhere,
        select: {
          id: true,
          attestationType: true,
          verificationStatus: true,
          recipientIdentifierSnapshot: true,
          displayNameSnapshot: true,
          issuedAt: true,
          ingestedAt: true,
          expiresAt: true,
          revokedAt: true,
          assetNetwork: {
            select: {
              asset: {
                select: {
                  symbol: true,
                },
              },
              chain: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: [{ expiresAt: 'asc' }, { ingestedAt: 'desc' }],
        take: 8,
      }),
      this.prismaService.webhookDelivery.count({
        where: {
          endpoint: {
            partnerId,
          },
          createdAt: {
            gte: recentWindowStart,
          },
        },
      }),
      this.prismaService.webhookDelivery.count({
        where: {
          endpoint: {
            partnerId,
          },
          createdAt: {
            gte: recentWindowStart,
          },
          status: {
            in: [DeliveryStatus.FAILED, DeliveryStatus.ABANDONED],
          },
        },
      }),
      this.prismaService.webhookDelivery.count({
        where: {
          endpoint: {
            partnerId,
          },
          status: {
            in: [DeliveryStatus.PENDING, DeliveryStatus.PROCESSING],
          },
        },
      }),
      this.prismaService.attestation.findMany({
        where: {
          partnerId,
        },
        orderBy: {
          ingestedAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          attestationType: true,
          verificationStatus: true,
          recipientIdentifierSnapshot: true,
          displayNameSnapshot: true,
          addressRaw: true,
          issuedAt: true,
          verifiedAt: true,
          revokedAt: true,
          ingestedAt: true,
          assetNetwork: {
            select: {
              asset: {
                select: {
                  symbol: true,
                },
              },
              chain: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      }),
      this.prismaService.webhookDelivery.findMany({
        where: {
          endpoint: {
            partnerId,
          },
          createdAt: {
            gte: recentWindowStart,
          },
          status: {
            in: [DeliveryStatus.FAILED, DeliveryStatus.ABANDONED],
          },
        },
        include: {
          endpoint: {
            select: {
              label: true,
              url: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 8,
      }),
      this.prismaService.auditLog.findMany({
        where: {
          subjectPartnerId: partnerId,
          action: {
            in: ['attestation.ingested', 'attestation.ingest_failed'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
        select: {
          id: true,
          action: true,
          entityId: true,
          summary: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prismaService.auditLog.count({
        where: {
          subjectPartnerId: partnerId,
          action: 'attestation.ingested',
          createdAt: {
            gte: recentWindowStart,
          },
        },
      }),
      this.prismaService.auditLog.count({
        where: {
          subjectPartnerId: partnerId,
          action: 'attestation.ingest_failed',
          createdAt: {
            gte: recentWindowStart,
          },
        },
      }),
      this.prismaService.auditLog.findMany({
        where: {
          subjectPartnerId: partnerId,
          action: 'webhook.endpoint.test_failed',
          createdAt: {
            gte: recentWindowStart,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 6,
        select: {
          id: true,
          entityId: true,
          summary: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prismaService.partnerProductionCorridor.findMany({
        where: {
          partnerId,
          status: 'GRANTED',
        },
        select: {
          assetNetworkId: true,
        },
      }),
      this.prismaService.recipientDestination.groupBy({
        by: ['assetNetworkId'],
        where: activeDestinationWhere,
        _count: {
          _all: true,
        },
      }),
      this.prismaService.recipientDestination.groupBy({
        by: ['assetNetworkId'],
        where: staleDestinationWhere,
        _count: {
          _all: true,
        },
      }),
      this.prismaService.attestation.groupBy({
        by: ['assetNetworkId'],
        where: {
          ...activeVerifiedAttestationWhere,
          assetNetworkId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
      this.prismaService.attestation.groupBy({
        by: ['assetNetworkId'],
        where: {
          ...staleAttestationWhere,
          assetNetworkId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
      this.prismaService.attestation.groupBy({
        by: ['assetNetworkId'],
        where: {
          partnerId,
          assetNetworkId: {
            not: null,
          },
          ingestedAt: {
            gte: recentWindowStart,
          },
        },
        _count: {
          _all: true,
        },
      }),
      this.prismaService.attestation.groupBy({
        by: ['assetNetworkId'],
        where: {
          partnerId,
          assetNetworkId: {
            not: null,
          },
        },
        _max: {
          ingestedAt: true,
        },
      }),
      this.prismaService.attestation.groupBy({
        by: ['assetNetworkId'],
        where: {
          partnerId,
          assetNetworkId: {
            not: null,
          },
          revokedAt: {
            not: null,
          },
        },
        _max: {
          revokedAt: true,
        },
      }),
    ]);

    const activeDestinationCounts = this.buildCountMap(
      activeDestinationCountsByCorridor,
    );
    const staleDestinationCounts = this.buildCountMap(
      staleDestinationCountsByCorridor,
    );
    const verifiedAttestationCounts = this.buildCountMap(
      verifiedAttestationCountsByCorridor,
    );
    const staleAttestationCounts = this.buildCountMap(
      staleAttestationCountsByCorridor,
    );
    const recentIngestionCounts = this.buildCountMap(
      recentIngestionCountsByCorridor,
    );
    const lastAttestationDates = this.buildDateMap(
      lastAttestationByCorridor,
      (record) => record._max.ingestedAt,
    );
    const lastRevocationDates = this.buildDateMap(
      lastRevocationByCorridor,
      (record) => record._max.revokedAt,
    );
    const grantedProductionCorridorIds = new Set(
      grantedProductionCorridors.map((corridor) => corridor.assetNetworkId),
    );

    const corridorIds = new Set<string>([
      ...activeDestinationCounts.keys(),
      ...staleDestinationCounts.keys(),
      ...verifiedAttestationCounts.keys(),
      ...staleAttestationCounts.keys(),
      ...recentIngestionCounts.keys(),
      ...lastAttestationDates.keys(),
      ...lastRevocationDates.keys(),
      ...grantedProductionCorridorIds,
    ]);

    const assetNetworks =
      corridorIds.size === 0
        ? []
        : await this.prismaService.assetNetwork.findMany({
            where: {
              id: {
                in: Array.from(corridorIds),
              },
            },
            select: {
              id: true,
              contractAddressRaw: true,
              chain: {
                select: {
                  slug: true,
                  displayName: true,
                },
              },
              asset: {
                select: {
                  symbol: true,
                  displayName: true,
                },
              },
            },
          });

    const corridors = assetNetworks
      .map((assetNetwork) => {
        const activeDestinationTotal =
          activeDestinationCounts.get(assetNetwork.id) ?? 0;
        const staleDestinationTotal =
          staleDestinationCounts.get(assetNetwork.id) ?? 0;
        const verifiedAttestationTotal =
          verifiedAttestationCounts.get(assetNetwork.id) ?? 0;
        const staleAttestationTotal =
          staleAttestationCounts.get(assetNetwork.id) ?? 0;
        const recentIngestionTotal =
          recentIngestionCounts.get(assetNetwork.id) ?? 0;
        const productionGranted = grantedProductionCorridorIds.has(
          assetNetwork.id,
        );
        const status = this.resolveCorridorHealthStatus({
          activeDestinationCount: activeDestinationTotal,
          productionGranted,
          staleAttestationCount: staleAttestationTotal,
          staleDestinationCount: staleDestinationTotal,
          verifiedAttestationCount: verifiedAttestationTotal,
        });

        return {
          assetNetworkId: assetNetwork.id,
          chain: assetNetwork.chain.slug,
          chainDisplayName: assetNetwork.chain.displayName,
          asset: assetNetwork.asset.symbol,
          assetDisplayName: assetNetwork.asset.displayName,
          contractAddress: assetNetwork.contractAddressRaw?.trim() || null,
          productionGranted,
          activeDestinationCount: activeDestinationTotal,
          staleDestinationCount: staleDestinationTotal,
          verifiedAttestationCount: verifiedAttestationTotal,
          staleAttestationCount: staleAttestationTotal,
          recentIngestionCount7d: recentIngestionTotal,
          lastAttestationReceivedAt:
            lastAttestationDates.get(assetNetwork.id) ?? null,
          lastRevocationReceivedAt:
            lastRevocationDates.get(assetNetwork.id) ?? null,
          status,
          statusLabel: this.resolveCorridorHealthStatusLabel(
            status,
            productionGranted,
          ),
        };
      })
      .sort((left, right) => {
        const leftSeverity = this.resolveCorridorStatusSeverity(left.status);
        const rightSeverity = this.resolveCorridorStatusSeverity(right.status);

        if (leftSeverity !== rightSeverity) {
          return leftSeverity - rightSeverity;
        }

        if (left.productionGranted !== right.productionGranted) {
          return left.productionGranted ? -1 : 1;
        }

        return (
          right.activeDestinationCount +
          right.verifiedAttestationCount -
          (left.activeDestinationCount + left.verifiedAttestationCount)
        );
      });

    const degradedCorridorCount = corridors.filter(
      (corridor) => corridor.status === PartnerFeedHealthStatus.DEGRADED,
    ).length;
    const disconnectedCorridorCount = corridors.filter(
      (corridor) => corridor.status === PartnerFeedHealthStatus.DISCONNECTED,
    ).length;

    return {
      partner: {
        id: partner.id,
        slug: partner.slug,
        displayName: partner.displayName,
      },
      feed: {
        status: partner.feedHealthStatus,
        statusLabel: this.resolveFeedStatusLabel(partner.feedHealthStatus),
        onboardingStage: partner.onboardingStage,
        environment: this.resolveEnvironment(
          partner.productionEnabled,
          partner.sandboxEnabled,
        ),
        lastAttestationReceivedAt:
          lastAttestation?.ingestedAt.toISOString() ?? null,
        lastRevocationReceivedAt:
          lastRevocation?.revokedAt?.toISOString() ?? null,
      },
      metrics: {
        activeDestinationCount,
        activeAttestationCount,
        activeSigningKeyCount,
        activeWebhookCount,
        staleDestinationCount,
        staleAttestationCount,
        failedDeliveryCount7d,
        pendingDeliveryCount,
        deliverySuccessRate7d: this.calculateDeliverySuccessRate(
          totalDeliveryCount7d,
          failedDeliveryCount7d,
        ),
        recentIngestionSuccessCount7d,
        recentIngestionFailureCount7d,
        degradedCorridorCount,
        disconnectedCorridorCount,
      },
      freshness: {
        destinationFreshnessWindowDays,
        attestationExpiryWindowDays,
        staleDestinations: staleDestinations.map((destination) => ({
          id: destination.id,
          recipientId: destination.recipient.id,
          recipientIdentifier: destination.recipient.externalRecipientId,
          recipientDisplayName:
            destination.recipient.displayName ??
            destination.recipient.externalRecipientId,
          address: destination.addressRaw,
          chain: destination.assetNetwork.chain.slug,
          asset: destination.assetNetwork.asset.symbol,
          status: destination.status,
          lastAttestedAt: destination.lastAttestedAt?.toISOString() ?? null,
          expiresAt: destination.expiresAt?.toISOString() ?? null,
          updatedAt: destination.updatedAt.toISOString(),
        })),
        staleAttestations: staleAttestations.map((attestation) => ({
          id: attestation.id,
          attestationType: attestation.attestationType,
          verificationStatus: attestation.verificationStatus,
          recipientIdentifier: attestation.recipientIdentifierSnapshot,
          recipientDisplayName:
            attestation.displayNameSnapshot ??
            attestation.recipientIdentifierSnapshot,
          chain: attestation.assetNetwork?.chain.slug ?? null,
          asset: attestation.assetNetwork?.asset.symbol ?? null,
          issuedAt: attestation.issuedAt.toISOString(),
          ingestedAt: attestation.ingestedAt.toISOString(),
          expiresAt: attestation.expiresAt?.toISOString() ?? null,
          revokedAt: attestation.revokedAt?.toISOString() ?? null,
        })),
      },
      ingestion: {
        recentActivity: recentIngestionAuditLogs
          .filter((record) => record.action === 'attestation.ingested')
          .map((record) =>
            this.buildIngestionHistoryRecord(record, 'SUCCEEDED'),
          ),
        recentFailures: recentIngestionAuditLogs
          .filter((record) => record.action === 'attestation.ingest_failed')
          .map((record) => this.buildIngestionHistoryRecord(record, 'FAILED')),
      },
      corridors,
      recentTrustEvents: recentTrustEvents.map((attestation) => ({
        id: attestation.id,
        eventType: this.resolveTrustEventType(attestation.attestationType),
        verificationStatus: attestation.verificationStatus,
        recipientIdentifier: attestation.recipientIdentifierSnapshot,
        recipientDisplayName:
          attestation.displayNameSnapshot ??
          attestation.recipientIdentifierSnapshot,
        address: attestation.addressRaw,
        chain: attestation.assetNetwork?.chain.slug ?? null,
        asset: attestation.assetNetwork?.asset.symbol ?? null,
        occurredAt: this.resolveTrustEventTimestamp(attestation),
      })),
      deliveryFailures: recentDeliveryFailures.map((delivery) => ({
        id: delivery.id,
        endpointLabel: delivery.endpoint.label,
        endpointUrl: delivery.endpoint.url,
        eventType: delivery.eventType,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        responseCode: delivery.responseCode,
        lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
        nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
      })),
      eventHealth: {
        webhookTestFailures: recentWebhookTestFailures.map((record) =>
          this.buildWebhookTestFailureRecord(record),
        ),
      },
      recommendedActions: this.buildRecommendedActions({
        activeSigningKeyCount,
        activeWebhookCount,
        degradedCorridorCount,
        disconnectedCorridorCount,
        failedDeliveryCount7d,
        partnerFeedHealthStatus: partner.feedHealthStatus,
        recentIngestionFailureCount7d,
        staleAttestationCount,
        staleDestinationCount,
        webhooksEnabled: partner.webhooksEnabled,
      }),
    };
  }

  private calculateDeliverySuccessRate(
    totalDeliveryCount: number,
    failedDeliveryCount: number,
  ) {
    if (totalDeliveryCount === 0) {
      return 100;
    }

    return Math.max(
      0,
      Math.round(
        ((totalDeliveryCount - failedDeliveryCount) / totalDeliveryCount) * 100,
      ),
    );
  }

  private resolveEnvironment(
    productionEnabled: boolean,
    sandboxEnabled: boolean,
  ) {
    if (productionEnabled) {
      return 'PRODUCTION_APPROVED';
    }

    if (sandboxEnabled) {
      return 'SANDBOX_ONLY';
    }

    return 'RESTRICTED';
  }

  private resolveFeedStatusLabel(status: PartnerFeedHealthStatus) {
    switch (status) {
      case PartnerFeedHealthStatus.HEALTHY:
        return 'Healthy feed';
      case PartnerFeedHealthStatus.DEGRADED:
        return 'Degraded feed health';
      case PartnerFeedHealthStatus.DISCONNECTED:
        return 'Feed disconnected';
      case PartnerFeedHealthStatus.UNKNOWN:
      default:
        return 'Feed health unknown';
    }
  }

  private resolveTrustEventType(attestationType: AttestationType) {
    switch (attestationType) {
      case AttestationType.DESTINATION_ASSIGNMENT:
        return 'Destination assignment';
      case AttestationType.DESTINATION_ROTATION:
        return 'Destination rotation';
      case AttestationType.DESTINATION_REVOCATION:
        return 'Destination revocation';
      case AttestationType.IDENTIFIER_BINDING:
      default:
        return 'Identifier binding';
    }
  }

  private resolveTrustEventTimestamp(attestation: {
    ingestedAt: Date;
    revokedAt: Date | null;
    verifiedAt: Date | null;
  }) {
    return (
      attestation.revokedAt?.toISOString() ??
      attestation.verifiedAt?.toISOString() ??
      attestation.ingestedAt.toISOString()
    );
  }

  private resolveCorridorHealthStatus(params: {
    activeDestinationCount: number;
    productionGranted: boolean;
    staleAttestationCount: number;
    staleDestinationCount: number;
    verifiedAttestationCount: number;
  }) {
    if (
      params.activeDestinationCount === 0 &&
      params.verifiedAttestationCount === 0
    ) {
      return params.productionGranted
        ? PartnerFeedHealthStatus.DISCONNECTED
        : PartnerFeedHealthStatus.UNKNOWN;
    }

    if (params.staleDestinationCount > 0 || params.staleAttestationCount > 0) {
      return PartnerFeedHealthStatus.DEGRADED;
    }

    return PartnerFeedHealthStatus.HEALTHY;
  }

  private resolveCorridorHealthStatusLabel(
    status: PartnerFeedHealthStatus,
    productionGranted: boolean,
  ) {
    switch (status) {
      case PartnerFeedHealthStatus.HEALTHY:
        return 'Fresh destinations and verified attestations are available for this corridor.';
      case PartnerFeedHealthStatus.DEGRADED:
        return 'This corridor has stale destinations or attestations that need review.';
      case PartnerFeedHealthStatus.DISCONNECTED:
        return productionGranted
          ? 'Production access is granted, but no live trust data is currently flowing for this corridor.'
          : 'This corridor has no live trust data.';
      case PartnerFeedHealthStatus.UNKNOWN:
      default:
        return 'This corridor has not built enough trust data to assess freshness yet.';
    }
  }

  private resolveCorridorStatusSeverity(status: PartnerFeedHealthStatus) {
    switch (status) {
      case PartnerFeedHealthStatus.DISCONNECTED:
        return 0;
      case PartnerFeedHealthStatus.DEGRADED:
        return 1;
      case PartnerFeedHealthStatus.HEALTHY:
        return 2;
      case PartnerFeedHealthStatus.UNKNOWN:
      default:
        return 3;
    }
  }

  private buildRecommendedActions(params: {
    partnerFeedHealthStatus: PartnerFeedHealthStatus;
    activeSigningKeyCount: number;
    activeWebhookCount: number;
    staleDestinationCount: number;
    staleAttestationCount: number;
    failedDeliveryCount7d: number;
    recentIngestionFailureCount7d: number;
    degradedCorridorCount: number;
    disconnectedCorridorCount: number;
    webhooksEnabled: boolean;
  }) {
    const recommendations = [];

    if (params.activeSigningKeyCount === 0) {
      recommendations.push({
        key: 'register_signing_key',
        title: 'Register a signing key',
        description:
          'Trust updates cannot be verified until at least one active signing key is registered.',
        href: '/access/signing-keys',
      });
    }

    if (params.webhooksEnabled && params.activeWebhookCount === 0) {
      recommendations.push({
        key: 'configure_webhook',
        title: 'Configure feed webhooks',
        description:
          'Create at least one webhook endpoint so feed lifecycle issues are surfaced immediately.',
        href: '/webhooks',
      });
    }

    if (params.recentIngestionFailureCount7d > 0) {
      recommendations.push({
        key: 'review_ingestion_failures',
        title: 'Review ingestion failures',
        description:
          'Recent attestation-ingestion failures may indicate signing, corridor, or payload issues upstream.',
        href: '/data-feed-health',
      });
    }

    if (
      params.degradedCorridorCount > 0 ||
      params.disconnectedCorridorCount > 0
    ) {
      recommendations.push({
        key: 'review_corridor_health',
        title: 'Review corridor health',
        description:
          'One or more production or mapped corridors are degraded or disconnected.',
        href: '/data-feed-health',
      });
    }

    if (params.staleDestinationCount > 0) {
      recommendations.push({
        key: 'review_stale_destinations',
        title: 'Review stale destinations',
        description:
          'Some active destinations have not been refreshed recently or are approaching expiry.',
        href: '/destinations',
      });
    }

    if (params.staleAttestationCount > 0) {
      recommendations.push({
        key: 'review_stale_attestations',
        title: 'Review stale attestations',
        description:
          'Verified attestations are nearing expiry or have already expired and need attention.',
        href: '/attestations',
      });
    }

    if (params.failedDeliveryCount7d > 0) {
      recommendations.push({
        key: 'review_delivery_failures',
        title: 'Investigate delivery failures',
        description:
          'Recent webhook delivery failures may hide downstream feed-health problems.',
        href: '/webhooks/deliveries',
      });
    }

    if (
      params.partnerFeedHealthStatus === PartnerFeedHealthStatus.DEGRADED ||
      params.partnerFeedHealthStatus === PartnerFeedHealthStatus.DISCONNECTED
    ) {
      recommendations.unshift({
        key: 'resolve_feed_health',
        title: 'Resolve degraded feed health',
        description:
          'Your organization is currently marked as degraded or disconnected. Review stale data, delivery failures, and readiness before going live.',
        href: '/setup',
      });
    }

    return recommendations.slice(0, 6);
  }

  private buildCountMap(
    records: Array<{
      assetNetworkId: string | null;
      _count: {
        _all: number;
      };
    }>,
  ) {
    const map = new Map<string, number>();

    for (const record of records) {
      if (!record.assetNetworkId) {
        continue;
      }

      map.set(record.assetNetworkId, record._count._all);
    }

    return map;
  }

  private buildDateMap<T extends { assetNetworkId: string | null }>(
    records: T[],
    getDate: (record: T) => Date | null | undefined,
  ) {
    const map = new Map<string, string | null>();

    for (const record of records) {
      if (!record.assetNetworkId) {
        continue;
      }

      map.set(record.assetNetworkId, getDate(record)?.toISOString() ?? null);
    }

    return map;
  }

  private buildIngestionHistoryRecord(
    record: {
      id: string;
      entityId: string;
      summary: string | null;
      metadata: Prisma.JsonValue;
      createdAt: Date;
    },
    status: 'FAILED' | 'SUCCEEDED',
  ) {
    const metadata = this.readMetadataRecord(record.metadata);

    return {
      id: record.id,
      entityId: record.entityId,
      status,
      summary: record.summary,
      attestationType: this.readMetadataString(metadata, 'attestationType'),
      recipientIdentifier: this.readMetadataString(
        metadata,
        'recipientIdentifier',
      ),
      chain: this.readMetadataString(metadata, 'chain'),
      asset: this.readMetadataString(metadata, 'asset'),
      keyId: this.readMetadataString(metadata, 'keyId'),
      sequenceNumber: this.readMetadataString(metadata, 'sequenceNumber'),
      failureReason: this.readMetadataString(metadata, 'error'),
      occurredAt: record.createdAt.toISOString(),
    };
  }

  private buildWebhookTestFailureRecord(record: {
    id: string;
    entityId: string;
    summary: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }) {
    const metadata = this.readMetadataRecord(record.metadata);

    return {
      id: record.id,
      endpointId: record.entityId,
      summary: record.summary,
      error: this.readMetadataString(metadata, 'error'),
      occurredAt: record.createdAt.toISOString(),
    };
  }

  private readMetadataRecord(metadata: Prisma.JsonValue) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {} as Record<string, Prisma.JsonValue>;
    }

    return metadata as Record<string, Prisma.JsonValue>;
  }

  private readMetadataString(
    metadata: Record<string, Prisma.JsonValue>,
    key: string,
  ) {
    const value = metadata[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }
}
