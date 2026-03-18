import Link from "next/link";
import { DataPartnerIngestionGuide } from "@/components/data-partner-ingestion-guide";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { OnboardingProgressCard } from "@/components/onboarding-progress-card";
import { PageHeader } from "@/components/page-header";
import { PartnerCapabilityBadge } from "@/components/partner-capability-badge";
import { ProductionReadinessCard } from "@/components/production-readiness-card";
import { SummaryCard } from "@/components/summary-card";
import {
  describeOnboardingAction,
  findOnboardingTaskDefinition,
} from "@/lib/dashboard-metadata";
import {
  type AvailableProductionCorridorRecord,
  canManageProductionApproval,
  isDataContributorEnabled,
  type PartnerDashboardMetadataRecord,
  type PartnerProductionApprovalRequestRecord,
  type PartnerProfileRecord,
} from "@/lib/vervet-api";
import type { DashboardFlash } from "@/lib/flash";
import { formatConstantLabel, formatDateTime } from "@/lib/format";

type ChecklistTask =
  | "create_api_key"
  | "register_signing_key"
  | "configure_webhook"
  | "run_sandbox_request"
  | "map_recipient_data"
  | "ingest_attestation_data"
  | "request_production_approval";

export function PartnerOnboardingHome({
  availableProductionCorridors,
  flash,
  metadata,
  partnerProfile,
  productionApprovalRequests,
}: {
  availableProductionCorridors: AvailableProductionCorridorRecord[];
  flash: DashboardFlash | null;
  metadata: Pick<PartnerDashboardMetadataRecord, "guidance" | "onboarding">;
  partnerProfile: PartnerProfileRecord;
  productionApprovalRequests: PartnerProductionApprovalRequestRecord[];
}) {
  const completed = partnerProfile.onboarding.completedTasks;
  const blocked = partnerProfile.onboarding.blockedTasks;
  const nextAction = partnerProfile.onboarding.nextRecommendedAction;
  const nextActionDefinition = findOnboardingTaskDefinition(metadata, nextAction);
  const checklist = buildChecklist(metadata, partnerProfile);
  const latestApprovalRequest = partnerProfile.productionApproval.latestRequest;
  const canManageApproval = canManageProductionApproval(
    partnerProfile.authenticatedUser?.role,
  );

  return (
    <main className="setup-shell">
      <section className="setup-panel">
        <PageHeader
          title="Setup"
          description="Track onboarding progress, unblock required configuration, and move your organization toward production readiness."
          eyebrow="Platform onboarding"
          actions={
            <div className="page-header-actions">
              <Link className="secondary-button" href="/overview">
                Back to Overview
              </Link>
              {nextAction && nextActionDefinition ? (
                <Link className="primary-button" href={nextActionDefinition.href}>
                  {nextActionDefinition.ctaLabel}
                </Link>
              ) : nextAction ? (
                <Link className="primary-button" href="/setup">
                  {partnerProfile.onboarding.nextRecommendedActionLabel}
                </Link>
              ) : null}
            </div>
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="context-grid">
          <article className="context-card">
            <p className="eyebrow">Organization</p>
            <strong>{partnerProfile.displayName}</strong>
            <div className="chip-row">
              <PartnerCapabilityBadge
                profileLabel={partnerProfile.capabilities.profileLabel}
              />
            </div>
            <span>{formatConstantLabel(partnerProfile.partnerType)}</span>
          </article>
          <OnboardingProgressCard onboarding={partnerProfile.onboarding} />
          <ProductionReadinessCard readiness={partnerProfile.readiness} />
        </section>

        <section className="summary-grid">
          <SummaryCard
            hint="Tracked onboarding checklist items"
            label="Completed tasks"
            value={completed.length}
          />
          <SummaryCard
            hint="Capability or readiness blockers"
            label="Blocked tasks"
            value={blocked.length}
          />
          <SummaryCard
            hint="Current org state"
            label="Stage"
            value={formatConstantLabel(partnerProfile.onboarding.stage)}
          />
          <SummaryCard
            hint="Latest approval workflow state"
            label="Production request"
            value={
              latestApprovalRequest
                ? formatConstantLabel(latestApprovalRequest.status)
                : "Not requested"
            }
          />
        </section>

        {isDataContributorEnabled(partnerProfile) ? (
          <DataPartnerIngestionGuide guide={metadata.guidance.dataSubmission} />
        ) : null}

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Production approval</p>
              <h3>Request review when the workspace is ready</h3>
            </div>
            <p className="panel-copy">
              Owners and admins can submit a production approval request once onboarding and readiness checks are satisfied.
            </p>
          </div>

          <div className="detail-grid">
            <article className="detail-card">
              <span>Current status</span>
              <strong>
                {latestApprovalRequest
                  ? formatConstantLabel(latestApprovalRequest.status)
                  : "No production request yet"}
              </strong>
              <div className="detail-list">
                {latestApprovalRequest ? (
                  <>
                    <div className="stacked-cell">
                      <strong>Requested</strong>
                      <span>{formatDateTime(latestApprovalRequest.requestedAt)}</span>
                    </div>
                    <div className="stacked-cell">
                      <strong>Requested by</strong>
                      <span>
                        {latestApprovalRequest.requestedByUser?.fullName ??
                          latestApprovalRequest.requestedByUser?.email ??
                          "Unknown"}
                      </span>
                    </div>
                    {latestApprovalRequest.reviewedAt ? (
                      <div className="stacked-cell">
                        <strong>Reviewed</strong>
                        <span>{formatDateTime(latestApprovalRequest.reviewedAt)}</span>
                      </div>
                    ) : null}
                    {latestApprovalRequest.reviewNote ? (
                      <div className="stacked-cell">
                        <strong>Review note</strong>
                        <span>{latestApprovalRequest.reviewNote}</span>
                      </div>
                    ) : null}
                    {latestApprovalRequest.requestedCorridors.length > 0 ? (
                      <div className="stacked-cell">
                        <strong>Requested scope</strong>
                        <span>
                          {latestApprovalRequest.requestedCorridors
                            .map((requestedCorridor) =>
                              formatAvailableCorridorLabel(
                                requestedCorridor.assetNetwork,
                              ),
                            )
                            .join(", ")}
                        </span>
                      </div>
                    ) : null}
                    {latestApprovalRequest.approvedCorridors.length > 0 ? (
                      <div className="stacked-cell">
                        <strong>Approved scope</strong>
                        <span>
                          {latestApprovalRequest.approvedCorridors
                            .map((approvedCorridor) =>
                              formatAvailableCorridorLabel(
                                approvedCorridor.assetNetwork,
                              ),
                            )
                            .join(", ")}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="stacked-cell">
                    <strong>Blocked reason</strong>
                    <span>{partnerProfile.productionApproval.blockedReasonDescription}</span>
                  </div>
                )}
              </div>
            </article>

            <article className="detail-card">
              <span>Approval actions</span>
              <strong>Move from sandbox to production</strong>
              <p className="panel-copy">
                Submit the request once setup is complete, then monitor the review status here.
              </p>

              {partnerProfile.productionApproval.canRequest && canManageApproval ? (
                <form
                  action="/setup/actions/request-production-approval"
                  className="console-form"
                  method="POST"
                >
                  <div className="field">
                    <span>Requested production corridors</span>
                    <div className="detail-list">
                      {availableProductionCorridors.length === 0 ? (
                        <div className="stacked-cell">
                          <strong>No corridors available</strong>
                          <span>
                            Corridor selection will appear here once Vervet has
                            registered active production asset networks.
                          </span>
                        </div>
                      ) : (
                        availableProductionCorridors.map((corridor) => (
                          <label className="field checkbox-field" key={corridor.id}>
                            <input
                              defaultChecked={false}
                              name="assetNetworkIds"
                              type="checkbox"
                              value={corridor.id}
                            />
                            <span>{formatAvailableCorridorLabel(corridor)}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <label className="field">
                    <span>Request note</span>
                    <textarea
                      name="requestNote"
                      placeholder="Share corridor scope, live launch plan, or reviewer context."
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Request production approval
                  </button>
                </form>
              ) : null}

              {partnerProfile.productionApproval.canCancel &&
              canManageApproval &&
              latestApprovalRequest ? (
                <form
                  action="/setup/actions/cancel-production-approval"
                  className="console-form"
                  method="POST"
                >
                  <input name="requestId" type="hidden" value={latestApprovalRequest.id} />
                  <button className="secondary-button" type="submit">
                    Cancel pending request
                  </button>
                </form>
              ) : null}

              {!partnerProfile.productionApproval.canRequest &&
              !partnerProfile.productionApproval.canCancel ? (
                <div className="detail-list">
                  <div className="stacked-cell">
                    <strong>Why actions are unavailable</strong>
                    <span>{partnerProfile.productionApproval.blockedReasonDescription}</span>
                  </div>
                </div>
              ) : null}
            </article>
          </div>

          {productionApprovalRequests.length > 0 ? (
            <div className="detail-list">
              {productionApprovalRequests.slice(0, 3).map((request) => (
                <div className="stacked-cell" key={request.id}>
                  <strong>
                    {formatConstantLabel(request.status)} ·{" "}
                    {formatDateTime(request.requestedAt)}
                  </strong>
                  <span>
                    {request.requestNote ??
                      request.reviewNote ??
                      "No request or review note was recorded."}
                  </span>
                  {request.requestedCorridors.length > 0 ? (
                    <span>
                      Corridors:{" "}
                      {request.requestedCorridors
                        .map((requestedCorridor) =>
                          formatAvailableCorridorLabel(requestedCorridor.assetNetwork),
                        )
                        .join(", ")}
                    </span>
                  ) : null}
                  {request.approvedCorridors.length > 0 ? (
                    <span>
                      Approved:{" "}
                      {request.approvedCorridors
                        .map((approvedCorridor) =>
                          formatAvailableCorridorLabel(
                            approvedCorridor.assetNetwork,
                          ),
                        )
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Production corridors</p>
              <h3>Approved production access by asset and network</h3>
            </div>
            <p className="panel-copy">
              Corridor access is granted after approval review. Production-live
              organizations can still remain blocked in specific corridors until
              Vervet grants them here.
            </p>
          </div>

          {partnerProfile.productionAccess.approvedCorridors.length === 0 ? (
            <article className="detail-card">
              <span>Current access</span>
              <strong>No active production corridors</strong>
              <p className="panel-copy">
                Your organization can request production approval now, but live
                traffic will stay restricted until at least one corridor is
                granted by Vervet.
              </p>
            </article>
          ) : (
            <div className="detail-grid">
              {partnerProfile.productionAccess.approvedCorridors.map((corridor) => (
                <article className="detail-card" key={corridor.id}>
                  <span>
                    {corridor.assetNetwork.chain.displayName} /{" "}
                    {corridor.assetNetwork.asset.symbol}
                  </span>
                  <strong>{formatCorridorLabel(corridor)}</strong>
                  <div className="detail-list">
                    <div className="stacked-cell">
                      <strong>Granted</strong>
                      <span>{formatDateTime(corridor.grantedAt)}</span>
                    </div>
                    <div className="stacked-cell">
                      <strong>Status</strong>
                      <span>{formatConstantLabel(corridor.status)}</span>
                    </div>
                    {corridor.note ? (
                      <div className="stacked-cell">
                        <strong>Admin note</strong>
                        <span>{corridor.note}</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Checklist</p>
              <h3>Complete the next required steps</h3>
            </div>
            <p className="panel-copy">
              The checklist adapts to your capability profile and current onboarding stage.
            </p>
          </div>

          <div className="setup-task-grid">
            {checklist.map((item) => (
              <article
                className={
                  item.state === "completed"
                    ? "setup-task-card is-completed"
                    : item.state === "blocked"
                      ? "setup-task-card is-blocked"
                      : "setup-task-card"
                }
                key={item.key}
              >
                <div className="setup-task-header">
                  <div className="stacked-cell">
                    <span>{item.index}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <span className="status-pill">
                    {item.state === "completed"
                      ? "Completed"
                      : item.state === "blocked"
                        ? "Blocked"
                        : "Pending"}
                  </span>
                </div>
                <p className="panel-copy">{item.description}</p>
                {item.href && item.cta ? (
                  <div className="table-actions">
                    <Link className="secondary-button" href={item.href}>
                      {item.cta}
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function buildChecklist(
  metadata: Pick<PartnerDashboardMetadataRecord, "onboarding">,
  profile: PartnerProfileRecord,
) {
  const tasks = [
    "create_api_key",
    "register_signing_key",
    "configure_webhook",
    "run_sandbox_request",
    "map_recipient_data",
    "ingest_attestation_data",
    "request_production_approval",
  ] as const satisfies readonly ChecklistTask[];

  return tasks
    .filter((task) => shouldIncludeTask(profile, task))
    .map((task, index) => {
      const completed = profile.onboarding.completedTasks.includes(task);
      const definition = findOnboardingTaskDefinition(metadata, task);

      if (!definition) {
        return null;
      }

      const blocked =
        definition.blockedBy !== null &&
        profile.onboarding.blockedTasks.includes(definition.blockedBy);

      return {
        key: task,
        index: `0${index + 1}`,
        title: describeOnboardingAction(metadata, task),
        description: definition.description,
        href: definition.href,
        cta: definition.ctaLabel,
        state: completed ? "completed" : blocked ? "blocked" : "pending",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function shouldIncludeTask(
  profile: PartnerProfileRecord,
  task: ChecklistTask,
) {
  switch (task) {
    case "register_signing_key":
    case "map_recipient_data":
    case "ingest_attestation_data":
      return isDataContributorEnabled(profile);
    case "request_production_approval":
      return !profile.capabilities.productionEnabled;
    case "run_sandbox_request":
      return profile.capabilities.sandboxEnabled;
    case "configure_webhook":
      return profile.capabilities.webhooksEnabled;
    default:
      return true;
  }
}

function formatCorridorLabel(
  corridor: PartnerProfileRecord["productionAccess"]["approvedCorridors"][number],
) {
  const contractAddress = corridor.assetNetwork.contractAddressRaw;

  if (!contractAddress) {
    return `${corridor.assetNetwork.asset.displayName} on ${corridor.assetNetwork.chain.displayName}`;
  }

  return `${corridor.assetNetwork.asset.displayName} on ${corridor.assetNetwork.chain.displayName} · ${contractAddress}`;
}

function formatAvailableCorridorLabel(
  corridor: AvailableProductionCorridorRecord,
) {
  const contractAddress = corridor.contractAddressRaw;

  if (!contractAddress) {
    return `${corridor.chain.displayName} / ${corridor.asset.displayName}`;
  }

  return `${corridor.chain.displayName} / ${corridor.asset.displayName} · ${contractAddress}`;
}
