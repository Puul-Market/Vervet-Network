import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ChainFamily,
  PartnerFeedHealthStatus,
  PartnerOnboardingStage,
  PartnerStatus,
  PartnerType,
  PartnerUserRole,
  PrismaClient,
  ProductionApprovalRequestStatus,
  TokenStandard,
} from '@prisma/client';
import { createRequire } from 'node:module';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashSecret } from '../src/common/security/secret-hash.util';

const requireModule = createRequire(__filename);

interface ApiEnvelope<T> {
  data: T;
  status: true;
}

interface AdminPartnerResponse {
  id: string;
  slug: string;
  displayName: string;
  status: PartnerStatus;
  capabilities: {
    dataPartnerEnabled: boolean;
    fullAttestationPartnerEnabled: boolean;
    sandboxEnabled: boolean;
  };
  onboarding: {
    stage: PartnerOnboardingStage;
  };
  readiness: {
    feedHealthStatus: PartnerFeedHealthStatus;
  };
}

interface AdminProductionApprovalRequestResponse {
  id: string;
  status: ProductionApprovalRequestStatus;
  partner: {
    slug: string;
  };
}

interface AdminProductionCorridorResponse {
  id: string;
  status: 'GRANTED' | 'REVOKED';
  assetNetwork: {
    id: string;
    chain: {
      slug: string;
      displayName: string;
    };
    asset: {
      code: string;
      symbol: string;
    };
  };
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase28-admin-token';
const webhookSigningMasterSecret = 'phase28-webhook-signing-secret';

describe('Admin partner operations (e2e)', () => {
  let app: INestApplication<App>;
  let prismaClient: PrismaClient;

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

    const appModuleImport = requireModule(
      '../src/app.module',
    ) as typeof import('../src/app.module');
    const { AppModule } = appModuleImport;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  });

  it('lists partners with admin workspace state', async () => {
    const partner = await createPartnerFixture('list');

    const response = await request(app.getHttpServer())
      .get('/v1/partners')
      .set('x-admin-token', adminApiToken)
      .expect(200);
    const partners = readApiArray<AdminPartnerResponse>(
      response.body as unknown,
    );
    const listedPartner = partners.find((item) => item.id === partner.id);

    expect(listedPartner).toBeDefined();
    expect(listedPartner?.slug).toBe(partner.slug);
    expect(listedPartner?.capabilities.dataPartnerEnabled).toBe(false);
    expect(listedPartner?.onboarding.stage).toBe(
      PartnerOnboardingStage.ACCOUNT_CREATED,
    );
  });

  it('lists pending production approval requests with partner context', async () => {
    const context = await createPendingApprovalFixture('queue');

    const response = await request(app.getHttpServer())
      .get('/v1/partners/production-approval-requests')
      .query({
        status: ProductionApprovalRequestStatus.PENDING,
      })
      .set('x-admin-token', adminApiToken)
      .expect(200);
    const requests = readApiArray<AdminProductionApprovalRequestResponse>(
      response.body as unknown,
    );
    const listedRequest = requests.find(
      (item) => item.id === context.requestId,
    );

    expect(listedRequest).toBeDefined();
    expect(listedRequest?.partner.slug).toBe(context.partnerSlug);
    expect(listedRequest?.status).toBe(ProductionApprovalRequestStatus.PENDING);
  });

  it('updates partner admin-controlled state', async () => {
    const partner = await createPartnerFixture('update');

    const response = await request(app.getHttpServer())
      .patch(`/v1/partners/${partner.id}/admin-state`)
      .set('x-admin-token', adminApiToken)
      .send({
        status: PartnerStatus.SUSPENDED,
        onboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
        feedHealthStatus: PartnerFeedHealthStatus.DEGRADED,
        apiConsumerEnabled: true,
        dataPartnerEnabled: true,
        fullAttestationPartnerEnabled: false,
        webhooksEnabled: true,
        batchVerificationEnabled: false,
        auditExportsEnabled: true,
        sandboxEnabled: true,
      })
      .expect(200);
    const updatedPartner = readApiObject<AdminPartnerResponse>(
      response.body as unknown,
    );

    expect(updatedPartner.status).toBe(PartnerStatus.SUSPENDED);
    expect(updatedPartner.onboarding.stage).toBe(
      PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
    );
    expect(updatedPartner.readiness.feedHealthStatus).toBe(
      PartnerFeedHealthStatus.DEGRADED,
    );
    expect(updatedPartner.capabilities.dataPartnerEnabled).toBe(true);
  });

  it('lists available corridors and grants then revokes partner production access per corridor', async () => {
    const partner = await createPartnerFixture('corridor');
    const assetNetwork = await createAssetNetworkFixture('corridor');

    const availableResponse = await request(app.getHttpServer())
      .get('/v1/partners/corridors')
      .set('x-admin-token', adminApiToken)
      .expect(200);
    const availableCorridors = readApiArray<{
      id: string;
      chain: { slug: string };
      asset: { code: string };
    }>(availableResponse.body as unknown);

    expect(
      availableCorridors.some((corridor) => corridor.id === assetNetwork.id),
    ).toBe(true);

    const grantResponse = await request(app.getHttpServer())
      .post(`/v1/partners/${partner.id}/production-corridors`)
      .set('x-admin-token', adminApiToken)
      .send({
        assetNetworkId: assetNetwork.id,
        enabled: true,
        note: 'Granted for NGN pilot launch.',
      })
      .expect(201);
    const grantedCorridor = readApiObject<AdminProductionCorridorResponse>(
      grantResponse.body as unknown,
    );

    expect(grantedCorridor.status).toBe('GRANTED');
    expect(grantedCorridor.assetNetwork.id).toBe(assetNetwork.id);

    const partnerCorridorsResponse = await request(app.getHttpServer())
      .get(`/v1/partners/${partner.id}/production-corridors`)
      .set('x-admin-token', adminApiToken)
      .expect(200);
    const partnerCorridors = readApiArray<AdminProductionCorridorResponse>(
      partnerCorridorsResponse.body as unknown,
    );

    expect(partnerCorridors).toHaveLength(1);
    expect(partnerCorridors[0]?.assetNetwork.id).toBe(assetNetwork.id);

    const revokeResponse = await request(app.getHttpServer())
      .post(`/v1/partners/${partner.id}/production-corridors`)
      .set('x-admin-token', adminApiToken)
      .send({
        assetNetworkId: assetNetwork.id,
        enabled: false,
      })
      .expect(201);
    const revokedCorridor = readApiObject<AdminProductionCorridorResponse>(
      revokeResponse.body as unknown,
    );

    expect(revokedCorridor.status).toBe('REVOKED');

    const partnerAfterRevokeResponse = await request(app.getHttpServer())
      .get(`/v1/partners/${partner.id}/production-corridors`)
      .set('x-admin-token', adminApiToken)
      .expect(200);
    const corridorsAfterRevoke = readApiArray<AdminProductionCorridorResponse>(
      partnerAfterRevokeResponse.body as unknown,
    );

    expect(corridorsAfterRevoke).toHaveLength(0);
  });

  async function createPartnerFixture(suffix: string) {
    return prismaClient.partner.create({
      data: {
        slug: `phase28-${suffix}-${createUniqueSuffix()}`,
        displayName: `Phase 28 ${suffix}`,
        partnerType: PartnerType.EXCHANGE,
        status: PartnerStatus.ACTIVE,
        apiConsumerEnabled: true,
        dataPartnerEnabled: false,
        fullAttestationPartnerEnabled: false,
        webhooksEnabled: true,
        batchVerificationEnabled: true,
        auditExportsEnabled: true,
        sandboxEnabled: true,
        productionEnabled: false,
        onboardingStage: PartnerOnboardingStage.ACCOUNT_CREATED,
        feedHealthStatus: PartnerFeedHealthStatus.UNKNOWN,
        securitySettings: {
          create: {},
        },
      },
    });
  }

  async function createPendingApprovalFixture(suffix: string) {
    const partner = await createPartnerFixture(suffix);
    const partnerUser = await prismaClient.partnerUser.create({
      data: {
        partnerId: partner.id,
        email: `${partner.slug}@example.com`,
        fullName: 'Queue Reviewer',
        role: PartnerUserRole.OWNER,
        scopes: ['partners:read', 'partners:write'],
        passwordHash: hashSecret('phase28-password'),
      },
    });
    const approvalRequest =
      await prismaClient.partnerProductionApprovalRequest.create({
        data: {
          partnerId: partner.id,
          requestedByUserId: partnerUser.id,
          requestNote: 'Please approve this partner for production.',
        },
      });

    return {
      partnerSlug: partner.slug,
      requestId: approvalRequest.id,
    };
  }

  async function createAssetNetworkFixture(suffix: string) {
    const uniqueSuffix = createUniqueSuffix();
    const contractAddress = `0x${Math.floor(Math.random() * 10 ** 15)
      .toString(16)
      .padStart(40, '0')}`;
    const chain = await prismaClient.chain.create({
      data: {
        slug: `phase29-${suffix}-${uniqueSuffix}`,
        displayName: `Phase 29 ${suffix}`,
        family: ChainFamily.EVM,
        caip2: `eip155:${Math.floor(Math.random() * 10_000_000) + 100_000}`,
      },
    });
    const asset = await prismaClient.asset.create({
      data: {
        code: `P29${Math.floor(Math.random() * 10_000_000)}`,
        symbol: `P29${suffix.slice(0, 3).toUpperCase()}`,
        displayName: `Phase 29 ${suffix} Asset`,
      },
    });

    return prismaClient.assetNetwork.create({
      data: {
        chainId: chain.id,
        assetId: asset.id,
        standard: TokenStandard.ERC20,
        contractAddressRaw: contractAddress,
        contractAddressNormalized: contractAddress,
      },
    });
  }
});

function readApiArray<T>(payload: unknown): T[] {
  const body = payload as ApiEnvelope<T[]>;
  return body.data;
}

function readApiObject<T>(payload: unknown): T {
  const body = payload as ApiEnvelope<T>;
  return body.data;
}

function createUniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
}
