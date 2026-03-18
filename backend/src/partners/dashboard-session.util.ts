import { randomBytes } from 'node:crypto';
import { hashSecret, verifySecret } from '../common/security/secret-hash.util';

const dashboardSessionPrefix = 'vds_';
const keyPrefixBytes = 9;
const secretBodyBytes = 24;

export interface GeneratedDashboardSessionToken {
  keyPrefix: string;
  secret: string;
  secretHash: string;
}

export function generateDashboardSessionToken(): GeneratedDashboardSessionToken {
  const keyPrefix = `${dashboardSessionPrefix}${randomBytes(
    keyPrefixBytes,
  ).toString('base64url')}`;
  const secretBody = randomBytes(secretBodyBytes).toString('base64url');
  const secret = `${keyPrefix}.${secretBody}`;

  return {
    keyPrefix,
    secret,
    secretHash: hashSecret(secret),
  };
}

export async function verifyDashboardSessionToken(
  secret: string,
  storedHash: string,
): Promise<boolean> {
  return verifySecret(secret, storedHash);
}

export function extractDashboardSessionPrefix(secret: string): string | null {
  const [prefix, body] = secret.split('.', 2);

  if (!prefix || !body || !prefix.startsWith(dashboardSessionPrefix)) {
    return null;
  }

  return prefix;
}
