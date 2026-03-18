import { DisclosurePolicyBadge } from "./recipient-confirmation-card";
import type { DisclosureMode } from "@/lib/vervet-api";

export function ResolutionAvailabilityCard({
  byRecipient,
  byAddress,
  disclosureMode,
  platforms,
  currentLookupStatus,
}: {
  byRecipient: boolean;
  byAddress: boolean;
  disclosureMode: DisclosureMode;
  platforms: string[];
  currentLookupStatus?: "AVAILABLE" | "RESTRICTED" | "UNAVAILABLE";
}) {
  return (
    <article className="detail-card">
      <div className="stacked-cell">
        <strong>Resolution availability</strong>
        <span>{currentLookupStatus ?? "AVAILABLE"}</span>
      </div>

      <div className="chip-row">
        <span className="event-chip">
          By Recipient: {byRecipient ? "Enabled" : "Disabled"}
        </span>
        <span className="event-chip">
          By Address: {byAddress ? "Enabled" : "Disabled"}
        </span>
        <DisclosurePolicyBadge disclosureMode={disclosureMode} />
      </div>

      <div className="stacked-cell">
        <strong>Platform scope</strong>
        <span>{platforms.length > 0 ? platforms.join(", ") : "No platforms"}</span>
      </div>
    </article>
  );
}
