import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ChainFamily,
  PartnerType,
  PartnerUserRole,
  PrismaClient,
  QueryType,
  ResolutionOutcome,
  RiskLevel,
  TokenStandard,
  WebhookStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashSecret } from '../src/common/security/secret-hash.util';
import { generateApiCredential } from '../src/partners/api-credential.util';

const requireModule = createRequire(__filename);

interface ApiEnvelope<T> {
  data: T;
  status: true;
}

interface DashboardLoginResponse {
  accessToken: string;
  partner: {
    id: string;
    slug: string;
  };
  user: {
    email: string;
    role: PartnerUserRole;
  };
}

interface ProductionApprovalRequestResponse {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedAt: string;
  reviewedAt: string | null;
  requestNote: string | null;
  reviewNote: string | null;
  requestedCorridors: Array<{
    id: string;
    assetNetwork: {
      id: string;
      chain: {
        slug: string;
      };
      asset: {
        symbol: string;
      };
    };
  }>;
  approvedCorridors: Array<{
    id: string;
    assetNetwork: {
      id: string;
      chain: {
        slug: string;
      };
      asset: {
        symbol: string;
      };
    };
  }>;
}

interface PartnerProfileResponse {
  readiness: {
    environment: string;
    statusLabel: string;
    approvedCorridorCount: number;
  };
  onboarding: {
    nextRecommendedAction: string | null;
  };
  productionApproval: {
    canRequest: boolean;
    canCancel: boolean;
    blockedReason: string | null;
    latestRequest: ProductionApprovalRequestResponse | null;
  };
}

interface PartnerProductionCorridorResponse {
  assetNetwork: {
    id: string;
  };
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase27-admin-token';
const webhookSigningMasterSecret = 'phase27-webhook-signing-secret';

describe('Production approval workflow (e2e)', () => {
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

    // Load the module after env vars are set so ConfigModule sees test values.
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

  it('lets an owner request approval, supports admin review, and updates readiness', async () => {
    const context = await createProductionReadyDashboardContext({
      role: PartnerUserRole.OWNER,
    });
    const requestedAssetNetwork =
      await createAssetNetworkFixture('approval-requested');
    const approvedAssetNetwork =
      await createAssetNetworkFixture('approval-approved');

    const requestResponse = await request(app.getHttpServer())
      .post('/v1/partners/me/production-approval-requests')
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .send({
        requestNote: 'Ready for production launch in NGN stablecoin corridors.',
        assetNetworkIds: [requestedAssetNetwork.id],
      })
      .expect(201);
    const createdRequest = readApiObject<ProductionApprovalRequestResponse>(
      requestResponse.body as unknown,
    );

    expect(createdRequest.status).toBe('PENDING');
    expect(createdRequest.requestNote).toContain('Ready for production launch');
    expect(createdRequest.requestedCorridors).toHaveLength(1);
    expect(createdRequest.requestedCorridors[0]?.assetNetwork.id).toBe(
      requestedAssetNetwork.id,
    );
    expect(createdRequest.approvedCorridors).toHaveLength(0);

    const pendingProfileResponse = await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .expect(200);
    const pendingProfile = readApiObject<PartnerProfileResponse>(
      pendingProfileResponse.body as unknown,
    );

    expect(pendingProfile.onboarding.nextRecommendedAction).toBe(
      'await_production_review',
    );
    expect(pendingProfile.productionApproval.canRequest).toBe(false);
    expect(pendingProfile.productionApproval.canCancel).toBe(true);
    expect(pendingProfile.productionApproval.latestRequest?.status).toBe(
      'PENDING',
    );

    await request(app.getHttpServer())
      .post(
        `/v1/partners/production-approval-requests/${createdRequest.id}/review`,
      )
      .set('x-admin-token', adminApiToken)
      .send({
        decision: 'APPROVED',
        reviewNote: 'Approved for initial production traffic.',
        approvedAssetNetworkIds: [approvedAssetNetwork.id],
      })
      .expect(201);

    const reviewedRequestResponse = await request(app.getHttpServer())
      .get('/v1/partners/me/production-approval-requests')
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .expect(200);
    const reviewedRequests = readApiObject<ProductionApprovalRequestResponse[]>(
      reviewedRequestResponse.body as unknown,
    );
    const reviewedRequest = reviewedRequests.find(
      (productionApprovalRequest) =>
        productionApprovalRequest.id === createdRequest.id,
    );

    expect(reviewedRequest?.approvedCorridors).toHaveLength(1);
    expect(reviewedRequest?.approvedCorridors[0]?.assetNetwork.id).toBe(
      approvedAssetNetwork.id,
    );

    const approvedProfileResponse = await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .expect(200);
    const approvedProfile = readApiObject<PartnerProfileResponse>(
      approvedProfileResponse.body as unknown,
    );

    expect(approvedProfile.readiness.environment).toBe('PRODUCTION_APPROVED');
    expect(approvedProfile.readiness.approvedCorridorCount).toBe(1);
    expect(approvedProfile.productionApproval.latestRequest?.status).toBe(
      'APPROVED',
    );
    expect(approvedProfile.productionApproval.blockedReason).toBe(
      'already_production_enabled',
    );

    const grantedCorridorsResponse = await request(app.getHttpServer())
      .get('/v1/partners/me/production-corridors')
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .expect(200);
    const grantedCorridors = readApiObject<PartnerProductionCorridorResponse[]>(
      grantedCorridorsResponse.body as unknown,
    );

    expect(grantedCorridors).toHaveLength(1);
    expect(grantedCorridors[0]?.assetNetwork.id).toBe(approvedAssetNetwork.id);
  });

  it('allows a pending request to be cancelled by an owner', async () => {
    const context = await createProductionReadyDashboardContext({
      role: PartnerUserRole.OWNER,
    });

    const requestResponse = await request(app.getHttpServer())
      .post('/v1/partners/me/production-approval-requests')
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .send({})
      .expect(201);
    const createdRequest = readApiObject<ProductionApprovalRequestResponse>(
      requestResponse.body as unknown,
    );

    const cancelResponse = await request(app.getHttpServer())
      .post(
        `/v1/partners/me/production-approval-requests/${createdRequest.id}/cancel`,
      )
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .expect(201);
    const cancelledRequest = readApiObject<ProductionApprovalRequestResponse>(
      cancelResponse.body as unknown,
    );

    expect(cancelledRequest.status).toBe('CANCELLED');

    const profileResponse = await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${context.dashboardAccessToken}`)
      .expect(200);
    const profile = readApiObject<PartnerProfileResponse>(
      profileResponse.body as unknown,
    );

    expect(profile.productionApproval.canRequest).toBe(true);
    expect(profile.productionApproval.canCancel).toBe(false);
    expect(profile.productionApproval.latestRequest?.status).toBe('CANCELLED');
  });

  it('rejects approval requests from API credentials and lower-privilege users', async () => {
    const ownerContext = await createProductionReadyDashboardContext({
      role: PartnerUserRole.OWNER,
    });

    await request(app.getHttpServer())
      .post('/v1/partners/me/production-approval-requests')
      .set('Authorization', `Bearer ${ownerContext.apiCredentialSecret}`)
      .send({})
      .expect(403);

    const developerContext = await createProductionReadyDashboardContext({
      role: PartnerUserRole.DEVELOPER,
    });

    await request(app.getHttpServer())
      .post('/v1/partners/me/production-approval-requests')
      .set('Authorization', `Bearer ${developerContext.dashboardAccessToken}`)
      .send({})
      .expect(403);
  });

  async function createProductionReadyDashboardContext(input: {
    role: PartnerUserRole;
  }): Promise<{
    dashboardAccessToken: string;
    apiCredentialSecret: string;
  }> {
    const partnerSlug = `phase27-${createUniqueSuffix()}`;
    const generatedCredential = generateApiCredential();
    const password = `phase27-password-${createUniqueSuffix()}`;
    const email = `${partnerSlug}@example.com`;
    const partner = await prismaClient.partner.create({
      data: {
        slug: partnerSlug,
        displayName: `Phase 27 ${partnerSlug}`,
        partnerType: PartnerType.EXCHANGE,
        apiConsumerEnabled: true,
        dataPartnerEnabled: false,
        webhooksEnabled: true,
        sandboxEnabled: true,
      },
    });

    await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 27 API credential',
        keyPrefix: generatedCredential.keyPrefix,
        secretHash: generatedCredential.secretHash,
        scopes: ['partners:read', 'partners:write'],
      },
    });

    await prismaClient.partnerUser.create({
      data: {
        partnerId: partner.id,
        email,
        fullName: 'Phase 27 User',
        role: input.role,
        scopes: resolveScopesForRole(input.role),
        passwordHash: hashSecret(password),
      },
    });

    await prismaClient.webhookEndpoint.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 27 webhook',
        url: `https://${partnerSlug}.example.com/webhooks/vervet`,
        signingSecretHash: 'phase27-signing-secret-hash',
        eventTypes: [],
        status: WebhookStatus.ACTIVE,
      },
    });

    await prismaClient.resolutionRequest.create({
      data: {
        queryType: QueryType.RESOLVE,
        requesterPartnerId: partner.id,
        recipientIdentifierInput: `sandbox@${partnerSlug}`,
        recipientIdentifierNormalized: `sandbox@${partnerSlug}`,
        chainInput: 'ethereum',
        assetInput: 'USDC',
        outcome: ResolutionOutcome.NO_MATCH,
        riskLevel: RiskLevel.LOW,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/v1/dashboard-auth/login')
      .send({
        email,
        password,
      })
      .expect(201);
    const login = readApiObject<DashboardLoginResponse>(
      loginResponse.body as unknown,
    );

    expect(login.user.role).toBe(input.role);

    return {
      dashboardAccessToken: login.accessToken,
      apiCredentialSecret: generatedCredential.secret,
    };
  }

  async function createAssetNetworkFixture(suffix: string) {
    const uniqueSuffix = createUniqueSuffix();
    const contractAddress = `0x${Math.floor(Math.random() * 10 ** 15)
      .toString(16)
      .padStart(40, '0')}`;
    const chain = await prismaClient.chain.create({
      data: {
        slug: `phase30-${suffix}-${uniqueSuffix}`,
        displayName: `Phase 30 ${suffix}`,
        family: ChainFamily.EVM,
        caip2: `eip155:${Math.floor(Math.random() * 10_000_000) + 300_000}`,
      },
    });
    const asset = await prismaClient.asset.create({
      data: {
        code: `P30${Math.floor(Math.random() * 10_000_000)}`,
        symbol: `P30${suffix.slice(0, 3).toUpperCase()}`,
        displayName: `Phase 30 ${suffix} Asset`,
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

function resolveScopesForRole(role: PartnerUserRole): string[] {
  switch (role) {
    case PartnerUserRole.ADMIN:
      return ['partners:read', 'partners:write', 'team:read', 'team:write'];
    case PartnerUserRole.DEVELOPER:
      return ['partners:read', 'partners:write', 'resolution:read'];
    case PartnerUserRole.ANALYST:
    case PartnerUserRole.READ_ONLY:
      return ['partners:read'];
    case PartnerUserRole.OWNER:
    default:
      return ['partners:read', 'partners:write', 'security:write'];
  }
}

function readApiObject<T>(value: unknown): T {
  if (!isApiEnvelope(value)) {
    throw new Error('Expected API response envelope.');
  }

  return value.data as T;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === true &&
    'data' in value
  );
}

function createUniqueSuffix(): string {
  return randomBytes(5).toString('hex');
}
