import { DataPartnerIngestionGuide } from "@/components/data-partner-ingestion-guide";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FeedHealthCard } from "@/components/feed-health-card";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import {
  formatConstantLabel,
  formatDateTime,
  truncateMiddle,
} from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchDataFeedHealth,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  humanizeDashboardError,
  type DataFeedHealthRecord,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function DataFeedHealthPage() {
  const session = await requireDashboardSession();

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);

    if (!canAccessModule(partnerProfile, "data_feed")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Data Feed Health"
            description="Feed-health monitoring is available to data partners and attestation-enabled organizations."
            eyebrow="Data feed"
          />
          <ModuleAvailabilityBanner
            title="Data feed health is unavailable"
            description="Complete data partner onboarding to monitor stale trust objects, delivery failures, and production feed readiness."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const [dataFeedHealth, metadata] = await Promise.all([
      fetchDataFeedHealth(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    const recentFailureRows = buildRecentFailureRows(dataFeedHealth);
    const isWaitingForFirstAttestation =
      dataFeedHealth.metrics.activeAttestationCount === 0 &&
      dataFeedHealth.metrics.recentIngestionSuccessCount7d === 0;

    return (
      <section className="panel-stack">
        <PageHeader
          title="Data Feed Health"
          description="Monitor corridor freshness, attestation ingestion activity, and downstream event failures for the trust data your organization contributes into Vervet."
          eyebrow="Data feed"
          actions={
            <div className="page-header-actions">
              <Link className="secondary-button" href="/recipients">
                Open Recipients
              </Link>
              <Link className="secondary-button" href="/attestations">
                Review Attestations
              </Link>
              <Link className="secondary-button" href="/webhooks/deliveries">
                Delivery Failures
              </Link>
            </div>
          }
        />

        {isWaitingForFirstAttestation ? (
          <DataPartnerIngestionGuide
            guide={metadata.guidance.dataSubmission}
            eyebrow="First attestation"
            title="Waiting for your first signed trust update"
          />
        ) : null}

        <section className="context-grid">
          <FeedHealthCard dataFeedHealth={dataFeedHealth} title="Current feed status" />
          <article className="context-card">
            <p className="eyebrow">Environment</p>
            <strong>{formatConstantLabel(dataFeedHealth.feed.environment)}</strong>
            <div className="chip-row">
              <StatusBadge status={dataFeedHealth.feed.status} />
            </div>
            <span>
              Stage: {formatConstantLabel(dataFeedHealth.feed.onboardingStage)}
            </span>
            <span>{dataFeedHealth.feed.statusLabel}</span>
          </article>
        </section>

        <section className="summary-grid">
          <SummaryCard
            label="Active destinations"
            value={dataFeedHealth.metrics.activeDestinationCount}
          />
          <SummaryCard
            label="Active attestations"
            value={dataFeedHealth.metrics.activeAttestationCount}
          />
          <SummaryCard
            label="Successful ingestions (7d)"
            value={dataFeedHealth.metrics.recentIngestionSuccessCount7d}
          />
          <SummaryCard
            label="Failed ingestions (7d)"
            value={dataFeedHealth.metrics.recentIngestionFailureCount7d}
          />
          <SummaryCard
            label="Degraded corridors"
            value={dataFeedHealth.metrics.degradedCorridorCount}
          />
          <SummaryCard
            label="Disconnected corridors"
            value={dataFeedHealth.metrics.disconnectedCorridorCount}
          />
          <SummaryCard
            label="Stale destinations"
            value={dataFeedHealth.metrics.staleDestinationCount}
            hint={`Older than ${dataFeedHealth.freshness.destinationFreshnessWindowDays} days or nearing expiry`}
          />
          <SummaryCard
            label="Stale attestations"
            value={dataFeedHealth.metrics.staleAttestationCount}
            hint={`Expiring within ${dataFeedHealth.freshness.attestationExpiryWindowDays} days`}
          />
          <SummaryCard
            label="Failed deliveries (7d)"
            value={dataFeedHealth.metrics.failedDeliveryCount7d}
          />
          <SummaryCard
            label="Delivery success rate"
            value={`${dataFeedHealth.metrics.deliverySuccessRate7d}%`}
          />
        </section>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Freshness overview</p>
                <h3>Trust data checkpoints</h3>
              </div>
            </div>
            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Last attestation received</span>
                <strong>{formatDateTime(dataFeedHealth.feed.lastAttestationReceivedAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Last revocation received</span>
                <strong>{formatDateTime(dataFeedHealth.feed.lastRevocationReceivedAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Pending deliveries</span>
                <strong>{dataFeedHealth.metrics.pendingDeliveryCount}</strong>
              </div>
              <div className="metadata-row">
                <span>Production-granted corridors</span>
                <strong>
                  {dataFeedHealth.corridors.filter((corridor) => corridor.productionGranted)
                    .length}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recommended actions</p>
                <h3>Next steps for feed reliability</h3>
              </div>
            </div>
            {dataFeedHealth.recommendedActions.length === 0 ? (
              <EmptyState
                title="No urgent actions"
                description="Your contributed trust data is not currently showing actionable feed-health issues."
              />
            ) : (
              <div className="attention-stack">
                {dataFeedHealth.recommendedActions.map((action) => (
                  <article className="attention-card" key={action.key}>
                    <strong>{action.title}</strong>
                    <span>{action.description}</span>
                    <div className="table-actions">
                      <Link className="secondary-button" href={action.href}>
                        Open
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Corridor health</p>
              <h3>Freshness and coverage by asset-network corridor</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "corridor", label: "Corridor" },
              { key: "status", label: "Status" },
              { key: "production", label: "Production" },
              { key: "coverage", label: "Coverage" },
              { key: "ingestion", label: "Ingestion (7d)" },
              { key: "lastAttestation", label: "Last attestation" },
            ]}
            emptyState={
              <EmptyState
                title="No corridor health yet"
                description="Corridor health will appear once the first destinations, attestations, or production corridor grants exist for this organization."
              />
            }
            rows={dataFeedHealth.corridors.map((corridor) => ({
              key: corridor.assetNetworkId,
              cells: [
                <div className="stacked-cell" key={`${corridor.assetNetworkId}-corridor`}>
                  <strong>{`${corridor.chainDisplayName} · ${corridor.asset}`}</strong>
                  <span>
                    {corridor.contractAddress
                      ? truncateMiddle(corridor.contractAddress, 10)
                      : corridor.assetDisplayName}
                  </span>
                </div>,
                <div className="stacked-cell" key={`${corridor.assetNetworkId}-status`}>
                  <StatusBadge status={corridor.status} />
                  <span>{corridor.statusLabel}</span>
                </div>,
                corridor.productionGranted ? "Granted" : "Not granted",
                <div className="stacked-cell" key={`${corridor.assetNetworkId}-coverage`}>
                  <strong>
                    {corridor.activeDestinationCount} destinations ·{" "}
                    {corridor.verifiedAttestationCount} attestations
                  </strong>
                  <span>
                    {corridor.staleDestinationCount} stale destinations ·{" "}
                    {corridor.staleAttestationCount} stale attestations
                  </span>
                </div>,
                String(corridor.recentIngestionCount7d),
                <div className="stacked-cell" key={`${corridor.assetNetworkId}-last`}>
                  <strong>{formatDateTime(corridor.lastAttestationReceivedAt)}</strong>
                  <span>
                    Last revocation {formatDateTime(corridor.lastRevocationReceivedAt)}
                  </span>
                </div>,
              ],
            }))}
          />
        </section>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Ingestion history</p>
                <h3>Recent attestation ingestion activity</h3>
              </div>
            </div>

            <DataTable
              columns={[
                { key: "time", label: "Time" },
                { key: "attestation", label: "Attestation" },
                { key: "route", label: "Chain / Asset" },
                { key: "recipient", label: "Recipient" },
                { key: "status", label: "Status" },
              ]}
              emptyState={
                <EmptyState
                  title="No ingestion activity yet"
                  description="Successful attestation ingestions will appear here once the first trust updates are accepted."
                />
              }
              rows={dataFeedHealth.ingestion.recentActivity.map((record) => ({
                key: record.id,
                cells: [
                  formatDateTime(record.occurredAt),
                  <div className="stacked-cell" key={`${record.id}-attestation`}>
                    <strong>
                      {record.attestationType
                        ? formatConstantLabel(record.attestationType)
                        : "Attestation"}
                    </strong>
                    <span>{record.summary ?? "Accepted attestation ingestion."}</span>
                  </div>,
                  record.chain && record.asset
                    ? `${record.chain} · ${record.asset}`
                    : "No corridor context",
                  record.recipientIdentifier ?? "No recipient",
                  <StatusBadge key={`${record.id}-status`} status={record.status} />,
                ],
              }))}
            />
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Failure history</p>
                <h3>Recent ingestion and event failures</h3>
              </div>
            </div>

            <DataTable
              columns={[
                { key: "time", label: "Time" },
                { key: "type", label: "Failure type" },
                { key: "context", label: "Context" },
                { key: "detail", label: "Detail" },
              ]}
              emptyState={
                <EmptyState
                  title="No recent failures"
                  description="Rejected ingestions, delivery failures, and webhook test failures will appear here when the feed needs operator attention."
                />
              }
              rows={recentFailureRows.map((failure) => ({
                key: failure.key,
                cells: [
                  formatDateTime(failure.occurredAt),
                  failure.type,
                  failure.context,
                  failure.detail,
                ],
              }))}
            />
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Stale destinations</p>
              <h3>Destinations needing refresh or replacement</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "recipient", label: "Recipient" },
              { key: "address", label: "Address" },
              { key: "route", label: "Chain / Asset" },
              { key: "lastAttested", label: "Last attested" },
              { key: "expires", label: "Expires" },
            ]}
            emptyState={
              <EmptyState
                title="No stale destinations"
                description="All active destinations are currently within the configured freshness window."
              />
            }
            rows={dataFeedHealth.freshness.staleDestinations.map((destination) => ({
              key: destination.id,
              cells: [
                <div className="stacked-cell" key={`${destination.id}-recipient`}>
                  <strong>{destination.recipientDisplayName}</strong>
                  <span>{destination.recipientIdentifier}</span>
                </div>,
                truncateMiddle(destination.address),
                `${destination.chain} · ${destination.asset}`,
                formatDateTime(destination.lastAttestedAt),
                formatDateTime(destination.expiresAt),
              ],
            }))}
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Stale attestations</p>
              <h3>Trust artifacts nearing expiry</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "recipient", label: "Recipient" },
              { key: "type", label: "Type" },
              { key: "route", label: "Chain / Asset" },
              { key: "status", label: "Status" },
              { key: "expires", label: "Expires" },
            ]}
            emptyState={
              <EmptyState
                title="No stale attestations"
                description="No verified or expired attestations are currently inside the review threshold."
              />
            }
            rows={dataFeedHealth.freshness.staleAttestations.map((attestation) => ({
              key: attestation.id,
              cells: [
                <div className="stacked-cell" key={`${attestation.id}-recipient`}>
                  <strong>{attestation.recipientDisplayName}</strong>
                  <span>{attestation.recipientIdentifier}</span>
                </div>,
                formatConstantLabel(attestation.attestationType),
                attestation.chain && attestation.asset
                  ? `${attestation.chain} · ${attestation.asset}`
                  : "Not applicable",
                <StatusBadge
                  key={`${attestation.id}-status`}
                  status={attestation.verificationStatus}
                />,
                formatDateTime(attestation.expiresAt),
              ],
            }))}
          />
        </section>
      </section>
    );
  } catch (error) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      redirect("/");
    }

    throw new Error(`Data feed health unavailable: ${humanizeDashboardError(error)}`);
  }
}

function buildRecentFailureRows(dataFeedHealth: DataFeedHealthRecord) {
  return [
    ...dataFeedHealth.ingestion.recentFailures.map((failure) => ({
      key: `ingestion-${failure.id}`,
      occurredAt: failure.occurredAt,
      type: "Ingestion failure",
      context: failure.chain && failure.asset
        ? `${failure.chain} · ${failure.asset}`
        : "No corridor context",
      detail: (
        <div className="stacked-cell">
          <strong>{failure.recipientIdentifier ?? "Unknown recipient"}</strong>
          <span>{failure.failureReason ?? failure.summary ?? "Attestation ingestion was rejected."}</span>
        </div>
      ),
    })),
    ...dataFeedHealth.deliveryFailures.map((failure) => ({
      key: `delivery-${failure.id}`,
      occurredAt: failure.lastAttemptAt ?? failure.nextAttemptAt ?? null,
      type: "Delivery failure",
      context: (
        <div className="stacked-cell">
          <strong>{formatConstantLabel(failure.eventType)}</strong>
          <span>{failure.attemptCount} attempts</span>
        </div>
      ),
      detail: (
        <div className="stacked-cell">
          <strong>{failure.endpointLabel}</strong>
          <span>{truncateMiddle(failure.endpointUrl, 14)}</span>
        </div>
      ),
    })),
    ...dataFeedHealth.eventHealth.webhookTestFailures.map((failure) => ({
      key: `test-${failure.id}`,
      occurredAt: failure.occurredAt,
      type: "Webhook test failure",
      context: "Endpoint test",
      detail: (
        <div className="stacked-cell">
          <strong>{failure.summary ?? "Webhook endpoint test failed."}</strong>
          <span>{failure.error ?? failure.endpointId}</span>
        </div>
      ),
    })),
  ]
    .sort((left, right) => {
      const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
      const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;

      return rightTime - leftTime;
    })
    .slice(0, 12);
}
