import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import {
  EncryptedSubmissionService,
  type PartnerEncryptedSubmissionPolicy,
} from './encrypted-submission.service';

describe('EncryptedSubmissionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to platform-managed decryption when BYOK is not configured', async () => {
    const prismaServiceMock = createPrismaServiceMock(null);
    const service = new EncryptedSubmissionService(
      prismaServiceMock as never,
      createConfigServiceMock({
        ENCRYPTED_SUBMISSION_MASTER_SECRET: 'test-master',
      }) as never,
    );

    await expect(service.getPartnerPolicy('partner-1')).resolves.toEqual({
      enabled: false,
      keyProvider: {
        kind: 'PLATFORM_MANAGED',
      },
    });
  });

  it('surfaces the external-kms provider when BYOK is enabled for a partner', async () => {
    const prismaServiceMock = createPrismaServiceMock({
      enableEncryptedSubmission: true,
      enterpriseByokEnabled: true,
      customerKeyArn: ' arn:aws:kms:us-east-1:123456789012:key/example ',
      customerKeyStatus: ' ACTIVE ',
    });
    const service = new EncryptedSubmissionService(
      prismaServiceMock as never,
      createConfigServiceMock({
        ENCRYPTED_SUBMISSION_MASTER_SECRET: 'test-master',
      }) as never,
    );

    await expect(service.getPartnerPolicy('partner-2')).resolves.toEqual({
      enabled: true,
      keyProvider: {
        kind: 'EXTERNAL_KMS',
        customerKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/example',
        customerKeyStatus: 'ACTIVE',
      },
    });
  });

  it('decrypts BYOK-configured envelopes through the current platform-managed bridge', () => {
    const service = new EncryptedSubmissionService(
      createPrismaServiceMock(null) as never,
      createConfigServiceMock({
        ENCRYPTED_SUBMISSION_MASTER_SECRET: 'test-master',
      }) as never,
    );
    const policy: PartnerEncryptedSubmissionPolicy = {
      enabled: true,
      keyProvider: {
        kind: 'EXTERNAL_KMS',
        customerKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/example',
        customerKeyStatus: 'ACTIVE',
      },
    };

    expect(
      service.openField(
        sealForTest('merchant@vervet.test', 'test-master', 'v1'),
        policy,
        'Recipient identifier',
      ),
    ).toBe('merchant@vervet.test');
  });

  it('rejects encrypted submission when the partner setting is disabled', () => {
    const service = new EncryptedSubmissionService(
      createPrismaServiceMock(null) as never,
      createConfigServiceMock({
        ENCRYPTED_SUBMISSION_MASTER_SECRET: 'test-master',
      }) as never,
    );

    expect(() =>
      service.openField(
        sealForTest('merchant@vervet.test', 'test-master', 'v1'),
        {
          enabled: false,
          keyProvider: {
            kind: 'PLATFORM_MANAGED',
          },
        },
        'Recipient identifier',
      ),
    ).toThrow(ForbiddenException);
  });

  it('wraps undecryptable envelopes as bad requests', () => {
    const service = new EncryptedSubmissionService(
      createPrismaServiceMock(null) as never,
      createConfigServiceMock({
        ENCRYPTED_SUBMISSION_MASTER_SECRET: 'test-master',
      }) as never,
    );

    expect(() =>
      service.openField(
        sealForTest('merchant@vervet.test', 'different-master', 'v1'),
        {
          enabled: true,
          keyProvider: {
            kind: 'PLATFORM_MANAGED',
          },
        },
        'Recipient identifier',
      ),
    ).toThrow(BadRequestException);
  });
});

function createConfigServiceMock(
  values: Partial<Record<string, boolean | number | string>>,
) {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

function createPrismaServiceMock(
  settings: {
    enableEncryptedSubmission: boolean;
    enterpriseByokEnabled: boolean;
    customerKeyArn: string | null;
    customerKeyStatus: string | null;
  } | null,
) {
  return {
    partnerSecuritySettings: {
      findUnique: jest.fn(() => Promise.resolve(settings)),
    },
  };
}

function sealForTest(value: string, masterSecret: string, keyId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    createHash('sha256')
      .update(`vervet:encrypted-submission:${keyId}:${masterSecret}`)
      .digest(),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    alg: 'AES-256-GCM' as const,
    keyId,
    iv: iv.toString('base64url'),
    ciphertext: Buffer.concat([ciphertext, authTag]).toString('base64url'),
  };
}
