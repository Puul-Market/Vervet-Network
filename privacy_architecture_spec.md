# Vervet Privacy Architecture Spec

## Goal

Upgrade Vervet from a trust-focused network to a privacy-minimized trust network.

The target is not a literal "nothing stored" architecture. Vervet is a persistent
attestation and resolution network, so it must retain some durable state for:

- destination resolution
- reverse lookup
- attestation lineage
- auditability
- billing and entitlement enforcement
- abuse controls

The target state is:

- optional encrypted submission for sensitive inbound fields
- ciphertext at rest for high-sensitivity values
- blind indexes for exact-match search
- configurable raw-data retention for verification traffic
- more `VERIFICATION_ONLY` and `MASKED_LABEL` disclosure defaults
- enterprise BYOK for stored ciphertext and export artifacts

## Non-Goals

- no blanket "zero knowledge" claim
- no attempt to make all Vervet queries work without any service-managed index
- no full cryptographic redesign of attestation signing or webhook signing
- no near-term support for fuzzy or prefix search over encrypted user data

## Current State

Today Vervet persists plaintext or near-plaintext user-sensitive fields in core
domain tables:

- `Recipient.displayName`
- `RecipientIdentifier.rawValue`
- `RecipientIdentifier.normalizedValue`
- `RecipientDestination.addressRaw`
- `RecipientDestination.addressNormalized`
- `Attestation.displayNameSnapshot`
- `Attestation.addressRaw`
- `Attestation.addressNormalized`
- `ResolutionRequest.recipientIdentifierInput`
- `ResolutionRequest.recipientIdentifierNormalized`
- `ResolutionRequest.providedAddressRaw`
- `ResolutionRequest.providedAddressNormalized`
- `ResolutionRequest.responseData`
- `AuditLog.metadata`
- `AuditExportJob.downloadContent`

The current disclosure model already exists in code:

- `FULL_LABEL`
- `MASKED_LABEL`
- `VERIFICATION_ONLY`

However, current lookup behavior still commonly returns `FULL_LABEL` when a
display name is present.

## Privacy Principles

1. Store the minimum plaintext needed for network function.
2. Separate queryability from readability.
3. Prefer equality search through blind indexes over plaintext indexes.
4. Make raw request retention configurable by workflow and partner.
5. Default to least disclosure unless a partner explicitly needs more.
6. Treat audit exports and operational logs as sensitive artifacts.
7. Support enterprise key separation without breaking core network matching.

## Data Classification

### Class A: Always queryable, low sensitivity

- partner slug
- chain slug
- asset symbol
- enums and statuses
- timestamps
- capability flags
- plan and entitlement state
- sequence numbers
- non-user-facing IDs

Storage:

- plaintext

### Class B: Sensitive and exactly searchable

- recipient identifiers
- wallet addresses
- contract addresses where customer-provided

Storage:

- ciphertext for readability
- blind index for exact match

### Class C: Sensitive and readable only when authorized

- display names
- attestation snapshots
- raw verification payloads
- audit metadata containing partner or user inputs
- export files

Storage:

- ciphertext only
- optional blind index only when exact search is needed

### Class D: Short-lived operational inputs

- raw resolution requests
- verify-transfer submitted addresses
- batch verification row payloads

Storage:

- encrypted for short retention
- or not retained at all when partner policy allows

## Proposed Cryptography Model

### Encryption at Rest

Use envelope encryption:

- Data Encryption Key (DEK) per record or per batch object
- DEK wrapped by a Key Encryption Key (KEK)
- KEK backed by a service-managed KMS in the default mode
- optional customer-managed KEK for enterprise BYOK

Each encrypted record stores:

- `ciphertext`
- `keyVersion`
- `encryptionMode`
- `aadContext`

Recommended AAD:

- record ID
- partner ID
- field name
- model name

### Blind Indexes

Use deterministic keyed HMAC indexes over normalized values:

- `blindIndex = HMAC-SHA256(index_key, normalized_value)`

Rules:

- normalize first, then HMAC
- use different keys per logical field family
- never expose blind indexes through partner-facing APIs
- do not reuse encryption keys as blind-index keys

Recommended index families:

- `recipient_identifier_index_key`
- `wallet_address_index_key`
- `contract_address_index_key`

## Core Tradeoff: Blind Indexes vs BYOK

Vervet is a network, not a single-tenant vault.

Cross-partner exact matching requires a stable equality primitive. That means:

- ciphertext can be tenant-keyed for readability
- but equality matching across the network still needs a service-recognizable
  blind index or a network-level deterministic search primitive

Therefore:

- BYOK should protect stored ciphertext and export artifacts
- blind indexes for network-wide resolution should remain service-managed
- per-tenant BYOK must not be allowed to break network-wide exact matching

## Proposed Schema Changes

### New Supporting Enum

```prisma
enum EncryptionMode {
  PLATFORM_MANAGED
  CUSTOMER_MANAGED
}
```

### `PartnerSecuritySettings`

Extend the current security settings model instead of adding a separate privacy
settings concept.

Add fields:

```prisma
model PartnerSecuritySettings {
  id                              String   @id @default(cuid())
  partnerId                       String   @unique
  sessionIdleTimeoutMinutes       Int      @default(720)
  enforceMfa                      Boolean  @default(false)
  ipAllowlist                     String[]
  credentialRotationDays          Int      @default(90)

  defaultDisclosureMode           String   @default("VERIFICATION_ONLY")
  allowFullLabelDisclosure        Boolean  @default(false)
  enableEncryptedSubmission       Boolean  @default(false)
  rawVerificationRetentionMode    String   @default("SHORT_RETENTION")
  rawVerificationRetentionHours   Int      @default(24)
  encryptAuditMetadata            Boolean  @default(true)
  encryptAuditExports             Boolean  @default(true)
  enterpriseByokEnabled           Boolean  @default(false)
  customerKeyArn                  String?
  customerKeyStatus               String?

  createdAt                       DateTime @default(now())
  updatedAt                       DateTime @updatedAt
}
```

Notes:

- `defaultDisclosureMode` must only allow `MASKED_LABEL` or `VERIFICATION_ONLY`
  for self-service partners at first
- `allowFullLabelDisclosure` should be gated by review, consent, or plan
- `rawVerificationRetentionMode` should support:
  - `NO_RETAIN`
  - `SHORT_RETENTION`
  - `STANDARD_RETENTION`

### `Recipient`

Replace readable display names with ciphertext plus optional preview material.

```prisma
model Recipient {
  displayName                String?
  displayNameCiphertext      String?   @db.Text
  displayNameKeyVersion      Int?
  displayNameEncryptionMode  EncryptionMode?
}
```

Migration target:

- deprecate `displayName`

### `RecipientIdentifier`

```prisma
model RecipientIdentifier {
  rawValue                   String
  normalizedValue            String

  rawValueCiphertext         String?   @db.Text
  normalizedValueCiphertext  String?   @db.Text
  blindIndex                 String?
  keyVersion                 Int?
  encryptionMode             EncryptionMode?
}
```

Migration target:

- deprecate direct reads of `rawValue`
- replace search on `normalizedValue` with `blindIndex`

### `RecipientDestination`

```prisma
model RecipientDestination {
  addressRaw                 String
  addressNormalized          String

  addressCiphertext          String?   @db.Text
  addressBlindIndex          String?
  addressKeyVersion          Int?
  addressEncryptionMode      EncryptionMode?
}
```

Migration target:

- replace `@@index([addressNormalized])` with `@@index([addressBlindIndex])`

### `Attestation`

```prisma
model Attestation {
  recipientIdentifierSnapshot        String
  displayNameSnapshot                String?
  addressRaw                         String?
  addressNormalized                  String?
  canonicalPayload                   String
  payload                            Json

  recipientIdentifierSnapshotCiphertext String? @db.Text
  displayNameSnapshotCiphertext         String? @db.Text
  addressCiphertext                     String? @db.Text
  addressBlindIndex                     String?
  payloadCiphertext                     String? @db.Text
  payloadKeyVersion                     Int?
  payloadEncryptionMode                 EncryptionMode?
}
```

Rules:

- keep `payloadHash`, `signature`, `sequenceNumber`, `verificationStatus`,
  `issuedAt`, `effectiveFrom`, and `expiresAt` plaintext
- signature verification runs before encrypted persistence is finalized

### `ResolutionRequest`

```prisma
model ResolutionRequest {
  recipientIdentifierInput        String
  recipientIdentifierNormalized   String
  providedAddressRaw              String?
  providedAddressNormalized       String?
  responseData                    Json?
  metadata                        Json?

  recipientIdentifierCiphertext   String? @db.Text
  recipientIdentifierBlindIndex   String?
  providedAddressCiphertext       String? @db.Text
  providedAddressBlindIndex       String?
  responseDataCiphertext          String? @db.Text
  metadataCiphertext              String? @db.Text
  retentionExpiresAt              DateTime?
  keyVersion                      Int?
  encryptionMode                  EncryptionMode?
}
```

Migration target:

- long-term deprecate plaintext request input columns
- preserve `requestFingerprint`, `idempotencyKey`, `outcome`, `riskLevel`,
  `recommendation`, `flags`, and foreign keys in plaintext

### `ResolutionBatchRow`

```prisma
model ResolutionBatchRow {
  recipientIdentifierInput        String
  submittedAddressRaw             String
  responseData                    Json?

  recipientIdentifierCiphertext   String? @db.Text
  recipientIdentifierBlindIndex   String?
  submittedAddressCiphertext      String? @db.Text
  submittedAddressBlindIndex      String?
  responseDataCiphertext          String? @db.Text
  retentionExpiresAt              DateTime?
  keyVersion                      Int?
  encryptionMode                  EncryptionMode?
}
```

### `AuditLog`

```prisma
model AuditLog {
  metadata                 Json?
  metadataCiphertext       String? @db.Text
  keyVersion               Int?
  encryptionMode           EncryptionMode?
}
```

Rule:

- keep summary readable only when it contains no sensitive user value
- otherwise move sensitive detail into encrypted metadata

### `AuditExportJob`

```prisma
model AuditExportJob {
  downloadContent          String? @db.Text
  downloadContentCiphertext String? @db.Text
  keyVersion               Int?
  encryptionMode           EncryptionMode?
}
```

Rule:

- plaintext `downloadContent` should be transitional only

## API Contract Changes

### Shared Encrypted Input Envelope

Add optional encrypted forms for sensitive request fields.

```json
{
  "ciphertext": "base64...",
  "alg": "AES-256-GCM",
  "keyId": "vervet-kms-v1",
  "iv": "base64...",
  "blindIndex": "hex..."
}
```

### Resolution APIs

Current plaintext mode remains supported for backward compatibility.

Add optional encrypted request variants:

- `recipientIdentifierEncrypted`
- `addressEncrypted`

Example:

```json
{
  "recipientIdentifierEncrypted": {
    "ciphertext": "base64...",
    "alg": "AES-256-GCM",
    "keyId": "vervet-kms-v1",
    "iv": "base64...",
    "blindIndex": "hex..."
  },
  "chain": "base",
  "asset": "USDC"
}
```

Rules:

- if encrypted value is present, plaintext counterpart must be absent
- blind index is required when exact-match lookup is needed
- request logs obey partner retention mode

### Attestation Ingestion

Add optional encrypted inbound fields:

- `recipientIdentifierEncrypted`
- `addressEncrypted`
- optional `displayNameEncrypted`

Service behavior:

- decrypt in memory
- normalize
- validate signature
- persist ciphertext plus derived blind indexes

### Batch Verify

Support:

- plaintext rows for backward compatibility
- encrypted rows for enterprise mode
- file-level retention mode inherited from partner settings

### Audit Export Download

No change to response shape for the initial rollout.

Backend changes:

- store encrypted export content
- decrypt only on authorized download path
- enforce expiry strictly

## Disclosure Model Changes

### Default Policy

New default:

- consumer flows: `VERIFICATION_ONLY`
- reverse lookup: `VERIFICATION_ONLY`
- verified-recipient resolution: `MASKED_LABEL` when partner policy allows
- `FULL_LABEL` only when partner is explicitly approved for full disclosure

### Required Backend Changes

- stop defaulting to `FULL_LABEL` when a display name exists
- implement real masking behavior
- include disclosure policy in partner security settings and metadata

### Suggested Masking Rules

- person names: `A*** T.`
- business names: `Ac*** Pay`
- email-like identifiers: `a***@example.com`

## Retention Policy

### Modes

`NO_RETAIN`

- do not persist raw request inputs
- persist blind indexes, request fingerprint, outcome, risk, and timestamps only

`SHORT_RETENTION`

- encrypt raw request inputs and response payloads
- purge after 24 hours by default

`STANDARD_RETENTION`

- encrypt raw request inputs and response payloads
- purge after 30 days by default

### Applies To

- `ResolutionRequest`
- `ResolutionBatchRow`
- any audit metadata that embeds raw request values

### Worker Changes

Add a scheduled cleanup job to:

- purge expired encrypted request payloads
- purge expired batch row payloads
- purge expired export artifacts

## Partner Settings API Changes

Extend `GET /v1/partners/me/security-settings` and
`PATCH /v1/partners/me/security-settings`.

New response fields:

```json
{
  "defaultDisclosureMode": "VERIFICATION_ONLY",
  "allowFullLabelDisclosure": false,
  "enableEncryptedSubmission": false,
  "rawVerificationRetentionMode": "SHORT_RETENTION",
  "rawVerificationRetentionHours": 24,
  "encryptAuditMetadata": true,
  "encryptAuditExports": true,
  "enterpriseByokEnabled": false,
  "customerKeyArn": null,
  "customerKeyStatus": null
}
```

New patch fields:

- `defaultDisclosureMode`
- `enableEncryptedSubmission`
- `rawVerificationRetentionMode`
- `rawVerificationRetentionHours`
- `encryptAuditMetadata`
- `encryptAuditExports`

Admin-only or reviewed fields:

- `allowFullLabelDisclosure`
- `enterpriseByokEnabled`
- `customerKeyArn`

## Dashboard Changes

### Access / Security

Extend the existing security page with:

- disclosure policy
- raw verification retention policy
- encrypted submission toggle
- audit export encryption status
- enterprise key status

### Resolution UI

- show effective disclosure policy in docs and sandbox examples
- prefer masked or verification-only examples
- add encrypted submission examples for approved partners

### Docs and Metadata

Dashboard metadata should expose:

- supported disclosure modes by partner
- encrypted submission capability
- retention policy options
- BYOK status

## Website Positioning

Recommended language:

- "Selective disclosure by default"
- "Encrypted submission for sensitive verification flows"
- "Data minimization with configurable retention"
- "Enterprise key control for stored artifacts"

Avoid:

- "Nothing stored"
- "Zero knowledge architecture"

## Rollout Plan

### Phase 1

- implement real `MASKED_LABEL`
- change default disclosure policy toward `VERIFICATION_ONLY`
- encrypt audit exports
- add retention modes and cleanup worker

### Phase 2

- add encrypted submission envelopes for resolution and verification APIs
- add blind indexes for identifiers and addresses
- dual-write plaintext and encrypted columns

### Phase 3

- migrate reads to blind indexes and ciphertext
- encrypt attestation snapshots and request logs
- reduce plaintext column usage to transitional fallback only

### Phase 4

- add enterprise BYOK
- encrypt export artifacts and high-sensitivity metadata under customer keys
- expose partner-facing key health and rotation status

### Phase 5

- remove deprecated plaintext columns
- tighten copy and docs to match the implemented privacy posture

## Verification Plan

- schema migration tests for dual-write and read fallback
- exact-match lookup parity tests for blind indexes
- resolution idempotency tests under encrypted submission
- retention cleanup tests
- audit export decrypt/download tests
- disclosure-mode behavior tests for full, masked, and verification-only paths
- enterprise BYOK failure-mode tests for disabled or unreachable keys

## Open Questions

1. Should network-wide blind indexes be global or partner-scoped plus translated?
2. Which partners are allowed to receive `FULL_LABEL`, and under what consent or
   contractual terms?
3. Do compliance requirements require some request logs to remain readable by
   operators, or is decrypt-on-demand sufficient?
4. Should batch verification support `NO_RETAIN`, or is encrypted short retention
   required for supportability and billing disputes?
5. Which KMS provider is the default target for enterprise BYOK?

## Recommendation

Start with the highest-value and lowest-risk slice:

- make disclosure stricter
- shorten or eliminate raw verification retention
- encrypt exports and sensitive audit metadata
- introduce blind indexes before full BYOK

That sequence materially improves privacy without breaking the current network
behavior or overcommitting the product to a misleading "zero knowledge" claim.
