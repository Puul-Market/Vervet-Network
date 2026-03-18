import Link from "next/link";
import { redirect } from "next/navigation";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  formatConstantLabel,
  formatDateTime,
  formatDisclosureMode,
  formatResolutionQueryType,
} from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  fetchResolutionLog,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function ResolutionLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireDashboardSession();
  const { id } = await params;

  try {
    const log = await fetchResolutionLog(session.accessToken, id);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Log Detail"
          description="Inspect the request, response, resolved entities, lookup direction, and disclosure policy for a single lookup."
          eyebrow="Resolution"
          actions={
            <Link className="secondary-button" href="/resolution/logs">
              Back to logs
            </Link>
          }
        />

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Summary</p>
                <h3>{log.recipientIdentifierInput}</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Lookup type</span>
                <strong>{formatResolutionQueryType(log.queryType)}</strong>
              </div>
              <div className="metadata-row">
                <span>Lookup direction</span>
                <strong>{formatConstantLabel(log.lookupDirection)}</strong>
              </div>
              <div className="metadata-row">
                <span>Platform</span>
                <strong>{log.platformInput ?? "Not provided"}</strong>
              </div>
              <div className="metadata-row">
                <span>Chain / Asset</span>
                <strong>{`${log.chainInput} / ${log.assetInput}`}</strong>
              </div>
              <div className="metadata-row">
                <span>Requested</span>
                <strong>{formatDateTime(log.requestedAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Responded</span>
                <strong>{formatDateTime(log.respondedAt)}</strong>
              </div>
            </div>

            <div className="chip-row">
              <StatusBadge status={log.outcome} />
              <RiskBadge riskLevel={log.riskLevel} />
            </div>

            <div className="stacked-cell">
              <strong>Recommendation</strong>
              <span>{log.recommendation ?? "No recommendation provided"}</span>
              <span>{formatDisclosureMode(log.disclosureMode)}</span>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Resolved entities</p>
                <h3>Matched objects</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Recipient</span>
                <strong>{log.resolvedRecipient?.displayName ?? log.resolvedRecipient?.externalRecipientId ?? "Not resolved"}</strong>
              </div>
              <div className="metadata-row">
                <span>Identifier</span>
                <strong>{log.resolvedIdentifier?.rawValue ?? "Not resolved"}</strong>
              </div>
              <div className="metadata-row">
                <span>Destination</span>
                <strong>{log.resolvedDestination?.addressRaw ?? "Not resolved"}</strong>
              </div>
              <div className="metadata-row">
                <span>Attestation</span>
                <strong>{log.resolvedAttestation?.id ?? "Not resolved"}</strong>
              </div>
            </div>

            <div className="chip-row">
              {log.flags.length === 0 ? (
                <span className="event-chip">No risk flags</span>
              ) : (
                log.flags.map((flag) => (
                  <span className="event-chip" key={flag}>
                    {flag}
                  </span>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Risk signals</p>
              <h3>Why this decision was returned</h3>
            </div>
          </div>

          <div className="detail-list">
            {log.riskSignals.length === 0 ? (
              <p className="panel-copy">No explicit risk signals were recorded for this lookup.</p>
            ) : (
              log.riskSignals.map((signal, index) => (
                <article className="detail-card" key={`${signal.kind}-${index}`}>
                  <div className="stacked-cell">
                    <strong>{signal.kind}</strong>
                    <span>{formatDateTime(signal.createdAt)}</span>
                  </div>
                  <RiskBadge riskLevel={signal.severity} />
                  <pre className="inline-json">{JSON.stringify(signal.details, null, 2)}</pre>
                </article>
              ))
            )}
          </div>
        </section>

        <JsonPreviewPanel title="Request metadata" value={log.metadata} />
        <JsonPreviewPanel title="Response payload" value={log.responseData} />
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
          title="Resolution log unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
