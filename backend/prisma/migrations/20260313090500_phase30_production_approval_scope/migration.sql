-- CreateTable
CREATE TABLE "PartnerProductionApprovalRequestCorridor" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "assetNetworkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerProductionApprovalRequestCorridor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProductionApprovalRequestCorridor_requestId_assetNetwork_key" ON "PartnerProductionApprovalRequestCorridor"("requestId", "assetNetworkId");

-- CreateIndex
CREATE INDEX "PartnerProductionApprovalRequestCorridor_assetNetworkId_idx" ON "PartnerProductionApprovalRequestCorridor"("assetNetworkId");

-- AddForeignKey
ALTER TABLE "PartnerProductionApprovalRequestCorridor" ADD CONSTRAINT "PartnerProductionApprovalRequestCorridor_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PartnerProductionApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProductionApprovalRequestCorridor" ADD CONSTRAINT "PartnerProductionApprovalRequestCorridor_assetNetworkId_fkey" FOREIGN KEY ("assetNetworkId") REFERENCES "AssetNetwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
