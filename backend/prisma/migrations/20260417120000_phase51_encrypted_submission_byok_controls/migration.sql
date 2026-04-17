ALTER TABLE "PartnerSecuritySettings"
  ADD COLUMN "enableEncryptedSubmission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enterpriseByokEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customerKeyArn" TEXT,
  ADD COLUMN "customerKeyStatus" TEXT;
