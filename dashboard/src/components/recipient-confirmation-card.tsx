import { formatDisclosureMode } from "@/lib/format";
import { RiskBadge } from "./risk-badge";
import { StatusBadge } from "./status-badge";
import type { ConfirmRecipientResponseRecord, DisclosureMode } from "@/lib/vervet-api";

export function RecipientConfirmationCard({
  result,
}: {
  result: ConfirmRecipientResponseRecord;
}) {
  const destinationStatus = result.confirmed
    ? "SAFE_TO_SEND"
    : result.requiresPlatformSelection
      ? "AMBIGUOUS"
      : "DO_NOT_SEND";
  const summaryTitle = result.confirmed
    ? "Verified destination"
    : result.requiresPlatformSelection
      ? "Choose the recipient platform"
      : "Destination not confirmed";
  const summaryCopy = result.confirmed
    ? "Safe to send after the sender reviews this confirmation."
    : result.requiresPlatformSelection
      ? "Vervet found more than one valid platform for this address. Select the intended platform before allowing the transfer."
      : "Do not send until the destination is rechecked or resolved by recipient.";

  return (
    <article className="detail-card">
      <div className="result-summary">
        <div className="stacked-cell">
          <span>{summaryTitle}</span>
          <strong>{result.recipientDisplayName ?? "Recipient hidden by policy"}</strong>
          <span>{result.platform ?? "Platform unavailable"}</span>
        </div>
        <StatusBadge status={destinationStatus} />
      </div>

      <div className="metadata-grid">
        <div className="metadata-row">
          <span>Recipient platform</span>
          <strong>{result.platform ?? "Not yet selected"}</strong>
        </div>
        <div className="metadata-row">
          <span>Disclosure mode</span>
          <strong>{formatDisclosureMode(result.disclosureMode)}</strong>
        </div>
        <div className="metadata-row">
          <span>Recommendation</span>
          <strong>{summaryCopy}</strong>
        </div>
      </div>

      <RiskBadge riskLevel={result.riskLevel} />
      <p className="panel-copy">{result.recommendation}</p>
    </article>
  );
}

export function DisclosurePolicyBadge({
  disclosureMode,
}: {
  disclosureMode: DisclosureMode;
}) {
  return <span className="event-chip">{formatDisclosureMode(disclosureMode)}</span>;
}
