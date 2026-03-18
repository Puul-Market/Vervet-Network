CREATE TYPE "PartnerUserStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "PartnerUserRole" AS ENUM ('OWNER', 'ADMIN', 'ANALYST');

CREATE TABLE "PartnerUser" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "PartnerUserRole" NOT NULL DEFAULT 'OWNER',
  "scopes" TEXT[],
  "passwordHash" TEXT NOT NULL,
  "status" "PartnerUserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DashboardSession" (
  "id" TEXT NOT NULL,
  "partnerUserId" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DashboardSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerUser_email_key" ON "PartnerUser"("email");

CREATE INDEX "PartnerUser_partnerId_status_idx"
ON "PartnerUser"("partnerId", "status");

CREATE UNIQUE INDEX "DashboardSession_keyPrefix_key"
ON "DashboardSession"("keyPrefix");

CREATE INDEX "DashboardSession_partnerUserId_revokedAt_idx"
ON "DashboardSession"("partnerUserId", "revokedAt");

CREATE INDEX "DashboardSession_expiresAt_idx"
ON "DashboardSession"("expiresAt");

ALTER TABLE "PartnerUser"
ADD CONSTRAINT "PartnerUser_partnerId_fkey"
FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DashboardSession"
ADD CONSTRAINT "DashboardSession_partnerUserId_fkey"
FOREIGN KEY ("partnerUserId") REFERENCES "PartnerUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
