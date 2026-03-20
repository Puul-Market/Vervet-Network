import type {
  PartnerFeedHealthStatus,
  PartnerOnboardingStage,
  PartnerPricingPlan,
  PartnerStatus,
  PartnerUserRole,
} from '@prisma/client';
import type { Request } from 'express';

export type PartnerAccessActorType = 'API_CREDENTIAL' | 'PARTNER_USER';

export interface AuthenticatedPartnerCapabilities {
  apiConsumerEnabled: boolean;
  dataPartnerEnabled: boolean;
  fullAttestationPartnerEnabled: boolean;
  webhooksEnabled: boolean;
  batchVerificationEnabled: boolean;
  auditExportsEnabled: boolean;
  sandboxEnabled: boolean;
  productionEnabled: boolean;
}

export interface AuthenticatedPartnerPlanEntitlements {
  verificationAnalyticsEnabled: boolean;
  bulkVerificationEnabled: boolean;
  prioritySupportEnabled: boolean;
  dedicatedIntegrationSupportEnabled: boolean;
  customPricing: boolean;
}

export interface AuthenticatedPartner {
  actorIdentifier: string;
  actorType: PartnerAccessActorType;
  credentialId: string | null;
  dashboardSessionId: string | null;
  partnerId: string;
  partnerSlug: string;
  partnerStatus: PartnerStatus;
  partnerPricingPlan: PartnerPricingPlan;
  partnerCapabilities: AuthenticatedPartnerCapabilities;
  partnerPlanEntitlements: AuthenticatedPartnerPlanEntitlements;
  partnerFeedHealthStatus: PartnerFeedHealthStatus;
  partnerOnboardingStage: PartnerOnboardingStage;
  partnerUserEmail: string | null;
  partnerUserId: string | null;
  partnerUserRole: PartnerUserRole | null;
  scopes: string[];
}

export interface AuthenticatedRequest extends Request {
  authenticatedPartner?: AuthenticatedPartner;
}
