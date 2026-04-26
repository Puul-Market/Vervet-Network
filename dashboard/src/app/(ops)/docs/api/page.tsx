import { DataPartnerIngestionGuide } from "@/components/data-partner-ingestion-guide";
import Link from "next/link";
import { ProductionUpgradeCard } from "@/components/production-upgrade-card";
import { PageHeader } from "@/components/page-header";
import {
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  isDataContributorEnabled,
} from "@/lib/vervet-api";
import { requireDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ApiDocsPage() {
  const session = await requireDashboardSession();
  const [partnerProfile, metadata] = await Promise.all([
    fetchPartnerProfile(session.accessToken),
    fetchPartnerDashboardMetadata(session.accessToken),
  ]);
  const apiBaseUrl =
    process.env.VERVET_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3000";
  const relevantEndpoints = [
    partnerProfile.capabilities.apiConsumerEnabled
      ? {
          title: "Resolution APIs",
          copy: "Use by-recipient, by-address, verify-transfer, and supported-platform endpoints to implement the corridor-first sender flow.",
          href: "/sandbox",
        }
      : null,
    isDataContributorEnabled(partnerProfile)
      ? {
          title: "Trust ingestion APIs",
          copy: "Use recipients, destinations, attestations, and data feed health to maintain trust data quality.",
          href: "/data-feed-health",
        }
      : null,
    {
      title: "Webhook APIs",
      copy: "Configure endpoint subscriptions and review delivery behavior alongside the live API surface.",
      href: "/docs/webhooks",
    },
  ].filter((entry) => entry !== null);

  return (
    <section className="panel-stack">
      <PageHeader
        title="API Reference"
        description={`Use the live backend OpenAPI surface for ${metadata.guidance.journeyLabel.toLowerCase()} request and response contracts.`}
        eyebrow="Docs"
        actions={
          <div className="page-header-actions">
            <Link className="secondary-button" href="/setup">
              Continue setup
            </Link>
            <a className="primary-button" href={`${apiBaseUrl}/docs`} rel="noreferrer" target="_blank">
              Open Swagger
            </a>
          </div>
        }
      />

      <section className="detail-grid">
        <article className="detail-card">
          <span>Relevant APIs</span>
          <strong>Focus on the endpoints that match your partner workflow</strong>
          <div className="detail-list">
            {relevantEndpoints.map((entry) => (
              <div className="stacked-cell" key={entry.title}>
                <strong>{entry.title}</strong>
                <span>{entry.copy}</span>
                <Link className="inline-link" href={entry.href}>
                  Open related workflow
                </Link>
              </div>
            ))}
          </div>
        </article>

        <ProductionUpgradeCard metadata={metadata} partnerProfile={partnerProfile} />
      </section>

      {isDataContributorEnabled(partnerProfile) ? (
        <DataPartnerIngestionGuide
          guide={metadata.guidance.dataSubmission}
          title="How data partners send trust data"
        />
      ) : null}

      <section className="panel">
        <p className="panel-copy">
          The dashboard reuses the same backend APIs documented in Swagger.
          Open the live reference, then use the team-managed API keys and
          signing keys from this console to integrate `By Recipient`,
          `By Address`, `Verify Transfer`, trust ingestion, and webhook flows.
        </p>
        <div className="detail-list">
          <div className="stacked-cell">
            <strong>Recommended sender-side order</strong>
            <span>
              First choose asset and network, then either fetch supported
              recipient platforms for that corridor or submit the pasted wallet
              address directly. If Vervet finds more than one plausible
              platform, ask the sender to choose the intended platform before
              final send.
            </span>
          </div>
          <div className="stacked-cell">
            <strong>Address-first API path</strong>
            <span>
              Optional `GET /v1/platforms?chain=...&asset=...&lookupMode=BY_ADDRESS`,
              then `POST /v1/resolution/by-address` with the address and
              corridor. Retry with `platform` only if the response asks for
              platform selection, then optionally call
              `POST /v1/resolution/verify-transfer`.
            </span>
          </div>
        </div>
        <div className="detail-list">
          <Link className="inline-link" href="/access/api-keys">
            Manage API keys
          </Link>
          <Link className="inline-link" href="/access/signing-keys">
            Manage signing keys
          </Link>
          <Link className="inline-link" href="/docs/webhooks">
            Read webhook guide
          </Link>
          {isDataContributorEnabled(partnerProfile) ? (
            <Link className="inline-link" href="/data-feed-health">
              Review data feed health
            </Link>
          ) : null}
        </div>
      </section>
    </section>
  );
}
