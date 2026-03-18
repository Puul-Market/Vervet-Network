-- CreateEnum
CREATE TYPE "PartnerProductionCorridorStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateTable
CREATE TABLE "PartnerProductionCorridor" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "status" "PartnerProductionCorridorStatus" NOT NULL DEFAULT 'GRANTED',
    "note" TEXT,
    "grantedByIdentifier" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProductionCorridor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerProductionCorridor_partnerId_status_idx" ON "PartnerProductionCorridor"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerProductionCorridor_assetNetworkId_status_idx" ON "PartnerProductionCorridor"("assetNetworkId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProductionCorridor_partnerId_assetNetworkId_key" ON "PartnerProductionCorridor"("partnerId", "assetNetworkId");

-- AddForeignKey
ALTER TABLE "PartnerProductionCorridor" ADD CONSTRAINT "PartnerProductionCorridor_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProductionCorridor" ADD CONSTRAINT "PartnerProductionCorridor_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "PartnerProductionApprovalRequest_partnerId_status_requestedAt_i" RENAME TO "PartnerProductionApprovalRequest_partnerId_status_requested_idx";

-- RenameIndex
ALTER INDEX "ResolutionRequest_requesterPartnerId_platformInput_requestedAt_" RENAME TO "ResolutionRequest_requesterPartnerId_platformInput_requeste_idx";
