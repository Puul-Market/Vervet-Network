import { PartnerPricingPlan } from '@prisma/client';

export interface PartnerPricingPlanDefinition {
  label: string;
  monthlyBasePriceUsd: number | null;
  includedVerifications: number | null;
  overagePriceUsd: number | null;
  overagePolicyNote: string;
  bestFor: string;
  supportTierLabel: string;
  featureHighlights: string[];
  requirements: {
    mustContributeOwnAttestationData: boolean;
    requirementNote: string | null;
  };
  entitlements: {
    verificationAnalyticsEnabled: boolean;
    bulkVerificationEnabled: boolean;
    prioritySupportEnabled: boolean;
    dedicatedIntegrationSupportEnabled: boolean;
    customPricing: boolean;
  };
}

export const partnerPricingPlanCatalog: Record<
  PartnerPricingPlan,
  PartnerPricingPlanDefinition
> = {
  STARTER: {
    label: 'Starter',
    monthlyBasePriceUsd: 99,
    includedVerifications: 2_000,
    overagePriceUsd: 0.01,
    overagePolicyNote:
      'Verification requests continue beyond the included monthly volume and accrue the standard overage rate.',
    bestFor: 'Smaller platforms getting started.',
    supportTierLabel: 'Standard support',
    featureHighlights: [
      'Multi-chain support',
      'By Recipient, By Address, and Verify Transfer',
      'Operational setup for your own attestation contribution',
    ],
    requirements: {
      mustContributeOwnAttestationData: true,
      requirementNote:
        'Starter organizations are expected to contribute attestation data for their own platform.',
    },
    entitlements: {
      verificationAnalyticsEnabled: false,
      bulkVerificationEnabled: false,
      prioritySupportEnabled: false,
      dedicatedIntegrationSupportEnabled: false,
      customPricing: false,
    },
  },
  GROWTH: {
    label: 'Growth',
    monthlyBasePriceUsd: 299,
    includedVerifications: 15_000,
    overagePriceUsd: 0.01,
    overagePolicyNote:
      'Verification requests continue beyond the included monthly volume and accrue the standard overage rate.',
    bestFor: 'Growing platforms that need analytics and faster support.',
    supportTierLabel: 'Priority support',
    featureHighlights: [
      'Everything in Starter',
      'Verification analytics dashboard',
      'Priority support',
    ],
    requirements: {
      mustContributeOwnAttestationData: false,
      requirementNote: null,
    },
    entitlements: {
      verificationAnalyticsEnabled: true,
      bulkVerificationEnabled: false,
      prioritySupportEnabled: true,
      dedicatedIntegrationSupportEnabled: false,
      customPricing: false,
    },
  },
  SCALE: {
    label: 'Scale',
    monthlyBasePriceUsd: 799,
    includedVerifications: 75_000,
    overagePriceUsd: 0.01,
    overagePolicyNote:
      'Verification requests continue beyond the included monthly volume and accrue the standard overage rate.',
    bestFor: 'Treasury, payroll, and high-volume operations teams.',
    supportTierLabel: 'Dedicated integration support',
    featureHighlights: [
      'Everything in Growth',
      'Bulk verification for treasury and payroll',
      'Dedicated integration support',
    ],
    requirements: {
      mustContributeOwnAttestationData: false,
      requirementNote: null,
    },
    entitlements: {
      verificationAnalyticsEnabled: true,
      bulkVerificationEnabled: true,
      prioritySupportEnabled: true,
      dedicatedIntegrationSupportEnabled: true,
      customPricing: false,
    },
  },
  ENTERPRISE: {
    label: 'Enterprise',
    monthlyBasePriceUsd: null,
    includedVerifications: null,
    overagePriceUsd: null,
    overagePolicyNote:
      'Verification volume and any overage handling follow your enterprise agreement.',
    bestFor:
      'Top-tier exchanges and payment platforms with custom requirements.',
    supportTierLabel: 'Enterprise SLA and custom support',
    featureHighlights: [
      'Unlimited verification volume',
      'Custom integrations and SLA support',
      'Dedicated operational partnership',
    ],
    requirements: {
      mustContributeOwnAttestationData: false,
      requirementNote: null,
    },
    entitlements: {
      verificationAnalyticsEnabled: true,
      bulkVerificationEnabled: true,
      prioritySupportEnabled: true,
      dedicatedIntegrationSupportEnabled: true,
      customPricing: true,
    },
  },
};

export function getPartnerPricingPlanDefinition(plan: PartnerPricingPlan) {
  return partnerPricingPlanCatalog[plan];
}
