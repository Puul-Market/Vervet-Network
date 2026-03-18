-- CreateTable
CREATE TABLE "PartnerProductionApprovalApprovedCorridor" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerProductionApprovalApprovedCorridor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProductionApprovalApprovedCorridor_requestId_assetNetworkId_key" ON "PartnerProductionApprovalApprovedCorridor"("requestId", "assetNetworkId");

-- CreateIndex
CREATE INDEX "PartnerProductionApprovalApprovedCorridor_assetNetworkId_idx" ON "PartnerProductionApprovalApprovedCorridor"("assetNetworkId");

-- AddForeignKey
ALTER TABLE "PartnerProductionApprovalApprovedCorridor" ADD CONSTRAINT "PartnerProductionApprovalApprovedCorridor_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PartnerProductionApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProductionApprovalApprovedCorridor" ADD CONSTRAINT "PartnerProductionApprovalApprovedCorridor_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
