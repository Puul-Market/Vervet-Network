import Link from "next/link";
import { FeedHealthCard } from "@/components/feed-health-card";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { OnboardingProgressCard } from "@/components/onboarding-progress-card";
import { PageHeader } from "@/components/page-header";
import { PartnerCapabilityBadge } from "@/components/partner-capability-badge";
import { ProductionReadinessCard } from "@/components/production-readiness-card";
import { ProductionUpgradeCard } from "@/components/production-upgrade-card";
import {
  fetchDataFeedHealth,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  isDataContributorEnabled,
} from "@/lib/vervet-api";
import { requireDashboardSession } from "@/lib/session";

export default async function SandboxPage() {
  const session = await requireDashboardSession();
  const [partnerProfile, metadata] = await Promise.all([
    fetchPartnerProfile(session.accessToken),
    fetchPartnerDashboardMetadata(session.accessToken),
  ]);

  if (!partnerProfile.capabilities.sandboxEnabled) {
    return (
      <section className="panel-stack">
        <PageHeader
          title="Sandbox"
          description="Sandbox tooling is not enabled for this organization."
          eyebrow="Developer enablement"
        />
        <ModuleAvailabilityBanner
          title="Sandbox is unavailable"
          description="Sandbox access will appear here after sandbox capability is enabled for your organization."
          actionHref="/setup"
          actionLabel="Continue setup"
        />
      </section>
    );
  }

  const dataFeedHealth = isDataContributorEnabled(partnerProfile)
    ? await fetchDataFeedHealth(session.accessToken)
    : null;

  return (
    <section className="panel-stack">
      <PageHeader
        title="Sandbox"
        description={`Test by-recipient, by-address, transfer-verification, and batch flows with guided presets for ${metadata.guidance.journeyLabel.toLowerCase()} validation.`}
        eyebrow="Developer enablement"
        actions={
          <div className="page-header-actions">
            <Link className="secondary-button" href="/docs/quickstart">
              Quickstart
            </Link>
            <Link className="primary-button" href="/setup">
              Continue setup
            </Link>
          </div>
        }
      />

      <section className="context-grid">
        <article className="context-card">
          <p className="eyebrow">Sandbox profile</p>
          <strong>{metadata.guidance.journeyLabel}</strong>
          <div className="chip-row">
            <PartnerCapabilityBadge
              profileLabel={partnerProfile.capabilities.profileLabel}
            />
          </div>
          <span>{metadata.guidance.journeySummary}</span>
        </article>
        <OnboardingProgressCard onboarding={partnerProfile.onboarding} />
        <ProductionReadinessCard readiness={partnerProfile.readiness} />
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <span>Recommended scenarios</span>
          <strong>Use the right test path</strong>
          <div className="detail-list">
            {partnerProfile.capabilities.apiConsumerEnabled ? (
              <>
                <div className="stacked-cell">
                  <strong>Sender-side resolution</strong>
                  <span>Validate by-recipient and by-address resolution before you rely on pasted destinations in production.</span>
                </div>
                <div className="stacked-cell">
                  <strong>Transfer verification</strong>
                  <span>Run safe, caution, and blocked examples so your operators understand the recommendation flow.</span>
                </div>
              </>
            ) : null}
            {isDataContributorEnabled(partnerProfile) ? (
              <div className="stacked-cell">
                <strong>Trust data validation</strong>
                <span>After sandbox resolution succeeds, verify that contributed trust objects stay fresh and appear healthy in Data Feed Health.</span>
              </div>
            ) : null}
            {partnerProfile.capabilities.batchVerificationEnabled ? (
              <div className="stacked-cell">
                <strong>Batch verification</strong>
                <span>Run treasury-scale examples before enabling operational teams to upload CSV or JSON payloads.</span>
              </div>
            ) : null}
          </div>
        </article>

        <ProductionUpgradeCard metadata={metadata} partnerProfile={partnerProfile} />
      </section>

      {dataFeedHealth ? (
        <FeedHealthCard
          actionHref="/data-feed-health"
          actionLabel="Review feed health"
          dataFeedHealth={dataFeedHealth}
          title="Trust data validation"
        />
      ) : null}

      <section className="detail-grid">
        {metadata.sandbox.presets.map((preset) => (
          <article className="detail-card" key={preset.key}>
            <span>{preset.title}</span>
            <strong>{preset.description}</strong>
            <Link className="inline-link" href={preset.href}>
              Run sample
            </Link>
          </article>
        ))}
      </section>

      {metadata.sandbox.sampleResponse ? (
        <JsonPreviewPanel title="Sample response" value={metadata.sandbox.sampleResponse} />
      ) : null}
    </section>
  );
}
