import { Injectable } from '@nestjs/common';
import {
  DeliveryStatus,
  DestinationStatus,
  QueryType,
  RecipientStatus,
  RiskLevel,
  SigningKeyStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OverviewService {
  constructor(private readonly prismaService: PrismaService) {}

  async getPartnerOverview(partnerId: string) {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      activeRecipients,
      activeDestinations,
      activeAttestations,
      byRecipientRequests7d,
      byAddressRequests7d,
      verifyTransferRequests7d,
      blockedVerificationCount,
      webhookFailureCount,
      highRiskVerifications,
      revokedDestinations,
      expiringAttestations,
      failedWebhookDeliveries,
      recentActivity,
      recentAuditEvents,
      webhookStats,
      byRecipientResolutionStats,
      byAddressResolutionStats,
      activeSigningKeys,
    ] = await Promise.all([
      this.prismaService.recipient.count({
        where: {
          partnerId,
          status: RecipientStatus.ACTIVE,
        },
      }),
      this.prismaService.recipientDestination.count({
        where: {
          recipient: {
            partnerId,
          },
          status: DestinationStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prismaService.attestation.count({
        where: {
          partnerId,
          verificationStatus: VerificationStatus.VERIFIED,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prismaService.resolutionRequest.count({
        where: {
          requesterPartnerId: partnerId,
          requestedAt: {
            gte: last7Days,
          },
          queryType: QueryType.RESOLVE,
        },
      }),
      this.prismaService.resolutionRequest.count({
        where: {
          requesterPartnerId: partnerId,
          requestedAt: {
            gte: last7Days,
          },
          queryType: QueryType.CONFIRM_ADDRESS,
        },
      }),
      this.prismaService.resolutionRequest.count({
        where: {
          requesterPartnerId: partnerId,
          requestedAt: {
            gte: last7Days,
          },
          queryType: QueryType.VERIFY_ADDRESS,
        },
      }),
      this.prismaService.resolutionRequest.count({
        where: {
          requesterPartnerId: partnerId,
          requestedAt: {
            gte: last7Days,
          },
          OR: [
            { riskLevel: RiskLevel.HIGH },
            { riskLevel: RiskLevel.CRITICAL },
          ],
        },
      }),
      this.prismaService.webhookDelivery.count({
        where: {
          endpoint: {
            partnerId,
          },
          createdAt: {
            gte: last7Days,
          },
          status: {
            in: [DeliveryStatus.FAILED, DeliveryStatus.ABANDONED],
          },
        },
      }),
      this.prismaService.resolutionRequest.findMany({
        where: {
          requesterPartnerId: partnerId,
          requestedAt: {
            gte: last7Days,
          },
          OR: [
            { riskLevel: RiskLevel.HIGH },
            { riskLevel: RiskLevel.CRITICAL },
          ],
        },
        orderBy: {
          requestedAt: 'desc',
        },
        take: 8,
        select: {
          id: true,
          queryType: true,
          platformInput: true,
          recipientIdentifierInput: true,
          chainInput: true,
          assetInput: true,
          outcome: true,
          riskLevel: true,
          recommendation: true,
          flags: true,
          requestedAt: true,
        },
      }),
      this.prismaService.recipientDestination.findMany({
        where: {
          recipient: {
            partnerId,
          },
          status: DestinationStatus.REVOKED,
          revokedAt: {
            gte: last7Days,
          },
        },
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
              asset: true,
              chain: true,
            },
          },
        },
        orderBy: {
          revokedAt: 'desc',
        },
        take: 8,
      }),
      this.prismaService.attestation.findMany({
        where: {
          partnerId,
          verificationStatus: VerificationStatus.VERIFIED,
          expiresAt: {
            gte: now,
            lte: next7Days,
          },
        },
        include: {
          recipient: {
            select: {
              id: true,
              externalRecipientId: true,
              displayName: true,
            },
          },
        },
        orderBy: {
          expiresAt: 'asc',
        },
        take: 8,
      }),
      this.prismaService.webhookDelivery.findMany({
        where: {
          endpoint: {
            partnerId,
          },
          status: {
            in: [
              DeliveryStatus.FAILED,
              DeliveryStatus.ABANDONED,
              DeliveryStatus.PENDING,
            ],
          },
        },
        include: {
          endpoint: {
            select: {
              id: true,
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
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 16,
        select: {
          id: true,
          action: true,
          summary: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actorType: true,
          actorIdentifier: true,
        },
      }),
      this.prismaService.auditLog.findMany({
        where: {
          subjectPartnerId: partnerId,
          action: {
            contains: 'key',
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 6,
        select: {
          id: true,
          action: true,
          summary: true,
          createdAt: true,
        },
      }),
      this.prismaService.webhookDelivery.groupBy({
        by: ['status'],
        where: {
          endpoint: {
            partnerId,
          },
          createdAt: {
            gte: last24Hours,
          },
        },
        _count: {
          _all: true,
        },
      }),
      this.prismaService.resolutionRequest.groupBy({
        by: ['outcome'],
        where: {
          requesterPartnerId: partnerId,
          requestedAt: {
            gte: last24Hours,
          },
          queryType: QueryType.RESOLVE,
        },
        _count: {
          _all: true,
        },
      }),
      this.prismaService.resolutionRequest.groupBy({
        by: ['outcome'],
        where: {
          requesterPartnerId: partnerId,
          requestedAt: {
            gte: last24Hours,
          },
          queryType: QueryType.CONFIRM_ADDRESS,
        },
        _count: {
          _all: true,
        },
      }),
      this.prismaService.partnerSigningKey.findMany({
        where: {
          partnerId,
          status: {
            in: [SigningKeyStatus.ACTIVE, SigningKeyStatus.ROTATING],
          },
        },
        select: {
          id: true,
          keyId: true,
          createdAt: true,
          validTo: true,
          revokedAt: true,
        },
      }),
    ]);

    const webhookTotal = webhookStats.reduce(
      (sum, stat) => sum + stat._count._all,
      0,
    );
    const webhookSucceeded =
      webhookStats.find((stat) => stat.status === DeliveryStatus.SUCCEEDED)
        ?._count._all ?? 0;
    const byRecipientResolutionTotal = byRecipientResolutionStats.reduce(
      (sum, stat) => sum + stat._count._all,
      0,
    );
    const byRecipientResolutionSucceeded =
      byRecipientResolutionStats.find((stat) => stat.outcome === 'RESOLVED')
        ?._count._all ?? 0;
    const byAddressResolutionTotal = byAddressResolutionStats.reduce(
      (sum, stat) => sum + stat._count._all,
      0,
    );
    const byAddressResolutionSucceeded =
      byAddressResolutionStats.find((stat) => stat.outcome === 'RESOLVED')
        ?._count._all ?? 0;

    return {
      kpis: {
        activeRecipients,
        activeDestinations,
        activeAttestations,
        byRecipientRequests7d,
        byAddressRequests7d,
        verifyTransferRequests7d,
        blockedVerificationCount,
        webhookFailureCount,
      },
      attention: {
        highRiskVerifications: highRiskVerifications.map((request) => ({
          ...request,
          requestedAt: request.requestedAt.toISOString(),
        })),
        revokedDestinations: revokedDestinations.map((destination) => ({
          id: destination.id,
          recipient: destination.recipient,
          chain: destination.assetNetwork.chain.slug,
          asset: destination.assetNetwork.asset.symbol,
          address: destination.addressRaw,
          revokedAt: destination.revokedAt?.toISOString() ?? null,
        })),
        expiringAttestations: expiringAttestations.map((attestation) => ({
          id: attestation.id,
          recipient: attestation.recipient,
          recipientIdentifier: attestation.recipientIdentifierSnapshot,
          attestationType: attestation.attestationType,
          expiresAt: attestation.expiresAt?.toISOString() ?? null,
        })),
        failedWebhookDeliveries: failedWebhookDeliveries.map((delivery) => ({
          id: delivery.id,
          endpoint: delivery.endpoint,
          eventType: delivery.eventType,
          status: delivery.status,
          attemptCount: delivery.attemptCount,
          responseCode: delivery.responseCode,
          lastError: delivery.lastError,
          updatedAt: delivery.updatedAt.toISOString(),
        })),
        recentKeyChanges: recentAuditEvents.map((event) => ({
          ...event,
          createdAt: event.createdAt.toISOString(),
        })),
      },
      health: {
        webhookSuccessRate:
          webhookTotal === 0
            ? null
            : Number((webhookSucceeded / webhookTotal).toFixed(4)),
        byRecipientResolutionSuccessRate:
          byRecipientResolutionTotal === 0
            ? null
            : Number(
                (
                  byRecipientResolutionSucceeded / byRecipientResolutionTotal
                ).toFixed(4),
              ),
        byAddressResolutionSuccessRate:
          byAddressResolutionTotal === 0
            ? null
            : Number(
                (
                  byAddressResolutionSucceeded / byAddressResolutionTotal
                ).toFixed(4),
              ),
        attestationFreshnessScore:
          activeAttestations === 0
            ? null
            : Number(
                (activeAttestations / Math.max(activeAttestations, 1)).toFixed(
                  4,
                ),
              ),
        keyRotationStatus: activeSigningKeys.length > 0 ? 'healthy' : 'missing',
      },
      recentActivity: recentActivity.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
