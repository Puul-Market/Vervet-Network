import { createHash } from "node:crypto";

const backendRequestTimeoutMs = 10_000;
const defaultListLimit = 20;

type ApiEnvelope<T> = {
  status: true;
  data: T;
};

export type PartnerType =
  | "EXCHANGE"
  | "WALLET"
  | "PAYMENT_PROCESSOR"
  | "MERCHANT"
  | "FINTECH"
  | "OTHER";
export type PartnerStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
export type PartnerOnboardingStage =
  | "ACCOUNT_CREATED"
  | "API_ACCESS_READY"
  | "TRUST_SETUP_READY"
  | "DATA_MAPPING_IN_PROGRESS"
  | "BOOTSTRAP_IMPORT_COMPLETED"
  | "LIVE_FEED_CONNECTED"
  | "PRODUCTION_APPROVED";
export type PartnerFeedHealthStatus =
  | "UNKNOWN"
  | "HEALTHY"
  | "DEGRADED"
  | "DISCONNECTED";
export type ProductionApprovalRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";
export type PartnerProductionCorridorStatus = "GRANTED" | "REVOKED";
export type PartnerUserRole =
  | "OWNER"
  | "ADMIN"
  | "DEVELOPER"
  | "ANALYST"
  | "READ_ONLY";
export type PartnerUserStatus = "ACTIVE" | "DISABLED";
export type SigningKeyAlgorithm = "ED25519" | "ES256K" | "RSA_PSS_SHA256";
export type SigningKeyStatus = "ACTIVE" | "ROTATING" | "REVOKED" | "EXPIRED";
export type WebhookEventType =
  | "DESTINATION_UPDATED"
  | "DESTINATION_REVOKED"
  | "SIGNING_KEY_ROTATED"
  | "RECIPIENT_STATUS_CHANGED";
export type WebhookStatus = "ACTIVE" | "PAUSED" | "DISABLED";
export type DeliveryStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "ABANDONED";
export type RecipientStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
export type IdentifierKind =
  | "PARTNER_HANDLE"
  | "PARTNER_UID"
  | "EMAIL_HASH"
  | "PHONE_HASH"
  | "BUSINESS_ID"
  | "PAYMENT_HANDLE";
export type IdentifierVisibility = "PRIVATE" | "SEARCHABLE" | "RESOLVABLE";
export type IdentifierStatus = "ACTIVE" | "DISABLED" | "REVOKED";
export type DestinationStatus = "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";
export type AttestationType =
  | "DESTINATION_ASSIGNMENT"
  | "DESTINATION_ROTATION"
  | "DESTINATION_REVOCATION"
  | "IDENTIFIER_BINDING";
export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "FAILED"
  | "REVOKED"
  | "EXPIRED";
export type QueryType =
  | "RESOLVE"
  | "CONFIRM_ADDRESS"
  | "VERIFY_ADDRESS"
  | "BATCH_VERIFY";
export type ResolutionOutcome =
  | "RESOLVED"
  | "NO_MATCH"
  | "MISMATCH"
  | "AMBIGUOUS"
  | "UNVERIFIED"
  | "BLOCKED"
  | "ERROR";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DisclosureMode =
  | "FULL_LABEL"
  | "MASKED_LABEL"
  | "VERIFICATION_ONLY";
export type LookupDirection =
  | "FORWARD_LOOKUP"
  | "REVERSE_LOOKUP"
  | "TRANSFER_VERIFICATION";
export type ResolutionBatchLookupMode =
  | "BY_RECIPIENT"
  | "BY_ADDRESS"
  | "MIXED";
export type ResolutionBatchRowLookupMode = Exclude<
  ResolutionBatchLookupMode,
  "MIXED"
>;
export type RiskSignalKind =
  | "ADDRESS_NOT_ATTESTED"
  | "ADDRESS_MISMATCH"
  | "NEW_DESTINATION"
  | "RECENT_ROTATION"
  | "IDENTIFIER_MISMATCH"
  | "ADDRESS_LOOKALIKE"
  | "EXPIRED_ATTESTATION"
  | "KEY_REVOKED"
  | "ENUMERATION_SUSPECTED"
  | "MULTIPLE_ACTIVE_DESTINATIONS"
  | "UNSUPPORTED_ASSET_NETWORK";
export type ResolutionBatchInputFormat = "CSV" | "ROWS" | "JSON";
export type AuditActorType = "SYSTEM" | "PARTNER" | "USER";
export type AuditExportFormat = "CSV" | "JSON";
export type AuditExportStatus = "PENDING" | "READY" | "FAILED" | "EXPIRED";
export type CredentialScope =
  | "partners:read"
  | "partners:write"
  | "attestations:read"
  | "attestations:write"
  | "recipients:read"
  | "recipients:write"
  | "destinations:read"
  | "destinations:write"
  | "resolution:read"
  | "resolution:batch"
  | "webhooks:read"
  | "webhooks:write"
  | "webhooks:replay"
  | "team:read"
  | "team:write"
  | "security:read"
  | "security:write"
  | "audit:read"
  | "audit:export";

export const credentialScopeOptions: readonly CredentialScope[] = [
  "partners:read",
  "partners:write",
  "attestations:read",
  "attestations:write",
  "recipients:read",
  "recipients:write",
  "destinations:read",
  "destinations:write",
  "resolution:read",
  "resolution:batch",
  "webhooks:read",
  "webhooks:write",
  "webhooks:replay",
  "team:read",
  "team:write",
  "security:read",
  "security:write",
  "audit:read",
  "audit:export",
];

export interface PartnerUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: PartnerUserRole;
  scopes: CredentialScope[];
  status: PartnerUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface DashboardLoginRecord {
  accessToken: string;
  expiresAt: string;
  partner: {
    id: string;
    slug: string;
    displayName: string;
  };
  user: PartnerUserRecord;
}

export interface PartnerProfileRecord {
  id: string;
  slug: string;
  displayName: string;
  partnerType: PartnerType;
  status: PartnerStatus;
  createdAt: string;
  activeCredentialCount: number;
  activeSigningKeyCount: number;
  capabilities: {
    apiConsumerEnabled: boolean;
    dataPartnerEnabled: boolean;
    fullAttestationPartnerEnabled: boolean;
    webhooksEnabled: boolean;
    batchVerificationEnabled: boolean;
    auditExportsEnabled: boolean;
    sandboxEnabled: boolean;
    productionEnabled: boolean;
    profileLabel:
      | "API_CONSUMER"
      | "DATA_PARTNER"
      | "CONSUMER_AND_DATA_PARTNER"
      | "FULL_ATTESTATION_PARTNER"
      | "LIMITED_PARTNER";
  };
  onboarding: {
    stage: PartnerOnboardingStage;
    completedTasks: string[];
    blockedTasks: string[];
    nextRecommendedAction: string | null;
    nextRecommendedActionLabel: string;
  };
  readiness: {
    environment: "SANDBOX_ONLY" | "PRODUCTION_APPROVED" | "RESTRICTED";
    productionEnabled: boolean;
    feedHealthStatus: PartnerFeedHealthStatus;
    approvedCorridorCount: number;
    statusLabel: string;
  };
  productionAccess: {
    approvedCorridorCount: number;
    approvedCorridors: PartnerProductionCorridorRecord[];
  };
  productionApproval: {
    canRequest: boolean;
    canCancel: boolean;
    blockedReason: string | null;
    blockedReasonDescription: string;
    latestRequest: PartnerProductionApprovalRequestRecord | null;
  };
  authenticatedActor: {
    type: "API_CREDENTIAL" | "PARTNER_USER";
    identifier: string;
    scopes: CredentialScope[];
  };
  authenticatedCredential: {
    id: string;
    scopes: CredentialScope[];
  } | null;
  authenticatedUser: PartnerUserRecord | null;
}

export interface SupportedPlatformRecord {
  id: string;
  slug: string;
  displayName: string;
  partnerType: PartnerType;
  supportsByAddress: boolean;
  supportsByRecipient: boolean;
}

export interface DashboardAssetNetworkRecord {
  id: string;
  standard: string;
  contractAddressRaw: string | null;
  decimals: number | null;
  memoPolicy: string;
  memoLabel: string | null;
  chain: {
    id: string;
    slug: string;
    displayName: string;
    family: string;
  };
  asset: {
    id: string;
    code: string;
    symbol: string;
    displayName: string;
  };
}

export interface DashboardGuidanceStepRecord {
  title: string;
  description: string;
  href: string;
}

export interface DashboardDataSubmissionGuideRecord {
  summary: string;
  steps: DashboardGuidanceStepRecord[];
  notes: string[];
  endpointPath: string;
  examplePayload: Record<string, unknown>;
  exampleCurl: string;
}

export interface DashboardOnboardingTaskDefinitionRecord {
  key: string;
  label: string;
  description: string;
  href: string;
  ctaLabel: string;
  blockedBy: string | null;
}

export interface DashboardCredentialScopeDefinitionRecord {
  value: CredentialScope;
  label: string;
  description: string;
}

export interface PartnerDashboardMetadataRecord {
  assetNetworks: DashboardAssetNetworkRecord[];
  optionSets: {
    partnerTypes: PartnerType[];
    partnerStatuses: PartnerStatus[];
    partnerOnboardingStages: PartnerOnboardingStage[];
    partnerFeedHealthStatuses: PartnerFeedHealthStatus[];
    partnerUserRoles: PartnerUserRole[];
    partnerUserStatuses: PartnerUserStatus[];
    signingKeyAlgorithms: SigningKeyAlgorithm[];
    credentialScopes: CredentialScope[];
    credentialScopeDefinitions: DashboardCredentialScopeDefinitionRecord[];
    recommendedCredentialScopes: CredentialScope[];
    webhookEventTypes: WebhookEventType[];
    webhookStatuses: WebhookStatus[];
    deliveryStatuses: DeliveryStatus[];
    recipientStatuses: RecipientStatus[];
    identifierKinds: IdentifierKind[];
    identifierVisibilities: IdentifierVisibility[];
    destinationStatuses: DestinationStatus[];
    attestationTypes: AttestationType[];
    verificationStatuses: VerificationStatus[];
    auditActorTypes: AuditActorType[];
    auditExportFormats: AuditExportFormat[];
    queryTypes: QueryType[];
    resolutionOutcomes: ResolutionOutcome[];
    riskLevels: RiskLevel[];
    disclosureModes: DisclosureMode[];
    resolutionBatchLookupModes: ResolutionBatchLookupMode[];
    resolutionBatchInputFormats: ResolutionBatchInputFormat[];
  };
  onboarding: {
    actionLabels: Record<string, string>;
    blockedReasonDescriptions: Record<string, string>;
    taskDefinitions: DashboardOnboardingTaskDefinitionRecord[];
  };
  guidance: {
    journeyLabel: string;
    journeySummary: string;
    quickstartSteps: DashboardGuidanceStepRecord[];
    productionUpgradeSteps: DashboardGuidanceStepRecord[];
    dataSubmission: DashboardDataSubmissionGuideRecord;
  };
  sandbox: {
    presets: Array<{
      key: string;
      title: string;
      description: string;
      href: string;
    }>;
    sampleResponse: unknown | null;
    batchDefaultInput: string | null;
  };
}

export interface AdminSetupMetadataRecord {
  optionSets: {
    partnerTypes: PartnerType[];
    partnerStatuses: PartnerStatus[];
    partnerOnboardingStages: PartnerOnboardingStage[];
    partnerFeedHealthStatuses: PartnerFeedHealthStatus[];
    partnerUserRoles: PartnerUserRole[];
    signingKeyAlgorithms: SigningKeyAlgorithm[];
  };
}

export type SupportedPlatformLookupMode = "BY_ADDRESS" | "BY_RECIPIENT";

export interface PartnerProductionApprovalRequestRecord {
  id: string;
  status: ProductionApprovalRequestStatus;
  requestNote: string | null;
  reviewNote: string | null;
  reviewedByIdentifier: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requestedByUser: {
    id: string;
    email: string;
    fullName: string;
    role: PartnerUserRole;
  } | null;
  requestedCorridors: Array<{
    id: string;
    assetNetwork: ProductionCorridorAssetNetworkRecord;
  }>;
  approvedCorridors: Array<{
    id: string;
    assetNetwork: ProductionCorridorAssetNetworkRecord;
  }>;
}

export interface ProductionCorridorAssetNetworkRecord {
  id: string;
  standard: string;
  contractAddressRaw: string | null;
  chain: {
    id: string;
    slug: string;
    displayName: string;
  };
  asset: {
    id: string;
    code: string;
    symbol: string;
    displayName: string;
  };
}

export interface PartnerProductionCorridorRecord {
  id: string;
  status: PartnerProductionCorridorStatus;
  note: string | null;
  grantedByIdentifier: string | null;
  grantedAt: string;
  revokedAt: string | null;
  assetNetwork: ProductionCorridorAssetNetworkRecord;
}

export interface AdminPartnerRecord {
  id: string;
  slug: string;
  displayName: string;
  partnerType: PartnerType;
  status: PartnerStatus;
  createdAt: string;
  updatedAt: string;
  capabilities: PartnerProfileRecord["capabilities"];
  onboarding: PartnerProfileRecord["onboarding"];
  readiness: PartnerProfileRecord["readiness"];
  productionAccess: PartnerProfileRecord["productionAccess"];
  counts: {
    activeCredentialCount: number;
    activeSigningKeyCount: number;
    activeWebhookCount: number;
    activeRecipientCount: number;
    verifiedAttestationCount: number;
    resolutionRequestCount: number;
  };
  latestProductionApprovalRequest: PartnerProductionApprovalRequestRecord | null;
}

export interface AdminProductionApprovalRequestRecord
  extends PartnerProductionApprovalRequestRecord {
  partner: {
    id: string;
    slug: string;
    displayName: string;
    partnerType: PartnerType;
    status: PartnerStatus;
    productionEnabled: boolean;
    onboardingStage: PartnerOnboardingStage;
    feedHealthStatus: PartnerFeedHealthStatus;
  };
}

export type AvailableProductionCorridorRecord = ProductionCorridorAssetNetworkRecord;

export type DashboardModule =
  | "overview"
  | "data_feed"
  | "resolution"
  | "batch_verification"
  | "registry"
  | "webhooks"
  | "api_keys"
  | "signing_keys"
  | "team"
  | "security"
  | "audit"
  | "audit_exports"
  | "docs"
  | "sandbox";

export interface PartnerApiCredentialRecord {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: CredentialScope[];
  status: PartnerStatus;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

export interface PartnerApiCredentialSecretRecord
  extends PartnerApiCredentialRecord {
  partner: string;
  secret: string;
}

export interface PartnerSigningKeyRecord {
  id: string;
  keyId: string;
  algorithm: SigningKeyAlgorithm;
  fingerprint: string;
  status: SigningKeyStatus;
  validFrom: string;
  validTo: string | null;
  rotatesAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PartnerSigningKeySecretRecord extends PartnerSigningKeyRecord {
  partner?: string;
}

export interface PartnerUserInviteRecord {
  id: string;
  email: string;
  fullName: string | null;
  role: PartnerUserRole;
  scopes: CredentialScope[];
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  inviteToken?: string;
}

export interface PartnerSecuritySettingsRecord {
  id: string;
  sessionIdleTimeoutMinutes: number;
  enforceMfa: boolean;
  ipAllowlist: string[];
  credentialRotationDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface IdentifierRecord {
  id: string;
  kind: IdentifierKind;
  rawValue: string;
  normalizedValue: string;
  status: IdentifierStatus;
  visibility: IdentifierVisibility;
  isPrimary: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export interface DestinationRecord {
  id: string;
  recipient: {
    id: string;
    externalRecipientId: string;
    displayName: string | null;
  };
  address: string;
  normalizedAddress: string;
  memoValue: string | null;
  status: DestinationStatus;
  isDefault: boolean;
  effectiveFrom: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAttestedAt: string | null;
  assetNetwork: {
    id: string;
    assetCode: string;
    assetSymbol: string;
    chain: string;
    chainDisplayName: string;
    tokenStandard: string;
    contractAddress: string | null;
  };
  latestAttestation: {
    id: string;
    verificationStatus: VerificationStatus;
    issuedAt: string;
    expiresAt: string | null;
  } | null;
  attestationHistory?: Array<{
    id: string;
    attestationType: AttestationType;
    verificationStatus: VerificationStatus;
    issuedAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
  }>;
  recentUsage?: Array<{
    id: string;
    queryType: QueryType;
    outcome: ResolutionOutcome;
    riskLevel: RiskLevel;
    recommendation: string | null;
    requestedAt: string;
  }>;
  resolutionAvailability?: {
    byRecipient: boolean;
    byAddress: boolean;
    disclosureMode: DisclosureMode;
    platformScope: string[];
    currentLookupStatus: "AVAILABLE" | "RESTRICTED" | "UNAVAILABLE";
  };
}

export interface RecipientRecord {
  id: string;
  externalRecipientId: string;
  displayName: string | null;
  status: RecipientStatus;
  profile: unknown;
  createdAt: string;
  updatedAt: string;
  activeDestinationsCount: number;
  identifiers: IdentifierRecord[];
  currentDestinations: Array<{
    id: string;
    address: string;
    memo: string | null;
    status: DestinationStatus;
    isDefault: boolean;
    effectiveFrom: string;
    expiresAt: string | null;
    lastAttestedAt: string | null;
    assetNetwork: {
      id: string;
      assetCode: string;
      assetSymbol: string;
      chain: string;
      chainDisplayName: string;
      tokenStandard: string;
      contractAddress: string | null;
    };
  }>;
  recentAttestations?: Array<{
    id: string;
    attestationType: AttestationType;
    verificationStatus: VerificationStatus;
    issuedAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
  }>;
  recentVerificationAttempts?: Array<{
    id: string;
    queryType: QueryType;
    outcome: ResolutionOutcome;
    riskLevel: RiskLevel;
    recommendation: string | null;
    requestedAt: string;
  }>;
  resolutionAvailability?: {
    byRecipient: boolean;
    byAddress: boolean;
    supportedPlatforms: string[];
    disclosureMode: DisclosureMode;
  };
}

export interface AttestationRecord {
  id: string;
  attestationType: AttestationType;
  verificationStatus: VerificationStatus;
  recipientId: string;
  recipientExternalId: string;
  recipientDisplayName: string | null;
  recipientIdentifier: string;
  chain: string | null;
  assetCode: string | null;
  assetSymbol: string | null;
  address: string | null;
  memo: string | null;
  destinationId: string | null;
  destinationStatus: DestinationStatus | null;
  keyId: string;
  sequenceNumber: string;
  issuedAt: string;
  effectiveFrom: string;
  expiresAt: string | null;
  verifiedAt: string | null;
  ingestedAt: string;
}

export interface AttestationDetailRecord {
  id: string;
  attestationType: AttestationType;
  verificationStatus: VerificationStatus;
  canonicalPayload: string;
  payload: unknown;
  payloadHash: string;
  signature: string;
  partnerId: string;
  recipient: {
    id: string;
    externalRecipientId: string;
    displayName: string | null;
    identifier: string;
  };
  identifier: {
    id: string;
    kind: IdentifierKind;
    rawValue: string;
    normalizedValue: string;
  } | null;
  destination: {
    id: string;
    address: string;
    normalizedAddress: string;
    memoValue: string | null;
    status: DestinationStatus;
  } | null;
  assetNetwork: {
    id: string;
    chain: string;
    chainDisplayName: string;
    assetCode: string;
    assetSymbol: string;
    tokenStandard: string;
  } | null;
  signingKey: {
    id: string;
    keyId: string;
    algorithm: SigningKeyAlgorithm;
    fingerprint: string;
  };
  sequenceNumber: string;
  issuedAt: string;
  effectiveFrom: string;
  expiresAt: string | null;
  verifiedAt: string | null;
  revokedAt: string | null;
  ingestedAt: string;
  supersedesAttestationId: string | null;
  supersededByAttestationIds: string[];
  resolutionPolicy?: {
    allowedLookupDirection: "FORWARD_ONLY" | "REVERSE_ONLY" | "BOTH" | "RESTRICTED";
    disclosureMode: DisclosureMode;
    sourcePlatformPolicy: string;
    labelReturnAllowed: boolean;
  };
}

export interface WebhookEndpointRecord {
  id: string;
  label: string;
  url: string;
  eventTypes: WebhookEventType[];
  signingSecretVersion: number;
  status: WebhookStatus;
  lastDeliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  signingSecret?: string;
  deliveryStats?: Record<string, number>;
  deliveries?: WebhookDeliveryRecord[];
}

export interface WebhookDeliveryRecord {
  id: string;
  endpointId?: string;
  eventType: WebhookEventType;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  responseCode: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  payload?: unknown;
  payloadHash?: string;
  endpoint: {
    id?: string;
    label: string;
    url: string;
    eventTypes?: WebhookEventType[];
    signingSecretVersion?: number;
    status?: WebhookStatus;
  };
}

export interface ResolutionLogRecord {
  id: string;
  queryType: QueryType;
  recipientIdentifier: string;
  platform: string | null;
  chain: string;
  asset: string;
  providedAddress: string | null;
  outcome: ResolutionOutcome;
  riskLevel: RiskLevel;
  recommendation: string | null;
  flags: RiskSignalKind[];
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  requestedAt: string;
  respondedAt: string | null;
}

export interface ResolutionLogDetailRecord {
  id: string;
  queryType: QueryType;
  recipientIdentifierInput: string;
  recipientIdentifierNormalized: string;
  platformInput: string | null;
  chainInput: string;
  assetInput: string;
  providedAddressRaw: string | null;
  providedAddressNormalized: string | null;
  outcome: ResolutionOutcome;
  riskLevel: RiskLevel;
  recommendation: string | null;
  flags: RiskSignalKind[];
  requestedAt: string;
  respondedAt: string | null;
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  responseData: unknown;
  metadata: unknown;
  resolvedRecipient: {
    id: string;
    externalRecipientId: string;
    displayName: string | null;
  } | null;
  resolvedIdentifier: {
    id: string;
    rawValue: string;
    normalizedValue: string;
    kind: IdentifierKind;
  } | null;
  resolvedDestination: {
    id: string;
    addressRaw: string;
    addressNormalized: string;
    memoValue: string;
    status: DestinationStatus;
  } | null;
  resolvedAttestation: {
    id: string;
    attestationType: AttestationType;
    verificationStatus: VerificationStatus;
    issuedAt: string;
    expiresAt: string | null;
  } | null;
  riskSignals: Array<{
    kind: RiskSignalKind;
    severity: RiskLevel;
    details: unknown;
    createdAt: string;
  }>;
}

export interface ResolveResponseRecord {
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  recipientDisplayName: string | null;
  platform: string | null;
  address: string | null;
  chain: string | null;
  asset: string | null;
  verified: boolean;
  expiresAt: string | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
}

export interface CandidatePlatformRecord {
  id: string;
  slug: string;
  displayName: string;
}

export interface ConfirmRecipientResponseRecord {
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  confirmed: boolean;
  verified: boolean;
  recipientDisplayName: string | null;
  platform: string | null;
  chain: string | null;
  asset: string | null;
  expiresAt: string | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
  candidatePlatforms?: CandidatePlatformRecord[];
  requiresPlatformSelection?: boolean;
}

export interface VerifyResponseRecord {
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  match: boolean;
  verified: boolean;
  recipientDisplayName: string | null;
  platform: string | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
}

export interface BatchVerifyRowRecord {
  clientReference: string | null;
  lookupMode: ResolutionBatchRowLookupMode;
  platform: string | null;
  recipientIdentifier: string | null;
  submittedAddress: string;
  match: boolean;
  verified: boolean;
  recipientDisplayName: string | null;
  disclosureMode: DisclosureMode | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
}

export interface BatchVerifyRecord {
  batchRunId: string;
  inputFormat: ResolutionBatchInputFormat;
  lookupMode: ResolutionBatchLookupMode;
  chain: string;
  asset: string;
  totalRows: number;
  verifiedRows: number;
  warningRows: number;
  blockedRows: number;
  unsupportedRows: number;
  rows: BatchVerifyRowRecord[];
}

export interface OverviewRecord {
  kpis: {
    activeRecipients: number;
    activeDestinations: number;
    activeAttestations: number;
    byRecipientRequests7d: number;
    byAddressRequests7d: number;
    verifyTransferRequests7d: number;
    blockedVerificationCount: number;
    webhookFailureCount: number;
  };
  attention: {
    highRiskVerifications: Array<{
      id: string;
      queryType: QueryType;
      platformInput: string | null;
      recipientIdentifierInput: string;
      chainInput: string;
      assetInput: string;
      outcome: ResolutionOutcome;
      riskLevel: RiskLevel;
      recommendation: string | null;
      flags: RiskSignalKind[];
      requestedAt: string;
    }>;
    revokedDestinations: Array<{
      id: string;
      recipient: {
        id: string;
        externalRecipientId: string;
        displayName: string | null;
      };
      chain: string;
      asset: string;
      address: string;
      revokedAt: string | null;
    }>;
    expiringAttestations: Array<{
      id: string;
      recipient: {
        id: string;
        externalRecipientId: string;
        displayName: string | null;
      };
      recipientIdentifier: string;
      attestationType: AttestationType;
      expiresAt: string | null;
    }>;
    failedWebhookDeliveries: Array<{
      id: string;
      endpoint: {
        id: string;
        label: string;
        url: string;
      };
      eventType: WebhookEventType;
      status: DeliveryStatus;
      attemptCount: number;
      responseCode: number | null;
      lastError: string | null;
      updatedAt: string;
    }>;
    recentKeyChanges: Array<{
      id: string;
      action: string;
      summary: string | null;
      createdAt: string;
    }>;
  };
  health: {
    webhookSuccessRate: number | null;
    byRecipientResolutionSuccessRate: number | null;
    byAddressResolutionSuccessRate: number | null;
    attestationFreshnessScore: number | null;
    keyRotationStatus: string;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    summary: string | null;
    entityType: string;
    entityId: string;
    createdAt: string;
    actorType: AuditActorType;
    actorIdentifier: string | null;
  }>;
}

export interface DataFeedHealthRecord {
  partner: {
    id: string;
    slug: string;
    displayName: string;
  };
  feed: {
    status: PartnerFeedHealthStatus;
    statusLabel: string;
    onboardingStage: PartnerOnboardingStage;
    environment: "SANDBOX_ONLY" | "PRODUCTION_APPROVED" | "RESTRICTED";
    lastAttestationReceivedAt: string | null;
    lastRevocationReceivedAt: string | null;
  };
  metrics: {
    activeDestinationCount: number;
    activeAttestationCount: number;
    activeSigningKeyCount: number;
    activeWebhookCount: number;
    staleDestinationCount: number;
    staleAttestationCount: number;
    failedDeliveryCount7d: number;
    pendingDeliveryCount: number;
    deliverySuccessRate7d: number;
    recentIngestionSuccessCount7d: number;
    recentIngestionFailureCount7d: number;
    degradedCorridorCount: number;
    disconnectedCorridorCount: number;
  };
  freshness: {
    destinationFreshnessWindowDays: number;
    attestationExpiryWindowDays: number;
    staleDestinations: Array<{
      id: string;
      recipientId: string;
      recipientIdentifier: string;
      recipientDisplayName: string;
      address: string;
      chain: string;
      asset: string;
      status: DestinationStatus;
      lastAttestedAt: string | null;
      expiresAt: string | null;
      updatedAt: string;
    }>;
    staleAttestations: Array<{
      id: string;
      attestationType: AttestationType;
      verificationStatus: VerificationStatus;
      recipientIdentifier: string;
      recipientDisplayName: string;
      chain: string | null;
      asset: string | null;
      issuedAt: string;
      ingestedAt: string;
      expiresAt: string | null;
      revokedAt: string | null;
    }>;
  };
  ingestion: {
    recentActivity: Array<{
      id: string;
      entityId: string;
      status: "SUCCEEDED";
      summary: string | null;
      attestationType: string | null;
      recipientIdentifier: string | null;
      chain: string | null;
      asset: string | null;
      keyId: string | null;
      sequenceNumber: string | null;
      failureReason: string | null;
      occurredAt: string;
    }>;
    recentFailures: Array<{
      id: string;
      entityId: string;
      status: "FAILED";
      summary: string | null;
      attestationType: string | null;
      recipientIdentifier: string | null;
      chain: string | null;
      asset: string | null;
      keyId: string | null;
      sequenceNumber: string | null;
      failureReason: string | null;
      occurredAt: string;
    }>;
  };
  corridors: Array<{
    assetNetworkId: string;
    chain: string;
    chainDisplayName: string;
    asset: string;
    assetDisplayName: string;
    contractAddress: string | null;
    productionGranted: boolean;
    activeDestinationCount: number;
    staleDestinationCount: number;
    verifiedAttestationCount: number;
    staleAttestationCount: number;
    recentIngestionCount7d: number;
    lastAttestationReceivedAt: string | null;
    lastRevocationReceivedAt: string | null;
    status: PartnerFeedHealthStatus;
    statusLabel: string;
  }>;
  recentTrustEvents: Array<{
    id: string;
    eventType: string;
    verificationStatus: VerificationStatus;
    recipientIdentifier: string;
    recipientDisplayName: string;
    address: string | null;
    chain: string | null;
    asset: string | null;
    occurredAt: string;
  }>;
  deliveryFailures: Array<{
    id: string;
    endpointLabel: string;
    endpointUrl: string;
    eventType: WebhookEventType;
    status: DeliveryStatus;
    attemptCount: number;
    responseCode: number | null;
    lastAttemptAt: string | null;
    nextAttemptAt: string | null;
  }>;
  eventHealth: {
    webhookTestFailures: Array<{
      id: string;
      endpointId: string;
      summary: string | null;
      error: string | null;
      occurredAt: string;
    }>;
  };
  recommendedActions: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
  }>;
}

export interface AuditLogRecord {
  id: string;
  actorType: AuditActorType;
  actorIdentifier: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditExportRecord {
  id: string;
  format: AuditExportFormat;
  status: AuditExportStatus;
  downloadFilename: string | null;
  downloadMimeType: string | null;
  downloadContent?: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export class DashboardApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "DashboardApiError";
    this.statusCode = statusCode;
  }
}

export class DashboardAuthError extends DashboardApiError {
  constructor(message = "Your dashboard session is no longer valid.") {
    super(message, 401);
    this.name = "DashboardAuthError";
  }
}

export class DashboardAdminAuthError extends DashboardApiError {
  constructor(message = "Admin setup is not available.") {
    super(message, 401);
    this.name = "DashboardAdminAuthError";
  }
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.VERVET_API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new DashboardApiError("VERVET_API_BASE_URL is not configured.", 500);
  }

  const normalizedBaseUrl = baseUrl.replace(/\/v1\/?$/u, "");

  return normalizedBaseUrl.endsWith("/")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/`;
}

function buildUrl(pathname: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(pathname.replace(/^\//, ""), getApiBaseUrl());

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

async function fetchApi<T>(input: {
  accessToken?: string;
  adminToken?: string;
  pathname: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  params?: Record<string, string | number | undefined>;
  body?: unknown;
  extraHeaders?: Record<string, string>;
}): Promise<T> {
  const headers = new Headers({
    accept: "application/json",
  });

  if (input.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (input.accessToken) {
    headers.set("authorization", `Bearer ${input.accessToken}`);
  }

  if (input.adminToken) {
    headers.set("x-admin-token", input.adminToken);
  }

  for (const [key, value] of Object.entries(input.extraHeaders ?? {})) {
    headers.set(key, value);
  }

  const response = await fetch(buildUrl(input.pathname, input.params), {
    method: input.method ?? "GET",
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    cache: "no-store",
    signal: AbortSignal.timeout(backendRequestTimeoutMs),
  });

  if (response.status === 401) {
    throw input.adminToken
      ? new DashboardAdminAuthError()
      : new DashboardAuthError();
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new DashboardApiError(message, response.status);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload.data;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }

    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || "Backend request failed.";
}

export function humanizeDashboardError(error: unknown): string {
  if (error instanceof DashboardApiError) {
    return error.message;
  }

  return "The dashboard could not complete the backend request.";
}

export function canAccessScope(
  sessionScopes: readonly CredentialScope[],
  requiredScopes: readonly CredentialScope[],
): boolean {
  return requiredScopes.every((scope) => sessionScopes.includes(scope));
}

const partnerOnboardingStageOrder: readonly PartnerOnboardingStage[] = [
  "ACCOUNT_CREATED",
  "API_ACCESS_READY",
  "TRUST_SETUP_READY",
  "DATA_MAPPING_IN_PROGRESS",
  "BOOTSTRAP_IMPORT_COMPLETED",
  "LIVE_FEED_CONNECTED",
  "PRODUCTION_APPROVED",
];

function readPartnerCapabilities(
  input: PartnerProfileRecord | PartnerProfileRecord["capabilities"],
) {
  return "capabilities" in input ? input.capabilities : input;
}

export function isDataContributorEnabled(
  input: PartnerProfileRecord | PartnerProfileRecord["capabilities"],
): boolean {
  const capabilities = readPartnerCapabilities(input);

  return (
    capabilities.dataPartnerEnabled || capabilities.fullAttestationPartnerEnabled
  );
}

export function hasReachedOnboardingStage(
  currentStage: PartnerOnboardingStage,
  requiredStage: PartnerOnboardingStage,
): boolean {
  return (
    partnerOnboardingStageOrder.indexOf(currentStage) >=
    partnerOnboardingStageOrder.indexOf(requiredStage)
  );
}

export function canRunOperationalResolution(
  profile: PartnerProfileRecord,
): boolean {
  return (
    canAccessModule(profile, "resolution") &&
    (profile.capabilities.sandboxEnabled ||
      profile.capabilities.productionEnabled)
  );
}

export function canAccessModule(
  profile: PartnerProfileRecord,
  module: DashboardModule,
): boolean {
  switch (module) {
    case "overview":
    case "docs":
      return true;
    case "data_feed":
      return isDataContributorEnabled(profile);
    case "resolution":
      return (
        profile.capabilities.apiConsumerEnabled ||
        isDataContributorEnabled(profile)
      );
    case "batch_verification":
      return (
        canAccessModule(profile, "resolution") &&
        profile.capabilities.batchVerificationEnabled
      );
    case "registry":
      return isDataContributorEnabled(profile);
    case "webhooks":
      return profile.capabilities.webhooksEnabled;
    case "api_keys":
      return (
        profile.capabilities.apiConsumerEnabled ||
        isDataContributorEnabled(profile)
      );
    case "signing_keys":
      return isDataContributorEnabled(profile);
    case "team":
      return canAccessScope(profile.authenticatedActor.scopes, ["team:read"]);
    case "security":
      return canAccessScope(profile.authenticatedActor.scopes, [
        "security:read",
      ]);
    case "audit":
      return canAccessScope(profile.authenticatedActor.scopes, ["audit:read"]);
    case "audit_exports":
      return (
        profile.capabilities.auditExportsEnabled &&
        canAccessScope(profile.authenticatedActor.scopes, ["audit:export"])
      );
    case "sandbox":
      return profile.capabilities.sandboxEnabled;
  }
}

export function describeOnboardingAction(action: string | null): string {
  switch (action) {
    case "create_api_key":
      return "Create an API key";
    case "register_signing_key":
      return "Register a signing key";
    case "configure_webhook":
      return "Configure a webhook";
    case "run_sandbox_request":
      return "Run a sandbox request";
    case "map_recipient_data":
      return "Map recipient data";
    case "ingest_attestation_data":
      return "Ingest attestation data";
    case "request_production_approval":
      return "Request production approval";
    case "await_production_review":
      return "Await production review";
    default:
      return "Review workspace readiness";
  }
}

export function describeProductionApprovalBlockedReason(
  blockedReason: string | null,
): string {
  switch (blockedReason) {
    case "dashboard_user_required":
      return "A dashboard user session is required to request production approval.";
    case "insufficient_role":
      return "Only owners and admins can request or cancel production approval.";
    case "already_production_enabled":
      return "This organization is already production approved.";
    case "pending_review":
      return "A production approval request is already pending review.";
    case "feed_health_not_ready":
      return "Feed health must be healthy before production approval can be requested.";
    case "onboarding_incomplete":
      return "Complete the remaining onboarding steps before requesting production approval.";
    default:
      return "Review readiness requirements before requesting production approval.";
  }
}

export function canManageProductionApproval(
  userRole: string | null | undefined,
): boolean {
  return userRole === "OWNER" || userRole === "ADMIN";
}

export function shouldSurfaceOnboardingSetup(
  profile: PartnerProfileRecord,
): boolean {
  return (
    profile.onboarding.nextRecommendedAction !== null ||
    profile.readiness.environment !== "PRODUCTION_APPROVED"
  );
}

export function roleDefaultScopes(role: PartnerUserRole): CredentialScope[] {
  switch (role) {
    case "DEVELOPER":
      return [
        "partners:read",
        "attestations:read",
        "recipients:read",
        "destinations:read",
        "resolution:read",
        "resolution:batch",
        "webhooks:read",
        "webhooks:write",
        "webhooks:replay",
        "audit:read",
      ];
    case "ANALYST":
      return [
        "partners:read",
        "attestations:read",
        "recipients:read",
        "destinations:read",
        "resolution:read",
        "webhooks:read",
        "audit:read",
      ];
    case "READ_ONLY":
      return [
        "partners:read",
        "attestations:read",
        "recipients:read",
        "destinations:read",
        "resolution:read",
        "webhooks:read",
        "audit:read",
      ];
    case "ADMIN":
      return [
        "partners:read",
        "partners:write",
        "attestations:read",
        "attestations:write",
        "recipients:read",
        "recipients:write",
        "destinations:read",
        "destinations:write",
        "resolution:read",
        "resolution:batch",
        "webhooks:read",
        "webhooks:write",
        "webhooks:replay",
        "team:read",
        "team:write",
        "security:read",
        "audit:read",
        "audit:export",
      ];
    case "OWNER":
    default:
      return [...credentialScopeOptions];
  }
}

export async function loginDashboardUser(input: {
  email: string;
  password: string;
}) {
  return fetchApi<DashboardLoginRecord>({
    pathname: "/v1/dashboard-auth/login",
    method: "POST",
    body: input,
  });
}

export async function acceptPartnerInvite(input: {
  inviteToken: string;
  fullName: string;
  password: string;
}) {
  return fetchApi<DashboardLoginRecord>({
    pathname: `/v1/dashboard-auth/invitations/${input.inviteToken}/accept`,
    method: "POST",
    body: {
      fullName: input.fullName,
      password: input.password,
    },
  });
}

export async function logoutDashboardSession(accessToken: string) {
  return fetchApi<{ revoked: boolean }>({
    pathname: "/v1/dashboard-auth/logout",
    method: "POST",
    accessToken,
  });
}

export async function verifyAdminSetupToken(adminToken: string) {
  return fetchApi<{ authenticated: true }>({
    pathname: "/v1/partners/setup/status",
    adminToken,
  });
}

export async function createPartner(
  adminToken: string,
  input: {
    slug: string;
    displayName: string;
    partnerType: PartnerType;
  },
) {
  return fetchApi<{
    id: string;
    slug: string;
    displayName: string;
    partnerType: PartnerType;
    status: PartnerStatus;
    createdAt: string;
  }>({
    pathname: "/v1/partners",
    method: "POST",
    adminToken,
    body: input,
  });
}

export async function createOwnerUser(
  adminToken: string,
  input: {
    partnerSlug: string;
    fullName: string;
    email: string;
    password: string;
  },
) {
  return fetchApi<PartnerUserRecord>({
    pathname: "/v1/partners/users",
    method: "POST",
    adminToken,
    body: {
      ...input,
      role: "OWNER",
    },
  });
}

export async function registerInitialSigningKey(
  adminToken: string,
  input: {
    partnerSlug: string;
    keyId: string;
    algorithm: SigningKeyAlgorithm;
    publicKeyPem: string;
    validFrom: string;
    validTo?: string;
  },
) {
  return fetchApi<PartnerSigningKeyRecord>({
    pathname: "/v1/partners/signing-keys",
    method: "POST",
    adminToken,
    body: input,
  });
}

export async function fetchAdminPartners(adminToken: string) {
  return fetchApi<AdminPartnerRecord[]>({
    pathname: "/v1/partners",
    adminToken,
  });
}

export async function fetchAdminAvailableProductionCorridors(adminToken: string) {
  return fetchApi<AvailableProductionCorridorRecord[]>({
    pathname: "/v1/partners/corridors",
    adminToken,
  });
}

export async function fetchAdminSetupMetadata(adminToken: string) {
  return fetchApi<AdminSetupMetadataRecord>({
    pathname: "/v1/partners/setup/metadata",
    adminToken,
  });
}

export async function fetchAdminProductionApprovalRequests(
  adminToken: string,
  input?: {
    status?: ProductionApprovalRequestStatus;
  },
) {
  return fetchApi<AdminProductionApprovalRequestRecord[]>({
    pathname: "/v1/partners/production-approval-requests",
    adminToken,
    params: {
      status: input?.status,
    },
  });
}

export async function reviewAdminProductionApprovalRequest(
  adminToken: string,
  requestId: string,
  input: {
    decision: "APPROVED" | "REJECTED";
    reviewNote?: string;
    approvedAssetNetworkIds?: string[];
  },
) {
  return fetchApi<PartnerProductionApprovalRequestRecord>({
    pathname: `/v1/partners/production-approval-requests/${requestId}/review`,
    method: "POST",
    adminToken,
    body: input,
  });
}

export async function updateAdminPartnerState(
  adminToken: string,
  partnerId: string,
  input: {
    status?: PartnerStatus;
    onboardingStage?: PartnerOnboardingStage;
    feedHealthStatus?: PartnerFeedHealthStatus;
    apiConsumerEnabled?: boolean;
    dataPartnerEnabled?: boolean;
    fullAttestationPartnerEnabled?: boolean;
    webhooksEnabled?: boolean;
    batchVerificationEnabled?: boolean;
    auditExportsEnabled?: boolean;
    sandboxEnabled?: boolean;
  },
) {
  return fetchApi<AdminPartnerRecord>({
    pathname: `/v1/partners/${partnerId}/admin-state`,
    method: "PATCH",
    adminToken,
    body: input,
  });
}

export async function updateAdminPartnerProductionCorridor(
  adminToken: string,
  partnerId: string,
  input: {
    assetNetworkId: string;
    enabled: boolean;
    note?: string;
  },
) {
  return fetchApi<PartnerProductionCorridorRecord>({
    pathname: `/v1/partners/${partnerId}/production-corridors`,
    method: "POST",
    adminToken,
    body: input,
  });
}

export async function fetchPartnerProfile(accessToken: string) {
  return fetchApi<PartnerProfileRecord>({
    pathname: "/v1/partners/me",
    accessToken,
  });
}

export async function fetchPartnerDashboardMetadata(accessToken: string) {
  return fetchApi<PartnerDashboardMetadataRecord>({
    pathname: "/v1/partners/me/dashboard-metadata",
    accessToken,
  });
}

export async function fetchPartnerProductionCorridors(accessToken: string) {
  return fetchApi<PartnerProductionCorridorRecord[]>({
    pathname: "/v1/partners/me/production-corridors",
    accessToken,
  });
}

export async function fetchAvailableProductionCorridors(accessToken: string) {
  return fetchApi<AvailableProductionCorridorRecord[]>({
    pathname: "/v1/partners/me/available-production-corridors",
    accessToken,
  });
}

export async function fetchSupportedPlatforms(
  accessToken: string,
  filters?: {
    address?: string;
    asset?: string;
    chain?: string;
    lookupMode?: SupportedPlatformLookupMode;
  },
) {
  return fetchApi<SupportedPlatformRecord[]>({
    pathname: "/v1/platforms",
    accessToken,
    params: {
      address: filters?.address,
      asset: filters?.asset,
      chain: filters?.chain,
      lookupMode: filters?.lookupMode,
    },
  });
}

export async function fetchOverview(accessToken: string) {
  return fetchApi<OverviewRecord>({
    pathname: "/v1/overview",
    accessToken,
  });
}

export async function fetchDataFeedHealth(accessToken: string) {
  return fetchApi<DataFeedHealthRecord>({
    pathname: "/v1/data-feed-health",
    accessToken,
  });
}

export async function fetchPartnerApiCredentials(accessToken: string) {
  return fetchApi<PartnerApiCredentialRecord[]>({
    pathname: "/v1/partners/me/api-credentials",
    accessToken,
  });
}

export async function issuePartnerApiCredential(
  accessToken: string,
  input: {
    label: string;
    scopes: CredentialScope[];
  },
) {
  return fetchApi<PartnerApiCredentialSecretRecord>({
    pathname: "/v1/partners/me/api-credentials",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function revokePartnerApiCredential(
  accessToken: string,
  credentialId: string,
) {
  return fetchApi<PartnerApiCredentialRecord>({
    pathname: `/v1/partners/me/api-credentials/${credentialId}/revoke`,
    method: "POST",
    accessToken,
  });
}

export async function fetchPartnerSigningKeys(accessToken: string) {
  return fetchApi<PartnerSigningKeyRecord[]>({
    pathname: "/v1/partners/me/signing-keys",
    accessToken,
  });
}

export async function registerPartnerSigningKey(
  accessToken: string,
  input: {
    keyId: string;
    algorithm: SigningKeyAlgorithm;
    publicKeyPem: string;
    validFrom: string;
    validTo?: string;
  },
) {
  return fetchApi<PartnerSigningKeyRecord>({
    pathname: "/v1/partners/me/signing-keys",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function revokePartnerSigningKey(
  accessToken: string,
  signingKeyId: string,
) {
  return fetchApi<PartnerSigningKeyRecord>({
    pathname: `/v1/partners/me/signing-keys/${signingKeyId}/revoke`,
    method: "POST",
    accessToken,
  });
}

export async function fetchPartnerUsers(accessToken: string) {
  return fetchApi<{
    users: PartnerUserRecord[];
    invites: PartnerUserInviteRecord[];
  }>({
    pathname: "/v1/partners/me/users",
    accessToken,
  });
}

export async function invitePartnerUser(
  accessToken: string,
  input: {
    email: string;
    fullName?: string;
    role: PartnerUserRole;
  },
) {
  return fetchApi<PartnerUserInviteRecord>({
    pathname: "/v1/partners/me/users/invites",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function updatePartnerUser(
  accessToken: string,
  userId: string,
  input: {
    fullName?: string;
    role?: PartnerUserRole;
  },
) {
  return fetchApi<PartnerUserRecord>({
    pathname: `/v1/partners/me/users/${userId}`,
    method: "PATCH",
    accessToken,
    body: input,
  });
}

export async function deactivatePartnerUser(
  accessToken: string,
  userId: string,
) {
  return fetchApi<PartnerUserRecord>({
    pathname: `/v1/partners/me/users/${userId}/deactivate`,
    method: "POST",
    accessToken,
  });
}

export async function fetchPartnerSecuritySettings(accessToken: string) {
  return fetchApi<PartnerSecuritySettingsRecord>({
    pathname: "/v1/partners/me/security-settings",
    accessToken,
  });
}

export async function updatePartnerSecuritySettings(
  accessToken: string,
  input: {
    sessionIdleTimeoutMinutes?: number;
    enforceMfa?: boolean;
    ipAllowlist?: string[];
    credentialRotationDays?: number;
  },
) {
  return fetchApi<PartnerSecuritySettingsRecord>({
    pathname: "/v1/partners/me/security-settings",
    method: "PATCH",
    accessToken,
    body: input,
  });
}

export async function fetchProductionApprovalRequests(accessToken: string) {
  return fetchApi<PartnerProductionApprovalRequestRecord[]>({
    pathname: "/v1/partners/me/production-approval-requests",
    accessToken,
  });
}

export async function requestProductionApproval(
  accessToken: string,
  input: {
    requestNote?: string;
    assetNetworkIds?: string[];
  },
) {
  return fetchApi<PartnerProductionApprovalRequestRecord>({
    pathname: "/v1/partners/me/production-approval-requests",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function cancelProductionApprovalRequest(
  accessToken: string,
  requestId: string,
) {
  return fetchApi<PartnerProductionApprovalRequestRecord>({
    pathname: `/v1/partners/me/production-approval-requests/${requestId}/cancel`,
    method: "POST",
    accessToken,
  });
}

export async function resolveRecipient(
  accessToken: string,
  input: {
    recipientIdentifier: string;
    chain: string;
    asset: string;
  },
) {
  return fetchApi<ResolveResponseRecord>({
    pathname: "/v1/resolution/by-recipient",
    method: "POST",
    accessToken,
    body: input,
    extraHeaders: {
      "idempotency-key": createRequestIdempotencyKey("by-recipient", input),
    },
  });
}

export async function confirmRecipientByAddress(
  accessToken: string,
  input: {
    platform?: string;
    address: string;
    chain: string;
    asset: string;
  },
) {
  return fetchApi<ConfirmRecipientResponseRecord>({
    pathname: "/v1/resolution/by-address",
    method: "POST",
    accessToken,
    body: input,
    extraHeaders: {
      "idempotency-key": createRequestIdempotencyKey("by-address", input),
    },
  });
}

export async function verifyDestination(
  accessToken: string,
  input: {
    recipientIdentifier: string;
    address: string;
    chain: string;
    asset: string;
  },
) {
  return fetchApi<VerifyResponseRecord>({
    pathname: "/v1/resolution/verify-transfer",
    method: "POST",
    accessToken,
    body: input,
    extraHeaders: {
      "idempotency-key": createRequestIdempotencyKey("verify-transfer", input),
    },
  });
}

export async function batchVerifyDestinations(
  accessToken: string,
  input: {
    inputFormat: ResolutionBatchInputFormat;
    lookupMode?: ResolutionBatchLookupMode;
    chain: string;
    asset: string;
    stopOnFirstHighRisk?: boolean;
    requireExactAttestedMatch?: boolean;
    rows: Array<{
      clientReference?: string;
      lookupMode?: ResolutionBatchRowLookupMode;
      platform?: string;
      recipientIdentifier?: string;
      address: string;
    }>;
  },
) {
  return fetchApi<BatchVerifyRecord>({
    pathname: "/v1/resolution/batch",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function fetchResolutionLogs(
  accessToken: string,
  params?: {
    queryType?: QueryType;
    outcome?: ResolutionOutcome;
    riskLevel?: RiskLevel;
    platform?: string;
    chain?: string;
    asset?: string;
    recipientIdentifier?: string;
    limit?: number;
  },
) {
  return fetchApi<ResolutionLogRecord[]>({
    pathname: "/v1/resolution/logs",
    accessToken,
    params: {
      limit: params?.limit ?? defaultListLimit,
      queryType: params?.queryType,
      outcome: params?.outcome,
      riskLevel: params?.riskLevel,
      platform: params?.platform,
      chain: params?.chain,
      asset: params?.asset,
      recipientIdentifier: params?.recipientIdentifier,
    },
  });
}

export async function fetchResolutionLog(
  accessToken: string,
  requestId: string,
) {
  return fetchApi<ResolutionLogDetailRecord>({
    pathname: `/v1/resolution/logs/${requestId}`,
    accessToken,
  });
}

export async function fetchRecipients(
  accessToken: string,
  params?: {
    search?: string;
    status?: RecipientStatus;
    limit?: number;
  },
) {
  return fetchApi<RecipientRecord[]>({
    pathname: "/v1/recipients",
    accessToken,
    params: {
      search: params?.search,
      status: params?.status,
      limit: params?.limit ?? defaultListLimit,
    },
  });
}

export async function fetchRecipient(accessToken: string, recipientId: string) {
  return fetchApi<RecipientRecord>({
    pathname: `/v1/recipients/${recipientId}`,
    accessToken,
  });
}

export async function createRecipient(
  accessToken: string,
  input: {
    externalRecipientId: string;
    displayName?: string;
    primaryIdentifier: string;
    identifierKind?: IdentifierKind;
    visibility?: IdentifierVisibility;
  },
) {
  return fetchApi<RecipientRecord>({
    pathname: "/v1/recipients",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function updateRecipient(
  accessToken: string,
  recipientId: string,
  input: {
    displayName?: string;
  },
) {
  return fetchApi<RecipientRecord>({
    pathname: `/v1/recipients/${recipientId}`,
    method: "PATCH",
    accessToken,
    body: input,
  });
}

export async function disableRecipient(accessToken: string, recipientId: string) {
  return fetchApi<RecipientRecord>({
    pathname: `/v1/recipients/${recipientId}/disable`,
    method: "POST",
    accessToken,
  });
}

export async function fetchDestinations(
  accessToken: string,
  params?: {
    recipientId?: string;
    chain?: string;
    asset?: string;
    status?: DestinationStatus;
    limit?: number;
  },
) {
  return fetchApi<DestinationRecord[]>({
    pathname: "/v1/destinations",
    accessToken,
    params: {
      recipientId: params?.recipientId,
      chain: params?.chain,
      asset: params?.asset,
      status: params?.status,
      limit: params?.limit ?? 50,
    },
  });
}

export async function fetchDestination(
  accessToken: string,
  destinationId: string,
) {
  return fetchApi<DestinationRecord>({
    pathname: `/v1/destinations/${destinationId}`,
    accessToken,
  });
}

export async function createDestination(
  accessToken: string,
  input: {
    recipientId: string;
    chain: string;
    asset: string;
    address: string;
    memoValue?: string;
    isDefault?: boolean;
    effectiveFrom?: string;
    expiresAt?: string;
  },
) {
  return fetchApi<DestinationRecord>({
    pathname: "/v1/destinations",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function revokeDestination(
  accessToken: string,
  destinationId: string,
) {
  return fetchApi<DestinationRecord>({
    pathname: `/v1/destinations/${destinationId}/revoke`,
    method: "POST",
    accessToken,
  });
}

export async function replaceDestination(
  accessToken: string,
  destinationId: string,
  input: {
    chain?: string;
    asset?: string;
    address: string;
    memoValue?: string;
    isDefault?: boolean;
    effectiveFrom?: string;
    expiresAt?: string;
  },
) {
  return fetchApi<DestinationRecord>({
    pathname: `/v1/destinations/${destinationId}/replace`,
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function fetchAttestations(
  accessToken: string,
  params?: {
    recipientId?: string;
    recipientIdentifier?: string;
    chain?: string;
    asset?: string;
    attestationType?: AttestationType;
    verificationStatus?: VerificationStatus;
    limit?: number;
  },
) {
  return fetchApi<AttestationRecord[]>({
    pathname: "/v1/attestations",
    accessToken,
    params: {
      recipientId: params?.recipientId,
      recipientIdentifier: params?.recipientIdentifier,
      chain: params?.chain,
      asset: params?.asset,
      attestationType: params?.attestationType,
      verificationStatus: params?.verificationStatus,
      limit: params?.limit ?? defaultListLimit,
    },
  });
}

export async function fetchAttestation(
  accessToken: string,
  attestationId: string,
) {
  return fetchApi<AttestationDetailRecord>({
    pathname: `/v1/attestations/${attestationId}`,
    accessToken,
  });
}

export async function fetchWebhookEndpoints(accessToken: string) {
  return fetchApi<WebhookEndpointRecord[]>({
    pathname: "/v1/webhooks",
    accessToken,
  });
}

export async function fetchWebhookEndpoint(
  accessToken: string,
  endpointId: string,
) {
  return fetchApi<WebhookEndpointRecord>({
    pathname: `/v1/webhooks/${endpointId}`,
    accessToken,
  });
}

export async function createWebhookEndpoint(
  accessToken: string,
  input: {
    label: string;
    url: string;
    eventTypes: WebhookEventType[];
  },
) {
  return fetchApi<WebhookEndpointRecord>({
    pathname: "/v1/webhooks",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function updateWebhookEndpoint(
  accessToken: string,
  endpointId: string,
  input: {
    label?: string;
    url?: string;
    eventTypes?: WebhookEventType[];
    status?: WebhookStatus;
  },
) {
  return fetchApi<WebhookEndpointRecord>({
    pathname: `/v1/webhooks/${endpointId}`,
    method: "PATCH",
    accessToken,
    body: input,
  });
}

export async function rotateWebhookSigningSecret(
  accessToken: string,
  endpointId: string,
) {
  return fetchApi<WebhookEndpointRecord>({
    pathname: `/v1/webhooks/${endpointId}/rotate-secret`,
    method: "POST",
    accessToken,
  });
}

export async function disableWebhookEndpoint(
  accessToken: string,
  endpointId: string,
) {
  return fetchApi<WebhookEndpointRecord>({
    pathname: `/v1/webhooks/${endpointId}`,
    method: "DELETE",
    accessToken,
  });
}

export async function testWebhookEndpoint(
  accessToken: string,
  endpointId: string,
) {
  return fetchApi<{
    endpointId: string;
    ok: boolean;
    responseCode: number | null;
    responseBody: string;
    testedAt: string;
  }>({
    pathname: `/v1/webhooks/${endpointId}/test`,
    method: "POST",
    accessToken,
  });
}

export async function fetchWebhookDeliveries(
  accessToken: string,
  params?: {
    endpointId?: string;
    eventType?: WebhookEventType;
    status?: DeliveryStatus;
    limit?: number;
  },
) {
  return fetchApi<WebhookDeliveryRecord[]>({
    pathname: "/v1/webhooks/deliveries",
    accessToken,
    params: {
      endpointId: params?.endpointId,
      eventType: params?.eventType,
      status: params?.status,
      limit: params?.limit ?? 50,
    },
  });
}

export async function fetchWebhookDelivery(
  accessToken: string,
  deliveryId: string,
) {
  return fetchApi<WebhookDeliveryRecord>({
    pathname: `/v1/webhooks/deliveries/${deliveryId}`,
    accessToken,
  });
}

export async function replayWebhookDelivery(
  accessToken: string,
  deliveryId: string,
) {
  return fetchApi<WebhookDeliveryRecord | null>({
    pathname: `/v1/webhooks/deliveries/${deliveryId}/replay`,
    method: "POST",
    accessToken,
  });
}

export async function fetchAuditLogs(
  accessToken: string,
  params?: {
    actorType?: AuditActorType;
    action?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
  },
) {
  return fetchApi<AuditLogRecord[]>({
    pathname: "/v1/audit-logs",
    accessToken,
    params: {
      actorType: params?.actorType,
      action: params?.action,
      entityType: params?.entityType,
      entityId: params?.entityId,
      limit: params?.limit ?? 50,
    },
  });
}

export async function fetchAuditLog(accessToken: string, eventId: string) {
  return fetchApi<AuditLogRecord>({
    pathname: `/v1/audit-logs/${eventId}`,
    accessToken,
  });
}

export async function fetchAuditExports(accessToken: string) {
  return fetchApi<AuditExportRecord[]>({
    pathname: "/v1/audit-exports",
    accessToken,
  });
}

export async function createAuditExport(
  accessToken: string,
  input: {
    format: AuditExportFormat;
    actorType?: AuditActorType;
    action?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
  },
) {
  return fetchApi<AuditExportRecord>({
    pathname: "/v1/audit-exports",
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function fetchAuditExport(
  accessToken: string,
  exportId: string,
) {
  return fetchApi<AuditExportRecord>({
    pathname: `/v1/audit-exports/${exportId}`,
    accessToken,
  });
}

function createRequestIdempotencyKey(
  prefix: string,
  value: Record<string, unknown>,
): string {
  return `${prefix}_${createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 24)}`;
}
