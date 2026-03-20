CREATE TYPE "PartnerPricingPlan" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE');

ALTER TABLE "Partner"
ADD COLUMN "pricingPlan" "PartnerPricingPlan" NOT NULL DEFAULT 'STARTER';
