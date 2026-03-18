import Link from "next/link";
import { FeedHealthCard } from "@/components/feed-health-card";
import { PageHeader } from "@/components/page-header";
import { ProductionUpgradeCard } from "@/components/production-upgrade-card";
import {
  fetchDataFeedHealth,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  isDataContributorEnabled,
} from "@/lib/vervet-api";
import { requireDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function WebhookDocsPage() {
  const session = await requireDashboardSession();
  const [partnerProfile, metadata] = await Promise.all([
    fetchPartnerProfile(session.accessToken),
    fetchPartnerDashboardMetadata(session.accessToken),
  ]);
  const dataFeedHealth = isDataContributorEnabled(partnerProfile)
    ? await fetchDataFeedHealth(session.accessToken)
    : null;

  return (
    <section className="panel-stack">
      <PageHeader
        title="Webhook Guide"
        description="Configure webhook endpoints, signature verification, replay handling, and partner-type-specific event delivery."
        eyebrow="Docs"
        actions={
          <div className="page-header-actions">
            <Link className="secondary-button" href="/webhooks">
              Open Webhooks
            </Link>
            <Link className="primary-button" href="/setup">
              Continue setup
            </Link>
          </div>
        }
      />

      <section className="detail-grid">
        <article className="detail-card">
          <span>Webhook modes</span>
          <strong>Use the right event path for your organization</strong>
          <div className="detail-list">
            <div className="stacked-cell">
              <strong>Query-side events</strong>
              <span>Resolution-focused partners should subscribe to sender-side delivery, verification, and lifecycle events.</span>
            </div>
            <div className="stacked-cell">
              <strong>Data-feed health events</strong>
              <span>Data partners should monitor delivery failures, revocations, and trust-state changes tied to contributed data.</span>
            </div>
          </div>
        </article>

        <ProductionUpgradeCard metadata={metadata} partnerProfile={partnerProfile} />
      </section>

      {dataFeedHealth ? (
        <FeedHealthCard
          actionHref="/data-feed-health"
          actionLabel="Open Data Feed Health"
          dataFeedHealth={dataFeedHealth}
          title="Feed delivery health"
        />
      ) : null}

      <section className="panel">
        <div className="detail-list">
          <article className="detail-card">
            <strong>1. Create a subscription</strong>
            <span>Register the endpoint URL and the event types you want to receive.</span>
          </article>
          <article className="detail-card">
            <strong>2. Store the signing secret</strong>
            <span>Secrets are only revealed once at creation or rotation time.</span>
          </article>
          <article className="detail-card">
            <strong>3. Verify the signature header</strong>
            <span>Use the per-endpoint secret to verify inbound delivery payloads.</span>
          </article>
          <article className="detail-card">
            <strong>4. Monitor delivery health</strong>
            <span>Use the Deliveries surface for retries, response codes, and failures.</span>
          </article>
          <article className="detail-card">
            <strong>5. Subscribe to resolution-aware events</strong>
            <span>Use event categories that reflect by-recipient, by-address, and trust-state changes.</span>
          </article>
          {dataFeedHealth ? (
            <article className="detail-card">
              <strong>6. Monitor feed-side failures</strong>
              <span>Use Data Feed Health to catch stale destinations, expiring attestations, and delivery failures before production issues escalate.</span>
            </article>
          ) : null}
        </div>

        <div className="table-actions">
          <Link className="secondary-button" href="/webhooks">
            Open Webhook Operations
          </Link>
          {dataFeedHealth ? (
            <Link className="secondary-button" href="/data-feed-health">
              Open Data Feed Health
            </Link>
          ) : null}
        </div>
      </section>
    </section>
  );
}
