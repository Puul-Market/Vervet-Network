import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const saltBytes = 16;
const derivedKeyBytes = 64;
const scryptAsync = promisify(scrypt);

export function hashSecret(secret: string): string {
  const salt = randomBytes(saltBytes).toString('hex');
  const hash = scryptSync(secret, salt, derivedKeyBytes).toString('hex');

  return `scrypt$${salt}$${hash}`;
}

export async function verifySecret(
  secret: string,
  storedHash: string,
): Promise<boolean> {
  const [algorithm, salt, expectedHash] = storedHash.split('$');

  if (algorithm !== 'scrypt' || !salt || !expectedHash) {
    return false;
  }

  const actualHash = (await scryptAsync(
    secret,
    salt,
    derivedKeyBytes,
  )) as Buffer;
  const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

  if (actualHash.length !== expectedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHashBuffer);
}
