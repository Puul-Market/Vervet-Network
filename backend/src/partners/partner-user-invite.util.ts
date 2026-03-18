import { randomBytes } from 'node:crypto';
import { hashSecret, verifySecret } from '../common/security/secret-hash.util';

const partnerUserInvitePrefix = 'vdi_';
const keyPrefixBytes = 9;
const secretBodyBytes = 24;

export interface GeneratedPartnerUserInviteToken {
  keyPrefix: string;
  secret: string;
  secretHash: string;
}

export function generatePartnerUserInviteToken(): GeneratedPartnerUserInviteToken {
  const keyPrefix = `${partnerUserInvitePrefix}${randomBytes(
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

export async function verifyPartnerUserInviteToken(
  secret: string,
  storedHash: string,
): Promise<boolean> {
  return verifySecret(secret, storedHash);
}

export function extractPartnerUserInvitePrefix(secret: string): string | null {
  const [prefix, body] = secret.split('.', 2);

  if (!prefix || !body || !prefix.startsWith(partnerUserInvitePrefix)) {
    return null;
  }

  return prefix;
}
