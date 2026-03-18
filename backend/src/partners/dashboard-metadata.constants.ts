export const onboardingActionCatalog = {
  create_api_key: {
    label: 'Create an API key',
    description:
      'Issue the first API credential so your organization can authenticate against Vervet APIs.',
    href: '/access/api-keys',
    ctaLabel: 'Open API Keys',
    blockedBy: 'api_consumer_capability_disabled',
  },
  register_signing_key: {
    label: 'Register a signing key',
    description:
      'Register the signing key Vervet will use to verify your attestation and trust updates.',
    href: '/access/signing-keys',
    ctaLabel: 'Open Signing Keys',
    blockedBy: 'data_partner_capability_disabled',
  },
  configure_webhook: {
    label: 'Configure a webhook',
    description:
      'Create at least one webhook subscription for delivery updates and trust lifecycle events.',
    href: '/webhooks',
    ctaLabel: 'Open Webhooks',
    blockedBy: 'webhooks_capability_disabled',
  },
  run_sandbox_request: {
    label: 'Run a sandbox request',
    description:
      'Run a sandbox or resolution request so the team can validate your integration path end to end.',
    href: '/sandbox',
    ctaLabel: 'Open Sandbox',
    blockedBy: 'sandbox_capability_disabled',
  },
  map_recipient_data: {
    label: 'Map recipient data',
    description:
      'Map recipient and destination data into Vervet so your trust objects are ready for onboarding review.',
    href: '/recipients',
    ctaLabel: 'Open Recipients',
    blockedBy: 'data_partner_capability_disabled',
  },
  ingest_attestation_data: {
    label: 'Ingest attestation data',
    description:
      'Begin attestation ingestion so Vervet can verify and materialize your trust data.',
    href: '/attestations',
    ctaLabel: 'Open Attestations',
    blockedBy: 'data_partner_capability_disabled',
  },
  request_production_approval: {
    label: 'Request production approval',
    description:
      'Review your readiness and follow the production activation path with the Vervet team.',
    href: '/setup',
    ctaLabel: 'Open production approval',
    blockedBy: null,
  },
  await_production_review: {
    label: 'Await production review',
    description: 'Your production approval request is pending Vervet review.',
    href: '/setup',
    ctaLabel: 'Review approval status',
    blockedBy: null,
  },
} as const;

export const productionApprovalBlockedReasonDescriptions: Record<
  string,
  string
> = {
  dashboard_user_required:
    'A dashboard user session is required to request production approval.',
  insufficient_role:
    'Only owners and admins can request or cancel production approval.',
  already_production_enabled:
    'This organization is already production approved.',
  pending_review: 'A production approval request is already pending review.',
  feed_health_not_ready:
    'Feed health must be healthy before production approval can be requested.',
  onboarding_incomplete:
    'Complete the remaining onboarding steps before requesting production approval.',
};
