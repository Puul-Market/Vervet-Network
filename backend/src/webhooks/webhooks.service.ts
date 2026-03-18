import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import {
  AuditActorType,
  DeliveryStatus,
  type Prisma,
  WebhookEventType,
  WebhookStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { AuditService } from '../audit/audit.service';
import { hashSecret } from '../common/security/secret-hash.util';
import { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import {
  calculateNextWebhookAttemptAt,
  shouldAbandonWebhookDelivery,
} from './delivery-retry.util';
import {
  deriveWebhookSigningSecret,
  hashWebhookPayload,
  signWebhookPayload,
} from './webhook-signing.util';

interface DispatchWebhookEventParams {
  partnerId: string;
  eventType: WebhookEventType;
  payload: Prisma.InputJsonValue;
}

type WebhookDatabaseClient = Prisma.TransactionClient | PrismaService;

interface ProcessPendingDeliveriesParams {
  limit?: number;
  ignoreSchedule?: boolean;
}

interface ListWebhookDeliveriesParams {
  endpointId?: string;
  eventType?: WebhookEventType;
  limit: number;
  status?: DeliveryStatus;
}

type DeliveryProcessingResult =
  | 'ABANDONED'
  | 'RESCHEDULED'
  | 'SKIPPED'
  | 'SUCCEEDED';

const blockedWebhookTargets = new BlockList();
blockedWebhookTargets.addSubnet('0.0.0.0', 8, 'ipv4');
blockedWebhookTargets.addSubnet('10.0.0.0', 8, 'ipv4');
blockedWebhookTargets.addSubnet('100.64.0.0', 10, 'ipv4');
blockedWebhookTargets.addSubnet('127.0.0.0', 8, 'ipv4');
blockedWebhookTargets.addSubnet('169.254.0.0', 16, 'ipv4');
blockedWebhookTargets.addSubnet('172.16.0.0', 12, 'ipv4');
blockedWebhookTargets.addSubnet('192.0.0.0', 24, 'ipv4');
blockedWebhookTargets.addSubnet('192.168.0.0', 16, 'ipv4');
blockedWebhookTargets.addSubnet('198.18.0.0', 15, 'ipv4');
blockedWebhookTargets.addSubnet('224.0.0.0', 4, 'ipv4');
blockedWebhookTargets.addSubnet('240.0.0.0', 4, 'ipv4');
blockedWebhookTargets.addSubnet('::', 128, 'ipv6');
blockedWebhookTargets.addSubnet('::1', 128, 'ipv6');
blockedWebhookTargets.addSubnet('fc00::', 7, 'ipv6');
blockedWebhookTargets.addSubnet('fe80::', 10, 'ipv6');
blockedWebhookTargets.addSubnet('ff00::', 8, 'ipv6');

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly auditService: AuditService,
  ) {}

  async listWebhookEndpoints(partnerId: string) {
    return this.prismaService.webhookEndpoint.findMany({
      where: {
        partnerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        label: true,
        url: true,
        eventTypes: true,
        signingSecretVersion: true,
        status: true,
        lastDeliveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getWebhookEndpointDetail(partnerId: string, endpointId: string) {
    const endpoint = await this.prismaService.webhookEndpoint.findFirst({
      where: {
        id: endpointId,
        partnerId,
      },
      select: {
        id: true,
        label: true,
        url: true,
        eventTypes: true,
        signingSecretVersion: true,
        status: true,
        lastDeliveredAt: true,
        createdAt: true,
        updatedAt: true,
        deliveries: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
          select: {
            id: true,
            eventType: true,
            status: true,
            attemptCount: true,
            responseCode: true,
            lastError: true,
            lastAttemptAt: true,
            nextAttemptAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!endpoint) {
      return null;
    }

    const recentDeliveryStats =
      await this.prismaService.webhookDelivery.groupBy({
        by: ['status'],
        where: {
          endpointId,
        },
        _count: {
          _all: true,
        },
      });

    return {
      ...endpoint,
      lastDeliveredAt: endpoint.lastDeliveredAt?.toISOString() ?? null,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
      deliveryStats: recentDeliveryStats.reduce<Record<string, number>>(
        (result, stat) => {
          result[stat.status] = stat._count._all;
          return result;
        },
        {},
      ),
      deliveries: endpoint.deliveries.map((delivery) => ({
        ...delivery,
        lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
        nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
        updatedAt: delivery.updatedAt.toISOString(),
      })),
    };
  }

  async listWebhookDeliveries(
    partnerId: string,
    params: ListWebhookDeliveriesParams,
  ) {
    return this.prismaService.webhookDelivery.findMany({
      where: {
        endpoint: {
          partnerId,
        },
        endpointId: params.endpointId,
        eventType: params.eventType,
        status: params.status,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: params.limit,
      select: {
        id: true,
        endpointId: true,
        eventType: true,
        status: true,
        attemptCount: true,
        nextAttemptAt: true,
        lastAttemptAt: true,
        responseCode: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        endpoint: {
          select: {
            label: true,
            url: true,
          },
        },
      },
    });
  }

  async getWebhookDeliveryDetail(partnerId: string, deliveryId: string) {
    const delivery = await this.prismaService.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        endpoint: {
          partnerId,
        },
      },
      include: {
        endpoint: {
          select: {
            id: true,
            label: true,
            url: true,
            eventTypes: true,
            signingSecretVersion: true,
            status: true,
          },
        },
      },
    });

    if (!delivery) {
      return null;
    }

    return {
      id: delivery.id,
      eventType: delivery.eventType,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      responseCode: delivery.responseCode,
      lastError: delivery.lastError,
      payload: delivery.payload,
      payloadHash: delivery.payloadHash,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString(),
      lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
      nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
      endpoint: delivery.endpoint,
    };
  }

  async createWebhookEndpoint(
    authenticatedPartner: AuthenticatedPartner,
    createWebhookEndpointDto: CreateWebhookEndpointDto,
  ) {
    const normalizedUrl = await this.normalizeAndValidateWebhookUrl(
      createWebhookEndpointDto.url,
    );
    const masterSecret = this.getWebhookMasterSecret();

    return this.prismaService.$transaction(async (transaction) => {
      const endpoint = await transaction.webhookEndpoint.create({
        data: {
          partnerId: authenticatedPartner.partnerId,
          label: createWebhookEndpointDto.label.trim(),
          url: normalizedUrl,
          eventTypes: this.normalizeWebhookEventTypes(
            createWebhookEndpointDto.eventTypes,
          ),
          signingSecretHash: '',
          signingSecretVersion: 1,
          status: WebhookStatus.ACTIVE,
        },
        select: {
          id: true,
          label: true,
          url: true,
          eventTypes: true,
          signingSecretVersion: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const signingSecret = deriveWebhookSigningSecret(
        endpoint.id,
        endpoint.signingSecretVersion,
        masterSecret,
      );

      await transaction.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          signingSecretHash: hashSecret(signingSecret),
        },
      });

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.PARTNER,
          actorPartnerId: authenticatedPartner.partnerId,
          subjectPartnerId: authenticatedPartner.partnerId,
          actorIdentifier: authenticatedPartner.actorIdentifier,
          action: 'webhook.endpoint.created',
          entityType: 'WebhookEndpoint',
          entityId: endpoint.id,
          summary: `Created webhook endpoint '${endpoint.label}'.`,
          metadata: {
            label: endpoint.label,
            status: endpoint.status,
            eventTypes: endpoint.eventTypes,
            url: endpoint.url,
          },
        },
        transaction,
      );

      return {
        ...endpoint,
        signingSecret,
      };
    });
  }

  async updateWebhookEndpoint(
    authenticatedPartner: AuthenticatedPartner,
    endpointId: string,
    updateWebhookEndpointDto: UpdateWebhookEndpointDto,
  ) {
    const existingEndpoint = await this.getPartnerWebhookEndpoint(
      authenticatedPartner.partnerId,
      endpointId,
    );
    const updateData = await this.buildWebhookEndpointUpdateData(
      updateWebhookEndpointDto,
    );

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one webhook endpoint field must be provided.',
      );
    }

    const changedFields = Object.keys(updateData).sort();

    return this.prismaService.$transaction(async (transaction) => {
      const endpoint = await transaction.webhookEndpoint.update({
        where: { id: existingEndpoint.id },
        data: updateData,
        select: {
          id: true,
          label: true,
          url: true,
          eventTypes: true,
          signingSecretVersion: true,
          status: true,
          lastDeliveredAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      let abandonedDeliveryCount = 0;

      if (
        existingEndpoint.status !== WebhookStatus.DISABLED &&
        endpoint.status === WebhookStatus.DISABLED
      ) {
        abandonedDeliveryCount = await this.abandonPendingDeliveriesForEndpoint(
          endpoint.id,
          authenticatedPartner.partnerId,
          'Endpoint disabled before delivery.',
          transaction,
        );
      }

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.PARTNER,
          actorPartnerId: authenticatedPartner.partnerId,
          subjectPartnerId: authenticatedPartner.partnerId,
          actorIdentifier: authenticatedPartner.actorIdentifier,
          action:
            endpoint.status === WebhookStatus.DISABLED &&
            existingEndpoint.status !== WebhookStatus.DISABLED
              ? 'webhook.endpoint.disabled'
              : 'webhook.endpoint.updated',
          entityType: 'WebhookEndpoint',
          entityId: endpoint.id,
          summary: `Updated webhook endpoint '${endpoint.label}'.`,
          metadata: {
            changedFields,
            previousStatus: existingEndpoint.status,
            status: endpoint.status,
            abandonedDeliveryCount,
            eventTypes: endpoint.eventTypes,
            url: endpoint.url,
          },
        },
        transaction,
      );

      return endpoint;
    });
  }

  async disableWebhookEndpoint(
    authenticatedPartner: AuthenticatedPartner,
    endpointId: string,
  ) {
    return this.updateWebhookEndpoint(authenticatedPartner, endpointId, {
      status: WebhookStatus.DISABLED,
    });
  }

  async rotateWebhookSigningSecret(
    authenticatedPartner: AuthenticatedPartner,
    endpointId: string,
  ) {
    const existingEndpoint = await this.getPartnerWebhookEndpoint(
      authenticatedPartner.partnerId,
      endpointId,
    );

    if (existingEndpoint.status === WebhookStatus.DISABLED) {
      throw new ConflictException(
        'Cannot rotate the signing secret for a disabled webhook endpoint.',
      );
    }

    const nextSigningSecretVersion = existingEndpoint.signingSecretVersion + 1;
    const masterSecret = this.getWebhookMasterSecret();
    const signingSecret = deriveWebhookSigningSecret(
      existingEndpoint.id,
      nextSigningSecretVersion,
      masterSecret,
    );

    return this.prismaService.$transaction(async (transaction) => {
      const endpoint = await transaction.webhookEndpoint.update({
        where: { id: existingEndpoint.id },
        data: {
          signingSecretHash: hashSecret(signingSecret),
          signingSecretVersion: nextSigningSecretVersion,
        },
        select: {
          id: true,
          label: true,
          url: true,
          eventTypes: true,
          signingSecretVersion: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.PARTNER,
          actorPartnerId: authenticatedPartner.partnerId,
          subjectPartnerId: authenticatedPartner.partnerId,
          actorIdentifier: authenticatedPartner.actorIdentifier,
          action: 'webhook.endpoint.secret_rotated',
          entityType: 'WebhookEndpoint',
          entityId: endpoint.id,
          summary: `Rotated signing secret for webhook endpoint '${endpoint.label}'.`,
          metadata: {
            previousSigningSecretVersion: existingEndpoint.signingSecretVersion,
            signingSecretVersion: endpoint.signingSecretVersion,
          },
        },
        transaction,
      );

      return {
        ...endpoint,
        signingSecret,
      };
    });
  }

  async testWebhookEndpoint(
    authenticatedPartner: AuthenticatedPartner,
    endpointId: string,
  ) {
    const endpoint = await this.getPartnerWebhookEndpoint(
      authenticatedPartner.partnerId,
      endpointId,
    );
    const payload = JSON.stringify({
      type: 'webhook.test',
      endpointId: endpoint.id,
      partnerId: authenticatedPartner.partnerId,
      generatedAt: new Date().toISOString(),
    });
    const timestamp = new Date().toISOString();
    const signingSecret = deriveWebhookSigningSecret(
      endpoint.id,
      endpoint.signingSecretVersion,
      this.getWebhookMasterSecret(),
    );
    const signature = signWebhookPayload({
      payload,
      timestamp,
      secret: signingSecret,
    });

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vervet-event': 'webhook.test',
          'x-vervet-signature': signature,
          'x-vervet-timestamp': timestamp,
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });

      const responseBody = await response.text();

      await this.auditService.recordEvent({
        actorType: AuditActorType.PARTNER,
        actorPartnerId: authenticatedPartner.partnerId,
        subjectPartnerId: authenticatedPartner.partnerId,
        actorIdentifier: authenticatedPartner.actorIdentifier,
        action: 'webhook.endpoint.tested',
        entityType: 'WebhookEndpoint',
        entityId: endpoint.id,
        summary: `Tested webhook endpoint '${endpoint.label}'.`,
        metadata: {
          responseCode: response.status,
          responseBody: responseBody.slice(0, 512),
        },
      });

      return {
        endpointId: endpoint.id,
        ok: response.ok,
        responseCode: response.status,
        responseBody,
        testedAt: timestamp,
      };
    } catch (error: unknown) {
      await this.auditService.recordEvent({
        actorType: AuditActorType.PARTNER,
        actorPartnerId: authenticatedPartner.partnerId,
        subjectPartnerId: authenticatedPartner.partnerId,
        actorIdentifier: authenticatedPartner.actorIdentifier,
        action: 'webhook.endpoint.test_failed',
        entityType: 'WebhookEndpoint',
        entityId: endpoint.id,
        summary: `Webhook test failed for '${endpoint.label}'.`,
        metadata: {
          error: this.stringifyError(error),
        },
      });

      return {
        endpointId: endpoint.id,
        ok: false,
        responseCode: null,
        responseBody: this.stringifyError(error),
        testedAt: timestamp,
      };
    }
  }

  async replayWebhookDelivery(
    authenticatedPartner: AuthenticatedPartner,
    deliveryId: string,
  ) {
    const delivery = await this.prismaService.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        endpoint: {
          partnerId: authenticatedPartner.partnerId,
        },
      },
      include: {
        endpoint: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(
        `Webhook delivery '${deliveryId}' was not found for the authenticated partner.`,
      );
    }

    if (delivery.endpoint.status === WebhookStatus.DISABLED) {
      throw new ConflictException(
        'Cannot replay deliveries for a disabled webhook endpoint.',
      );
    }

    const replayedDelivery = await this.prismaService.webhookDelivery.create({
      data: {
        endpointId: delivery.endpointId,
        eventType: delivery.eventType,
        payload: delivery.payload as Prisma.InputJsonValue,
        payloadHash: delivery.payloadHash,
        status: DeliveryStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    await this.auditService.recordEvent({
      actorType: AuditActorType.PARTNER,
      actorPartnerId: authenticatedPartner.partnerId,
      subjectPartnerId: authenticatedPartner.partnerId,
      actorIdentifier: authenticatedPartner.actorIdentifier,
      action: 'webhook.delivery.replayed',
      entityType: 'WebhookDelivery',
      entityId: replayedDelivery.id,
      summary: `Replayed webhook delivery '${deliveryId}'.`,
      metadata: {
        sourceDeliveryId: deliveryId,
        endpointId: delivery.endpointId,
        eventType: delivery.eventType,
      },
    });

    await this.processPendingDeliveries({
      ignoreSchedule: true,
      limit: 1,
    });

    return this.getWebhookDeliveryDetail(
      authenticatedPartner.partnerId,
      replayedDelivery.id,
    );
  }

  async dispatchPartnerWebhookEvent(
    params: DispatchWebhookEventParams,
  ): Promise<void> {
    const enqueuedCount = await this.enqueuePartnerWebhookEvent(params);

    if (enqueuedCount > 0) {
      await this.processPendingDeliveries({
        ignoreSchedule: true,
        limit: enqueuedCount,
      });
    }
  }

  async enqueuePartnerWebhookEvent(
    params: DispatchWebhookEventParams,
    database: WebhookDatabaseClient = this.prismaService,
  ): Promise<number> {
    const endpoints = await database.webhookEndpoint.findMany({
      where: {
        partnerId: params.partnerId,
        status: WebhookStatus.ACTIVE,
        eventTypes: {
          has: params.eventType,
        },
      },
      select: {
        id: true,
      },
    });

    if (endpoints.length === 0) {
      return 0;
    }

    const serializedPayload = JSON.stringify(params.payload);
    const payload = JSON.parse(serializedPayload) as Prisma.InputJsonValue;
    const payloadHash = hashWebhookPayload(serializedPayload);
    const now = new Date();
    const createdDeliveries = await database.webhookDelivery.createMany({
      data: endpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        eventType: params.eventType,
        payload,
        payloadHash,
        status: DeliveryStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: now,
      })),
    });

    return createdDeliveries.count;
  }

  async processPendingDeliveries(params: ProcessPendingDeliveriesParams) {
    const now = new Date();
    const staleThreshold = this.buildDeliveryStaleThreshold(now);
    const pendingWhere: Prisma.WebhookDeliveryWhereInput = {
      status: DeliveryStatus.PENDING,
      endpoint: {
        status: WebhookStatus.ACTIVE,
      },
      ...(params.ignoreSchedule
        ? {}
        : {
            OR: [
              {
                nextAttemptAt: null,
              },
              {
                nextAttemptAt: {
                  lte: now,
                },
              },
            ],
          }),
    };
    const where: Prisma.WebhookDeliveryWhereInput = {
      OR: [
        pendingWhere,
        {
          status: DeliveryStatus.PROCESSING,
          lastAttemptAt: {
            lte: staleThreshold,
          },
          endpoint: {
            status: WebhookStatus.ACTIVE,
          },
        },
      ],
    };

    const deliveries = await this.prismaService.webhookDelivery.findMany({
      where,
      orderBy: [
        {
          nextAttemptAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
      take: params.limit ?? 50,
      select: {
        id: true,
      },
    });

    let succeededCount = 0;
    let rescheduledCount = 0;
    let abandonedCount = 0;
    let skippedCount = 0;

    for (const delivery of deliveries) {
      const result = await this.processWebhookDeliveryById(delivery.id);

      switch (result) {
        case 'SUCCEEDED':
          succeededCount += 1;
          break;
        case 'RESCHEDULED':
          rescheduledCount += 1;
          break;
        case 'ABANDONED':
          abandonedCount += 1;
          break;
        case 'SKIPPED':
          skippedCount += 1;
          break;
      }
    }

    return {
      processedCount: deliveries.length,
      succeededCount,
      rescheduledCount,
      abandonedCount,
      skippedCount,
    };
  }

  private async processWebhookDeliveryById(
    deliveryId: string,
  ): Promise<DeliveryProcessingResult> {
    const staleThreshold = this.buildDeliveryStaleThreshold(new Date());
    const delivery = await this.prismaService.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        endpoint: {
          select: {
            id: true,
            label: true,
            partnerId: true,
            url: true,
            status: true,
            signingSecretVersion: true,
          },
        },
      },
    });

    if (!delivery) {
      return 'SKIPPED';
    }

    const staleProcessingDelivery =
      delivery.status === DeliveryStatus.PROCESSING &&
      (delivery.lastAttemptAt === null ||
        delivery.lastAttemptAt <= staleThreshold);

    if (
      delivery.status !== DeliveryStatus.PENDING &&
      !staleProcessingDelivery
    ) {
      return 'SKIPPED';
    }

    if (delivery.endpoint.status === WebhookStatus.DISABLED) {
      await this.markDeliveryAsAbandoned(
        delivery.id,
        delivery.endpoint.id,
        delivery.endpoint.partnerId,
        delivery.eventType,
        delivery.attemptCount,
        'Endpoint disabled before delivery.',
      );

      return 'ABANDONED';
    }

    if (delivery.endpoint.status !== WebhookStatus.ACTIVE) {
      return 'SKIPPED';
    }

    const attemptCount = delivery.attemptCount + 1;
    const claimResult = await this.prismaService.webhookDelivery.updateMany({
      where: {
        id: delivery.id,
        OR: [
          {
            status: DeliveryStatus.PENDING,
          },
          {
            status: DeliveryStatus.PROCESSING,
            OR: [
              {
                lastAttemptAt: null,
              },
              {
                lastAttemptAt: {
                  lte: staleThreshold,
                },
              },
            ],
          },
        ],
      },
      data: {
        status: DeliveryStatus.PROCESSING,
        attemptCount,
        lastAttemptAt: new Date(),
        nextAttemptAt: null,
      },
    });

    if (claimResult.count === 0) {
      return 'SKIPPED';
    }

    const payload = JSON.stringify(delivery.payload);
    const timestamp = new Date().toISOString();
    const signingSecret = deriveWebhookSigningSecret(
      delivery.endpoint.id,
      delivery.endpoint.signingSecretVersion,
      this.getWebhookMasterSecret(),
    );
    const signature = signWebhookPayload({
      payload,
      timestamp,
      secret: signingSecret,
    });

    try {
      const response = await fetch(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vervet-delivery-id': delivery.id,
          'x-vervet-event': delivery.eventType,
          'x-vervet-signature': signature,
          'x-vervet-timestamp': timestamp,
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });
      const responseBody = await response.text();

      if (response.ok) {
        await this.prismaService.$transaction(async (transaction) => {
          await transaction.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: DeliveryStatus.SUCCEEDED,
              responseCode: response.status,
              lastError: null,
            },
          });

          await transaction.webhookEndpoint.update({
            where: { id: delivery.endpoint.id },
            data: {
              lastDeliveredAt: new Date(),
            },
          });
        });

        return 'SUCCEEDED';
      }

      return this.handleFailedDeliveryAttempt({
        attemptCount,
        deliveryId: delivery.id,
        endpointId: delivery.endpoint.id,
        subjectPartnerId: delivery.endpoint.partnerId,
        eventType: delivery.eventType,
        lastError: responseBody.slice(0, 1024),
        responseCode: response.status,
      });
    } catch (error: unknown) {
      return this.handleFailedDeliveryAttempt({
        attemptCount,
        deliveryId: delivery.id,
        endpointId: delivery.endpoint.id,
        subjectPartnerId: delivery.endpoint.partnerId,
        eventType: delivery.eventType,
        lastError: this.stringifyError(error),
      });
    }
  }

  private async handleFailedDeliveryAttempt(params: {
    attemptCount: number;
    deliveryId: string;
    endpointId: string;
    subjectPartnerId: string;
    eventType: WebhookEventType;
    lastError: string;
    responseCode?: number;
  }): Promise<DeliveryProcessingResult> {
    if (shouldAbandonWebhookDelivery(params.attemptCount)) {
      await this.markDeliveryAsAbandoned(
        params.deliveryId,
        params.endpointId,
        params.subjectPartnerId,
        params.eventType,
        params.attemptCount,
        params.lastError,
        params.responseCode,
      );

      return 'ABANDONED';
    }

    await this.prismaService.webhookDelivery.update({
      where: {
        id: params.deliveryId,
      },
      data: {
        status: DeliveryStatus.PENDING,
        responseCode: params.responseCode ?? null,
        lastError: params.lastError,
        nextAttemptAt: calculateNextWebhookAttemptAt(
          new Date(),
          params.attemptCount,
        ),
      },
    });

    return 'RESCHEDULED';
  }

  private async markDeliveryAsAbandoned(
    deliveryId: string,
    endpointId: string,
    subjectPartnerId: string,
    eventType: WebhookEventType,
    attemptCount: number,
    lastError: string,
    responseCode?: number,
  ): Promise<void> {
    await this.prismaService.$transaction(async (transaction) => {
      await transaction.webhookDelivery.update({
        where: {
          id: deliveryId,
        },
        data: {
          status: DeliveryStatus.ABANDONED,
          responseCode: responseCode ?? null,
          lastError,
          nextAttemptAt: null,
        },
      });

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.SYSTEM,
          subjectPartnerId,
          action: 'webhook.delivery.abandoned',
          entityType: 'WebhookDelivery',
          entityId: deliveryId,
          summary: `Abandoned webhook delivery after ${attemptCount} attempts.`,
          metadata: {
            endpointId,
            eventType,
            attemptCount,
            responseCode: responseCode ?? null,
            lastError,
          },
        },
        transaction,
      );
    });
  }

  private async abandonPendingDeliveriesForEndpoint(
    endpointId: string,
    subjectPartnerId: string,
    lastError: string,
    transaction: Prisma.TransactionClient,
  ): Promise<number> {
    const updatedDeliveries = await transaction.webhookDelivery.findMany({
      where: {
        endpointId,
        status: DeliveryStatus.PENDING,
      },
      select: {
        id: true,
        eventType: true,
        attemptCount: true,
      },
    });

    if (updatedDeliveries.length === 0) {
      return 0;
    }

    await transaction.webhookDelivery.updateMany({
      where: {
        endpointId,
        status: DeliveryStatus.PENDING,
      },
      data: {
        status: DeliveryStatus.ABANDONED,
        lastError,
        nextAttemptAt: null,
      },
    });

    for (const delivery of updatedDeliveries) {
      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.SYSTEM,
          subjectPartnerId,
          action: 'webhook.delivery.abandoned',
          entityType: 'WebhookDelivery',
          entityId: delivery.id,
          summary:
            'Abandoned pending webhook delivery because the endpoint was disabled.',
          metadata: {
            endpointId,
            eventType: delivery.eventType,
            attemptCount: delivery.attemptCount,
            lastError,
          },
        },
        transaction,
      );
    }

    return updatedDeliveries.length;
  }

  private async buildWebhookEndpointUpdateData(
    updateWebhookEndpointDto: UpdateWebhookEndpointDto,
  ): Promise<Prisma.WebhookEndpointUpdateInput> {
    const updateData: Prisma.WebhookEndpointUpdateInput = {};

    if (updateWebhookEndpointDto.label !== undefined) {
      updateData.label = updateWebhookEndpointDto.label.trim();
    }

    if (updateWebhookEndpointDto.url !== undefined) {
      updateData.url = await this.normalizeAndValidateWebhookUrl(
        updateWebhookEndpointDto.url,
      );
    }

    if (updateWebhookEndpointDto.eventTypes !== undefined) {
      updateData.eventTypes = this.normalizeWebhookEventTypes(
        updateWebhookEndpointDto.eventTypes,
      );
    }

    if (updateWebhookEndpointDto.status !== undefined) {
      updateData.status = updateWebhookEndpointDto.status;
    }

    return updateData;
  }

  private async getPartnerWebhookEndpoint(
    partnerId: string,
    endpointId: string,
  ) {
    const endpoint = await this.prismaService.webhookEndpoint.findFirst({
      where: {
        id: endpointId,
        partnerId,
      },
      select: {
        id: true,
        label: true,
        partnerId: true,
        url: true,
        eventTypes: true,
        signingSecretVersion: true,
        status: true,
      },
    });

    if (!endpoint) {
      throw new NotFoundException(
        `Webhook endpoint '${endpointId}' was not found for the authenticated partner.`,
      );
    }

    return endpoint;
  }

  private getWebhookMasterSecret(): string {
    return this.configService.get('WEBHOOK_SIGNING_MASTER_SECRET', {
      infer: true,
    });
  }

  private normalizeWebhookEventTypes(
    eventTypes: readonly WebhookEventType[],
  ): WebhookEventType[] {
    return [...new Set(eventTypes)];
  }

  private buildDeliveryStaleThreshold(referenceTime: Date): Date {
    const staleWindowMs = this.configService.get(
      'WEBHOOK_DELIVERY_PROCESSING_STALE_MS',
      {
        infer: true,
      },
    );

    return new Date(referenceTime.getTime() - staleWindowMs);
  }

  private async normalizeAndValidateWebhookUrl(
    rawUrl: string,
  ): Promise<string> {
    const parsedUrl = new URL(rawUrl.trim());

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException(
        'Webhook endpoints must use HTTP or HTTPS.',
      );
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new BadRequestException(
        'Webhook endpoints must not embed credentials in the URL.',
      );
    }

    if (
      !this.configService.get('WEBHOOK_ALLOW_PRIVATE_TARGETS', { infer: true })
    ) {
      await this.assertPublicWebhookTarget(parsedUrl.hostname);
    }

    return parsedUrl.toString();
  }

  private async assertPublicWebhookTarget(hostname: string): Promise<void> {
    const normalizedHostname = hostname.trim().toLowerCase();

    if (
      normalizedHostname === 'localhost' ||
      normalizedHostname.endsWith('.localhost') ||
      normalizedHostname.endsWith('.local')
    ) {
      throw new BadRequestException(
        'Webhook endpoints must not target loopback or local-network hosts.',
      );
    }

    const ipVersion = isIP(normalizedHostname);

    if (ipVersion !== 0) {
      this.assertAllowedWebhookAddress(normalizedHostname, ipVersion);
      return;
    }

    let addresses: { address: string; family: number }[];

    try {
      addresses = await lookup(normalizedHostname, {
        all: true,
        verbatim: true,
      });
    } catch {
      throw new BadRequestException(
        'Webhook endpoint host could not be resolved.',
      );
    }

    if (addresses.length === 0) {
      throw new BadRequestException(
        'Webhook endpoint host could not be resolved.',
      );
    }

    for (const address of addresses) {
      this.assertAllowedWebhookAddress(address.address, address.family);
    }
  }

  private assertAllowedWebhookAddress(address: string, family: number): void {
    if (blockedWebhookTargets.check(address, family === 6 ? 'ipv6' : 'ipv4')) {
      throw new BadRequestException(
        'Webhook endpoints must resolve to publicly routable addresses.',
      );
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.slice(0, 1024);
    }

    return 'Unknown webhook delivery error.';
  }
}
