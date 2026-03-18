import { formatConstantLabel } from "@/lib/format";
import type { PartnerProfileRecord } from "@/lib/vervet-api";

export function ProductionReadinessCard({
  readiness,
}: {
  readiness: PartnerProfileRecord["readiness"];
}) {
  return (
    <article className="context-card">
      <p className="eyebrow">Readiness</p>
      <strong>{formatConstantLabel(readiness.environment)}</strong>
      <span>{readiness.statusLabel}</span>
      <span>Feed health: {formatConstantLabel(readiness.feedHealthStatus)}</span>
      <span>
        Production corridors: {readiness.approvedCorridorCount}
      </span>
    </article>
  );
}
