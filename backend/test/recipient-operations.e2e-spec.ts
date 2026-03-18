import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttestationType,
  IdentifierKind,
  PartnerOnboardingStage,
  PartnerType,
  PrismaClient,
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

interface RecipientResponseRecord {
  id: string;
  displayName: string | null;
  externalRecipientId: string;
  identifiers: Array<{
    rawValue: string;
  }>;
  currentDestinations: Array<{
    address: string;
    isDefault: boolean;
    assetNetwork: {
      assetCode: string;
      assetSymbol: string;
      chain: string;
    };
  }>;
}

interface AttestationResponseRecord {
  attestationType: string;
  address: string | null;
  recipientId: string;
  recipientIdentifier: string;
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase12-admin-token';
const webhookSigningMasterSecret = 'phase12-webhook-signing-secret';

describe('Recipient operations (e2e)', () => {
  let app: INestApplication<App>;
  let prismaClient: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.ADMIN_API_TOKEN = adminApiToken;
    process.env.WEBHOOK_SIGNING_MASTER_SECRET = webhookSigningMasterSecret;
    process.env.WEBHOOK_DELIVERY_PROCESSOR_ENABLED = 'false';
    process.env.ATTESTATION_REQUEST_MAX_AGE_MS = '300000';
    process.env.ATTESTATION_REQUEST_NONCE_TTL_MS = '600000';

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

  it('requires the recipients:read scope for recipient registry access', async () => {
    const partner = await createPartnerContext(['webhooks:read']);

    await request(app.getHttpServer())
      .get('/v1/recipients')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(403);
  });

  it('lists partner-scoped recipients, current destinations, and recent attestation activity', async () => {
    const partner = await createAttestationPartnerContext([
      'attestations:write',
      'attestations:read',
      'recipients:read',
    ]);
    const otherPartner = await createAttestationPartnerContext([
      'attestations:write',
      'attestations:read',
      'recipients:read',
    ]);
    const recipientIdentifier = `jane@${partner.slug}`;
    const firstAddress = randomEvmAddress();
    const secondAddress = randomEvmAddress();
    const baseTime = Date.now();

    await createAttestation({
      partner,
      address: firstAddress,
      attestationType: AttestationType.DESTINATION_ASSIGNMENT,
      effectiveFrom: new Date(baseTime - 60_000).toISOString(),
      issuedAt: new Date(baseTime - 60_000).toISOString(),
      recipientDisplayName: 'Jane A.',
      recipientExternalId: `recipient-${partner.slug}`,
      recipientIdentifier,
      sequenceNumber: 1,
    });
    await createAttestation({
      partner,
      address: secondAddress,
      attestationType: AttestationType.DESTINATION_ROTATION,
      effectiveFrom: new Date(baseTime).toISOString(),
      issuedAt: new Date(baseTime).toISOString(),
      recipientDisplayName: 'Jane A.',
      recipientExternalId: `recipient-${partner.slug}`,
      recipientIdentifier,
      sequenceNumber: 2,
    });
    await createAttestation({
      partner: otherPartner,
      address: randomEvmAddress(),
      attestationType: AttestationType.DESTINATION_ASSIGNMENT,
      effectiveFrom: new Date(baseTime).toISOString(),
      issuedAt: new Date(baseTime).toISOString(),
      recipientDisplayName: 'Other User',
      recipientExternalId: `recipient-${otherPartner.slug}`,
      recipientIdentifier: `other@${otherPartner.slug}`,
      sequenceNumber: 1,
    });

    const recipientsResponse = await request(app.getHttpServer())
      .get('/v1/recipients')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .query({
        search: recipientIdentifier,
      })
      .expect(200);
    const recipients = readApiArray<RecipientResponseRecord>(
      recipientsResponse.body as unknown,
    );

    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toMatchObject({
      displayName: 'Jane A.',
      externalRecipientId: `recipient-${partner.slug}`,
    });
    expect(recipients[0].identifiers[0]?.rawValue).toBe(recipientIdentifier);
    expect(recipients[0].currentDestinations[0]?.address).toBe(secondAddress);
    expect(recipients[0].currentDestinations[0]?.isDefault).toBe(true);
    expect(recipients[0].currentDestinations[0]?.assetNetwork.assetCode).toBe(
      'usdc',
    );
    expect(recipients[0].currentDestinations[0]?.assetNetwork.assetSymbol).toBe(
      'USDC',
    );
    expect(recipients[0].currentDestinations[0]?.assetNetwork.chain).toBe(
      'ethereum',
    );

    const recipientId = recipients[0].id;
    const recipientDetailResponse = await request(app.getHttpServer())
      .get(`/v1/recipients/${recipientId}`)
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(200);
    const recipientDetail = readApiObject<RecipientResponseRecord>(
      recipientDetailResponse.body as unknown,
    );

    expect(recipientDetail).toMatchObject({
      id: recipientId,
      currentDestinations: [
        expect.objectContaining({
          address: secondAddress,
        }),
      ],
    });
    expect(recipientDetail.currentDestinations).toHaveLength(1);

    const attestationsResponse = await request(app.getHttpServer())
      .get('/v1/attestations')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .query({
        recipientId,
      })
      .expect(200);
    const attestations = readApiArray<AttestationResponseRecord>(
      attestationsResponse.body as unknown,
    );

    expect(attestations).toHaveLength(2);
    expect(attestations[0]).toMatchObject({
      attestationType: 'DESTINATION_ROTATION',
      address: secondAddress,
      recipientId,
      recipientIdentifier,
    });
    expect(attestations[1]).toMatchObject({
      attestationType: 'DESTINATION_ASSIGNMENT',
      address: firstAddress,
      recipientId,
      recipientIdentifier,
    });
  });

  async function createPartnerContext(
    scopes: string[],
    options?: {
      dataPartnerEnabled?: boolean;
      fullAttestationPartnerEnabled?: boolean;
      onboardingStage?: PartnerOnboardingStage;
    },
  ): Promise<PartnerContext> {
    const slug = `phase12-${createUniqueSuffix()}`;
    const generatedCredential = generateApiCredential();
    const partner = await prismaClient.partner.create({
      data: {
        slug,
        displayName: `Phase 12 ${slug}`,
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
        label: 'Phase 12 E2E',
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

  async function createAttestation(params: {
    partner: AttestationPartnerContext;
    address: string;
    attestationType: AttestationType;
    effectiveFrom: string;
    issuedAt: string;
    recipientDisplayName: string;
    recipientExternalId: string;
    recipientIdentifier: string;
    sequenceNumber: number;
  }) {
    const attestationPayload = createSignedAttestationPayload({
      partner: params.partner,
      address: params.address,
      attestationType: params.attestationType,
      effectiveFrom: params.effectiveFrom,
      issuedAt: params.issuedAt,
      recipientDisplayName: params.recipientDisplayName,
      recipientExternalId: params.recipientExternalId,
      recipientIdentifier: params.recipientIdentifier,
      sequenceNumber: params.sequenceNumber,
    });

    await request(app.getHttpServer())
      .post('/v1/attestations')
      .set('Authorization', `Bearer ${params.partner.credentialSecret}`)
      .set('X-Request-Nonce', `nonce-${createUniqueSuffix()}`)
      .set('X-Request-Timestamp', new Date().toISOString())
      .send(attestationPayload)
      .expect(201);
  }
});

function createSignedAttestationPayload(params: {
  partner: AttestationPartnerContext;
  address: string;
  attestationType: AttestationType;
  effectiveFrom: string;
  issuedAt: string;
  recipientDisplayName: string;
  recipientExternalId: string;
  recipientIdentifier: string;
  sequenceNumber: number;
}) {
  const payload = {
    partnerSlug: params.partner.slug,
    keyId: params.partner.keyId,
    algorithm: SigningKeyAlgorithm.ED25519,
    attestationType: params.attestationType,
    sequenceNumber: params.sequenceNumber,
    recipientExternalId: params.recipientExternalId,
    recipientDisplayName: params.recipientDisplayName,
    recipientIdentifier: params.recipientIdentifier,
    identifierKind: IdentifierKind.PARTNER_HANDLE,
    chain: 'ethereum',
    assetCode: 'usdc',
    assetSymbol: 'USDC',
    tokenStandard: TokenStandard.ERC20,
    contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
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
      contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
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

function readApiArray<T>(value: unknown): T[] {
  if (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray(value.data)
  ) {
    return value.data as T[];
  }

  throw new Error('Expected an API response body with an array data field.');
}

function readApiObject<T>(value: unknown): T {
  if (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    typeof value.data === 'object' &&
    value.data !== null &&
    !Array.isArray(value.data)
  ) {
    return value.data as T;
  }

  throw new Error('Expected an API response body with an object data field.');
}
