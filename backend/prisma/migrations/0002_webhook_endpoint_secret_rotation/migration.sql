ALTER TABLE "WebhookEndpoint"
ADD COLUMN "signingSecretVersion" INTEGER NOT NULL DEFAULT 1;
