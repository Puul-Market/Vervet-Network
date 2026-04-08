ALTER TABLE "PartnerSecuritySettings"
ADD COLUMN "defaultDisclosureMode" TEXT NOT NULL DEFAULT 'VERIFICATION_ONLY',
ADD COLUMN "allowFullLabelDisclosure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rawVerificationRetentionMode" TEXT NOT NULL DEFAULT 'SHORT_RETENTION',
ADD COLUMN "rawVerificationRetentionHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN "encryptAuditExports" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ResolutionRequest"
ADD COLUMN "retentionExpiresAt" TIMESTAMP(3);

ALTER TABLE "ResolutionBatchRow"
ADD COLUMN "retentionExpiresAt" TIMESTAMP(3);
