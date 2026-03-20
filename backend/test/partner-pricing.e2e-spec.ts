import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PartnerOnboardingStage,
  PartnerPricingPlan,
  PartnerStatus,
  PartnerType,
  PrismaClient,
  QueryType,
  ResolutionBatchInputFormat,
  ResolutionOutcome,
  RiskLevel,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { generateApiCredential } from '../src/partners/api-credential.util';

interface ApiEnvelope<T> {
  data: T;
  status: true;
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase48-admin-token';
const webhookSigningMasterSecret = 'phase48-webhook-signing-secret';

describe('Partner pricing and plan usage API (e2e)', () => {
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

  it('returns current billing-period usage and Starter requirements on the partner profile endpoint', async () => {
    const partner = await createApiCredentialContext({
      pricingPlan: PartnerPricingPlan.STARTER,
      scopes: ['partners:read'],
    });

    const currentMonthDate = new Date();
    const previousMonthDate = new Date(
      Date.UTC(
        currentMonthDate.getUTCFullYear(),
        currentMonthDate.getUTCMonth() - 1,
        20,
        12,
        0,
        0,
        0,
      ),
    );

    await prismaClient.resolutionRequest.createMany({
      data: [
        buildResolutionRequest(partner.partnerId, QueryType.RESOLVE),
        buildResolutionRequest(partner.partnerId, QueryType.CONFIRM_ADDRESS),
        buildResolutionRequest(partner.partnerId, QueryType.VERIFY_ADDRESS),
        buildResolutionRequest(partner.partnerId, QueryType.BATCH_VERIFY),
        buildResolutionRequest(
          partner.partnerId,
          QueryType.RESOLVE,
          previousMonthDate,
        ),
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/v1/partners/me/plan-usage')
      .set('Authorization', `Bearer ${partner.secret}`)
      .expect(200);

    const billing = readApiObject<{
      plan: {
        code: PartnerPricingPlan;
        label: string;
        requirements: {
          requirementStatus: string;
        };
        entitlements: {
          bulkVerificationEnabled: boolean;
          verificationAnalyticsEnabled: boolean;
        };
      };
      usage: {
        verificationsUsed: number;
        byRecipientVerifications: number;
        byAddressVerifications: number;
        verifyTransferVerifications: number;
        batchVerifications: number;
        includedVerifications: number | null;
        overageVerifications: number;
      };
    }>(response.body);

    expect(billing.plan.code).toBe(PartnerPricingPlan.STARTER);
    expect(billing.plan.label).toBe('Starter');
    expect(billing.plan.requirements.requirementStatus).toBe('UNMET');
    expect(billing.plan.entitlements.bulkVerificationEnabled).toBe(false);
    expect(billing.plan.entitlements.verificationAnalyticsEnabled).toBe(false);
    expect(billing.usage.verificationsUsed).toBe(4);
    expect(billing.usage.byRecipientVerifications).toBe(1);
    expect(billing.usage.byAddressVerifications).toBe(1);
    expect(billing.usage.verifyTransferVerifications).toBe(1);
    expect(billing.usage.batchVerifications).toBe(1);
    expect(billing.usage.includedVerifications).toBe(2000);
    expect(billing.usage.overageVerifications).toBe(0);
  });

  it('denies Starter partners from batch verification even when the raw capability flag is enabled', async () => {
    const starterPartner = await createApiCredentialContext({
      pricingPlan: PartnerPricingPlan.STARTER,
      scopes: ['resolution:batch'],
    });

    await request(app.getHttpServer())
      .post('/v1/resolution/batch')
      .set('Authorization', `Bearer ${starterPartner.secret}`)
      .send({
        inputFormat: ResolutionBatchInputFormat.JSON,
        chain: 'ethereum',
        asset: 'USDC',
        rows: [],
      })
      .expect(403);
  });

  it('allows Scale partners through the batch policy gate before request validation executes', async () => {
    const scalePartner = await createApiCredentialContext({
      pricingPlan: PartnerPricingPlan.SCALE,
      scopes: ['resolution:batch'],
    });

    await request(app.getHttpServer())
      .post('/v1/resolution/batch')
      .set('Authorization', `Bearer ${scalePartner.secret}`)
      .send({
        inputFormat: ResolutionBatchInputFormat.JSON,
        chain: 'ethereum',
        asset: 'USDC',
        rows: [],
      })
      .expect(400);
  });

  async function createApiCredentialContext(params: {
    pricingPlan: PartnerPricingPlan;
    scopes: string[];
  }) {
    const partner = await prismaClient.partner.create({
      data: {
        slug: `phase48-${createUniqueSuffix()}`,
        displayName: 'Phase 48 Partner',
        partnerType: PartnerType.EXCHANGE,
        status: PartnerStatus.ACTIVE,
        pricingPlan: params.pricingPlan,
        apiConsumerEnabled: true,
        dataPartnerEnabled: false,
        fullAttestationPartnerEnabled: false,
        webhooksEnabled: true,
        batchVerificationEnabled: true,
        auditExportsEnabled: true,
        sandboxEnabled: true,
        productionEnabled: false,
        onboardingStage: PartnerOnboardingStage.API_ACCESS_READY,
      },
    });
    createdPartnerIds.add(partner.id);

    const generatedCredential = generateApiCredential();
    await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 48 Credential',
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

  function buildResolutionRequest(
    partnerId: string,
    queryType: QueryType,
    requestedAt = new Date(),
  ) {
    return {
      queryType,
      requesterPartnerId: partnerId,
      recipientIdentifierInput: 'pricing-test',
      recipientIdentifierNormalized: 'pricing-test',
      platformInput: queryType === QueryType.CONFIRM_ADDRESS ? 'bybit' : null,
      chainInput: 'ethereum',
      assetInput: 'USDC',
      providedAddressRaw:
        queryType === QueryType.CONFIRM_ADDRESS ||
        queryType === QueryType.VERIFY_ADDRESS ||
        queryType === QueryType.BATCH_VERIFY
          ? '0x0000000000000000000000000000000000000001'
          : null,
      providedAddressNormalized:
        queryType === QueryType.CONFIRM_ADDRESS ||
        queryType === QueryType.VERIFY_ADDRESS ||
        queryType === QueryType.BATCH_VERIFY
          ? '0x0000000000000000000000000000000000000001'
          : null,
      outcome: ResolutionOutcome.RESOLVED,
      riskLevel: RiskLevel.LOW,
      recommendation: 'safe_to_send',
      flags: [],
      requestedAt,
    };
  }

  function readApiObject<T>(payload: unknown): T {
    return (payload as ApiEnvelope<T>).data;
  }

  function createUniqueSuffix() {
    return randomBytes(6).toString('hex');
  }
});
