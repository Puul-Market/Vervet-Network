import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const algorithm = 'aes-256-gcm';
const ivBytes = 12;
const versionPrefix = 'encv1';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`vervet:data-seal:${secret}`).digest();
}

export function isSealedValue(value: string): boolean {
  return value.startsWith(`${versionPrefix}:`);
}

export function sealString(value: string, secret: string): string {
  const iv = randomBytes(ivBytes);
  const cipher = createCipheriv(algorithm, deriveKey(secret), iv);
  const encryptedValue = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    versionPrefix,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encryptedValue.toString('base64url'),
  ].join(':');
}

export function openSealedString(value: string, secret: string): string {
  if (!isSealedValue(value)) {
    return value;
  }

  const [version, ivEncoded, authTagEncoded, payloadEncoded] = value.split(':');

  if (
    version !== versionPrefix ||
    !ivEncoded ||
    !authTagEncoded ||
    !payloadEncoded
  ) {
    throw new Error('Sealed value is malformed.');
  }

  const decipher = createDecipheriv(
    algorithm,
    deriveKey(secret),
    Buffer.from(ivEncoded, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(payloadEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
