import Link from "next/link";
import { formatConstantLabel, formatDateTime } from "@/lib/format";
import {
  type PartnerDashboardMetadataRecord,
  isDataContributorEnabled,
  type PartnerProfileRecord,
} from "@/lib/vervet-api";

export function ProductionUpgradeCard({
  metadata,
  partnerProfile,
}: {
  metadata: Pick<PartnerDashboardMetadataRecord, "guidance">;
  partnerProfile: PartnerProfileRecord;
}) {
  const steps = metadata.guidance.productionUpgradeSteps;

  return (
    <article className="detail-card">
      <span>Production upgrade</span>
      <strong>{metadata.guidance.journeyLabel}</strong>
      <p className="panel-copy">{metadata.guidance.journeySummary}</p>

      <div className="detail-list">
        <div className="stacked-cell">
          <strong>Current production request</strong>
          <span>
            {partnerProfile.productionApproval.latestRequest
              ? formatConstantLabel(
                  partnerProfile.productionApproval.latestRequest.status,
                )
              : "Not requested"}
          </span>
        </div>
        {partnerProfile.productionApproval.latestRequest ? (
          <div className="stacked-cell">
            <strong>Requested at</strong>
            <span>
              {formatDateTime(
                partnerProfile.productionApproval.latestRequest.requestedAt,
              )}
            </span>
          </div>
        ) : (
          <div className="stacked-cell">
            <strong>Next gating note</strong>
            <span>{partnerProfile.productionApproval.blockedReasonDescription}</span>
          </div>
        )}
      </div>

      <div className="detail-list">
        {steps.map((step) => (
          <div className="stacked-cell" key={step.title}>
            <strong>{step.title}</strong>
            <span>{step.description}</span>
          </div>
        ))}
      </div>

      <div className="table-actions">
        <Link className="primary-button" href="/setup">
          Continue setup
        </Link>
        {isDataContributorEnabled(partnerProfile) ? (
          <Link className="secondary-button" href="/data-feed-health">
            Review feed health
          </Link>
        ) : null}
      </div>
    </article>
  );
}
