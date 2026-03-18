import {
  DeliveryStatus,
  WebhookEventType,
  WebhookStatus,
} from '@prisma/client';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects private webhook targets when private destinations are disabled', async () => {
    const service = new WebhooksService(
      createPrismaServiceMock() as never,
      createConfigServiceMock({
        WEBHOOK_ALLOW_PRIVATE_TARGETS: false,
      }) as never,
      createAuditServiceMock() as never,
    );

    await expect(
      service.createWebhookEndpoint(
        {
          credentialId: 'credential-1',
          partnerId: 'partner-1',
          partnerSlug: 'partner-one',
          scopes: ['webhooks:write'],
        },
        {
          label: 'Loopback endpoint',
          url: 'http://127.0.0.1:9999/private',
          eventTypes: [WebhookEventType.DESTINATION_UPDATED],
        },
      ),
    ).rejects.toThrow(
      'Webhook endpoints must resolve to publicly routable addresses.',
    );
  });

  it('reclaims stale processing deliveries and marks them succeeded', async () => {
    const prismaServiceMock = createPrismaServiceMock();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const service = new WebhooksService(
      prismaServiceMock as never,
      createConfigServiceMock({
        WEBHOOK_DELIVERY_PROCESSING_STALE_MS: 1_000,
        WEBHOOK_SIGNING_MASTER_SECRET: 'test-master-secret',
      }) as never,
      createAuditServiceMock() as never,
    );
    const staleAttemptAt = new Date(Date.now() - 5_000);
    const deliveryRecord = {
      id: 'delivery-1',
      endpointId: 'endpoint-1',
      eventType: WebhookEventType.DESTINATION_UPDATED,
      payload: {
        destinationId: 'destination-1',
      },
      payloadHash: 'payload-hash',
      status: DeliveryStatus.PROCESSING,
      attemptCount: 1,
      nextAttemptAt: null,
      lastAttemptAt: staleAttemptAt,
      responseCode: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      endpoint: {
        id: 'endpoint-1',
        label: 'Primary endpoint',
        partnerId: 'partner-1',
        url: 'https://hooks.example.com/vervet',
        status: WebhookStatus.ACTIVE,
        signingSecretVersion: 1,
      },
    };

    prismaServiceMock.webhookDelivery.findMany.mockResolvedValue([
      { id: deliveryRecord.id },
    ]);
    prismaServiceMock.webhookDelivery.findUnique.mockResolvedValue(
      deliveryRecord,
    );
    prismaServiceMock.webhookDelivery.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.processPendingDeliveries({
      limit: 10,
    });

    expect(result).toMatchObject({
      processedCount: 1,
      succeededCount: 1,
      rescheduledCount: 0,
      abandonedCount: 0,
      skippedCount: 0,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      deliveryRecord.endpoint.url,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const claimCall =
      prismaServiceMock.webhookDelivery.updateMany.mock.calls[0]?.[0];

    expect(claimCall?.where.id).toBe(deliveryRecord.id);
    const successCall =
      prismaServiceMock.transaction.webhookDelivery.update.mock.calls[0]?.[0];

    expect(successCall?.where.id).toBe(deliveryRecord.id);
    expect(successCall?.data.status).toBe(DeliveryStatus.SUCCEEDED);
    expect(successCall?.data.responseCode).toBe(200);
    expect(
      prismaServiceMock.transaction.webhookEndpoint.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: deliveryRecord.endpoint.id,
        },
      }),
    );
  });
});

function createConfigServiceMock(
  values: Partial<Record<string, boolean | number | string>>,
) {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

function createAuditServiceMock() {
  return {
    recordEvent: jest.fn(),
  };
}

function createPrismaServiceMock() {
  const transaction = {
    webhookDelivery: {
      update: jest.fn(
        (args: {
          where: {
            id: string;
          };
          data: {
            responseCode: number | null;
            status: DeliveryStatus;
          };
        }) => args,
      ),
    },
    webhookEndpoint: {
      update: jest.fn(
        (args: {
          where: {
            id: string;
          };
          data: {
            lastDeliveredAt: Date;
          };
        }) => args,
      ),
    },
  };

  return {
    webhookEndpoint: {
      create: jest.fn(() => undefined),
      findMany: jest.fn(() => []),
      update: jest.fn(() => undefined),
    },
    webhookDelivery: {
      createMany: jest.fn(() => ({ count: 0 })),
      findMany: jest.fn(() => [] as Array<{ id: string }>),
      findUnique: jest.fn(() => null),
      update: jest.fn(() => undefined),
      updateMany: jest.fn(
        (args: {
          where: {
            id: string;
          };
        }) => {
          void args;

          return { count: 1 };
        },
      ),
    },
    $transaction: jest.fn(
      (callback: (transactionClient: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    transaction,
  };
}
