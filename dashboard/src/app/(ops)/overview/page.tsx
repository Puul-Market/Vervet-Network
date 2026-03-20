import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FeedHealthCard } from "@/components/feed-health-card";
import { PageHeader } from "@/components/page-header";
import { PartnerCapabilityBadge } from "@/components/partner-capability-badge";
import { RiskBadge } from "@/components/risk-badge";
import { SummaryCard } from "@/components/summary-card";
import {
  formatConstantLabel,
  formatCurrencyUsd,
  formatDateTime,
  formatInteger,
  formatResolutionQueryType,
} from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchDataFeedHealth,
  fetchPartnerProfile,
  fetchOverview,
  humanizeDashboardError,
  isDataContributorEnabled,
  shouldSurfaceOnboardingSetup,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await requireDashboardSession();

  try {
    const [overview, partnerProfile] = await Promise.all([
      fetchOverview(session.accessToken),
      fetchPartnerProfile(session.accessToken),
    ]);
    const dataFeedHealth = canAccessModule(partnerProfile, "data_feed")
      ? await fetchDataFeedHealth(session.accessToken)
      : null;
    const showSetupAction = shouldSurfaceOnboardingSetup(partnerProfile);
    const nextActionLabel = partnerProfile.onboarding.nextRecommendedActionLabel;

    return (
      <section className="panel-stack">
        <PageHeader
          title="Overview"
          description="Your verification activity, system health, and items that need attention — at a glance."
          eyebrow="Partner Operations"
          actions={
            <div className="page-header-actions">
              <Link className="primary-button" href="/resolution/by-address">
                By Address
              </Link>
              <Link className="secondary-button" href="/resolution/by-recipient">
                By Recipient
              </Link>
              <Link className="secondary-button" href="/resolution/verify-transfer">
                Verify Transfer
              </Link>
              <Link className="secondary-button" href="/access/plan-usage">
                Plan & Usage
              </Link>
              {dataFeedHealth ? (
                <Link className="secondary-button" href="/data-feed-health">
                  Data Feed Health
                </Link>
              ) : null}
              {showSetupAction ? (
                <Link className="secondary-button" href="/setup">
                  {nextActionLabel}
                </Link>
              ) : null}
            </div>
          }
        />

        <section className="context-grid">
          <article className="context-card">
            <p className="eyebrow">Capability profile</p>
            <strong>{partnerProfile.displayName}</strong>
            <div className="chip-row">
              <PartnerCapabilityBadge
                profileLabel={partnerProfile.capabilities.profileLabel}
              />
            </div>
            <span>
              {partnerProfile.capabilities.apiConsumerEnabled
                ? "API consumer enabled"
                : "API consumer disabled"}
              {" · "}
              {isDataContributorEnabled(partnerProfile)
                ? "Trust data enabled"
                : "Trust data disabled"}
            </span>
          </article>
          <article className="context-card">
            <p className="eyebrow">Plan & usage</p>
            <strong>{partnerProfile.billing.plan.label}</strong>
            <div className="chip-row">
              <span className="event-chip">
                {partnerProfile.billing.plan.monthlyBasePriceUsd === null
                  ? "Custom pricing"
                  : `${formatCurrencyUsd(
                      partnerProfile.billing.plan.monthlyBasePriceUsd,
                      { maximumFractionDigits: 0 },
                    )}/month`}
              </span>
            </div>
            <span>
              {formatInteger(partnerProfile.billing.usage.verificationsUsed)} used
              {" · "}
              {partnerProfile.billing.usage.includedVerifications === null
                ? "Unlimited included"
                : `${formatInteger(
                    partnerProfile.billing.usage.remainingIncludedVerifications,
                  )} remaining`}
            </span>
          </article>
          {dataFeedHealth ? (
            <FeedHealthCard
              actionHref="/data-feed-health"
              actionLabel="Open Data Feed Health"
              dataFeedHealth={dataFeedHealth}
              title="Feed health"
            />
          ) : null}
        </section>

        {partnerProfile.billing.plan.requirements.requirementStatus === "UNMET" ||
        partnerProfile.billing.usage.verificationLimitExceeded ? (
          <section className="panel panel-warning">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Plan attention</p>
                <h3>Commercial plan review recommended</h3>
              </div>
              <p className="panel-copy">
                {partnerProfile.billing.plan.requirements.requirementStatus ===
                "UNMET"
                  ? partnerProfile.billing.plan.requirements.requirementNote ??
                    "This pricing tier expects your organization to contribute attestation data for its own platform."
                  : `Included monthly volume has been exceeded. Projected overage is ${formatCurrencyUsd(
                      partnerProfile.billing.usage.projectedOverageUsd,
                    )}.`}
              </p>
            </div>
            <div className="page-header-actions">
              <Link className="primary-button" href="/access/plan-usage">
                Review Plan & Usage
              </Link>
              <Link className="secondary-button" href="/setup">
                Review setup
              </Link>
            </div>
          </section>
        ) : null}

        <section className="summary-grid">
          <SummaryCard
            label="Active recipients"
            value={overview.kpis.activeRecipients}
            hint="Live registry entries"
          />
          <SummaryCard
            label="Active destinations"
            value={overview.kpis.activeDestinations}
            hint="Currently usable endpoints"
          />
          <SummaryCard
            label="Active attestations"
            value={overview.kpis.activeAttestations}
            hint="Verified trust artifacts"
          />
          <SummaryCard
            label="By Recipient Requests (7d)"
            value={overview.kpis.byRecipientRequests7d}
            hint="Forward lookup activity"
          />
          <SummaryCard
            label="By Address Requests (7d)"
            value={overview.kpis.byAddressRequests7d}
            hint="Reverse lookup activity"
          />
          <SummaryCard
            label="Verify Transfer Requests (7d)"
            value={overview.kpis.verifyTransferRequests7d}
            hint="Safety decision activity"
          />
          <SummaryCard
            label="Blocked or high-risk"
            value={overview.kpis.blockedVerificationCount}
            hint="Needs operator review"
          />
          <SummaryCard
            label="Webhook failures"
            value={overview.kpis.webhookFailureCount}
            hint="Delivery issues in queue"
          />
          <SummaryCard
            label="Verifications this month"
            value={formatInteger(partnerProfile.billing.usage.verificationsUsed)}
            hint={`${partnerProfile.billing.plan.label} plan`}
          />
          <SummaryCard
            label="Projected overage"
            value={formatCurrencyUsd(partnerProfile.billing.usage.projectedOverageUsd)}
            hint={
              partnerProfile.billing.plan.overagePriceUsd === null
                ? "Custom billing"
                : `${formatCurrencyUsd(partnerProfile.billing.plan.overagePriceUsd)} above included volume`
            }
          />
          {dataFeedHealth ? (
            <SummaryCard
              label="Failed ingestions (7d)"
              value={dataFeedHealth.metrics.recentIngestionFailureCount7d}
              hint="Rejected trust updates"
            />
          ) : null}
          {dataFeedHealth ? (
            <SummaryCard
              label="Corridors at risk"
              value={
                dataFeedHealth.metrics.degradedCorridorCount +
                dataFeedHealth.metrics.disconnectedCorridorCount
              }
              hint="Degraded or disconnected corridors"
            />
          ) : null}
        </section>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Needs attention</p>
                <h3>Operational risk queue</h3>
              </div>
            </div>

            <div className="attention-stack">
              <div className="attention-card">
                <strong>High-risk verifications</strong>
                <span>{overview.attention.highRiskVerifications.length} recent requests</span>
              </div>
              <div className="attention-card">
                <strong>Revoked destinations</strong>
                <span>{overview.attention.revokedDestinations.length} destinations without replacement</span>
              </div>
              <div className="attention-card">
                <strong>Expiring attestations</strong>
                <span>{overview.attention.expiringAttestations.length} trust artifacts nearing expiry</span>
              </div>
              <div className="attention-card">
                <strong>Failed deliveries</strong>
                <span>{overview.attention.failedWebhookDeliveries.length} webhook attempts failed</span>
              </div>
              <div className="attention-card">
                <strong>Key changes</strong>
                <span>{overview.attention.recentKeyChanges.length} access changes recorded</span>
              </div>
              {dataFeedHealth ? (
                <div className="attention-card">
                  <strong>Ingestion failures</strong>
                  <span>
                    {dataFeedHealth.metrics.recentIngestionFailureCount7d} recent
                    rejected trust updates
                  </span>
                </div>
              ) : null}
              {dataFeedHealth ? (
                <div className="attention-card">
                  <strong>Corridors needing review</strong>
                  <span>
                    {dataFeedHealth.metrics.degradedCorridorCount +
                      dataFeedHealth.metrics.disconnectedCorridorCount} corridors
                    with degraded or disconnected health
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">System health</p>
                <h3>Runtime signals</h3>
              </div>
            </div>

            <div className="summary-grid compact-summary-grid">
              <SummaryCard
                label="Webhook success rate"
                value={formatPercentage(overview.health.webhookSuccessRate)}
              />
              <SummaryCard
                label="By Recipient success rate"
                value={formatPercentage(
                  overview.health.byRecipientResolutionSuccessRate,
                )}
              />
              <SummaryCard
                label="By Address success rate"
                value={formatPercentage(
                  overview.health.byAddressResolutionSuccessRate,
                )}
              />
              <SummaryCard
                label="Attestation freshness"
                value={formatPercentage(overview.health.attestationFreshnessScore)}
              />
              <SummaryCard
                label="Key rotation status"
                value={overview.health.keyRotationStatus}
              />
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h3>Latest partner-scoped events</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "time", label: "Time" },
              { key: "action", label: "Action" },
              { key: "resource", label: "Resource" },
              { key: "actor", label: "Actor" },
            ]}
            emptyState={
              <EmptyState
                title="No activity yet"
                description="Once you begin resolving recipients, rotating keys, or receiving attestations, activity will appear here."
                action={
                  <Link className="primary-button" href="/setup">
                    Continue setup
                  </Link>
                }
              />
            }
            rows={overview.recentActivity.map((event) => ({
              key: event.id,
              cells: [
                formatDateTime(event.createdAt),
                <div className="stacked-cell" key={`${event.id}-action`}>
                  <strong>{formatConstantLabel(event.action)}</strong>
                  <span>{event.summary ?? "No summary available"}</span>
                </div>,
                <div className="stacked-cell" key={`${event.id}-resource`}>
                  <strong>{formatConstantLabel(event.entityType)}</strong>
                  <span>{event.entityId}</span>
                </div>,
                `${formatConstantLabel(event.actorType)}${
                  event.actorIdentifier ? ` · ${event.actorIdentifier}` : ""
                }`,
              ],
            }))}
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">High-risk attempts</p>
              <h3>Verification results that need review</h3>
            </div>
            <Link className="secondary-button" href="/resolution/logs">
              View resolution logs
            </Link>
          </div>

          <DataTable
            columns={[
              { key: "time", label: "Time" },
              { key: "lookup", label: "Lookup Type" },
              { key: "platform", label: "Platform" },
              { key: "recipient", label: "Recipient" },
              { key: "route", label: "Chain / Asset" },
              { key: "risk", label: "Risk" },
              { key: "recommendation", label: "Recommendation" },
            ]}
            emptyState={
              <EmptyState
                title="No high-risk attempts"
                description="Recent verification traffic is currently landing without high-risk outcomes."
              />
            }
            rows={overview.attention.highRiskVerifications.map((entry) => ({
              key: entry.id,
              cells: [
                formatDateTime(entry.requestedAt),
                formatResolutionQueryType(entry.queryType),
                entry.platformInput ?? "—",
                entry.recipientIdentifierInput,
                `${entry.chainInput} / ${entry.assetInput}`,
                <div className="stacked-cell" key={`${entry.id}-risk`}>
                  <RiskBadge riskLevel={entry.riskLevel} />
                  <span>{entry.flags.map(formatConstantLabel).join(", ") || "No flags"}</span>
                </div>,
                <div className="stacked-cell" key={`${entry.id}-recommendation`}>
                  <strong>{formatConstantLabel(entry.recommendation ?? "review")}</strong>
                  <Link className="inline-link" href={`/resolution/logs/${entry.id}`}>
                    View log
                  </Link>
                </div>,
              ],
            }))}
          />
        </section>
      </section>
    );
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      redirect("/");
    }

    return (
      <section className="panel panel-error">
        <PageHeader
          title="Overview unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function formatPercentage(value: number | null): string {
  if (value === null) {
    return "Not available";
  }

  return `${Math.round(value * 100)}%`;
}
