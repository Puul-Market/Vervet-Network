import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttestationType,
  IdentifierKind,
  PartnerOnboardingStage,
  PartnerType,
  PrismaClient,
  QueryType,
  ResolutionOutcome,
  RiskLevel,
  SigningKeyAlgorithm,
  TokenStandard,
} from '@prisma/client';
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  type KeyObject,
} from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  buildCanonicalAttestationInput,
  serializeAttestationPayload,
} from '../src/attestations/attestation-payload';
import { generateApiCredential } from '../src/partners/api-credential.util';

interface PartnerContext {
  id: string;
  slug: string;
  credentialSecret: string;
}

interface AttestationPartnerContext extends PartnerContext {
  keyId: string;
  privateKey: KeyObject;
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase9-admin-token';
const webhookSigningMasterSecret = 'phase9-webhook-signing-secret';

describe('Request hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prismaClient: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.ADMIN_API_TOKEN = adminApiToken;
    process.env.WEBHOOK_SIGNING_MASTER_SECRET = webhookSigningMasterSecret;
    process.env.WEBHOOK_DELIVERY_PROCESSOR_ENABLED = 'false';
    process.env.ATTESTATION_REQUEST_MAX_AGE_MS = '300000';
    process.env.ATTESTATION_REQUEST_NONCE_TTL_MS = '600000';
    process.env.RESOLUTION_LOOKUP_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RESOLUTION_LOOKUP_RATE_LIMIT_MAX_REQUESTS = '2';
    process.env.RESOLUTION_LOOKUP_ENUMERATION_WINDOW_MS = '60000';
    process.env.RESOLUTION_LOOKUP_ENUMERATION_MAX_IDENTIFIERS = '1';

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
    if (app) {
      await app.close();
    }

    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  });

  it('enforces the resolution scope for authenticated partner lookups', async () => {
    const partner = await createPartnerContext(['attestations:write']);

    await request(app.getHttpServer())
      .post('/v1/resolution/resolve')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .send({
        recipientIdentifier: `missing@${partner.slug}`,
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(403);
  });

  it('returns the stored response for repeated idempotent resolution requests', async () => {
    const partner = await createAttestationPartnerContext([
      'attestations:write',
      'resolution:read',
    ]);
    const recipientIdentifier = `jane@${partner.slug}`;
    const attestationPayload = createSignedAttestationPayload({
      partner,
      sequenceNumber: 1,
      recipientExternalId: `recipient-${partner.slug}`,
      recipientDisplayName: 'Jane A.',
      recipientIdentifier,
      address: randomEvmAddress(),
      issuedAt: new Date().toISOString(),
      effectiveFrom: new Date().toISOString(),
    });

    await request(app.getHttpServer())
      .post('/v1/attestations')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('X-Request-Nonce', `nonce-${createUniqueSuffix()}`)
      .set('X-Request-Timestamp', new Date().toISOString())
      .send(attestationPayload)
      .expect(201);

    const idempotencyKey = `idem-${createUniqueSuffix()}`;
    const firstResponse = await request(app.getHttpServer())
      .post('/v1/resolution/resolve')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        recipientIdentifier,
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(201);

    const secondResponse = await request(app.getHttpServer())
      .post('/v1/resolution/resolve')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        recipientIdentifier,
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(201);

    expect(secondResponse.body).toEqual(firstResponse.body);

    const storedRequests = await prismaClient.resolutionRequest.findMany({
      where: {
        requesterPartnerId: partner.id,
        idempotencyKey,
      },
    });

    expect(storedRequests).toHaveLength(1);

    await request(app.getHttpServer())
      .post('/v1/resolution/resolve')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        recipientIdentifier: `other@${partner.slug}`,
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(409);
  });

  it('rejects replayed attestation requests that reuse a nonce', async () => {
    const partner = await createAttestationPartnerContext([
      'attestations:write',
    ]);
    const attestationPayload = createSignedAttestationPayload({
      partner,
      sequenceNumber: 1,
      recipientExternalId: `recipient-${partner.slug}`,
      recipientDisplayName: 'Replay User',
      recipientIdentifier: `replay@${partner.slug}`,
      address: randomEvmAddress(),
      issuedAt: new Date().toISOString(),
      effectiveFrom: new Date().toISOString(),
    });
    const replayNonce = `nonce-${createUniqueSuffix()}`;
    const requestTimestamp = new Date().toISOString();

    await request(app.getHttpServer())
      .post('/v1/attestations')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('X-Request-Nonce', replayNonce)
      .set('X-Request-Timestamp', requestTimestamp)
      .send(attestationPayload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/attestations')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('X-Request-Nonce', replayNonce)
      .set('X-Request-Timestamp', requestTimestamp)
      .send(attestationPayload)
      .expect(409);
  });

  it('rejects stale attestation timestamps', async () => {
    const partner = await createAttestationPartnerContext([
      'attestations:write',
    ]);
    const attestationPayload = createSignedAttestationPayload({
      partner,
      sequenceNumber: 1,
      recipientExternalId: `recipient-${partner.slug}`,
      recipientDisplayName: 'Stale User',
      recipientIdentifier: `stale@${partner.slug}`,
      address: randomEvmAddress(),
      issuedAt: new Date().toISOString(),
      effectiveFrom: new Date().toISOString(),
    });
    const staleTimestamp = new Date(Date.now() - 600_000).toISOString();

    await request(app.getHttpServer())
      .post('/v1/attestations')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('X-Request-Nonce', `nonce-${createUniqueSuffix()}`)
      .set('X-Request-Timestamp', staleTimestamp)
      .send(attestationPayload)
      .expect(400);
  });

  it('rejects attestations for asset-network corridors that are not enabled', async () => {
    const partner = await createAttestationPartnerContext([
      'attestations:write',
    ]);
    const attestationPayload = createSignedAttestationPayload({
      partner,
      sequenceNumber: 1,
      recipientExternalId: `recipient-${partner.slug}`,
      recipientDisplayName: 'Unsupported Corridor User',
      recipientIdentifier: `unsupported@${partner.slug}`,
      address: randomEvmAddress(),
      issuedAt: new Date().toISOString(),
      effectiveFrom: new Date().toISOString(),
      contractAddress: '0x0000000000000000000000000000000000000001',
    });

    await request(app.getHttpServer())
      .post('/v1/attestations')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .set('X-Request-Nonce', `nonce-${createUniqueSuffix()}`)
      .set('X-Request-Timestamp', new Date().toISOString())
      .send(attestationPayload)
      .expect(400);
  });

  it('rate limits repeated resolution lookups for the same partner', async () => {
    const partner = await createPartnerContext(['resolution:read']);
    await seedResolutionRequests({
      partnerId: partner.id,
      totalRequests: 120,
      distinctIdentifiers: 1,
      slug: partner.slug,
    });

    await request(app.getHttpServer())
      .post('/v1/resolution/resolve')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .send({
        recipientIdentifier: `limit@${partner.slug}`,
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(429);
  });

  it('blocks distinct identifier probing via anti-enumeration controls', async () => {
    const partner = await createPartnerContext(['resolution:read']);
    await seedResolutionRequests({
      partnerId: partner.id,
      totalRequests: 40,
      distinctIdentifiers: 40,
      slug: partner.slug,
    });

    await request(app.getHttpServer())
      .post('/v1/resolution/resolve')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .send({
        recipientIdentifier: `second@${partner.slug}`,
        chain: 'ethereum',
        asset: 'USDC',
      })
      .expect(429);
  });

  async function createPartnerContext(
    scopes: string[],
    options?: {
      dataPartnerEnabled?: boolean;
      fullAttestationPartnerEnabled?: boolean;
      onboardingStage?: PartnerOnboardingStage;
    },
  ): Promise<PartnerContext> {
    const slug = `phase9-${createUniqueSuffix()}`;
    const generatedCredential = generateApiCredential();
    const partner = await prismaClient.partner.create({
      data: {
        slug,
        displayName: `Phase 9 ${slug}`,
        partnerType: PartnerType.EXCHANGE,
        dataPartnerEnabled: options?.dataPartnerEnabled ?? false,
        fullAttestationPartnerEnabled:
          options?.fullAttestationPartnerEnabled ?? false,
        onboardingStage:
          options?.onboardingStage ?? PartnerOnboardingStage.ACCOUNT_CREATED,
      },
    });
    await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 9 E2E',
        keyPrefix: generatedCredential.keyPrefix,
        secretHash: generatedCredential.secretHash,
        scopes,
      },
    });

    return {
      id: partner.id,
      slug,
      credentialSecret: generatedCredential.secret,
    };
  }

  async function createAttestationPartnerContext(
    scopes: string[],
  ): Promise<AttestationPartnerContext> {
    const partner = await createPartnerContext(scopes, {
      dataPartnerEnabled: true,
      fullAttestationPartnerEnabled: true,
      onboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
    });
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const keyId = `key-${createUniqueSuffix()}`;
    const publicKeyPem = publicKey
      .export({
        format: 'pem',
        type: 'spki',
      })
      .toString();

    await prismaClient.partnerSigningKey.create({
      data: {
        partnerId: partner.id,
        keyId,
        algorithm: SigningKeyAlgorithm.ED25519,
        publicKeyPem,
        fingerprint: createHash('sha256').update(publicKeyPem).digest('hex'),
        validFrom: new Date(),
      },
    });

    return {
      ...partner,
      keyId,
      privateKey,
    };
  }

  async function seedResolutionRequests(params: {
    partnerId: string;
    totalRequests: number;
    distinctIdentifiers: number;
    slug: string;
  }) {
    const now = new Date();
    const rows = Array.from({ length: params.totalRequests }, (_, index) => {
      const identifierIndex = index % params.distinctIdentifiers;
      const identifier = `seed-${identifierIndex}@${params.slug}`;

      return {
        queryType: QueryType.RESOLVE,
        requesterPartnerId: params.partnerId,
        recipientIdentifierInput: identifier,
        recipientIdentifierNormalized: identifier,
        chainInput: 'ethereum',
        assetInput: 'USDC',
        outcome: ResolutionOutcome.NO_MATCH,
        riskLevel: RiskLevel.LOW,
        flags: [],
        requestedAt: now,
        respondedAt: now,
      };
    });

    await prismaClient.resolutionRequest.createMany({
      data: rows,
    });
  }
});

function createSignedAttestationPayload(params: {
  partner: AttestationPartnerContext;
  sequenceNumber: number;
  recipientExternalId: string;
  recipientDisplayName: string;
  recipientIdentifier: string;
  address: string;
  issuedAt: string;
  effectiveFrom: string;
  contractAddress?: string;
}) {
  const contractAddress =
    params.contractAddress ?? '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  const payload = {
    partnerSlug: params.partner.slug,
    keyId: params.partner.keyId,
    algorithm: SigningKeyAlgorithm.ED25519,
    attestationType: AttestationType.DESTINATION_ASSIGNMENT,
    sequenceNumber: params.sequenceNumber,
    recipientExternalId: params.recipientExternalId,
    recipientDisplayName: params.recipientDisplayName,
    recipientIdentifier: params.recipientIdentifier,
    identifierKind: IdentifierKind.PARTNER_HANDLE,
    chain: 'ethereum',
    assetCode: 'usdc',
    assetSymbol: 'USDC',
    tokenStandard: TokenStandard.ERC20,
    contractAddress,
    decimals: 6,
    address: params.address,
    memo: '',
    issuedAt: params.issuedAt,
    effectiveFrom: params.effectiveFrom,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    signature: '',
  };
  const canonicalPayload = serializeAttestationPayload(
    buildCanonicalAttestationInput(payload, {
      partnerSlug: params.partner.slug,
      recipientIdentifier: params.recipientIdentifier.toLowerCase(),
      chain: 'ethereum',
      assetCode: 'usdc',
      assetSymbol: 'USDC',
      contractAddress: contractAddress.toLowerCase(),
      address: params.address.toLowerCase(),
      memo: '',
    }),
  );
  const signature = sign(
    null,
    Buffer.from(canonicalPayload, 'utf8'),
    params.partner.privateKey,
  ).toString('base64');

  return {
    ...payload,
    signature,
  };
}

function createUniqueSuffix(): string {
  return `${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function randomEvmAddress(): string {
  return `0x${randomBytes(20).toString('hex')}`;
}
