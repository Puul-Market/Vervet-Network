CREATE TYPE "ProductionApprovalRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "PartnerProductionApprovalRequest" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "status" "ProductionApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestNote" TEXT,
  "reviewNote" TEXT,
  "reviewedByIdentifier" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerProductionApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerProductionApprovalRequest_partnerId_requestedAt_idx"
  ON "PartnerProductionApprovalRequest"("partnerId", "requestedAt");

CREATE INDEX "PartnerProductionApprovalRequest_partnerId_status_requestedAt_idx"
  ON "PartnerProductionApprovalRequest"("partnerId", "status", "requestedAt");

CREATE INDEX "PartnerProductionApprovalRequest_status_requestedAt_idx"
  ON "PartnerProductionApprovalRequest"("status", "requestedAt");

ALTER TABLE "PartnerProductionApprovalRequest"
ADD CONSTRAINT "PartnerProductionApprovalRequest_partnerId_fkey"
FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerProductionApprovalRequest"
ADD CONSTRAINT "PartnerProductionApprovalRequest_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "PartnerUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
