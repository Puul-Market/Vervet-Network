import type { PartnerOnboardingStage, PartnerUserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import type {
  AuthenticatedPartnerCapabilities,
  AuthenticatedPartnerPlanEntitlements,
  PartnerAccessActorType,
} from './authenticated-partner.interface';

export type PartnerCapabilityFlag = keyof AuthenticatedPartnerCapabilities;
export type PartnerPlanEntitlementFlag =
  keyof AuthenticatedPartnerPlanEntitlements;

export interface PartnerAccessPolicyDefinition {
  actorTypes?: PartnerAccessActorType[];
  allCapabilities?: PartnerCapabilityFlag[];
  anyCapabilities?: PartnerCapabilityFlag[];
  allPlanEntitlements?: PartnerPlanEntitlementFlag[];
  anyPlanEntitlements?: PartnerPlanEntitlementFlag[];
  minOnboardingStage?: PartnerOnboardingStage;
  partnerUserRoles?: PartnerUserRole[];
  requireOperationalEnvironment?: boolean;
}

export const partnerAccessPolicyDecorator =
  Reflector.createDecorator<PartnerAccessPolicyDefinition>({
    key: 'partnerAccessPolicy',
  });

export const RequirePartnerAccessPolicy = (
  policy: PartnerAccessPolicyDefinition,
) => partnerAccessPolicyDecorator(policy);
