import { formatConstantLabel } from "@/lib/format";
import type { PartnerProfileRecord } from "@/lib/vervet-api";

export function PartnerCapabilityBadge({
  profileLabel,
}: {
  profileLabel: PartnerProfileRecord["capabilities"]["profileLabel"];
}) {
  return (
    <span className="event-chip capability-chip">
      {formatConstantLabel(profileLabel)}
    </span>
  );
}
