import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { openEncryptedField } from './encrypted-field.util';

describe('encrypted-field util', () => {
  it('opens AES-GCM envelopes with appended auth tags', () => {
    const envelope = sealForTest('merchant@vervet.test', 'test-master', 'v1');

    expect(openEncryptedField(envelope, 'test-master')).toBe(
      'merchant@vervet.test',
    );
  });

  it('opens AES-GCM envelopes with explicit auth tags', () => {
    const envelope = sealForTest(
      '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
      'test-master',
      'v1',
      {
        splitAuthTag: true,
      },
    );

    expect(openEncryptedField(envelope, 'test-master')).toBe(
      '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
    );
  });

  it('rejects envelopes encrypted under another key id', () => {
    const envelope = sealForTest('merchant@vervet.test', 'test-master', 'v1');

    expect(() =>
      openEncryptedField({ ...envelope, keyId: 'v2' }, 'test-master'),
    ).toThrow();
  });
});

function sealForTest(
  value: string,
  masterSecret: string,
  keyId: string,
  options: { splitAuthTag?: boolean } = {},
) {
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
    ciphertext: options.splitAuthTag
      ? ciphertext.toString('base64url')
      : Buffer.concat([ciphertext, authTag]).toString('base64url'),
    ...(options.splitAuthTag ? { authTag: authTag.toString('base64url') } : {}),
  };
}
