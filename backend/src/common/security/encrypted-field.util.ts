import { createDecipheriv, createHash } from 'node:crypto';

export interface EncryptedFieldEnvelope {
  alg: 'AES-256-GCM';
  keyId: string;
  iv: string;
  ciphertext: string;
  authTag?: string;
  aad?: string;
}

const algorithm = 'aes-256-gcm';
const gcmAuthTagBytes = 16;

export function openEncryptedField(
  envelope: EncryptedFieldEnvelope,
  masterSecret: string,
): string {
  if (envelope.alg !== 'AES-256-GCM') {
    throw new Error(`Unsupported encrypted field algorithm '${envelope.alg}'.`);
  }

  const iv = decodeBase64(envelope.iv, 'iv');
  const ciphertextWithMaybeTag = decodeBase64(
    envelope.ciphertext,
    'ciphertext',
  );

  if (!envelope.authTag && ciphertextWithMaybeTag.length <= gcmAuthTagBytes) {
    throw new Error(
      'Encrypted field ciphertext must include encrypted bytes plus auth tag.',
    );
  }

  const authTag = envelope.authTag
    ? decodeBase64(envelope.authTag, 'authTag')
    : ciphertextWithMaybeTag.subarray(
        ciphertextWithMaybeTag.length - gcmAuthTagBytes,
      );
  const ciphertext = envelope.authTag
    ? ciphertextWithMaybeTag
    : ciphertextWithMaybeTag.subarray(
        0,
        ciphertextWithMaybeTag.length - gcmAuthTagBytes,
      );

  if (iv.length !== 12) {
    throw new Error('Encrypted field iv must be 12 bytes.');
  }

  if (authTag.length !== gcmAuthTagBytes) {
    throw new Error('Encrypted field authTag must be 16 bytes.');
  }

  const decipher = createDecipheriv(
    algorithm,
    deriveEncryptedSubmissionKey(masterSecret, envelope.keyId),
    iv,
  );

  if (envelope.aad) {
    decipher.setAAD(Buffer.from(envelope.aad, 'utf8'));
  }

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

function deriveEncryptedSubmissionKey(
  masterSecret: string,
  keyId: string,
): Buffer {
  return createHash('sha256')
    .update(`vervet:encrypted-submission:${keyId}:${masterSecret}`)
    .digest();
}

function decodeBase64(value: string, fieldName: string): Buffer {
  try {
    const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalizedValue, 'base64');
  } catch {
    throw new Error(`Encrypted field ${fieldName} is not valid base64.`);
  }
}
