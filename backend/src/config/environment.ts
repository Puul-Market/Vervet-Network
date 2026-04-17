type NodeEnvironment = 'development' | 'test' | 'production';
type PartnerDisclosureMode = 'MASKED_LABEL' | 'VERIFICATION_ONLY';
type RawVerificationRetentionMode =
  | 'NO_RETAIN'
  | 'SHORT_RETENTION'
  | 'STANDARD_RETENTION';

export interface EnvironmentVariables {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  CORS_ALLOWED_ORIGINS: string[];
  DATABASE_URL: string;
  ADMIN_API_TOKEN: string;
  WEBHOOK_SIGNING_MASTER_SECRET: string;
  WEBHOOK_ALLOW_PRIVATE_TARGETS: boolean;
  WEBHOOK_DELIVERY_PROCESSOR_ENABLED: boolean;
  WEBHOOK_DELIVERY_PROCESSOR_INTERVAL_MS: number;
  WEBHOOK_DELIVERY_PROCESSOR_BATCH_SIZE: number;
  WEBHOOK_DELIVERY_PROCESSING_STALE_MS: number;
  ATTESTATION_REQUEST_MAX_AGE_MS: number;
  ATTESTATION_REQUEST_NONCE_TTL_MS: number;
  PARTNER_API_CREDENTIAL_LAST_USED_MIN_INTERVAL_MS: number;
  PARTNER_DASHBOARD_SESSION_TTL_MS: number;
  PARTNER_DASHBOARD_SESSION_LAST_USED_MIN_INTERVAL_MS: number;
  PARTNER_USER_INVITE_TTL_MS: number;
  PARTNER_SECURITY_DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES: number;
  PARTNER_SECURITY_DEFAULT_CREDENTIAL_ROTATION_DAYS: number;
  PARTNER_SECURITY_DEFAULT_DISCLOSURE_MODE: PartnerDisclosureMode;
  PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_MODE: RawVerificationRetentionMode;
  PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_HOURS: number;
  PARTNER_SECURITY_DEFAULT_ENCRYPT_AUDIT_EXPORTS: boolean;
  RESOLUTION_REQUEST_RETENTION_MS: number;
  RESOLUTION_LOOKUP_RATE_LIMIT_WINDOW_MS: number;
  RESOLUTION_LOOKUP_RATE_LIMIT_MAX_REQUESTS: number;
  RESOLUTION_LOOKUP_ENUMERATION_WINDOW_MS: number;
  RESOLUTION_LOOKUP_ENUMERATION_MAX_IDENTIFIERS: number;
  RESOLUTION_BATCH_MAX_ROWS: number;
  AUDIT_EXPORT_RETENTION_MS: number;
  DATA_ENCRYPTION_MASTER_SECRET: string;
  BLIND_INDEX_MASTER_SECRET: string;
  ENCRYPTED_SUBMISSION_MASTER_SECRET: string;
}

const allowedNodeEnvironments: readonly NodeEnvironment[] = [
  'development',
  'test',
  'production',
];

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const nodeEnvironment = parseNodeEnvironment(config.NODE_ENV);

  return {
    NODE_ENV: nodeEnvironment,
    PORT: parsePort(config.PORT),
    CORS_ALLOWED_ORIGINS: parseStringList(
      config.CORS_ALLOWED_ORIGINS,
      nodeEnvironment === 'development' ? ['http://localhost:3001'] : [],
      'CORS_ALLOWED_ORIGINS',
    ),
    DATABASE_URL: parseRequiredString(config.DATABASE_URL, 'DATABASE_URL'),
    ADMIN_API_TOKEN: parseRequiredString(
      config.ADMIN_API_TOKEN,
      'ADMIN_API_TOKEN',
    ),
    WEBHOOK_SIGNING_MASTER_SECRET: parseRequiredString(
      config.WEBHOOK_SIGNING_MASTER_SECRET,
      'WEBHOOK_SIGNING_MASTER_SECRET',
    ),
    WEBHOOK_ALLOW_PRIVATE_TARGETS: parseBoolean(
      config.WEBHOOK_ALLOW_PRIVATE_TARGETS,
      nodeEnvironment !== 'production',
      'WEBHOOK_ALLOW_PRIVATE_TARGETS',
    ),
    WEBHOOK_DELIVERY_PROCESSOR_ENABLED: parseBoolean(
      config.WEBHOOK_DELIVERY_PROCESSOR_ENABLED,
      nodeEnvironment !== 'test',
      'WEBHOOK_DELIVERY_PROCESSOR_ENABLED',
    ),
    WEBHOOK_DELIVERY_PROCESSOR_INTERVAL_MS: parsePositiveInteger(
      config.WEBHOOK_DELIVERY_PROCESSOR_INTERVAL_MS,
      30_000,
      'WEBHOOK_DELIVERY_PROCESSOR_INTERVAL_MS',
    ),
    WEBHOOK_DELIVERY_PROCESSOR_BATCH_SIZE: parsePositiveInteger(
      config.WEBHOOK_DELIVERY_PROCESSOR_BATCH_SIZE,
      50,
      'WEBHOOK_DELIVERY_PROCESSOR_BATCH_SIZE',
    ),
    WEBHOOK_DELIVERY_PROCESSING_STALE_MS: parsePositiveInteger(
      config.WEBHOOK_DELIVERY_PROCESSING_STALE_MS,
      60_000,
      'WEBHOOK_DELIVERY_PROCESSING_STALE_MS',
    ),
    ATTESTATION_REQUEST_MAX_AGE_MS: parsePositiveInteger(
      config.ATTESTATION_REQUEST_MAX_AGE_MS,
      300_000,
      'ATTESTATION_REQUEST_MAX_AGE_MS',
    ),
    ATTESTATION_REQUEST_NONCE_TTL_MS: parsePositiveInteger(
      config.ATTESTATION_REQUEST_NONCE_TTL_MS,
      600_000,
      'ATTESTATION_REQUEST_NONCE_TTL_MS',
    ),
    PARTNER_API_CREDENTIAL_LAST_USED_MIN_INTERVAL_MS: parsePositiveInteger(
      config.PARTNER_API_CREDENTIAL_LAST_USED_MIN_INTERVAL_MS,
      60_000,
      'PARTNER_API_CREDENTIAL_LAST_USED_MIN_INTERVAL_MS',
    ),
    PARTNER_DASHBOARD_SESSION_TTL_MS: parsePositiveInteger(
      config.PARTNER_DASHBOARD_SESSION_TTL_MS,
      43_200_000,
      'PARTNER_DASHBOARD_SESSION_TTL_MS',
    ),
    PARTNER_DASHBOARD_SESSION_LAST_USED_MIN_INTERVAL_MS: parsePositiveInteger(
      config.PARTNER_DASHBOARD_SESSION_LAST_USED_MIN_INTERVAL_MS,
      60_000,
      'PARTNER_DASHBOARD_SESSION_LAST_USED_MIN_INTERVAL_MS',
    ),
    PARTNER_USER_INVITE_TTL_MS: parsePositiveInteger(
      config.PARTNER_USER_INVITE_TTL_MS,
      604_800_000,
      'PARTNER_USER_INVITE_TTL_MS',
    ),
    PARTNER_SECURITY_DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES: parsePositiveInteger(
      config.PARTNER_SECURITY_DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES,
      720,
      'PARTNER_SECURITY_DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES',
    ),
    PARTNER_SECURITY_DEFAULT_CREDENTIAL_ROTATION_DAYS: parsePositiveInteger(
      config.PARTNER_SECURITY_DEFAULT_CREDENTIAL_ROTATION_DAYS,
      90,
      'PARTNER_SECURITY_DEFAULT_CREDENTIAL_ROTATION_DAYS',
    ),
    PARTNER_SECURITY_DEFAULT_DISCLOSURE_MODE: parseDisclosureMode(
      config.PARTNER_SECURITY_DEFAULT_DISCLOSURE_MODE,
      'VERIFICATION_ONLY',
      'PARTNER_SECURITY_DEFAULT_DISCLOSURE_MODE',
    ),
    PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_MODE:
      parseRawVerificationRetentionMode(
        config.PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_MODE,
        'SHORT_RETENTION',
        'PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_MODE',
      ),
    PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_HOURS:
      parsePositiveInteger(
        config.PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_HOURS,
        24,
        'PARTNER_SECURITY_DEFAULT_RAW_VERIFICATION_RETENTION_HOURS',
      ),
    PARTNER_SECURITY_DEFAULT_ENCRYPT_AUDIT_EXPORTS: parseBoolean(
      config.PARTNER_SECURITY_DEFAULT_ENCRYPT_AUDIT_EXPORTS,
      true,
      'PARTNER_SECURITY_DEFAULT_ENCRYPT_AUDIT_EXPORTS',
    ),
    RESOLUTION_REQUEST_RETENTION_MS: parsePositiveInteger(
      config.RESOLUTION_REQUEST_RETENTION_MS,
      2_592_000_000,
      'RESOLUTION_REQUEST_RETENTION_MS',
    ),
    RESOLUTION_LOOKUP_RATE_LIMIT_WINDOW_MS: parsePositiveInteger(
      config.RESOLUTION_LOOKUP_RATE_LIMIT_WINDOW_MS,
      60_000,
      'RESOLUTION_LOOKUP_RATE_LIMIT_WINDOW_MS',
    ),
    RESOLUTION_LOOKUP_RATE_LIMIT_MAX_REQUESTS: parsePositiveInteger(
      config.RESOLUTION_LOOKUP_RATE_LIMIT_MAX_REQUESTS,
      120,
      'RESOLUTION_LOOKUP_RATE_LIMIT_MAX_REQUESTS',
    ),
    RESOLUTION_LOOKUP_ENUMERATION_WINDOW_MS: parsePositiveInteger(
      config.RESOLUTION_LOOKUP_ENUMERATION_WINDOW_MS,
      300_000,
      'RESOLUTION_LOOKUP_ENUMERATION_WINDOW_MS',
    ),
    RESOLUTION_LOOKUP_ENUMERATION_MAX_IDENTIFIERS: parsePositiveInteger(
      config.RESOLUTION_LOOKUP_ENUMERATION_MAX_IDENTIFIERS,
      40,
      'RESOLUTION_LOOKUP_ENUMERATION_MAX_IDENTIFIERS',
    ),
    RESOLUTION_BATCH_MAX_ROWS: parsePositiveInteger(
      config.RESOLUTION_BATCH_MAX_ROWS,
      250,
      'RESOLUTION_BATCH_MAX_ROWS',
    ),
    AUDIT_EXPORT_RETENTION_MS: parsePositiveInteger(
      config.AUDIT_EXPORT_RETENTION_MS,
      604_800_000,
      'AUDIT_EXPORT_RETENTION_MS',
    ),
    DATA_ENCRYPTION_MASTER_SECRET: parseRequiredString(
      config.DATA_ENCRYPTION_MASTER_SECRET ??
        config.WEBHOOK_SIGNING_MASTER_SECRET,
      'DATA_ENCRYPTION_MASTER_SECRET',
    ),
    BLIND_INDEX_MASTER_SECRET: parseRequiredString(
      config.BLIND_INDEX_MASTER_SECRET ??
        config.DATA_ENCRYPTION_MASTER_SECRET ??
        config.WEBHOOK_SIGNING_MASTER_SECRET,
      'BLIND_INDEX_MASTER_SECRET',
    ),
    ENCRYPTED_SUBMISSION_MASTER_SECRET: parseRequiredString(
      config.ENCRYPTED_SUBMISSION_MASTER_SECRET ??
        config.DATA_ENCRYPTION_MASTER_SECRET ??
        config.WEBHOOK_SIGNING_MASTER_SECRET,
      'ENCRYPTED_SUBMISSION_MASTER_SECRET',
    ),
  };
}

function parseNodeEnvironment(value: unknown): NodeEnvironment {
  if (typeof value !== 'string') {
    return 'development';
  }

  if (allowedNodeEnvironments.includes(value as NodeEnvironment)) {
    return value as NodeEnvironment;
  }

  return 'development';
}

function parsePort(value: unknown): number {
  if (value === undefined) {
    return 3000;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  throw new Error('PORT must be a positive integer.');
}

function parseRequiredString(value: unknown, key: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be provided.`);
  }

  return value.trim();
}

function parseBoolean(
  value: unknown,
  defaultValue: boolean,
  key: string,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }
  }

  throw new Error(`${key} must be 'true' or 'false'.`);
}

function parsePositiveInteger(
  value: unknown,
  defaultValue: number,
  key: string,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  throw new Error(`${key} must be a positive integer.`);
}

function parseDisclosureMode(
  value: unknown,
  defaultValue: PartnerDisclosureMode,
  key: string,
): PartnerDisclosureMode {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === 'MASKED_LABEL' || value === 'VERIFICATION_ONLY') {
    return value;
  }

  throw new Error(`${key} must be 'MASKED_LABEL' or 'VERIFICATION_ONLY'.`);
}

function parseRawVerificationRetentionMode(
  value: unknown,
  defaultValue: RawVerificationRetentionMode,
  key: string,
): RawVerificationRetentionMode {
  if (value === undefined) {
    return defaultValue;
  }

  if (
    value === 'NO_RETAIN' ||
    value === 'SHORT_RETENTION' ||
    value === 'STANDARD_RETENTION'
  ) {
    return value;
  }

  throw new Error(
    `${key} must be 'NO_RETAIN', 'SHORT_RETENTION', or 'STANDARD_RETENTION'.`,
  );
}

function parseStringList(
  value: unknown,
  defaultValue: string[],
  key: string,
): string[] {
  if (value === undefined) {
    return [...defaultValue];
  }

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a comma-separated string.`);
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
