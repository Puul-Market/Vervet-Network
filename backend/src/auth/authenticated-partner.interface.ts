import type {
  PartnerFeedHealthStatus,
  PartnerOnboardingStage,
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

export interface AuthenticatedPartner {
  actorIdentifier: string;
  actorType: PartnerAccessActorType;
  credentialId: string | null;
  dashboardSessionId: string | null;
  partnerId: string;
  partnerSlug: string;
  partnerStatus: PartnerStatus;
  partnerCapabilities: AuthenticatedPartnerCapabilities;
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
