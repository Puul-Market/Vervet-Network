import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ChainFamily,
  DeliveryStatus,
  DestinationStatus,
  PartnerFeedHealthStatus,
  PartnerOnboardingStage,
  PartnerStatus,
  PartnerType,
  PrismaClient,
  SigningKeyAlgorithm,
  SigningKeyStatus,
  TokenStandard,
  VerificationStatus,
  WebhookEventType,
  WebhookStatus,
} from '@prisma/client';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { generateApiCredential } from '../src/partners/api-credential.util';

interface PartnerContext {
  id: string;
  slug: string;
  credentialSecret: string;
}

interface DataFeedHealthResponse {
  partner: {
    slug: string;
  };
  feed: {
    status: string;
    environment: string;
    lastAttestationReceivedAt: string | null;
    lastRevocationReceivedAt: string | null;
  };
  metrics: {
    activeDestinationCount: number;
    activeAttestationCount: number;
    staleDestinationCount: number;
    staleAttestationCount: number;
    failedDeliveryCount7d: number;
    pendingDeliveryCount: number;
    recentIngestionSuccessCount7d: number;
    recentIngestionFailureCount7d: number;
    degradedCorridorCount: number;
    disconnectedCorridorCount: number;
  };
  ingestion: {
    recentActivity: Array<{
      id: string;
    }>;
    recentFailures: Array<{
      id: string;
      failureReason: string | null;
    }>;
  };
  corridors: Array<{
    assetNetworkId: string;
    status: string;
    productionGranted: boolean;
  }>;
  freshness: {
    staleDestinations: Array<{
      id: string;
    }>;
    staleAttestations: Array<{
      id: string;
    }>;
  };
  recentTrustEvents: Array<{
    id: string;
  }>;
  deliveryFailures: Array<{
    endpointLabel: string;
  }>;
  eventHealth: {
    webhookTestFailures: Array<{
      id: string;
    }>;
  };
  recommendedActions: Array<{
    key: string;
  }>;
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase25-admin-token';
const webhookSigningMasterSecret = 'phase25-webhook-signing-secret';

describe('Data feed health API (e2e)', () => {
  let app: INestApplication<App>;
  let prismaClient: PrismaClient;
  const createdPartnerIds = new Set<string>();

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.ADMIN_API_TOKEN = adminApiToken;
    process.env.WEBHOOK_SIGNING_MASTER_SECRET = webhookSigningMasterSecret;
    process.env.WEBHOOK_DELIVERY_PROCESSOR_ENABLED = 'false';

    prismaClient = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
      }),
    });
    await prismaClient.$connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await prismaClient.partner.deleteMany({
      where: {
        id: {
          in: Array.from(createdPartnerIds),
        },
      },
    });

    if (app) {
      await app.close();
    }

    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  });

  it('requires partners:read to access data feed health', async () => {
    const partner = await createPartnerContext(['resolution:read']);

    await request(app.getHttpServer())
      .get('/v1/data-feed-health')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('Accept', 'application/json')
      .expect(403);
  });

  it('returns data feed freshness, delivery failure, and recommendation signals', async () => {
    const partner = await createPartnerContext(['partners:read']);
    const assetNetworkId = await createAssetNetwork();
    const signingKeyId = await createSigningKey(partner.id);
    const recipient = await prismaClient.recipient.create({
      data: {
        partnerId: partner.id,
        externalRecipientId: `recipient-${createUniqueSuffix()}`,
        displayName: 'Phase 25 Treasury',
      },
    });
    const destination = await prismaClient.recipientDestination.create({
      data: {
        recipientId: recipient.id,
        assetNetworkId,
        addressRaw: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        addressNormalized: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        status: DestinationStatus.ACTIVE,
        isDefault: true,
        effectiveFrom: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        lastAttestedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    });

    const assignmentAttestation = await prismaClient.attestation.create({
      data: {
        partnerId: partner.id,
        signingKeyId,
        attestationType: 'DESTINATION_ASSIGNMENT',
        recipientId: recipient.id,
        assetNetworkId,
        destinationId: destination.id,
        recipientIdentifierSnapshot: 'treasury@phase25',
        displayNameSnapshot: 'Phase 25 Treasury',
        addressRaw: destination.addressRaw,
        addressNormalized: destination.addressNormalized,
        canonicalPayload: 'phase25-assignment',
        payload: { id: 'phase25-assignment' },
        payloadHash: `payload-${createUniqueSuffix()}`,
        signature: 'phase25-signature',
        sequenceNumber: BigInt(1),
        issuedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        effectiveFrom: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        ingestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });

    await prismaClient.attestation.create({
      data: {
        partnerId: partner.id,
        signingKeyId,
        attestationType: 'DESTINATION_REVOCATION',
        recipientId: recipient.id,
        assetNetworkId,
        destinationId: destination.id,
        recipientIdentifierSnapshot: 'treasury@phase25',
        displayNameSnapshot: 'Phase 25 Treasury',
        addressRaw: destination.addressRaw,
        addressNormalized: destination.addressNormalized,
        canonicalPayload: 'phase25-revocation',
        payload: { id: 'phase25-revocation' },
        payloadHash: `payload-${createUniqueSuffix()}`,
        signature: 'phase25-revocation-signature',
        sequenceNumber: BigInt(2),
        issuedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        effectiveFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        expiresAt: null,
        verificationStatus: VerificationStatus.REVOKED,
        verifiedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        ingestedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    const endpoint = await prismaClient.webhookEndpoint.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 25 Feed Endpoint',
        url: 'https://example.com/feed-health',
        eventTypes: [WebhookEventType.DESTINATION_UPDATED],
        status: WebhookStatus.ACTIVE,
        signingSecretVersion: 1,
        signingSecretHash: 'phase25-secret-hash',
      },
    });

    await prismaClient.webhookDelivery.createMany({
      data: [
        {
          endpointId: endpoint.id,
          eventType: WebhookEventType.DESTINATION_UPDATED,
          payload: { id: assignmentAttestation.id },
          payloadHash: `payload-${createUniqueSuffix()}`,
          status: DeliveryStatus.FAILED,
          attemptCount: 3,
          createdAt: new Date(Date.now() - 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 30 * 60 * 1000),
          lastAttemptAt: new Date(Date.now() - 30 * 60 * 1000),
          responseCode: 500,
        },
        {
          endpointId: endpoint.id,
          eventType: WebhookEventType.DESTINATION_UPDATED,
          payload: { id: `${assignmentAttestation.id}-pending` },
          payloadHash: `payload-${createUniqueSuffix()}`,
          status: DeliveryStatus.PENDING,
          attemptCount: 0,
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
          updatedAt: new Date(Date.now() - 10 * 60 * 1000),
          nextAttemptAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/v1/data-feed-health')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('Accept', 'application/json')
      .expect(200);
    const data = readApiObject<DataFeedHealthResponse>(
      response.body as unknown,
    );

    expect(data.partner.slug).toBe(partner.slug);
    expect(data.feed).toMatchObject({
      status: PartnerFeedHealthStatus.DEGRADED,
      environment: 'SANDBOX_ONLY',
    });
    expect(data.feed.lastAttestationReceivedAt).not.toBeNull();
    expect(data.feed.lastRevocationReceivedAt).not.toBeNull();
    expect(data.metrics).toMatchObject({
      activeDestinationCount: 1,
      activeAttestationCount: 1,
      staleDestinationCount: 1,
      staleAttestationCount: 1,
      failedDeliveryCount7d: 1,
      pendingDeliveryCount: 1,
      recentIngestionSuccessCount7d: 0,
      recentIngestionFailureCount7d: 0,
      degradedCorridorCount: 1,
      disconnectedCorridorCount: 0,
    });
    expect(data.corridors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetNetworkId,
          status: PartnerFeedHealthStatus.DEGRADED,
          productionGranted: false,
        }),
      ]),
    );
    expect(data.ingestion.recentActivity.length).toBe(0);
    expect(data.ingestion.recentFailures.length).toBe(0);
    expect(data.freshness.staleDestinations).toHaveLength(1);
    expect(data.freshness.staleAttestations).toHaveLength(1);
    expect(data.recentTrustEvents.length).toBeGreaterThanOrEqual(2);
    expect(data.deliveryFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpointLabel: 'Phase 25 Feed Endpoint',
        }),
      ]),
    );
    expect(data.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'resolve_feed_health',
        }),
        expect.objectContaining({
          key: 'review_stale_destinations',
        }),
      ]),
    );
  });

  it('records failed attestation ingestion attempts in feed-health history', async () => {
    const partner = await createPartnerContext(
      ['partners:read', 'attestations:write'],
      {
        dataPartnerEnabled: true,
        fullAttestationPartnerEnabled: true,
        onboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
        feedHealthStatus: PartnerFeedHealthStatus.DEGRADED,
      },
    );
    const signingKey = await createVerifiedSigningKey(partner.id);

    await request(app.getHttpServer())
      .post('/v1/attestations')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('Accept', 'application/json')
      .send({
        partnerSlug: partner.slug,
        keyId: signingKey.keyId,
        algorithm: SigningKeyAlgorithm.ED25519,
        attestationType: 'DESTINATION_ASSIGNMENT',
        sequenceNumber: 1,
        recipientExternalId: `recipient-${createUniqueSuffix()}`,
        recipientDisplayName: 'Failed Feed Recipient',
        recipientIdentifier: 'failed@phase25',
        identifierKind: 'PARTNER_HANDLE',
        chain: 'ethereum',
        assetCode: 'usdc',
        assetSymbol: 'USDC',
        tokenStandard: 'ERC20',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        memo: '',
        issuedAt: new Date().toISOString(),
        effectiveFrom: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        signature: Buffer.from('invalid-signature').toString('base64'),
      })
      .expect(401);

    const response = await request(app.getHttpServer())
      .get('/v1/data-feed-health')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('Accept', 'application/json')
      .expect(200);
    const data = readApiObject<DataFeedHealthResponse>(
      response.body as unknown,
    );

    expect(data.metrics.recentIngestionFailureCount7d).toBe(1);
    expect(data.ingestion.recentFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failureReason: 'Attestation signature verification failed.',
        }),
      ]),
    );
    expect(data.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'review_ingestion_failures',
        }),
      ]),
    );
  });

  async function createPartnerContext(
    scopes: string[],
    overrides?: Partial<{
      dataPartnerEnabled: boolean;
      feedHealthStatus: PartnerFeedHealthStatus;
      fullAttestationPartnerEnabled: boolean;
      onboardingStage: PartnerOnboardingStage;
    }>,
  ): Promise<PartnerContext> {
    const slug = `phase25-${createUniqueSuffix()}`;
    const generatedCredential = generateApiCredential();
    const partner = await prismaClient.partner.create({
      data: {
        slug,
        displayName: `Phase 25 ${slug}`,
        partnerType: PartnerType.PAYMENT_PROCESSOR,
        status: PartnerStatus.ACTIVE,
        dataPartnerEnabled: overrides?.dataPartnerEnabled ?? true,
        fullAttestationPartnerEnabled:
          overrides?.fullAttestationPartnerEnabled ?? false,
        webhooksEnabled: true,
        sandboxEnabled: true,
        productionEnabled: false,
        onboardingStage:
          overrides?.onboardingStage ?? PartnerOnboardingStage.API_ACCESS_READY,
        feedHealthStatus:
          overrides?.feedHealthStatus ?? PartnerFeedHealthStatus.DEGRADED,
      },
    });

    await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 25 E2E',
        keyPrefix: generatedCredential.keyPrefix,
        secretHash: generatedCredential.secretHash,
        scopes,
      },
    });
    createdPartnerIds.add(partner.id);

    return {
      id: partner.id,
      slug: partner.slug,
      credentialSecret: generatedCredential.secret,
    };
  }

  async function createAssetNetwork(): Promise<string> {
    const suffix = createUniqueSuffix();
    const chain = await prismaClient.chain.create({
      data: {
        slug: `phase25-chain-${suffix}`,
        displayName: `Phase 25 Chain ${suffix}`,
        family: ChainFamily.OTHER,
      },
    });
    const asset = await prismaClient.asset.create({
      data: {
        code: `phase25-${suffix}`,
        symbol: `P${suffix.slice(0, 5).toUpperCase()}`,
        displayName: `Phase 25 Asset ${suffix}`,
      },
    });
    const assetNetwork = await prismaClient.assetNetwork.create({
      data: {
        assetId: asset.id,
        chainId: chain.id,
        standard: TokenStandard.OTHER,
      },
    });

    return assetNetwork.id;
  }

  async function createSigningKey(partnerId: string): Promise<string> {
    const signingKey = await prismaClient.partnerSigningKey.create({
      data: {
        partnerId,
        keyId: `phase25-signing-key-${createUniqueSuffix()}`,
        algorithm: SigningKeyAlgorithm.ED25519,
        publicKeyPem:
          '-----BEGIN PUBLIC KEY-----\nPHASE25\n-----END PUBLIC KEY-----',
        fingerprint: `fingerprint-${createUniqueSuffix()}`,
        status: SigningKeyStatus.ACTIVE,
        validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    });

    return signingKey.id;
  }

  async function createVerifiedSigningKey(partnerId: string): Promise<{
    keyId: string;
  }> {
    const { publicKey } = generateKeyPairSync('ed25519');
    const keyId = `phase25-signing-key-${createUniqueSuffix()}`;

    await prismaClient.partnerSigningKey.create({
      data: {
        partnerId,
        keyId,
        algorithm: SigningKeyAlgorithm.ED25519,
        publicKeyPem: publicKey.export({
          format: 'pem',
          type: 'spki',
        }) as string,
        fingerprint: `fingerprint-${createUniqueSuffix()}`,
        status: SigningKeyStatus.ACTIVE,
        validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      keyId,
    };
  }

  function createUniqueSuffix() {
    return randomBytes(6).toString('hex');
  }

  function readApiObject<T>(body: unknown): T {
    if (
      typeof body !== 'object' ||
      body === null ||
      !('status' in body) ||
      !('data' in body)
    ) {
      throw new Error('Expected API response envelope.');
    }

    return (body as { data: T }).data;
  }
});
