ALTER TABLE "ResolutionRequest"
ADD COLUMN "requestFingerprint" TEXT,
ADD COLUMN "responseData" JSONB;

CREATE INDEX "ResolutionRequest_requesterPartnerId_requestedAt_idx"
ON "ResolutionRequest"("requesterPartnerId", "requestedAt");

CREATE INDEX "ResolutionRequest_requesterPartnerId_recipientIdentifierNormalized_requestedAt_idx"
ON "ResolutionRequest"("requesterPartnerId", "recipientIdentifierNormalized", "requestedAt");

CREATE UNIQUE INDEX "ResolutionRequest_requesterPartnerId_queryType_idempotencyKey_key"
ON "ResolutionRequest"("requesterPartnerId", "queryType", "idempotencyKey")
WHERE "requesterPartnerId" IS NOT NULL
  AND "idempotencyKey" IS NOT NULL;

CREATE TABLE "PartnerRequestNonce" (
  "id" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerRequestNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerRequestNonce_credentialId_nonce_key"
ON "PartnerRequestNonce"("credentialId", "nonce");

CREATE INDEX "PartnerRequestNonce_credentialId_createdAt_idx"
ON "PartnerRequestNonce"("credentialId", "createdAt");

CREATE INDEX "PartnerRequestNonce_expiresAt_idx"
ON "PartnerRequestNonce"("expiresAt");

ALTER TABLE "PartnerRequestNonce"
ADD CONSTRAINT "PartnerRequestNonce_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "PartnerApiCredential"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
