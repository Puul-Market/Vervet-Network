import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ChainFamily,
  DestinationStatus,
  PartnerStatus,
  PartnerType,
  PrismaClient,
  TokenStandard,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { generateApiCredential } from '../src/partners/api-credential.util';

interface PartnerContext {
  id: string;
  slug: string;
  credentialSecret: string;
}

interface ConfirmRecipientResponseRecord {
  confirmed: boolean;
  verified: boolean;
  recipientDisplayName: string | null;
  platform: string | null;
  recommendation: string;
  requiresPlatformSelection?: boolean;
  candidatePlatforms?: Array<{
    id: string;
    slug: string;
    displayName: string;
  }>;
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase45-admin-token';
const webhookSigningMasterSecret = 'phase45-webhook-signing-secret';

describe('Reverse lookup (e2e)', () => {
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

  it('confirms a unique reverse-lookup match without requiring platform', async () => {
    const requester = await createPartnerContext(['resolution:read']);
    const assetNetwork = await createAssetNetwork();
    const address = '0x1111111111111111111111111111111111111111';
    const platform = await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      address,
      displayName: 'Trust Wallet',
      slugPrefix: 'trustwallet',
    });

    const response = await request(app.getHttpServer())
      .post('/v1/resolution/by-address')
      .set('Authorization', `Bearer ${requester.credentialSecret}`)
      .send({
        address,
        chain: assetNetwork.chain.slug,
        asset: assetNetwork.asset.symbol,
      })
      .expect(201);

    const payload = readApiObject<ConfirmRecipientResponseRecord>(
      response.body as unknown,
    );

    expect(payload).toEqual(
      expect.objectContaining({
        confirmed: true,
        verified: true,
        platform: platform.slug,
        recommendation: 'safe_to_send',
        requiresPlatformSelection: false,
      }),
    );
    expect(payload.candidatePlatforms ?? []).toEqual([]);
  });

  it('asks the caller to choose a platform when multiple listed platforms share the address', async () => {
    const requester = await createPartnerContext(['resolution:read']);
    const assetNetwork = await createAssetNetwork();
    const sharedAddress = '0x2222222222222222222222222222222222222222';
    const bybit = await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      address: sharedAddress,
      displayName: 'Bybit',
      slugPrefix: 'bybit',
    });
    const trustWallet = await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      address: sharedAddress,
      displayName: 'Trust Wallet',
      slugPrefix: 'trustwallet',
    });

    const response = await request(app.getHttpServer())
      .post('/v1/resolution/by-address')
      .set('Authorization', `Bearer ${requester.credentialSecret}`)
      .send({
        address: sharedAddress,
        chain: assetNetwork.chain.slug,
        asset: assetNetwork.asset.symbol,
      })
      .expect(201);

    const payload = readApiObject<ConfirmRecipientResponseRecord>(
      response.body as unknown,
    );

    expect(payload).toEqual(
      expect.objectContaining({
        confirmed: false,
        verified: false,
        platform: null,
        recommendation: 'select_platform',
        requiresPlatformSelection: true,
      }),
    );
    expect(payload.candidatePlatforms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: bybit.slug,
          displayName: 'Bybit',
        }),
        expect.objectContaining({
          slug: trustWallet.slug,
          displayName: 'Trust Wallet',
        }),
      ]),
    );
  });

  async function createPartnerContext(
    scopes: string[],
  ): Promise<PartnerContext> {
    const slug = `phase45-${createUniqueSuffix()}`;
    const generatedCredential = generateApiCredential();
    const partner = await prismaClient.partner.create({
      data: {
        slug,
        displayName: `Phase 45 ${slug}`,
        partnerType: PartnerType.EXCHANGE,
        status: PartnerStatus.ACTIVE,
      },
    });

    await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 45 E2E',
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

  async function createAssetNetwork() {
    const suffix = createUniqueSuffix();
    const chain =
      (await prismaClient.chain.findUnique({
        where: {
          slug: 'base',
        },
      })) ??
      (await prismaClient.chain.create({
        data: {
          slug: 'base',
          displayName: 'Base',
          family: ChainFamily.EVM,
        },
      }));
    const asset = await prismaClient.asset.create({
      data: {
        code: `phase45-usdc-${suffix}`,
        symbol: `PUS${suffix.slice(0, 4).toUpperCase()}`,
        displayName: `Phase 45 Asset ${suffix}`,
      },
    });
    const assetNetwork = await prismaClient.assetNetwork.create({
      data: {
        assetId: asset.id,
        chainId: chain.id,
        standard: TokenStandard.ERC20,
      },
      include: {
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

    return assetNetwork;
  }

  async function createSupportedPlatform(params: {
    assetNetworkId: string;
    address: string;
    displayName: string;
    slugPrefix: string;
  }) {
    const partner = await createPartnerContext(['resolution:read']);
    await prismaClient.partner.update({
      where: {
        id: partner.id,
      },
      data: {
        slug: `${params.slugPrefix}-${createUniqueSuffix()}`,
        displayName: params.displayName,
        isDirectoryListed: true,
        partnerType:
          params.slugPrefix === 'trustwallet'
            ? PartnerType.WALLET
            : PartnerType.EXCHANGE,
      },
    });
    const updatedPartner = await prismaClient.partner.findUniqueOrThrow({
      where: {
        id: partner.id,
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
      },
    });
    const recipient = await prismaClient.recipient.create({
      data: {
        partnerId: partner.id,
        externalRecipientId: `recipient-${createUniqueSuffix()}`,
        displayName: `${params.displayName} User`,
      },
    });

    await prismaClient.recipientDestination.create({
      data: {
        recipientId: recipient.id,
        assetNetworkId: params.assetNetworkId,
        addressRaw: params.address,
        addressNormalized: params.address.toLowerCase(),
        status: DestinationStatus.ACTIVE,
        isDefault: true,
        effectiveFrom: new Date(Date.now() - 60_000),
      },
    });

    return updatedPartner;
  }

  function createUniqueSuffix(): string {
    return randomBytes(5).toString('hex');
  }

  function readApiObject<T>(payload: unknown): T {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('status' in payload) ||
      !('data' in payload)
    ) {
      throw new Error('Unexpected API response payload.');
    }

    return (payload as { data: T }).data;
  }
});
