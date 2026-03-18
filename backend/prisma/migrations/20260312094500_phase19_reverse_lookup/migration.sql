ALTER TYPE "QueryType" ADD VALUE 'CONFIRM_ADDRESS';

ALTER TABLE "ResolutionRequest"
ADD COLUMN "platformInput" TEXT;

CREATE INDEX "ResolutionRequest_requesterPartnerId_platformInput_requestedAt_idx"
ON "ResolutionRequest"("requesterPartnerId", "platformInput", "requestedAt");
