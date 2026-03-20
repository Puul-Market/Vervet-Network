import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ChainFamily,
  DestinationStatus,
  IdentifierKind,
  IdentifierStatus,
  IdentifierVisibility,
  PartnerStatus,
  PartnerType,
  PrismaClient,
  RecipientStatus,
  TokenStandard,
} from '@prisma/client';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { generateApiCredential } from '../src/partners/api-credential.util';

const requireModule = createRequire(__filename);

interface ApiEnvelope<T> {
  data: T;
  status: true;
}

interface DashboardMetadataResponse {
  assetNetworks: Array<{
    id: string;
    chain: {
      slug: string;
    };
    asset: {
      symbol: string;
    };
  }>;
  optionSets: {
    identifierKinds: string[];
    identifierVisibilities: string[];
    auditActorTypes: string[];
    auditExportFormats: string[];
    partnerPricingPlans: string[];
    credentialScopeDefinitions: Array<{
      value: string;
      label: string;
      description: string;
    }>;
  };
  onboarding: {
    taskDefinitions: Array<{
      key: string;
      ctaLabel: string;
    }>;
  };
  guidance: {
    dataSubmission: {
      endpointPath: string;
      notes: string[];
      steps: Array<{
        title: string;
        href: string;
      }>;
    };
  };
  sandbox: {
    presets: Array<{
      key: string;
      href: string;
    }>;
    batchDefaultInput: string | null;
    sampleResponse: unknown;
  };
}

interface AdminSetupMetadataResponse {
  optionSets: {
    partnerTypes: string[];
    partnerStatuses: string[];
    partnerPricingPlans: string[];
    partnerOnboardingStages: string[];
    partnerFeedHealthStatuses: string[];
    signingKeyAlgorithms: string[];
  };
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase32-admin-token';
const webhookSigningMasterSecret = 'phase32-webhook-signing-secret';

describe('Dashboard metadata API (e2e)', () => {
  let app: INestApplication<App>;
  let prismaClient: PrismaClient;
  const createdPartnerIds = new Set<string>();
  const createdAssetIds = new Set<string>();
  const createdChainIds = new Set<string>();
  const createdAssetNetworkIds = new Set<string>();

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
    await prismaClient.recipient.deleteMany({
      where: {
        partnerId: {
          in: Array.from(createdPartnerIds),
        },
      },
    });
    await prismaClient.partner.deleteMany({
      where: {
        id: {
          in: Array.from(createdPartnerIds),
        },
      },
    });
    await prismaClient.assetNetwork.deleteMany({
      where: {
        id: {
          in: Array.from(createdAssetNetworkIds),
        },
      },
    });
    await prismaClient.asset.deleteMany({
      where: {
        id: {
          in: Array.from(createdAssetIds),
        },
      },
    });
    await prismaClient.chain.deleteMany({
      where: {
        id: {
          in: Array.from(createdChainIds),
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

  it('returns partner dashboard metadata with backend-owned option sets and sandbox presets', async () => {
    const requester = await createPartnerContext(['partners:read']);
    const assetNetwork = await createAssetNetwork();
    await createSandboxFixture(requester.partnerId, assetNetwork.id);

    const response = await request(app.getHttpServer())
      .get('/v1/partners/me/dashboard-metadata')
      .set('Authorization', `Bearer ${requester.credentialSecret}`)
      .expect(200);
    const metadata = readApiObject<DashboardMetadataResponse>(
      response.body as unknown,
    );

    const listedAssetNetwork = metadata.assetNetworks.find(
      (candidate) => candidate.id === assetNetwork.id,
    );

    expect(listedAssetNetwork).toBeDefined();
    expect(listedAssetNetwork?.chain.slug).toBe(assetNetwork.chain.slug);
    expect(listedAssetNetwork?.asset.symbol).toBe(assetNetwork.asset.symbol);
    expect(metadata.optionSets.identifierKinds).toContain('PARTNER_HANDLE');
    expect(metadata.optionSets.identifierVisibilities).toContain('RESOLVABLE');
    expect(metadata.optionSets.auditActorTypes).toContain('PARTNER');
    expect(metadata.optionSets.auditExportFormats).toContain('CSV');
    expect(metadata.optionSets.partnerPricingPlans).toContain('STARTER');
    expect(metadata.optionSets.credentialScopeDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'resolution:read',
          label: 'Run resolution queries',
        }),
      ]),
    );
    expect(metadata.onboarding.taskDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'create_api_key',
          ctaLabel: 'Open API Keys',
        }),
      ]),
    );
    expect(metadata.guidance.dataSubmission.endpointPath).toBe(
      '/v1/attestations',
    );
    expect(metadata.guidance.dataSubmission.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('dashboard are operational drafts'),
      ]),
    );
    expect(metadata.guidance.dataSubmission.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Register signing key',
          href: '/access/signing-keys',
        }),
      ]),
    );
    expect(metadata.sandbox.presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'by_address',
        }),
      ]),
    );
    expect(metadata.sandbox.batchDefaultInput).toContain('client_ref');
    expect(metadata.sandbox.sampleResponse).not.toBeNull();
  });

  it('returns admin setup metadata with backend-owned setup option sets', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/partners/setup/metadata')
      .set('x-admin-token', adminApiToken)
      .expect(200);
    const metadata = readApiObject<AdminSetupMetadataResponse>(
      response.body as unknown,
    );

    expect(metadata.optionSets.partnerTypes).toContain('EXCHANGE');
    expect(metadata.optionSets.partnerStatuses).toContain('ACTIVE');
    expect(metadata.optionSets.partnerPricingPlans).toContain('SCALE');
    expect(metadata.optionSets.partnerOnboardingStages).toContain(
      'ACCOUNT_CREATED',
    );
    expect(metadata.optionSets.partnerFeedHealthStatuses).toContain('HEALTHY');
    expect(metadata.optionSets.signingKeyAlgorithms).toContain('ED25519');
  });

  async function createPartnerContext(scopes: string[]) {
    const suffix = createUniqueSuffix();
    const { keyPrefix, secret, secretHash } = generateApiCredential();
    const partner = await prismaClient.partner.create({
      data: {
        slug: `phase32-${suffix}`,
        displayName: `Phase 32 ${suffix}`,
        partnerType: PartnerType.EXCHANGE,
        status: PartnerStatus.ACTIVE,
        isDirectoryListed: true,
        apiConsumerEnabled: true,
        webhooksEnabled: true,
        sandboxEnabled: true,
        apiCredentials: {
          create: {
            label: 'metadata-test',
            keyPrefix,
            secretHash,
            scopes,
          },
        },
      },
      select: {
        id: true,
      },
    });
    createdPartnerIds.add(partner.id);

    return {
      credentialSecret: secret,
      partnerId: partner.id,
    };
  }

  async function createAssetNetwork(): Promise<{
    id: string;
    chain: {
      slug: string;
    };
    asset: {
      symbol: string;
    };
  }> {
    const suffix = createUniqueSuffix();
    const chain = await prismaClient.chain.create({
      data: {
        slug: `phase32-chain-${suffix}`,
        displayName: `Phase 32 Chain ${suffix}`,
        family: ChainFamily.EVM,
        isActive: true,
      },
    });
    createdChainIds.add(chain.id);

    const asset = await prismaClient.asset.create({
      data: {
        code: `phase32-asset-${suffix}`,
        symbol: `P${suffix.slice(0, 3).toUpperCase()}`,
        displayName: `Phase 32 Asset ${suffix}`,
        isActive: true,
      },
    });
    createdAssetIds.add(asset.id);

    const assetNetwork = await prismaClient.assetNetwork.create({
      data: {
        chainId: chain.id,
        assetId: asset.id,
        standard: TokenStandard.ERC20,
        isActive: true,
      },
      select: {
        id: true,
        chain: {
          select: {
            slug: true,
          },
        },
        asset: {
          select: {
            symbol: true,
          },
        },
      },
    });
    createdAssetNetworkIds.add(assetNetwork.id);

    return assetNetwork;
  }

  async function createSandboxFixture(
    partnerId: string,
    assetNetworkId: string,
  ) {
    const suffix = createUniqueSuffix();

    const recipient = await prismaClient.recipient.create({
      data: {
        partnerId,
        externalRecipientId: `recipient-${suffix}`,
        displayName: `Recipient ${suffix}`,
        status: RecipientStatus.ACTIVE,
      },
    });

    await prismaClient.recipientIdentifier.create({
      data: {
        recipientId: recipient.id,
        partnerId,
        kind: IdentifierKind.PARTNER_HANDLE,
        rawValue: `recipient-${suffix}@phase32`,
        normalizedValue: `recipient-${suffix}@phase32`,
        visibility: IdentifierVisibility.RESOLVABLE,
        status: IdentifierStatus.ACTIVE,
        isPrimary: true,
      },
    });

    const address = `0x${randomBytes(20).toString('hex')}`;

    await prismaClient.recipientDestination.create({
      data: {
        recipientId: recipient.id,
        assetNetworkId,
        addressRaw: address,
        addressNormalized: address.toLowerCase(),
        status: DestinationStatus.ACTIVE,
        effectiveFrom: new Date(),
        memoValue: '',
      },
    });
  }
});

function createUniqueSuffix() {
  return randomBytes(6).toString('hex');
}

function readApiObject<T>(value: unknown) {
  const envelope = value as ApiEnvelope<T>;

  return envelope.data;
}
