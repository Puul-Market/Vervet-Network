-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('EXCHANGE', 'WALLET', 'PAYMENT_PROCESSOR', 'MERCHANT', 'FINTECH', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SigningKeyAlgorithm" AS ENUM ('ED25519', 'ES256K', 'RSA_PSS_SHA256');

-- CreateEnum
CREATE TYPE "SigningKeyStatus" AS ENUM ('ACTIVE', 'ROTATING', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IdentifierKind" AS ENUM ('PARTNER_HANDLE', 'PARTNER_UID', 'EMAIL_HASH', 'PHONE_HASH', 'BUSINESS_ID', 'PAYMENT_HANDLE');

-- CreateEnum
CREATE TYPE "IdentifierStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "IdentifierVisibility" AS ENUM ('PRIVATE', 'SEARCHABLE', 'RESOLVABLE');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChainFamily" AS ENUM ('EVM', 'TRON', 'SOLANA', 'OTHER');

-- CreateEnum
CREATE TYPE "TokenStandard" AS ENUM ('NATIVE', 'ERC20', 'TRC20', 'SPL', 'OTHER');

-- CreateEnum
CREATE TYPE "MemoPolicy" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- CreateEnum
CREATE TYPE "AttestationType" AS ENUM ('DESTINATION_ASSIGNMENT', 'DESTINATION_ROTATION', 'DESTINATION_REVOCATION', 'IDENTIFIER_BINDING');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DestinationStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QueryType" AS ENUM ('RESOLVE', 'VERIFY_ADDRESS');

-- CreateEnum
CREATE TYPE "ResolutionOutcome" AS ENUM ('RESOLVED', 'NO_MATCH', 'MISMATCH', 'AMBIGUOUS', 'UNVERIFIED', 'BLOCKED', 'ERROR');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskSignalKind" AS ENUM ('ADDRESS_NOT_ATTESTED', 'ADDRESS_MISMATCH', 'NEW_DESTINATION', 'RECENT_ROTATION', 'IDENTIFIER_MISMATCH', 'ADDRESS_LOOKALIKE', 'EXPIRED_ATTESTATION', 'KEY_REVOKED', 'ENUMERATION_SUSPECTED', 'MULTIPLE_ACTIVE_DESTINATIONS', 'UNSUPPORTED_ASSET_NETWORK');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('DESTINATION_UPDATED', 'DESTINATION_REVOKED', 'SIGNING_KEY_ROTATED', 'RECIPIENT_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('SYSTEM', 'PARTNER', 'USER');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "partnerType" "PartnerType" NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "countryCode" CHAR(2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerApiCredential" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSigningKey" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "algorithm" "SigningKeyAlgorithm" NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "SigningKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "rotatesAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "externalRecipientId" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "RecipientStatus" NOT NULL DEFAULT 'ACTIVE',
    "profile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipientIdentifier" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" "IdentifierKind" NOT NULL,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "status" "IdentifierStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "IdentifierVisibility" NOT NULL DEFAULT 'RESOLVABLE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipientIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chain" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "family" "ChainFamily" NOT NULL,
    "caip2" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetNetwork" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "standard" "TokenStandard" NOT NULL,
    "contractAddressRaw" TEXT,
    "contractAddressNormalized" TEXT NOT NULL DEFAULT '',
    "decimals" INTEGER,
    "memoPolicy" "MemoPolicy" NOT NULL DEFAULT 'NONE',
    "memoLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipientDestination" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "addressRaw" TEXT NOT NULL,
    "addressNormalized" TEXT NOT NULL,
    "memoValue" TEXT NOT NULL DEFAULT '',
    "status" "DestinationStatus" NOT NULL DEFAULT 'PENDING',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "lastAttestedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipientDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "signingKeyId" TEXT NOT NULL,
    "attestationType" "AttestationType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "identifierId" TEXT,
    "assetNetworkId" TEXT,
    "destinationId" TEXT,
    "recipientIdentifierSnapshot" TEXT NOT NULL,
    "displayNameSnapshot" TEXT,
    "addressRaw" TEXT,
    "addressNormalized" TEXT,
    "memoValue" TEXT NOT NULL DEFAULT '',
    "canonicalPayload" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "sequenceNumber" BIGINT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "supersedesAttestationId" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionRequest" (
    "id" TEXT NOT NULL,
    "queryType" "QueryType" NOT NULL,
    "requesterPartnerId" TEXT,
    "recipientIdentifierInput" TEXT NOT NULL,
    "recipientIdentifierNormalized" TEXT NOT NULL,
    "chainInput" TEXT NOT NULL,
    "assetInput" TEXT NOT NULL,
    "providedAddressRaw" TEXT,
    "providedAddressNormalized" TEXT,
    "resolvedRecipientId" TEXT,
    "resolvedIdentifierId" TEXT,
    "resolvedDestinationId" TEXT,
    "resolvedAttestationId" TEXT,
    "outcome" "ResolutionOutcome" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "recommendation" TEXT,
    "flags" TEXT[],
    "clientReference" TEXT,
    "idempotencyKey" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ResolutionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSignal" (
    "id" TEXT NOT NULL,
    "resolutionRequestId" TEXT NOT NULL,
    "kind" "RiskSignalKind" NOT NULL,
    "severity" "RiskLevel" NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "signingSecretHash" TEXT NOT NULL,
    "eventTypes" "WebhookEventType"[],
    "status" "WebhookStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastDeliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventType" "WebhookEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "responseCode" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorPartnerId" TEXT,
    "actorIdentifier" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApiCredential_keyPrefix_key" ON "PartnerApiCredential"("keyPrefix");

-- CreateIndex
CREATE INDEX "PartnerApiCredential_partnerId_status_idx" ON "PartnerApiCredential"("partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSigningKey_fingerprint_key" ON "PartnerSigningKey"("fingerprint");

-- CreateIndex
CREATE INDEX "PartnerSigningKey_partnerId_status_idx" ON "PartnerSigningKey"("partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSigningKey_partnerId_keyId_key" ON "PartnerSigningKey"("partnerId", "keyId");

-- CreateIndex
CREATE INDEX "Recipient_partnerId_status_idx" ON "Recipient"("partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_partnerId_externalRecipientId_key" ON "Recipient"("partnerId", "externalRecipientId");

-- CreateIndex
CREATE INDEX "RecipientIdentifier_recipientId_status_idx" ON "RecipientIdentifier"("recipientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecipientIdentifier_partnerId_kind_normalizedValue_key" ON "RecipientIdentifier"("partnerId", "kind", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "Chain_slug_key" ON "Chain"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Chain_caip2_key" ON "Chain"("caip2");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE INDEX "Asset_symbol_idx" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "AssetNetwork_chainId_isActive_idx" ON "AssetNetwork"("chainId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AssetNetwork_assetId_chainId_contractAddressNormalized_key" ON "AssetNetwork"("assetId", "chainId", "contractAddressNormalized");

-- CreateIndex
CREATE INDEX "RecipientDestination_recipientId_assetNetworkId_status_idx" ON "RecipientDestination"("recipientId", "assetNetworkId", "status");

-- CreateIndex
CREATE INDEX "RecipientDestination_addressNormalized_idx" ON "RecipientDestination"("addressNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "RecipientDestination_recipientId_assetNetworkId_addressNorm_key" ON "RecipientDestination"("recipientId", "assetNetworkId", "addressNormalized", "memoValue");

-- CreateIndex
CREATE INDEX "Attestation_recipientId_verificationStatus_idx" ON "Attestation"("recipientId", "verificationStatus");

-- CreateIndex
CREATE INDEX "Attestation_partnerId_attestationType_issuedAt_idx" ON "Attestation"("partnerId", "attestationType", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_partnerId_sequenceNumber_key" ON "Attestation"("partnerId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_partnerId_payloadHash_key" ON "Attestation"("partnerId", "payloadHash");

-- CreateIndex
CREATE INDEX "ResolutionRequest_recipientIdentifierNormalized_requestedAt_idx" ON "ResolutionRequest"("recipientIdentifierNormalized", "requestedAt");

-- CreateIndex
CREATE INDEX "ResolutionRequest_outcome_riskLevel_requestedAt_idx" ON "ResolutionRequest"("outcome", "riskLevel", "requestedAt");

-- CreateIndex
CREATE INDEX "RiskSignal_resolutionRequestId_kind_idx" ON "RiskSignal"("resolutionRequestId", "kind");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_partnerId_status_idx" ON "WebhookEndpoint"("partnerId", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_status_nextAttemptAt_idx" ON "WebhookDelivery"("endpointId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorPartnerId_createdAt_idx" ON "AuditLog"("actorPartnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PartnerApiCredential" ADD CONSTRAINT "PartnerApiCredential_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSigningKey" ADD CONSTRAINT "PartnerSigningKey_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientIdentifier" ADD CONSTRAINT "RecipientIdentifier_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientIdentifier" ADD CONSTRAINT "RecipientIdentifier_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetNetwork" ADD CONSTRAINT "AssetNetwork_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetNetwork" ADD CONSTRAINT "AssetNetwork_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientDestination" ADD CONSTRAINT "RecipientDestination_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientDestination" ADD CONSTRAINT "RecipientDestination_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_signingKeyId_fkey" FOREIGN KEY ("signingKeyId") REFERENCES "PartnerSigningKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_identifierId_fkey" FOREIGN KEY ("identifierId") REFERENCES "RecipientIdentifier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "RecipientDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_supersedesAttestationId_fkey" FOREIGN KEY ("supersedesAttestationId") REFERENCES "Attestation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRequest" ADD CONSTRAINT "ResolutionRequest_requesterPartnerId_fkey" FOREIGN KEY ("requesterPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRequest" ADD CONSTRAINT "ResolutionRequest_resolvedRecipientId_fkey" FOREIGN KEY ("resolvedRecipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRequest" ADD CONSTRAINT "ResolutionRequest_resolvedIdentifierId_fkey" FOREIGN KEY ("resolvedIdentifierId") REFERENCES "RecipientIdentifier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRequest" ADD CONSTRAINT "ResolutionRequest_resolvedDestinationId_fkey" FOREIGN KEY ("resolvedDestinationId") REFERENCES "RecipientDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRequest" ADD CONSTRAINT "ResolutionRequest_resolvedAttestationId_fkey" FOREIGN KEY ("resolvedAttestationId") REFERENCES "Attestation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_resolutionRequestId_fkey" FOREIGN KEY ("resolutionRequestId") REFERENCES "ResolutionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorPartnerId_fkey" FOREIGN KEY ("actorPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
