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

interface SupportedPlatformResponseRecord {
  id: string;
  slug: string;
  displayName: string;
  partnerType: PartnerType;
  supportsByAddress: boolean;
  supportsByRecipient: boolean;
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase20-admin-token';
const webhookSigningMasterSecret = 'phase20-webhook-signing-secret';

describe('Platforms API (e2e)', () => {
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

  it('requires the resolution:read scope to list supported platforms', async () => {
    const requester = await createPartnerContext(['partners:read']);

    await request(app.getHttpServer())
      .get('/v1/platforms')
      .set('Authorization', `Bearer ${requester.credentialSecret}`)
      .expect(403);
  });

  it('lists active supported platforms with by-address and by-recipient capabilities', async () => {
    const requester = await createPartnerContext(['resolution:read']);
    const assetNetwork = await createAssetNetwork();
    const both = await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      withIdentifier: true,
    });
    const byAddressOnly = await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      withIdentifier: false,
    });
    const noSupport = await createPartnerContext(['resolution:read']);
    await createRecipientWithoutDestination(noSupport.id);
    const disabled = await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      withIdentifier: true,
      status: PartnerStatus.DISABLED,
    });

    const response = await request(app.getHttpServer())
      .get('/v1/platforms')
      .set('Authorization', `Bearer ${requester.credentialSecret}`)
      .expect(200);
    const platforms = readApiArray<SupportedPlatformResponseRecord>(
      response.body as unknown,
    );

    expect(platforms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: both.slug,
          supportsByAddress: true,
          supportsByRecipient: true,
        }),
        expect.objectContaining({
          slug: byAddressOnly.slug,
          supportsByAddress: true,
          supportsByRecipient: false,
        }),
      ]),
    );
    expect(platforms.some((platform) => platform.slug === noSupport.slug)).toBe(
      false,
    );
    expect(platforms.some((platform) => platform.slug === disabled.slug)).toBe(
      false,
    );
  });

  it('filters supported platforms by chain, asset, and lookup mode', async () => {
    const requester = await createPartnerContext(['resolution:read']);
    const matchingAssetNetwork = await createAssetNetwork({
      chainSlug: `phase20-base-${createUniqueSuffix()}`,
      chainDisplayName: 'Phase 20 Base',
      assetCode: `pusdc${createUniqueSuffix()}`,
      assetSymbol: `PUS${createUniqueSuffix().slice(0, 4).toUpperCase()}`,
    });
    const otherAssetNetwork = await createAssetNetwork({
      chainSlug: `phase20-other-${createUniqueSuffix()}`,
      chainDisplayName: 'Phase 20 Other',
      assetCode: `palt${createUniqueSuffix()}`,
      assetSymbol: `PAL${createUniqueSuffix().slice(0, 4).toUpperCase()}`,
    });
    const recipientCapable = await createSupportedPlatform({
      assetNetworkId: matchingAssetNetwork.id,
      withIdentifier: true,
    });
    await createSupportedPlatform({
      assetNetworkId: matchingAssetNetwork.id,
      withIdentifier: false,
    });
    await createSupportedPlatform({
      assetNetworkId: otherAssetNetwork.id,
      withIdentifier: true,
    });

    const response = await request(app.getHttpServer())
      .get('/v1/platforms')
      .query({
        chain: matchingAssetNetwork.chain.slug,
        asset: matchingAssetNetwork.asset.symbol,
        lookupMode: 'BY_RECIPIENT',
      })
      .set('Authorization', `Bearer ${requester.credentialSecret}`)
      .expect(200);
    const platforms = readApiArray<SupportedPlatformResponseRecord>(
      response.body as unknown,
    );

    expect(platforms).toEqual([
      expect.objectContaining({
        slug: recipientCapable.slug,
        supportsByAddress: true,
        supportsByRecipient: true,
      }),
    ]);
  });

  it('filters supported platforms by address within the selected corridor', async () => {
    const requester = await createPartnerContext(['resolution:read']);
    const assetNetwork = await createAssetNetwork({
      chainSlug: `phase20-base-${createUniqueSuffix()}`,
      chainDisplayName: 'Phase 20 Base',
      assetCode: `pusdc${createUniqueSuffix()}`,
      assetSymbol: `PUS${createUniqueSuffix().slice(0, 4).toUpperCase()}`,
    });
    const matchingAddress = `address-${createUniqueSuffix()}`;
    const matchingPlatform = await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      withIdentifier: true,
      address: matchingAddress,
    });
    await createSupportedPlatform({
      assetNetworkId: assetNetwork.id,
      withIdentifier: true,
      address: `address-${createUniqueSuffix()}`,
    });

    const response = await request(app.getHttpServer())
      .get('/v1/platforms')
      .query({
        chain: assetNetwork.chain.slug,
        asset: assetNetwork.asset.symbol,
        lookupMode: 'BY_ADDRESS',
        address: matchingAddress,
      })
      .set('Authorization', `Bearer ${requester.credentialSecret}`)
      .expect(200);
    const platforms = readApiArray<SupportedPlatformResponseRecord>(
      response.body as unknown,
    );

    expect(platforms).toEqual([
      expect.objectContaining({
        slug: matchingPlatform.slug,
        supportsByAddress: true,
      }),
    ]);
  });

  async function createPartnerContext(
    scopes: string[],
    status: PartnerStatus = PartnerStatus.ACTIVE,
    isDirectoryListed = false,
  ): Promise<PartnerContext> {
    const slug = `phase20-${createUniqueSuffix()}`;
    const generatedCredential = generateApiCredential();
    const partner = await prismaClient.partner.create({
      data: {
        slug,
        displayName: `Phase 20 ${slug}`,
        partnerType: PartnerType.EXCHANGE,
        status,
        isDirectoryListed,
      },
    });

    await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 20 E2E',
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

  async function createAssetNetwork(params?: {
    chainSlug?: string;
    chainDisplayName?: string;
    assetCode?: string;
    assetSymbol?: string;
    assetDisplayName?: string;
  }): Promise<{
    id: string;
    chain: { slug: string };
    asset: { code: string; symbol: string };
  }> {
    const suffix = createUniqueSuffix();
    const chainSlug = params?.chainSlug ?? `phase20-chain-${suffix}`;
    const assetCode = params?.assetCode ?? `phase20-${suffix}`;
    const assetSymbol =
      params?.assetSymbol ?? `P${suffix.slice(0, 5).toUpperCase()}`;
    const chain = await prismaClient.chain.create({
      data: {
        slug: chainSlug,
        displayName: params?.chainDisplayName ?? `Phase 20 Chain ${suffix}`,
        family: ChainFamily.OTHER,
      },
    });
    const asset = await prismaClient.asset.create({
      data: {
        code: assetCode,
        symbol: assetSymbol,
        displayName: params?.assetDisplayName ?? `Phase 20 Asset ${suffix}`,
      },
    });
    const assetNetwork = await prismaClient.assetNetwork.create({
      data: {
        assetId: asset.id,
        chainId: chain.id,
        standard: TokenStandard.OTHER,
      },
    });

    return {
      id: assetNetwork.id,
      chain: {
        slug: chain.slug,
      },
      asset: {
        code: asset.code,
        symbol: asset.symbol,
      },
    };
  }

  async function createSupportedPlatform(params: {
    assetNetworkId: string;
    withIdentifier: boolean;
    address?: string;
    status?: PartnerStatus;
  }): Promise<PartnerContext> {
    const partner = await createPartnerContext(
      ['resolution:read'],
      params.status ?? PartnerStatus.ACTIVE,
      true,
    );
    const recipient = await prismaClient.recipient.create({
      data: {
        partnerId: partner.id,
        externalRecipientId: `recipient-${createUniqueSuffix()}`,
        displayName: `Recipient ${partner.slug}`,
      },
    });

    if (params.withIdentifier) {
      await prismaClient.recipientIdentifier.create({
        data: {
          recipientId: recipient.id,
          partnerId: partner.id,
          kind: IdentifierKind.PARTNER_HANDLE,
          rawValue: `user@${partner.slug}`,
          normalizedValue: `user@${partner.slug}`,
          status: IdentifierStatus.ACTIVE,
          visibility: IdentifierVisibility.RESOLVABLE,
          isPrimary: true,
        },
      });
    }

    const address = params.address ?? `address-${createUniqueSuffix()}`;

    await prismaClient.recipientDestination.create({
      data: {
        recipientId: recipient.id,
        assetNetworkId: params.assetNetworkId,
        addressRaw: address,
        addressNormalized: address,
        status: DestinationStatus.ACTIVE,
        isDefault: true,
        effectiveFrom: new Date(Date.now() - 60_000),
      },
    });

    return partner;
  }

  async function createRecipientWithoutDestination(partnerId: string) {
    return prismaClient.recipient.create({
      data: {
        partnerId,
        externalRecipientId: `recipient-${createUniqueSuffix()}`,
        displayName: 'No Support Recipient',
      },
    });
  }

  function createUniqueSuffix(): string {
    return randomBytes(5).toString('hex');
  }

  function readApiArray<T>(payload: unknown): T[] {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('status' in payload) ||
      !('data' in payload)
    ) {
      throw new Error('Unexpected API response payload.');
    }

    const data = (payload as { data: unknown }).data;

    if (!Array.isArray(data)) {
      throw new Error('Expected API response data to be an array.');
    }

    return data as T[];
  }
});
