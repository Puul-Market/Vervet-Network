import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { DataFeedHealthRecord } from "@/lib/vervet-api";
import { StatusBadge } from "./status-badge";

export function FeedHealthCard({
  actionHref,
  actionLabel,
  dataFeedHealth,
  title = "Data feed health",
}: {
  actionHref?: string;
  actionLabel?: string;
  dataFeedHealth: DataFeedHealthRecord;
  title?: string;
}) {
  return (
    <article className="context-card feed-health-card">
      <div className="feed-health-header">
        <div>
          <p className="eyebrow">Data feed</p>
          <strong>{title}</strong>
        </div>
        <StatusBadge status={dataFeedHealth.feed.status} />
      </div>

      <p className="panel-copy">{dataFeedHealth.feed.statusLabel}</p>

      <div className="feed-health-meta">
        <div className="metadata-row">
          <span>Last attestation</span>
          <strong>{formatDateTime(dataFeedHealth.feed.lastAttestationReceivedAt)}</strong>
        </div>
        <div className="metadata-row">
          <span>Last revocation</span>
          <strong>{formatDateTime(dataFeedHealth.feed.lastRevocationReceivedAt)}</strong>
        </div>
        <div className="metadata-row">
          <span>Stale destinations</span>
          <strong>{dataFeedHealth.metrics.staleDestinationCount}</strong>
        </div>
        <div className="metadata-row">
          <span>Ingestion failures (7d)</span>
          <strong>{dataFeedHealth.metrics.recentIngestionFailureCount7d}</strong>
        </div>
        <div className="metadata-row">
          <span>Corridors at risk</span>
          <strong>
            {dataFeedHealth.metrics.degradedCorridorCount +
              dataFeedHealth.metrics.disconnectedCorridorCount}
          </strong>
        </div>
      </div>

      {actionHref && actionLabel ? (
        <div className="table-actions">
          <Link className="secondary-button" href={actionHref}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
