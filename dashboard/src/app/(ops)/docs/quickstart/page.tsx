import Link from "next/link";
import { OnboardingProgressCard } from "@/components/onboarding-progress-card";
import { PageHeader } from "@/components/page-header";
import { PartnerCapabilityBadge } from "@/components/partner-capability-badge";
import { ProductionReadinessCard } from "@/components/production-readiness-card";
import { ProductionUpgradeCard } from "@/components/production-upgrade-card";
import {
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
} from "@/lib/vervet-api";
import { requireDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function QuickstartPage() {
  const session = await requireDashboardSession();
  const [partnerProfile, metadata] = await Promise.all([
    fetchPartnerProfile(session.accessToken),
    fetchPartnerDashboardMetadata(session.accessToken),
  ]);
  const steps = metadata.guidance.quickstartSteps;

  return (
    <section className="panel-stack">
      <PageHeader
        title="Quickstart"
        description="The fastest path to a working Vervet integration, tailored to your partner type and readiness state."
        eyebrow="Docs"
        actions={
          <div className="page-header-actions">
            <Link className="secondary-button" href="/sandbox">
              Open sandbox
            </Link>
            <Link className="primary-button" href="/setup">
              Continue setup
            </Link>
          </div>
        }
      />

      <section className="context-grid">
        <article className="context-card">
          <p className="eyebrow">Quickstart track</p>
          <strong>{metadata.guidance.journeyLabel}</strong>
          <div className="chip-row">
            <PartnerCapabilityBadge
              profileLabel={partnerProfile.capabilities.profileLabel}
            />
          </div>
          <span>
            This checklist adapts to your enabled capabilities and current
            onboarding stage.
          </span>
        </article>
        <OnboardingProgressCard onboarding={partnerProfile.onboarding} />
        <ProductionReadinessCard readiness={partnerProfile.readiness} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Guided checklist</p>
            <h3>Complete the recommended integration path</h3>
          </div>
          <p className="panel-copy">
            Focus on the steps below in order. The list changes depending on
            whether you are an API consumer, a data partner, or both.
          </p>
        </div>
        <ol className="ordered-list">
          {steps.map((step) => (
            <li key={step.title}>
              <Link className="inline-link" href={step.href}>
                {step.title}
              </Link>
              {" "}
              {step.description}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Address-first flow</p>
            <h3>Mirror the send verification sequence in your product</h3>
          </div>
          <p className="panel-copy">
            For address-first transfers, your UI should follow the same order
            as the Vervet dashboard: choose asset, choose network, paste the
            wallet address, optionally narrow by recipient platform, then show
            recipient confirmation and transfer safety before final send.
          </p>
        </div>
        <ol className="ordered-list">
          <li>Choose the transfer corridor, for example `USDC on Base`.</li>
          <li>Ask the sender to paste the recipient wallet address as soon as the corridor is known.</li>
          <li>Optionally load `/v1/platforms` filtered by corridor and lookup mode to help the sender narrow the recipient platform.</li>
          <li>Call Vervet without `platform` if the sender does not know it yet.</li>
          <li>If Vervet returns multiple candidate platforms, ask the sender to choose the intended platform and rerun confirmation.</li>
          <li>Show recipient confirmation, disclosure mode, and safety recommendation before the final send action.</li>
        </ol>
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <span>Partner playbooks</span>
          <strong>Choose the right operating focus</strong>
          <div className="detail-list">
            <div className="stacked-cell">
              <strong>API consumer</strong>
              <span>Prioritize API keys, sandbox calls, resolution logs, and webhook subscriptions.</span>
            </div>
            <div className="stacked-cell">
              <strong>Data partner</strong>
              <span>Prioritize signing keys, recipient and destination mapping, attestation ingestion, and feed health.</span>
            </div>
            <div className="stacked-cell">
              <strong>Combined partner</strong>
              <span>Complete both the sender-side integration path and the data-partner trust path before production launch.</span>
            </div>
          </div>
        </article>

        <ProductionUpgradeCard metadata={metadata} partnerProfile={partnerProfile} />
      </section>
    </section>
  );
}
