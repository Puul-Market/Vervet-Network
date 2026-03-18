import Link from "next/link";
import { OnboardingProgressCard } from "@/components/onboarding-progress-card";
import { PageHeader } from "@/components/page-header";
import { PartnerCapabilityBadge } from "@/components/partner-capability-badge";
import { ProductionReadinessCard } from "@/components/production-readiness-card";
import { ProductionUpgradeCard } from "@/components/production-upgrade-card";
import {
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  isDataContributorEnabled,
} from "@/lib/vervet-api";
import { requireDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DocsHomePage() {
  const session = await requireDashboardSession();
  const [partnerProfile, metadata] = await Promise.all([
    fetchPartnerProfile(session.accessToken),
    fetchPartnerDashboardMetadata(session.accessToken),
  ]);
  const quickstartSteps = metadata.guidance.quickstartSteps.slice(0, 4);

  return (
    <section className="panel-stack">
      <PageHeader
        title="Docs"
        description="Partner-type-aware integration guides, API reference, disclosure policy guidance, and webhook setup for external platform teams."
        eyebrow="Developer enablement"
        actions={
          <div className="page-header-actions">
            <Link className="secondary-button" href="/setup">
              Continue setup
            </Link>
            <Link className="primary-button" href="/docs/quickstart">
              Open quickstart
            </Link>
          </div>
        }
      />

      <section className="context-grid">
        <article className="context-card">
          <p className="eyebrow">Recommended track</p>
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
          <span>Recommended next steps</span>
          <strong>Use the correct partner path</strong>
          <div className="detail-list">
            {quickstartSteps.map((step) => (
              <div className="stacked-cell" key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.description}</span>
              </div>
            ))}
          </div>
          <div className="table-actions">
            <Link className="primary-button" href="/docs/quickstart">
              Open guided quickstart
            </Link>
          </div>
        </article>

        <ProductionUpgradeCard metadata={metadata} partnerProfile={partnerProfile} />
      </section>

      <section className="detail-grid">
        {[
          {
            href: "/docs/quickstart",
            label: "Quickstart",
            copy: "Follow the recommended setup path for your partner type and readiness state.",
          },
          {
            href: "/docs/api",
            label: "API Reference",
            copy: "Browse the live Swagger surface and focus on the endpoints most relevant to your partner workflow.",
          },
          {
            href: "/resolution/by-address",
            label: "By Address Resolution",
            copy: "Understand reverse lookup, platform-qualified confirmation, and disclosure-aware responses.",
          },
          {
            href: "/resolution/by-recipient",
            label: "By Recipient Resolution",
            copy: "Resolve verified destinations from recipient identifiers, assets, and networks.",
          },
          ...(isDataContributorEnabled(partnerProfile)
            ? [
                {
                  href: "/data-feed-health",
                  label: "Data Feed Health",
                  copy: "Review stale destinations, expiring attestations, and webhook delivery issues before production use.",
                },
              ]
            : []),
          {
            href: "/docs/webhooks",
            label: "Webhook Guide",
            copy: "Configure endpoint signatures, delivery expectations, and query-side or feed-side webhook workflows.",
          },
          {
            href: "/docs/webhooks",
            label: "Disclosure Policy Guide",
            copy: "Review forward lookup, reverse lookup, and disclosure mode handling across trust surfaces.",
          },
          {
            href: "/sandbox",
            label: "Sandbox",
            copy: "Test by-recipient, by-address, verify-transfer, and batch flows with guided samples.",
          },
        ].map((entry) => (
          <Link
            className="detail-card detail-link-card"
            href={entry.href}
            key={`${entry.href}-${entry.label}`}
          >
            <span>{entry.label}</span>
            <strong>{entry.copy}</strong>
          </Link>
        ))}
      </section>
    </section>
  );
}
