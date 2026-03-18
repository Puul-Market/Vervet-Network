import { randomBytes } from 'node:crypto';
import { hashSecret, verifySecret } from '../common/security/secret-hash.util';

export const credentialScopes = [
  'partners:read',
  'partners:write',
  'attestations:write',
  'attestations:read',
  'recipients:read',
  'recipients:write',
  'destinations:read',
  'destinations:write',
  'resolution:read',
  'resolution:batch',
  'webhooks:write',
  'webhooks:read',
  'webhooks:replay',
  'team:read',
  'team:write',
  'security:read',
  'security:write',
  'audit:read',
  'audit:export',
] as const;

export type CredentialScope = (typeof credentialScopes)[number];

export const credentialScopeCatalog: Record<
  CredentialScope,
  {
    label: string;
    description: string;
  }
> = {
  'partners:read': {
    label: 'Read partner profile',
    description:
      'View organization profile, capability, readiness, and setup metadata.',
  },
  'partners:write': {
    label: 'Manage partner settings',
    description:
      'Update partner-owned settings and create integration credentials.',
  },
  'attestations:write': {
    label: 'Write attestations',
    description:
      'Create or submit trust attestations and related partner trust updates.',
  },
  'attestations:read': {
    label: 'Read attestations',
    description:
      'Inspect attestation records, statuses, expiry, and trust history.',
  },
  'recipients:read': {
    label: 'Read recipients',
    description:
      'View recipient registry records, identifiers, and partner mappings.',
  },
  'recipients:write': {
    label: 'Manage recipients',
    description:
      'Create, update, disable, or otherwise manage recipient records.',
  },
  'destinations:read': {
    label: 'Read destinations',
    description: 'View registered destinations, coverage, and lifecycle state.',
  },
  'destinations:write': {
    label: 'Manage destinations',
    description:
      'Create, replace, revoke, or otherwise manage destination records.',
  },
  'resolution:read': {
    label: 'Run resolution queries',
    description:
      'Call by-recipient, by-address, and transfer-verification lookup APIs.',
  },
  'resolution:batch': {
    label: 'Run batch verification',
    description:
      'Submit bulk verification and resolution jobs for multiple transfers.',
  },
  'webhooks:write': {
    label: 'Manage webhooks',
    description:
      'Create, update, pause, resume, rotate, or disable webhook endpoints.',
  },
  'webhooks:read': {
    label: 'Read webhook health',
    description:
      'View webhook endpoints, delivery status, failures, and retry history.',
  },
  'webhooks:replay': {
    label: 'Replay webhook deliveries',
    description:
      'Retry failed webhook deliveries and operational replay actions.',
  },
  'team:read': {
    label: 'Read team access',
    description:
      'View dashboard users, pending invites, roles, and access status.',
  },
  'team:write': {
    label: 'Manage team access',
    description: 'Invite users, change roles, and deactivate dashboard access.',
  },
  'security:read': {
    label: 'Read security settings',
    description:
      'View session policy, rotation policy, and recent security-sensitive events.',
  },
  'security:write': {
    label: 'Manage security settings',
    description:
      'Update security policies such as session and credential settings.',
  },
  'audit:read': {
    label: 'Read audit activity',
    description: 'Inspect operational, security, and governance audit events.',
  },
  'audit:export': {
    label: 'Export audit data',
    description:
      'Request and download audit exports for compliance and reporting.',
  },
};

export const defaultCredentialScopes: CredentialScope[] = [
  'attestations:write',
];

const credentialSecretPrefix = 'vpk_';
const keyPrefixBytes = 9;
const secretBodyBytes = 24;

export interface GeneratedApiCredential {
  keyPrefix: string;
  secret: string;
  secretHash: string;
}

export function generateApiCredential(): GeneratedApiCredential {
  const keyPrefix = `${credentialSecretPrefix}${randomBytes(
    keyPrefixBytes,
  ).toString('base64url')}`;
  const secretBody = randomBytes(secretBodyBytes).toString('base64url');
  const secret = `${keyPrefix}.${secretBody}`;

  return {
    keyPrefix,
    secret,
    secretHash: hashApiCredentialSecret(secret),
  };
}

export function hashApiCredentialSecret(secret: string): string {
  return hashSecret(secret);
}

export async function verifyApiCredentialSecret(
  secret: string,
  storedHash: string,
): Promise<boolean> {
  return verifySecret(secret, storedHash);
}

export function extractApiCredentialPrefix(secret: string): string | null {
  const [prefix, body] = secret.split('.', 2);

  if (!prefix || !body || !prefix.startsWith(credentialSecretPrefix)) {
    return null;
  }

  return prefix;
}

export function normalizeCredentialScopes(
  scopes: readonly string[],
): CredentialScope[] {
  const uniqueScopes = new Set<CredentialScope>();

  for (const scope of scopes) {
    if (isCredentialScope(scope)) {
      uniqueScopes.add(scope);
    }
  }

  return [...uniqueScopes].sort();
}

export function isCredentialScope(value: string): value is CredentialScope {
  return credentialScopes.includes(value as CredentialScope);
}
