import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PartnerOnboardingStage,
  PartnerStatus,
  PartnerType,
  PartnerUserRole,
  PrismaClient,
  ResolutionBatchInputFormat,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { hashSecret } from '../src/common/security/secret-hash.util';
import { generateApiCredential } from '../src/partners/api-credential.util';

interface ApiEnvelope<T> {
  data: T;
  status: true;
}

interface DashboardLoginResponse {
  accessToken: string;
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase32-admin-token';
const webhookSigningMasterSecret = 'phase32-webhook-signing-secret';

describe('Partner policy enforcement (e2e)', () => {
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

  it('denies registry access when the partner is not data-enabled', async () => {
    const partner = await createApiCredentialContext({
      scopes: ['recipients:read'],
    });

    await request(app.getHttpServer())
      .get('/v1/recipients')
      .set('Authorization', `Bearer ${partner.secret}`)
      .expect(403);
  });

  it('denies batch verification when the batch capability is disabled', async () => {
    const partner = await createApiCredentialContext({
      batchVerificationEnabled: false,
      scopes: ['resolution:batch'],
    });

    await request(app.getHttpServer())
      .post('/v1/resolution/batch')
      .set('Authorization', `Bearer ${partner.secret}`)
      .send({
        inputFormat: ResolutionBatchInputFormat.JSON,
        chain: 'ethereum',
        asset: 'USDC',
        rows: [],
      })
      .expect(403);
  });

  it('denies live resolution execution when the partner has no operational environment enabled', async () => {
    const partner = await createApiCredentialContext({
      productionEnabled: false,
      sandboxEnabled: false,
      scopes: ['resolution:read'],
    });

    await request(app.getHttpServer())
      .post('/v1/resolution/by-recipient')
      .set('Authorization', `Bearer ${partner.secret}`)
      .send({
        recipientIdentifier: 'jane@bybit',
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(403);
  });

  it('denies platform listing when the partner has no operational environment enabled', async () => {
    const partner = await createApiCredentialContext({
      productionEnabled: false,
      sandboxEnabled: false,
      scopes: ['resolution:read'],
    });

    await request(app.getHttpServer())
      .get('/v1/platforms')
      .set('Authorization', `Bearer ${partner.secret}`)
      .expect(403);
  });

  it('denies recipient mutations before data mapping onboarding has started', async () => {
    const partner = await createApiCredentialContext({
      dataPartnerEnabled: true,
      onboardingStage: PartnerOnboardingStage.ACCOUNT_CREATED,
      scopes: ['recipients:write'],
    });

    await request(app.getHttpServer())
      .post('/v1/recipients')
      .set('Authorization', `Bearer ${partner.secret}`)
      .send({
        externalRecipientId: `recipient-${createUniqueSuffix()}`,
        displayName: 'Phase 32 Recipient',
        primaryIdentifier: `phase32-${createUniqueSuffix()}@demo`,
      })
      .expect(403);
  });

  it('denies API key management to analyst dashboard users', async () => {
    const dashboardSession = await createDashboardSessionContext({
      role: PartnerUserRole.ANALYST,
      scopes: [
        'partners:read',
        'recipients:read',
        'destinations:read',
        'attestations:read',
        'resolution:read',
        'webhooks:read',
        'audit:read',
      ],
    });

    await request(app.getHttpServer())
      .get('/v1/partners/me/api-credentials')
      .set('Authorization', `Bearer ${dashboardSession.accessToken}`)
      .expect(403);
  });

  it('denies security updates to admin users when owner-only enforcement applies', async () => {
    const dashboardSession = await createDashboardSessionContext({
      role: PartnerUserRole.ADMIN,
      scopes: ['partners:read', 'security:read', 'security:write'],
    });

    await request(app.getHttpServer())
      .patch('/v1/partners/me/security-settings')
      .set('Authorization', `Bearer ${dashboardSession.accessToken}`)
      .send({
        credentialRotationDays: 45,
        enforceMfa: true,
        ipAllowlist: [],
        sessionIdleTimeoutMinutes: 120,
      })
      .expect(403);
  });

  it('allows full-attestation-only partners to read registry data and exposes the correct profile label', async () => {
    const partner = await createApiCredentialContext({
      apiConsumerEnabled: false,
      dataPartnerEnabled: false,
      fullAttestationPartnerEnabled: true,
      onboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
      scopes: ['partners:read', 'recipients:read'],
    });

    const recipientsResponse = await request(app.getHttpServer())
      .get('/v1/recipients')
      .set('Authorization', `Bearer ${partner.secret}`)
      .expect(200);

    expect(
      Array.isArray(readApiObject<unknown[]>(recipientsResponse.body)),
    ).toBe(true);

    const profileResponse = await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${partner.secret}`)
      .expect(200);

    const profile = readApiObject<{
      capabilities: { profileLabel: string };
      onboarding: { blockedTasks: string[] };
    }>(profileResponse.body);

    expect(profile.capabilities.profileLabel).toBe('FULL_ATTESTATION_PARTNER');
    expect(profile.onboarding.blockedTasks).not.toContain(
      'data_partner_capability_disabled',
    );
  });

  async function createApiCredentialContext(params: {
    scopes: string[];
    apiConsumerEnabled?: boolean;
    batchVerificationEnabled?: boolean;
    dataPartnerEnabled?: boolean;
    fullAttestationPartnerEnabled?: boolean;
    onboardingStage?: PartnerOnboardingStage;
    sandboxEnabled?: boolean;
    productionEnabled?: boolean;
  }) {
    const partner = await prismaClient.partner.create({
      data: {
        slug: `phase32-${createUniqueSuffix()}`,
        displayName: 'Phase 32 Partner',
        partnerType: PartnerType.EXCHANGE,
        status: PartnerStatus.ACTIVE,
        apiConsumerEnabled: params.apiConsumerEnabled ?? true,
        dataPartnerEnabled: params.dataPartnerEnabled ?? false,
        fullAttestationPartnerEnabled:
          params.fullAttestationPartnerEnabled ?? false,
        webhooksEnabled: true,
        batchVerificationEnabled: params.batchVerificationEnabled ?? true,
        auditExportsEnabled: true,
        sandboxEnabled: params.sandboxEnabled ?? true,
        productionEnabled: params.productionEnabled ?? false,
        onboardingStage:
          params.onboardingStage ?? PartnerOnboardingStage.ACCOUNT_CREATED,
      },
    });
    createdPartnerIds.add(partner.id);

    const generatedCredential = generateApiCredential();
    await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 32 credential',
        keyPrefix: generatedCredential.keyPrefix,
        secretHash: generatedCredential.secretHash,
        scopes: params.scopes,
        status: PartnerStatus.ACTIVE,
      },
    });

    return {
      partnerId: partner.id,
      secret: generatedCredential.secret,
    };
  }

  async function createDashboardSessionContext(params: {
    role: PartnerUserRole;
    scopes: string[];
  }) {
    const password = `Vervet-${createUniqueSuffix()}-Password!`;
    const partner = await prismaClient.partner.create({
      data: {
        slug: `phase32-dashboard-${createUniqueSuffix()}`,
        displayName: 'Phase 32 Dashboard Partner',
        partnerType: PartnerType.EXCHANGE,
        status: PartnerStatus.ACTIVE,
        apiConsumerEnabled: true,
        dataPartnerEnabled: true,
        fullAttestationPartnerEnabled: true,
        webhooksEnabled: true,
        batchVerificationEnabled: true,
        auditExportsEnabled: true,
        sandboxEnabled: true,
        productionEnabled: false,
        onboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
      },
    });
    createdPartnerIds.add(partner.id);

    const email = `${params.role.toLowerCase()}-${createUniqueSuffix()}@phase32.local`;
    await prismaClient.partnerUser.create({
      data: {
        partnerId: partner.id,
        email,
        fullName: `Phase 32 ${params.role}`,
        role: params.role,
        scopes: params.scopes,
        passwordHash: hashSecret(password),
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/v1/dashboard-auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    return readApiObject<DashboardLoginResponse>(loginResponse.body as unknown);
  }
});

function readApiObject<T>(value: unknown): T {
  if (
    !value ||
    typeof value !== 'object' ||
    !('status' in value) ||
    !('data' in value)
  ) {
    throw new Error('Unexpected API response shape.');
  }

  const envelope = value as ApiEnvelope<T>;
  return envelope.data;
}

function createUniqueSuffix(): string {
  return randomBytes(6).toString('hex');
}
