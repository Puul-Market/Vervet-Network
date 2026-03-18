import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PartnerOnboardingStage,
  PartnerStatus,
  PartnerType,
  PrismaClient,
  SigningKeyAlgorithm,
  SigningKeyStatus,
} from '@prisma/client';
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { hashSecret } from '../src/common/security/secret-hash.util';
import { generateApiCredential } from '../src/partners/api-credential.util';

interface PartnerContext {
  credentialId: string;
  credentialSecret: string;
  partnerId: string;
  partnerSlug: string;
}

interface ApiDataEnvelope<T> {
  data: T;
  status: true;
}

interface PartnerProfileResponse {
  id: string;
  slug: string;
  displayName: string;
  partnerType: string;
  status: string;
  activeCredentialCount: number;
  activeSigningKeyCount: number;
  capabilities: {
    apiConsumerEnabled: boolean;
    dataPartnerEnabled: boolean;
    productionEnabled: boolean;
    profileLabel: string;
  };
  onboarding: {
    stage: string;
    completedTasks: string[];
    blockedTasks: string[];
    nextRecommendedAction: string | null;
  };
  readiness: {
    environment: string;
    feedHealthStatus: string;
    statusLabel: string;
  };
  authenticatedActor: {
    type: 'API_CREDENTIAL' | 'PARTNER_USER';
    identifier: string;
    scopes: string[];
  };
  authenticatedCredential: {
    id: string;
    scopes: string[];
  } | null;
  authenticatedUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    scopes: string[];
    status: string;
    lastLoginAt: string | null;
    createdAt: string;
  } | null;
}

interface ApiCredentialResponse {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
  partner?: string;
  secret?: string;
}

interface SigningKeyResponse {
  id: string;
  keyId: string;
  algorithm: string;
  fingerprint: string;
  status: string;
  validFrom: string;
  validTo: string | null;
  rotatesAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface DashboardLoginResponse {
  accessToken: string;
  expiresAt: string;
  partner: {
    id: string;
    slug: string;
    displayName: string;
  };
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    scopes: string[];
  };
}

const databaseUrl =
  'postgresql://postgres:postgres@localhost:54329/vervet_network?schema=public';
const adminApiToken = 'phase14-admin-token';
const webhookSigningMasterSecret = 'phase14-webhook-signing-secret';

describe('Partner access operations (e2e)', () => {
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

  it('requires partners:read to access the partner profile', async () => {
    const partner = await createPartnerContext(['recipients:read']);

    await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(403);
  });

  it('supports partner-scoped profile, credential lifecycle, and signing-key lifecycle', async () => {
    const partner = await createPartnerContext(
      ['partners:read', 'partners:write'],
      {
        dataPartnerEnabled: true,
        fullAttestationPartnerEnabled: true,
        onboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
      },
    );
    await createInitialSigningKey(partner.partnerId);

    const profileResponse = await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(200);
    const profile = readApiObject<PartnerProfileResponse>(
      profileResponse.body as unknown,
    );

    expect(profile).toMatchObject({
      id: partner.partnerId,
      slug: partner.partnerSlug,
      activeCredentialCount: 1,
      activeSigningKeyCount: 1,
      capabilities: {
        apiConsumerEnabled: true,
        dataPartnerEnabled: true,
        productionEnabled: false,
        profileLabel: 'FULL_ATTESTATION_PARTNER',
      },
      onboarding: {
        stage: 'DATA_MAPPING_IN_PROGRESS',
      },
      readiness: {
        environment: 'SANDBOX_ONLY',
        feedHealthStatus: 'UNKNOWN',
      },
      authenticatedCredential: {
        id: partner.credentialId,
        scopes: ['partners:read', 'partners:write'],
      },
    });

    const createCredentialResponse = await request(app.getHttpServer())
      .post('/v1/partners/me/api-credentials')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .send({
        label: 'Dashboard secondary credential',
        scopes: ['resolution:read', 'webhooks:read'],
      })
      .expect(201);
    const createdCredential = readApiObject<ApiCredentialResponse>(
      createCredentialResponse.body as unknown,
    );

    expect(createdCredential.secret).toMatch(/^vpk_/);
    expect(createdCredential.partner).toBe(partner.partnerSlug);
    expect(createdCredential.isCurrent).toBe(false);

    const listCredentialsResponse = await request(app.getHttpServer())
      .get('/v1/partners/me/api-credentials')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(200);
    const credentials = readApiArray<ApiCredentialResponse>(
      listCredentialsResponse.body as unknown,
    );

    expect(credentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: partner.credentialId,
          isCurrent: true,
          status: PartnerStatus.ACTIVE,
        }),
        expect.objectContaining({
          id: createdCredential.id,
          label: 'Dashboard secondary credential',
          status: PartnerStatus.ACTIVE,
        }),
      ]),
    );

    const revokeCredentialResponse = await request(app.getHttpServer())
      .post(`/v1/partners/me/api-credentials/${createdCredential.id}/revoke`)
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(201);
    const revokedCredential = readApiObject<ApiCredentialResponse>(
      revokeCredentialResponse.body as unknown,
    );

    expect(revokedCredential.status).toBe(PartnerStatus.DISABLED);
    expect(revokedCredential.revokedAt).not.toBeNull();

    const { publicKey, keyId } = generateSigningKeyMaterial();
    const registerSigningKeyResponse = await request(app.getHttpServer())
      .post('/v1/partners/me/signing-keys')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .send({
        algorithm: SigningKeyAlgorithm.ED25519,
        keyId,
        publicKeyPem: exportPublicKeyPem(publicKey),
        validFrom: new Date().toISOString(),
      })
      .expect(201);
    const registeredSigningKey = readApiObject<SigningKeyResponse>(
      registerSigningKeyResponse.body as unknown,
    );

    expect(registeredSigningKey.keyId).toBe(keyId);
    expect(registeredSigningKey.status).toBe(SigningKeyStatus.ACTIVE);

    const listSigningKeysResponse = await request(app.getHttpServer())
      .get('/v1/partners/me/signing-keys')
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(200);
    const signingKeys = readApiArray<SigningKeyResponse>(
      listSigningKeysResponse.body as unknown,
    );

    expect(signingKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyId: registeredSigningKey.keyId,
        }),
      ]),
    );

    const revokeSigningKeyResponse = await request(app.getHttpServer())
      .post(`/v1/partners/me/signing-keys/${registeredSigningKey.id}/revoke`)
      .set('Authorization', `Bearer ${partner.credentialSecret}`)
      .expect(201);
    const revokedSigningKey = readApiObject<SigningKeyResponse>(
      revokeSigningKeyResponse.body as unknown,
    );

    expect(revokedSigningKey.status).toBe(SigningKeyStatus.REVOKED);
    expect(revokedSigningKey.revokedAt).not.toBeNull();
  });

  it('supports partner user dashboard login and logout', async () => {
    const partnerSlug = `phase16-${createUniqueSuffix()}`;
    const email = `${partnerSlug}@example.com`;
    const password = `phase16-password-${createUniqueSuffix()}`;
    const partner = await prismaClient.partner.create({
      data: {
        slug: partnerSlug,
        displayName: `Phase 16 ${partnerSlug}`,
        partnerType: PartnerType.EXCHANGE,
      },
    });

    await prismaClient.partnerUser.create({
      data: {
        partnerId: partner.id,
        email,
        fullName: 'Phase 16 Owner',
        passwordHash: hashSecret(password),
        scopes: [
          'partners:read',
          'partners:write',
          'attestations:read',
          'recipients:read',
          'resolution:read',
          'webhooks:read',
          'webhooks:write',
          'audit:read',
        ],
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

    expect(login.accessToken).toMatch(/^vds_/);
    expect(login.partner).toMatchObject({
      id: partner.id,
      slug: partnerSlug,
    });
    expect(login.user).toMatchObject({
      email,
      fullName: 'Phase 16 Owner',
      role: 'OWNER',
    });

    const profileResponse = await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);
    const profile = readApiObject<PartnerProfileResponse>(
      profileResponse.body as unknown,
    );

    expect(profile.authenticatedActor).toMatchObject({
      type: 'PARTNER_USER',
      identifier: email,
    });
    expect(profile.authenticatedCredential).toBeNull();
    expect(profile.authenticatedUser).toMatchObject({
      email,
      fullName: 'Phase 16 Owner',
      role: 'OWNER',
    });

    await request(app.getHttpServer())
      .post('/v1/dashboard-auth/logout')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/v1/partners/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(401);
  });

  async function createPartnerContext(
    scopes: string[],
    options?: {
      dataPartnerEnabled?: boolean;
      fullAttestationPartnerEnabled?: boolean;
      onboardingStage?: PartnerOnboardingStage;
    },
  ): Promise<PartnerContext> {
    const partnerSlug = `phase14-${createUniqueSuffix()}`;
    const generatedCredential = generateApiCredential();
    const partner = await prismaClient.partner.create({
      data: {
        slug: partnerSlug,
        displayName: `Phase 14 ${partnerSlug}`,
        partnerType: PartnerType.EXCHANGE,
        dataPartnerEnabled: options?.dataPartnerEnabled ?? false,
        fullAttestationPartnerEnabled:
          options?.fullAttestationPartnerEnabled ?? false,
        onboardingStage:
          options?.onboardingStage ?? PartnerOnboardingStage.ACCOUNT_CREATED,
      },
    });
    const credential = await prismaClient.partnerApiCredential.create({
      data: {
        partnerId: partner.id,
        label: 'Phase 14 primary credential',
        keyPrefix: generatedCredential.keyPrefix,
        secretHash: generatedCredential.secretHash,
        scopes,
      },
    });

    return {
      credentialId: credential.id,
      credentialSecret: generatedCredential.secret,
      partnerId: partner.id,
      partnerSlug,
    };
  }

  async function createInitialSigningKey(partnerId: string): Promise<void> {
    const { publicKey, keyId } = generateSigningKeyMaterial();
    const publicKeyPem = exportPublicKeyPem(publicKey);

    await prismaClient.partnerSigningKey.create({
      data: {
        partnerId,
        keyId,
        algorithm: SigningKeyAlgorithm.ED25519,
        publicKeyPem,
        fingerprint: createHash('sha256').update(publicKeyPem).digest('hex'),
        status: SigningKeyStatus.ACTIVE,
        validFrom: new Date(),
      },
    });
  }
});

function generateSigningKeyMaterial(): { keyId: string; publicKey: KeyObject } {
  const { publicKey } = generateKeyPairSync('ed25519');

  return {
    keyId: `phase14-key-${createUniqueSuffix()}`,
    publicKey,
  };
}

function exportPublicKeyPem(publicKey: KeyObject): string {
  return publicKey.export({
    format: 'pem',
    type: 'spki',
  }) as string;
}

function readApiObject<T>(value: unknown): T {
  if (!isApiDataEnvelope(value)) {
    throw new Error('Expected API response envelope.');
  }

  return value.data as T;
}

function readApiArray<T>(value: unknown): T[] {
  const payload = readApiObject<unknown>(value);

  if (!Array.isArray(payload)) {
    throw new Error('Expected API response array.');
  }

  return payload as T[];
}

function isApiDataEnvelope(value: unknown): value is ApiDataEnvelope<unknown> {
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
