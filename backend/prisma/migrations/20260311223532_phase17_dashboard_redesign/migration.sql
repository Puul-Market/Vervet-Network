-- CreateEnum
CREATE TYPE "PartnerUserInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ResolutionBatchInputFormat" AS ENUM ('CSV', 'ROWS', 'JSON');

-- CreateEnum
CREATE TYPE "AuditExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "AuditExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PartnerUserRole" ADD VALUE 'DEVELOPER';
ALTER TYPE "PartnerUserRole" ADD VALUE 'READ_ONLY';

-- AlterEnum
ALTER TYPE "QueryType" ADD VALUE 'BATCH_VERIFY';

-- DropIndex
DROP INDEX "ResolutionRequest_requesterPartnerId_queryType_idempotencyKey_k";

-- AlterTable
ALTER TABLE "ResolutionRequest" ADD COLUMN     "resolutionBatchRunId" TEXT;

-- CreateTable
CREATE TABLE "PartnerUserInvite" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "PartnerUserRole" NOT NULL,
    "scopes" TEXT[],
    "keyPrefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "status" "PartnerUserInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerUserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSecuritySettings" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "sessionIdleTimeoutMinutes" INTEGER NOT NULL DEFAULT 720,
    "enforceMfa" BOOLEAN NOT NULL DEFAULT false,
    "ipAllowlist" TEXT[],
    "credentialRotationDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSecuritySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionBatchRun" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "inputFormat" "ResolutionBatchInputFormat" NOT NULL,
    "chainInput" TEXT NOT NULL,
    "assetInput" TEXT NOT NULL,
    "stopOnFirstHighRisk" BOOLEAN NOT NULL DEFAULT false,
    "requireExactAttestedMatch" BOOLEAN NOT NULL DEFAULT true,
    "rowCount" INTEGER NOT NULL,
    "verifiedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "unsupportedCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ResolutionBatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionBatchRow" (
    "id" TEXT NOT NULL,
    "batchRunId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "clientReference" TEXT,
    "recipientIdentifierInput" TEXT NOT NULL,
    "submittedAddressRaw" TEXT NOT NULL,
    "outcome" "ResolutionOutcome" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "recommendation" TEXT,
    "flags" TEXT[],
    "responseData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolutionBatchRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditExportJob" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "format" "AuditExportFormat" NOT NULL,
    "status" "AuditExportStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB,
    "downloadFilename" TEXT,
    "downloadMimeType" TEXT,
    "downloadContent" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerUserInvite_keyPrefix_key" ON "PartnerUserInvite"("keyPrefix");

-- CreateIndex
CREATE INDEX "PartnerUserInvite_partnerId_status_idx" ON "PartnerUserInvite"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerUserInvite_expiresAt_idx" ON "PartnerUserInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerUserInvite_partnerId_email_status_key" ON "PartnerUserInvite"("partnerId", "email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSecuritySettings_partnerId_key" ON "PartnerSecuritySettings"("partnerId");

-- CreateIndex
CREATE INDEX "ResolutionBatchRun_partnerId_createdAt_idx" ON "ResolutionBatchRun"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "ResolutionBatchRow_batchRunId_outcome_idx" ON "ResolutionBatchRow"("batchRunId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionBatchRow_batchRunId_rowIndex_key" ON "ResolutionBatchRow"("batchRunId", "rowIndex");

-- CreateIndex
CREATE INDEX "AuditExportJob_partnerId_createdAt_idx" ON "AuditExportJob"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditExportJob_status_expiresAt_idx" ON "AuditExportJob"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "PartnerUserInvite" ADD CONSTRAINT "PartnerUserInvite_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerUserInvite" ADD CONSTRAINT "PartnerUserInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "PartnerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSecuritySettings" ADD CONSTRAINT "PartnerSecuritySettings_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionRequest" ADD CONSTRAINT "ResolutionRequest_resolutionBatchRunId_fkey" FOREIGN KEY ("resolutionBatchRunId") REFERENCES "ResolutionBatchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionBatchRun" ADD CONSTRAINT "ResolutionBatchRun_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionBatchRun" ADD CONSTRAINT "ResolutionBatchRun_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "PartnerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionBatchRow" ADD CONSTRAINT "ResolutionBatchRow_batchRunId_fkey" FOREIGN KEY ("batchRunId") REFERENCES "ResolutionBatchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExportJob" ADD CONSTRAINT "AuditExportJob_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExportJob" ADD CONSTRAINT "AuditExportJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "PartnerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ResolutionRequest_requesterPartnerId_recipientIdentifierNormali" RENAME TO "ResolutionRequest_requesterPartnerId_recipientIdentifierNor_idx";
