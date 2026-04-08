ALTER TABLE "Recipient"
ADD COLUMN "displayNameCiphertext" TEXT;

ALTER TABLE "RecipientIdentifier"
ADD COLUMN "rawValueCiphertext" TEXT,
ADD COLUMN "normalizedValueBlindIndex" TEXT;

ALTER TABLE "RecipientDestination"
ADD COLUMN "addressRawCiphertext" TEXT,
ADD COLUMN "addressNormalizedBlindIndex" TEXT;

CREATE UNIQUE INDEX "RecipientIdentifier_partnerId_kind_normalizedValueBlindIndex_key"
ON "RecipientIdentifier"("partnerId", "kind", "normalizedValueBlindIndex");

CREATE UNIQUE INDEX "RecipientDestination_addr_blind_uq"
ON "RecipientDestination"("recipientId", "assetNetworkId", "addressNormalizedBlindIndex", "memoValue");

CREATE INDEX "RecipientDestination_addr_blind_idx"
ON "RecipientDestination"("addressNormalizedBlindIndex");
