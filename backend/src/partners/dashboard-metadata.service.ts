import { Injectable } from '@nestjs/common';
import {
  AttestationType,
  AuditActorType,
  AuditExportFormat,
  ChainFamily,
  DeliveryStatus,
  DestinationStatus,
  IdentifierKind,
  IdentifierStatus,
  IdentifierVisibility,
  PartnerFeedHealthStatus,
  PartnerOnboardingStage,
  PartnerPricingPlan,
  PartnerStatus,
  PartnerType,
  PartnerUserRole,
  PartnerUserStatus,
  Prisma,
  QueryType,
  RecipientStatus,
  ResolutionBatchInputFormat,
  ResolutionOutcome,
  RiskLevel,
  SigningKeyAlgorithm,
  VerificationStatus,
  WebhookEventType,
  WebhookStatus,
} from '@prisma/client';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  credentialScopeCatalog,
  credentialScopes,
} from './api-credential.util';
import {
  onboardingActionCatalog,
  productionApprovalBlockedReasonDescriptions,
} from './dashboard-metadata.constants';
import { PartnersService } from './partners.service';

type PartnerProfileSummary = Awaited<
  ReturnType<PartnersService['getPartnerProfile']>
>;

const dashboardAssetNetworkSelect = {
  id: true,
  standard: true,
  contractAddressRaw: true,
  decimals: true,
  memoPolicy: true,
  memoLabel: true,
  chain: {
    select: {
      id: true,
      slug: true,
      displayName: true,
      family: true,
    },
  },
  asset: {
    select: {
      id: true,
      code: true,
      symbol: true,
      displayName: true,
    },
  },
} satisfies Prisma.AssetNetworkSelect;

@Injectable()
export class DashboardMetadataService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly partnersService: PartnersService,
  ) {}

  async getPartnerDashboardMetadata(
    authenticatedPartner: AuthenticatedPartner,
  ) {
    const [partnerProfile, assetNetworks, sandboxExamples, activeSigningKey] =
      await Promise.all([
        this.partnersService.getPartnerProfile(authenticatedPartner),
        this.listActiveAssetNetworks(),
        this.buildSandboxExamples(),
        this.prismaService.partnerSigningKey.findFirst({
          where: {
            partnerId: authenticatedPartner.partnerId,
            status: 'ACTIVE',
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            keyId: true,
          },
        }),
      ]);

    return {
      assetNetworks,
      optionSets: this.buildDashboardOptionSets(),
      onboarding: {
        actionLabels: this.buildOnboardingActionLabels(),
        blockedReasonDescriptions: productionApprovalBlockedReasonDescriptions,
        taskDefinitions: this.buildOnboardingTaskDefinitions(),
      },
      guidance: this.buildGuidance(
        partnerProfile,
        assetNetworks,
        activeSigningKey?.keyId ?? null,
      ),
      sandbox: {
        presets: sandboxExamples.presets,
        sampleResponse: sandboxExamples.sampleResponse,
        batchDefaultInput: sandboxExamples.batchDefaultInput,
      },
    };
  }

  getAdminSetupMetadata() {
    return {
      optionSets: this.buildAdminOptionSets(),
    };
  }

  private async listActiveAssetNetworks() {
    return this.prismaService.assetNetwork.findMany({
      where: {
        isActive: true,
        chain: {
          isActive: true,
        },
        asset: {
          isActive: true,
        },
      },
      orderBy: [
        {
          chain: {
            displayName: 'asc',
          },
        },
        {
          asset: {
            displayName: 'asc',
          },
        },
      ],
      select: dashboardAssetNetworkSelect,
    });
  }

  private buildDashboardOptionSets() {
    return {
      partnerTypes: Object.values(PartnerType),
      partnerStatuses: Object.values(PartnerStatus),
      partnerPricingPlans: Object.values(PartnerPricingPlan),
      partnerOnboardingStages: Object.values(PartnerOnboardingStage),
      partnerFeedHealthStatuses: Object.values(PartnerFeedHealthStatus),
      partnerUserRoles: Object.values(PartnerUserRole),
      partnerUserStatuses: Object.values(PartnerUserStatus),
      signingKeyAlgorithms: Object.values(SigningKeyAlgorithm),
      credentialScopes: [...credentialScopes],
      credentialScopeDefinitions: credentialScopes.map((scope) => ({
        value: scope,
        label: credentialScopeCatalog[scope].label,
        description: credentialScopeCatalog[scope].description,
      })),
      recommendedCredentialScopes: ['resolution:read'],
      webhookEventTypes: Object.values(WebhookEventType),
      webhookStatuses: Object.values(WebhookStatus),
      deliveryStatuses: Object.values(DeliveryStatus),
      recipientStatuses: Object.values(RecipientStatus),
      identifierKinds: Object.values(IdentifierKind),
      identifierVisibilities: Object.values(IdentifierVisibility),
      destinationStatuses: Object.values(DestinationStatus),
      attestationTypes: Object.values(AttestationType),
      verificationStatuses: Object.values(VerificationStatus),
      auditActorTypes: Object.values(AuditActorType),
      auditExportFormats: Object.values(AuditExportFormat),
      queryTypes: Object.values(QueryType),
      resolutionOutcomes: Object.values(ResolutionOutcome),
      riskLevels: Object.values(RiskLevel),
      disclosureModes: [
        'FULL_LABEL',
        'MASKED_LABEL',
        'VERIFICATION_ONLY',
      ] as const,
      resolutionBatchLookupModes: [
        'BY_RECIPIENT',
        'BY_ADDRESS',
        'MIXED',
      ] as const,
      resolutionBatchInputFormats: Object.values(ResolutionBatchInputFormat),
    };
  }

  private buildAdminOptionSets() {
    const optionSets = this.buildDashboardOptionSets();

    return {
      partnerTypes: optionSets.partnerTypes,
      partnerStatuses: optionSets.partnerStatuses,
      partnerPricingPlans: optionSets.partnerPricingPlans,
      partnerOnboardingStages: optionSets.partnerOnboardingStages,
      partnerFeedHealthStatuses: optionSets.partnerFeedHealthStatuses,
      partnerUserRoles: optionSets.partnerUserRoles,
      signingKeyAlgorithms: optionSets.signingKeyAlgorithms,
    };
  }

  private buildOnboardingActionLabels() {
    return Object.fromEntries(
      Object.entries(onboardingActionCatalog).map(([key, value]) => [
        key,
        value.label,
      ]),
    );
  }

  private buildOnboardingTaskDefinitions() {
    return (
      [
        'create_api_key',
        'register_signing_key',
        'configure_webhook',
        'run_sandbox_request',
        'map_recipient_data',
        'ingest_attestation_data',
        'request_production_approval',
      ] as const
    ).map((key) => ({
      key,
      ...onboardingActionCatalog[key],
    }));
  }

  private buildGuidance(
    profile: PartnerProfileSummary,
    assetNetworks: Awaited<
      ReturnType<DashboardMetadataService['listActiveAssetNetworks']>
    >,
    activeSigningKeyId: string | null,
  ) {
    return {
      journeyLabel: this.describePartnerJourney(profile),
      journeySummary: this.describePartnerJourneySummary(profile),
      quickstartSteps: this.buildQuickstartSteps(profile),
      productionUpgradeSteps: this.buildProductionUpgradeSteps(profile),
      dataSubmission: this.buildDataSubmissionGuide(
        profile,
        assetNetworks,
        activeSigningKeyId,
      ),
    };
  }

  private describePartnerJourney(profile: PartnerProfileSummary) {
    switch (profile.capabilities.profileLabel) {
      case 'FULL_ATTESTATION_PARTNER':
        return 'Full attestation partner';
      case 'CONSUMER_AND_DATA_PARTNER':
        return 'Consumer + data partner';
      case 'DATA_PARTNER':
        return 'Data partner';
      case 'API_CONSUMER':
        return 'API consumer';
      default:
        return 'Limited partner';
    }
  }

  private describePartnerJourneySummary(profile: PartnerProfileSummary) {
    switch (profile.capabilities.profileLabel) {
      case 'API_CONSUMER':
        return 'Prioritize API keys, resolution flows, webhooks, and sandbox validation before requesting production access.';
      case 'DATA_PARTNER':
        return 'Prioritize signing keys, recipient and destination mapping, attestation ingestion, and data feed health before go-live.';
      case 'CONSUMER_AND_DATA_PARTNER':
        return 'You need both sender-side API readiness and data-partner trust freshness before moving into production.';
      case 'FULL_ATTESTATION_PARTNER':
        return 'Your org is expected to operate both integration and attestation trust workflows, with production feed health held to the highest bar.';
      default:
        return 'Complete onboarding and capability enablement before expanding into additional platform modules.';
    }
  }

  private buildQuickstartSteps(profile: PartnerProfileSummary) {
    const steps: Array<{
      title: string;
      description: string;
      href: string;
    }> = [];

    if (profile.capabilities.apiConsumerEnabled) {
      steps.push({
        title: onboardingActionCatalog.create_api_key.label,
        description:
          'Issue the first credential your systems will use to call Vervet APIs.',
        href: '/access/api-keys',
      });
    }

    if (
      profile.capabilities.dataPartnerEnabled ||
      profile.capabilities.fullAttestationPartnerEnabled
    ) {
      steps.push({
        title: onboardingActionCatalog.register_signing_key.label,
        description:
          'Add the public key Vervet will use to verify your attestation and trust updates.',
        href: '/access/signing-keys',
      });
    }

    if (profile.capabilities.webhooksEnabled) {
      steps.push({
        title: onboardingActionCatalog.configure_webhook.label,
        description:
          'Subscribe to delivery and trust lifecycle events so operational failures surface immediately.',
        href: '/webhooks',
      });
    }

    if (profile.capabilities.apiConsumerEnabled) {
      steps.push({
        title: onboardingActionCatalog.run_sandbox_request.label,
        description:
          'Validate by-recipient, by-address, and transfer verification flows before using live traffic.',
        href: '/sandbox',
      });
    }

    if (
      profile.capabilities.dataPartnerEnabled ||
      profile.capabilities.fullAttestationPartnerEnabled
    ) {
      steps.push({
        title: onboardingActionCatalog.map_recipient_data.label,
        description:
          'Create registry records and pending destinations so your trust objects are ready for attestation ingestion.',
        href: '/recipients',
      });
      steps.push({
        title: 'Review data feed health',
        description:
          'Confirm that trust artifacts are landing correctly and that stale data does not block production readiness.',
        href: '/data-feed-health',
      });
    }

    if (!profile.capabilities.productionEnabled) {
      steps.push({
        title: onboardingActionCatalog.request_production_approval.label,
        description:
          'Use setup and readiness guidance to complete the final production activation path with Vervet.',
        href: '/setup',
      });
    }

    return steps;
  }

  private buildProductionUpgradeSteps(profile: PartnerProfileSummary) {
    const steps: Array<{
      title: string;
      description: string;
      href: string;
    }> = [];

    if (profile.productionApproval.latestRequest?.status === 'PENDING') {
      steps.push({
        title: 'Track production review',
        description:
          'Your latest production approval request is pending review. Monitor Setup for review notes or follow-up actions.',
        href: '/setup',
      });
    }

    if (
      profile.onboarding.nextRecommendedAction !== null &&
      profile.onboarding.nextRecommendedAction !== 'await_production_review'
    ) {
      steps.push({
        title:
          profile.onboarding.nextRecommendedActionLabel ??
          'Review workspace readiness',
        description:
          'This is the highest-priority action currently blocking your onboarding or production progress.',
        href: '/setup',
      });
    }

    if (
      profile.capabilities.dataPartnerEnabled ||
      profile.capabilities.fullAttestationPartnerEnabled
    ) {
      steps.push({
        title: 'Review data feed health',
        description:
          'Check stale destinations, expiring attestations, and webhook failures before expanding customer-facing traffic.',
        href: '/data-feed-health',
      });
    }

    if (profile.capabilities.sandboxEnabled) {
      steps.push({
        title: 'Validate sandbox scenarios',
        description:
          'Re-run representative by-recipient, by-address, and verify-transfer paths in the sandbox before promotion.',
        href: '/sandbox',
      });
    }

    if (!profile.capabilities.productionEnabled) {
      steps.push({
        title: 'Finalize production readiness',
        description:
          'Confirm key setup, webhook health, and partner-state readiness, then follow the setup path to request production approval.',
        href: '/setup',
      });
    }

    return steps.slice(0, 4);
  }

  private buildDataSubmissionGuide(
    profile: PartnerProfileSummary,
    assetNetworks: Awaited<
      ReturnType<DashboardMetadataService['listActiveAssetNetworks']>
    >,
    activeSigningKeyId: string | null,
  ) {
    const preferredAssetNetwork =
      assetNetworks.find(
        (assetNetwork) =>
          assetNetwork.chain.slug === 'ethereum' &&
          assetNetwork.asset.symbol.toUpperCase() === 'USDC',
      ) ?? assetNetworks[0];
    const keyId = activeSigningKeyId ?? '<registered-signing-key-id>';
    const chain = preferredAssetNetwork?.chain.slug ?? 'ethereum';
    const assetCode = preferredAssetNetwork?.asset.code ?? 'usdc';
    const assetSymbol = preferredAssetNetwork?.asset.symbol ?? 'USDC';
    const tokenStandard = preferredAssetNetwork?.standard ?? 'ERC20';
    const contractAddress = preferredAssetNetwork?.contractAddressRaw ?? null;
    const decimals = preferredAssetNetwork?.decimals ?? 6;
    const memo =
      preferredAssetNetwork?.memoPolicy === 'REQUIRED' ? '<memo-or-tag>' : '';
    const address = this.buildExampleAddress(
      preferredAssetNetwork?.chain.family ?? ChainFamily.EVM,
    );
    const examplePayload = {
      partnerSlug: profile.slug,
      keyId,
      algorithm: 'ED25519',
      attestationType: 'DESTINATION_ASSIGNMENT',
      sequenceNumber: 1001,
      recipientExternalId: 'merchant-001',
      recipientDisplayName: 'Acme Merchant',
      recipientIdentifier: `merchant@${profile.slug}`,
      identifierKind: 'PARTNER_HANDLE',
      chain,
      assetCode,
      assetSymbol,
      tokenStandard,
      contractAddress,
      decimals,
      address,
      memo,
      issuedAt: '2026-03-14T12:00:00.000Z',
      effectiveFrom: '2026-03-14T12:00:00.000Z',
      expiresAt: '2026-06-14T12:00:00.000Z',
      signature: '<signed-canonical-payload>',
    };
    const examplePayloadJson = JSON.stringify(examplePayload, null, 2);

    return {
      summary:
        'Data partners send production trust data from their own backend by signing canonical attestation payloads and POSTing them to Vervet.',
      steps: [
        {
          title: 'Register signing key',
          description:
            'Add the public key Vervet will use to verify your signed trust updates.',
          href: '/access/signing-keys',
        },
        {
          title: 'Issue API key',
          description:
            'Create an integration credential for your backend attestation client.',
          href: '/access/api-keys',
        },
        {
          title: 'Sign and send the first attestation',
          description:
            'Your backend signs the canonical payload and sends it to POST /v1/attestations with replay-protection headers.',
          href: '/docs/api',
        },
        {
          title: 'Confirm it landed',
          description:
            'Use Data Feed Health, Recipients, Destinations, and Attestations to confirm the ingestion materialized correctly.',
          href: '/data-feed-health',
        },
      ],
      notes: [
        'Recipients and destinations created in the dashboard are operational drafts until a matching signed attestation is ingested.',
        'The dashboard does not hold your private signing key. Signing happens in your own backend or signing service.',
        'Feed Health is the operational confirmation surface after you send data.',
      ],
      endpointPath: '/v1/attestations',
      examplePayload,
      exampleCurl: [
        "curl -X POST '<VERVET_API_BASE_URL>/v1/attestations' \\",
        "  -H 'Authorization: Bearer <API_KEY>' \\",
        "  -H 'Content-Type: application/json' \\",
        "  -H 'x-request-nonce: <UNIQUE_NONCE>' \\",
        "  -H 'x-request-timestamp: <ISO8601_TIMESTAMP>' \\",
        "  --data @- <<'JSON'",
        examplePayloadJson,
        'JSON',
      ].join('\n'),
    };
  }

  private async buildSandboxExamples() {
    const now = new Date();
    const exampleDestination =
      await this.prismaService.recipientDestination.findFirst({
        where: {
          status: DestinationStatus.ACTIVE,
          effectiveFrom: {
            lte: now,
          },
          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],
          recipient: {
            status: RecipientStatus.ACTIVE,
            partner: {
              status: PartnerStatus.ACTIVE,
              isDirectoryListed: true,
            },
            identifiers: {
              some: {
                status: IdentifierStatus.ACTIVE,
              },
            },
          },
          assetNetwork: {
            isActive: true,
            chain: {
              isActive: true,
            },
            asset: {
              isActive: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          addressRaw: true,
          recipient: {
            select: {
              displayName: true,
              externalRecipientId: true,
              partner: {
                select: {
                  slug: true,
                  displayName: true,
                },
              },
              identifiers: {
                where: {
                  status: IdentifierStatus.ACTIVE,
                },
                orderBy: [
                  {
                    isPrimary: 'desc',
                  },
                  {
                    createdAt: 'asc',
                  },
                ],
                take: 1,
                select: {
                  rawValue: true,
                },
              },
            },
          },
          assetNetwork: {
            select: {
              chain: {
                select: {
                  slug: true,
                  displayName: true,
                  family: true,
                },
              },
              asset: {
                select: {
                  symbol: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

    if (!exampleDestination) {
      return {
        presets: [],
        sampleResponse: null,
        batchDefaultInput: null,
      };
    }

    const identifier =
      exampleDestination.recipient.identifiers[0]?.rawValue ??
      `${exampleDestination.recipient.externalRecipientId}@${exampleDestination.recipient.partner.slug}`;
    const platform = exampleDestination.recipient.partner.slug;
    const chain = exampleDestination.assetNetwork.chain.slug;
    const asset = exampleDestination.assetNetwork.asset.symbol;
    const address = exampleDestination.addressRaw;
    const mismatchAddress = this.buildMismatchAddress(
      exampleDestination.assetNetwork.chain.family,
    );

    return {
      presets: [
        {
          key: 'by_address',
          title: 'By Address',
          description:
            'Confirm a pasted wallet address against a real supported platform and corridor.',
          href: `/resolution/by-address?platform=${encodeURIComponent(platform)}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(address)}`,
        },
        {
          key: 'by_recipient',
          title: 'By Recipient',
          description:
            'Resolve a verified destination from a real recipient identifier and corridor.',
          href: `/resolution/by-recipient?recipientIdentifier=${encodeURIComponent(identifier)}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}`,
        },
        {
          key: 'verify_transfer',
          title: 'Verify Transfer',
          description:
            'Run a mismatch example and review the safety recommendation before send.',
          href: `/resolution/verify-transfer?mode=RECIPIENT_CONTEXT&recipientIdentifier=${encodeURIComponent(identifier)}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(mismatchAddress)}`,
        },
        {
          key: 'batch_verify',
          title: 'Batch Verify',
          description:
            'Open the batch console with a starter row built from a real seeded recipient and corridor.',
          href: '/resolution/batch',
        },
      ],
      sampleResponse: {
        recipientDisplayName:
          exampleDestination.recipient.displayName ??
          exampleDestination.recipient.externalRecipientId,
        platform,
        address,
        chain,
        asset,
        verified: true,
        riskLevel: 'LOW',
        recommendation: 'safe_to_send',
      },
      batchDefaultInput: [
        'client_ref,recipient_identifier,address',
        `sample-1,${identifier},${address}`,
      ].join('\n'),
    };
  }

  private buildMismatchAddress(chainFamily: ChainFamily) {
    switch (chainFamily) {
      case ChainFamily.SOLANA:
        return '11111111111111111111111111111111';
      case ChainFamily.TRON:
      case ChainFamily.EVM:
      case ChainFamily.OTHER:
      default:
        return '0x0000000000000000000000000000000000000000';
    }
  }

  private buildExampleAddress(chainFamily: ChainFamily) {
    switch (chainFamily) {
      case ChainFamily.TRON:
        return 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj';
      case ChainFamily.SOLANA:
        return '7YWH4M8v2u7c6ooQxW8RkNvztNFVQVw1Gc7YDxjx3s1m';
      case ChainFamily.EVM:
      case ChainFamily.OTHER:
      default:
        return '0x71c7656EC7ab88b098defB751B7401B5f6d8976F';
    }
  }
}
