import Link from "next/link";
import { redirect } from "next/navigation";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  fetchAuditLog,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const session = await requireDashboardSession();
  const { eventId } = await params;

  try {
    const auditLog = await fetchAuditLog(session.accessToken, eventId);
    const productionScope = extractProductionScope(auditLog.metadata);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Audit Event Detail"
          description="Inspect the actor, resource, and recorded metadata for a single event."
          eyebrow="Audit"
          actions={
            <Link className="secondary-button" href="/audit/logs">
              Back to audit log
            </Link>
          }
        />

        <section className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Event summary</p>
                <h3>{auditLog.action}</h3>
              </div>
            </div>
            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Actor</span>
                <strong>{auditLog.actorIdentifier ?? auditLog.actorType}</strong>
              </div>
              <div className="metadata-row">
                <span>Resource</span>
                <strong>{`${auditLog.entityType} · ${auditLog.entityId}`}</strong>
              </div>
              <div className="metadata-row">
                <span>Timestamp</span>
                <strong>{formatDateTime(auditLog.createdAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Summary</span>
                <strong>{auditLog.summary ?? "No summary"}</strong>
              </div>
            </div>
          </section>

          {productionScope ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Production scope</p>
                  <h3>Corridor history</h3>
                </div>
              </div>
              <div className="detail-list">
                {productionScope.requested.length > 0 ? (
                  <div className="stacked-cell">
                    <strong>Requested corridors</strong>
                    <span>{productionScope.requested.join(", ")}</span>
                  </div>
                ) : null}
                {productionScope.approved.length > 0 ? (
                  <div className="stacked-cell">
                    <strong>Approved corridors</strong>
                    <span>{productionScope.approved.join(", ")}</span>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </section>

        <JsonPreviewPanel title="Event metadata" value={auditLog.metadata} />
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
          title="Audit event unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function extractProductionScope(metadata: unknown):
  | {
      requested: string[];
      approved: string[];
    }
  | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as {
    requestedCorridors?: unknown;
    approvedCorridors?: unknown;
  };
  const requested = readCorridorLabels(record.requestedCorridors);
  const approved = readCorridorLabels(record.approvedCorridors);

  if (requested.length === 0 && approved.length === 0) {
    return null;
  }

  return {
    requested,
    approved,
  };
}

function readCorridorLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const corridor = entry as {
      chain?: unknown;
      asset?: unknown;
    };

    if (typeof corridor.chain !== "string" || typeof corridor.asset !== "string") {
      return [];
    }

    return [`${corridor.chain} / ${corridor.asset}`];
  });
}
