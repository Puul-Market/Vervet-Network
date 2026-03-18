import Link from "next/link";
import { AdminSetupEntryForm } from "@/components/admin-setup-entry-form";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { SummaryCard } from "@/components/summary-card";
import { adminSetupLogoutAction } from "@/app/session-actions";
import { formatConstantLabel, formatDateTime } from "@/lib/format";
import {
  type AdminSetupMetadataRecord,
  type AvailableProductionCorridorRecord,
  type AdminPartnerRecord,
  type AdminProductionApprovalRequestRecord,
} from "@/lib/vervet-api";
import type { DashboardFlash } from "@/lib/flash";

export function AdminSetupWorkspace({
  adminSessionActive,
  availableProductionCorridors,
  flash,
  metadata,
  partnerSlug,
  partners,
  productionApprovalRequests,
}: {
  adminSessionActive: boolean;
  availableProductionCorridors: AvailableProductionCorridorRecord[];
  flash: DashboardFlash | null;
  metadata: AdminSetupMetadataRecord | null;
  partnerSlug: string;
  partners: AdminPartnerRecord[];
  productionApprovalRequests: AdminProductionApprovalRequestRecord[];
}) {
  if (!adminSessionActive) {
    return (
      <main className="landing-shell">
        <section className="landing-panel">
          <div className="landing-grid">
            <div className="landing-copy">
              <p className="eyebrow">Admin setup</p>
              <h1>Bootstrap a partner into the network from the dashboard.</h1>
              <p className="lede">
                Use the admin setup token to create a partner, register the
                first public signing key, and create the first owner account for
                the operations console.
              </p>

              <div className="promise-grid">
                <article className="promise-card">
                  <span>01</span>
                  <h2>Create partner</h2>
                  <p>
                    Register the partner slug, display name, and type that will
                    anchor recipient identifiers.
                  </p>
                </article>
                <article className="promise-card">
                  <span>02</span>
                  <h2>Register key</h2>
                  <p>
                    Add the first signing key so the backend can verify
                    attestation payloads.
                  </p>
                </article>
                <article className="promise-card">
                  <span>03</span>
                  <h2>Create owner</h2>
                  <p>
                    Bootstrap the first human operator account for dashboard
                    access.
                  </p>
                </article>
              </div>
            </div>

            <div className="auth-stack">
              <AdminSetupEntryForm />
              <section className="auth-card admin-card">
                <div className="auth-copy">
                  <p className="eyebrow">Back to dashboard</p>
                  <h1>Return to partner sign-in.</h1>
                  <p className="lede">
                    If the partner already has an owner account, head back to
                    the main console and sign in there.
                  </p>
                </div>
                <Link className="secondary-button inverted-button" href="/">
                  Dashboard sign-in
                </Link>
              </section>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const selectedPartner =
    partners.find((partner) => partner.slug === partnerSlug) ?? partners[0] ?? null;
  const productionEnabledCount = partners.filter(
    (partner) => partner.capabilities.productionEnabled,
  ).length;
  const dataPartnerCount = partners.filter(
    (partner) =>
      partner.capabilities.dataPartnerEnabled ||
      partner.capabilities.fullAttestationPartnerEnabled,
  ).length;
  const grantedCorridorCount = partners.reduce(
    (count, partner) => count + partner.productionAccess.approvedCorridorCount,
    0,
  );
  const selectedPartnerGrantedCorridors =
    selectedPartner?.productionAccess.approvedCorridors ?? [];
  const grantableCorridors = availableProductionCorridors.filter(
    (corridor) =>
      !selectedPartnerGrantedCorridors.some(
        (grantedCorridor) => grantedCorridor.assetNetwork.id === corridor.id,
      ),
  );
  const adminOptions = metadata?.optionSets;

  return (
    <main className="setup-shell">
      <section className="setup-panel">
        <header className="panel panel-hero">
          <div>
            <p className="eyebrow">Admin setup</p>
            <h1>Internal partner review workspace</h1>
            <p className="panel-copy">
              Bootstrap new partners, review production approval requests, and
              control partner capabilities and readiness state without dropping
              to raw API calls.
            </p>
          </div>

          <div className="setup-actions">
            <div className="session-chip">
              <span>Admin session</span>
              <strong>Active</strong>
            </div>
            <form action={adminSetupLogoutAction}>
              <button className="secondary-button" type="submit">
                Disconnect setup
              </button>
            </form>
            <Link className="secondary-button" href="/">
              Back to sign-in
            </Link>
          </div>
        </header>

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="summary-grid">
          <SummaryCard
            hint="Organizations registered in this workspace"
            label="Partners"
            value={partners.length}
          />
          <SummaryCard
            hint="Approval requests waiting for review"
            label="Pending approvals"
            value={productionApprovalRequests.length}
          />
          <SummaryCard
            hint="Partners currently live in production"
            label="Production live"
            value={productionEnabledCount}
          />
          <SummaryCard
            hint="Organizations enabled to contribute trust data"
            label="Data-capable"
            value={dataPartnerCount}
          />
          <SummaryCard
            hint="Granted production asset-network corridors"
            label="Production corridors"
            value={grantedCorridorCount}
          />
        </section>

        <section className="setup-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Step 1</p>
                <h3>Create partner</h3>
              </div>
              <p className="panel-copy">
                This establishes the partner trust anchor used across
                identifiers, credentials, signing keys, and webhooks.
              </p>
            </div>

            <form
              action="/setup/actions/create-partner"
              className="endpoint-form"
              method="POST"
            >
              <label className="field">
                <span>Partner slug</span>
                <input
                  defaultValue={partnerSlug}
                  name="slug"
                  placeholder="bybit"
                  required
                  type="text"
                />
              </label>

              <label className="field">
                <span>Display name</span>
                <input name="displayName" placeholder="Bybit" required type="text" />
              </label>

              <label className="field">
                <span>Partner type</span>
                <select defaultValue="EXCHANGE" name="partnerType">
                  {(adminOptions?.partnerTypes ?? []).map((partnerType) => (
                    <option key={partnerType} value={partnerType}>
                      {formatConstantLabel(partnerType)}
                    </option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="submit">
                Create partner
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Step 2</p>
                <h3>Register initial signing key</h3>
              </div>
              <p className="panel-copy">
                This should be the public key for the signer that will produce
                attestation payloads for this partner.
              </p>
            </div>

            <form
              action="/setup/actions/register-signing-key"
              className="endpoint-form"
              method="POST"
            >
              <label className="field">
                <span>Partner slug</span>
                <input
                  defaultValue={selectedPartner?.slug ?? partnerSlug}
                  name="partnerSlug"
                  placeholder="bybit"
                  required
                  type="text"
                />
              </label>

              <label className="field">
                <span>Key identifier</span>
                <input name="keyId" placeholder="attest-key-v1" required type="text" />
              </label>

              <label className="field">
                <span>Algorithm</span>
                <select defaultValue="ED25519" name="algorithm">
                  {(adminOptions?.signingKeyAlgorithms ?? []).map((algorithm) => (
                    <option key={algorithm} value={algorithm}>
                      {algorithm}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Public key PEM</span>
                <textarea
                  name="publicKeyPem"
                  placeholder="-----BEGIN PUBLIC KEY-----"
                  required
                  rows={8}
                />
              </label>

              <div className="filter-grid">
                <label className="field">
                  <span>Valid from</span>
                  <input
                    defaultValue={buildDateTimeLocalValue()}
                    name="validFrom"
                    required
                    type="datetime-local"
                  />
                </label>

                <label className="field">
                  <span>Valid to</span>
                  <input name="validTo" type="datetime-local" />
                </label>
              </div>

              <button className="primary-button" type="submit">
                Register signing key
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Step 3</p>
                <h3>Create initial owner user</h3>
              </div>
              <p className="panel-copy">
                This owner account is the first human sign-in for the partner
                dashboard. API credentials can be created later from the Access
                screen for integrations.
              </p>
            </div>

            <form
              action="/setup/actions/create-owner-user"
              className="endpoint-form"
              method="POST"
            >
              <label className="field">
                <span>Partner slug</span>
                <input
                  defaultValue={selectedPartner?.slug ?? partnerSlug}
                  name="partnerSlug"
                  placeholder="bybit"
                  required
                  type="text"
                />
              </label>

              <label className="field">
                <span>Full name</span>
                <input name="fullName" placeholder="Jane Doe" required type="text" />
              </label>

              <label className="field">
                <span>Work email</span>
                <input
                  autoComplete="email"
                  name="email"
                  placeholder="ops@bybit.com"
                  required
                  type="email"
                />
              </label>

              <label className="field">
                <span>Temporary password</span>
                <input
                  autoComplete="new-password"
                  minLength={12}
                  name="password"
                  placeholder="At least 12 characters"
                  required
                  type="password"
                />
              </label>

              <button className="primary-button" type="submit">
                Create owner user
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Review queue</p>
                <h3>Pending production approvals</h3>
              </div>
              <p className="panel-copy">
                Approve or reject organizations that are requesting production
                activation.
              </p>
            </div>

            {productionApprovalRequests.length === 0 ? (
              <article className="detail-card">
                <span>Queue state</span>
                <strong>No pending production approvals</strong>
                <p className="panel-copy">
                  New approval requests will appear here as partner organizations
                  complete onboarding.
                </p>
              </article>
            ) : (
              <div className="panel-stack">
                {productionApprovalRequests.map((approvalRequest) => (
                  <article className="detail-card" key={approvalRequest.id}>
                    <span>{approvalRequest.partner.displayName}</span>
                    <strong>{approvalRequest.partner.slug}</strong>
                    <div className="detail-list">
                      <div className="stacked-cell">
                        <strong>Requested</strong>
                        <span>{formatDateTime(approvalRequest.requestedAt)}</span>
                      </div>
                      <div className="stacked-cell">
                        <strong>Requested by</strong>
                        <span>
                          {approvalRequest.requestedByUser?.fullName ??
                            approvalRequest.requestedByUser?.email ??
                            "Unknown"}
                        </span>
                      </div>
                      <div className="stacked-cell">
                        <strong>Partner state</strong>
                        <span>
                          {formatConstantLabel(approvalRequest.partner.status)} ·{" "}
                          {formatConstantLabel(
                            approvalRequest.partner.feedHealthStatus,
                          )}
                        </span>
                      </div>
                      {approvalRequest.requestNote ? (
                        <div className="stacked-cell">
                          <strong>Request note</strong>
                          <span>{approvalRequest.requestNote}</span>
                        </div>
                      ) : null}
                      {approvalRequest.requestedCorridors.length > 0 ? (
                        <div className="stacked-cell">
                          <strong>Requested corridors</strong>
                          <span>
                            {approvalRequest.requestedCorridors
                              .map((requestedCorridor) =>
                                formatAvailableCorridorLabel(
                                  requestedCorridor.assetNetwork,
                                ),
                              )
                              .join(", ")}
                          </span>
                        </div>
                      ) : null}
                      {approvalRequest.approvedCorridors.length > 0 ? (
                        <div className="stacked-cell">
                          <strong>Approved scope</strong>
                          <span>
                            {approvalRequest.approvedCorridors
                              .map((approvedCorridor) =>
                                formatAvailableCorridorLabel(
                                  approvedCorridor.assetNetwork,
                                ),
                              )
                              .join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <form
                      action="/setup/actions/review-production-approval"
                      className="console-form"
                      method="POST"
                    >
                      <input
                        name="partnerSlug"
                        type="hidden"
                        value={approvalRequest.partner.slug}
                      />
                      <input
                        name="requestId"
                        type="hidden"
                        value={approvalRequest.id}
                      />
                      <label className="field">
                        <span>Review note</span>
                        <textarea
                          name="reviewNote"
                          placeholder="Share approval scope or requested follow-up."
                        />
                      </label>
                      <label className="field">
                        <span>Approved production corridors</span>
                        <div className="detail-list">
                          {availableProductionCorridors.length === 0 ? (
                            <div className="stacked-cell">
                              <strong>No corridors available</strong>
                              <span>
                                Register active asset-network corridors before
                                approving production access.
                              </span>
                            </div>
                          ) : (
                            availableProductionCorridors.map((corridor) => (
                              <label
                                className="field checkbox-field"
                                key={`${approvalRequest.id}-${corridor.id}`}
                              >
                                <input
                                  defaultChecked={
                                    approvalRequest.requestedCorridors.some(
                                      (requestedCorridor) =>
                                        requestedCorridor.assetNetwork.id ===
                                        corridor.id,
                                    )
                                  }
                                  name="approvedAssetNetworkIds"
                                  type="checkbox"
                                  value={corridor.id}
                                />
                                <span>{formatAvailableCorridorLabel(corridor)}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </label>
                      <div className="page-header-actions">
                        <button
                          className="primary-button"
                          name="decision"
                          type="submit"
                          value="APPROVED"
                        >
                          Approve
                        </button>
                        <button
                          className="secondary-button"
                          name="decision"
                          type="submit"
                          value="REJECTED"
                        >
                          Reject
                        </button>
                      </div>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Partner roster</p>
              <h3>Manage partner capability and readiness state</h3>
            </div>
            <p className="panel-copy">
              Select a partner to review its current capabilities, onboarding
              stage, and feed-health posture.
            </p>
          </div>

          {partners.length === 0 ? (
            <article className="detail-card">
              <span>Partner state</span>
              <strong>No partners created yet</strong>
              <p className="panel-copy">
                Create a partner first to manage capability and readiness state.
              </p>
            </article>
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Type</th>
                      <th>Profile</th>
                      <th>Stage</th>
                      <th>Readiness</th>
                      <th>Latest request</th>
                      <th>Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((partner) => (
                      <tr key={partner.id}>
                        <td>
                          <div className="stacked-cell">
                            <strong>{partner.displayName}</strong>
                            <span>{partner.slug}</span>
                          </div>
                        </td>
                        <td>{formatConstantLabel(partner.partnerType)}</td>
                        <td>
                          {formatConstantLabel(partner.capabilities.profileLabel)}
                        </td>
                        <td>{formatConstantLabel(partner.onboarding.stage)}</td>
                        <td>{partner.readiness.statusLabel}</td>
                        <td>
                          {partner.latestProductionApprovalRequest
                            ? formatConstantLabel(
                                partner.latestProductionApprovalRequest.status,
                              )
                            : "None"}
                        </td>
                        <td>
                          <Link
                            className="secondary-button"
                            href={`/setup?partnerSlug=${partner.slug}`}
                          >
                            {selectedPartner?.id === partner.id ? "Selected" : "Manage"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedPartner ? (
                <div className="detail-grid">
                  <article className="detail-card">
                    <span>Selected partner</span>
                    <strong>{selectedPartner.displayName}</strong>
                    <div className="detail-list">
                      <div className="stacked-cell">
                        <strong>Slug</strong>
                        <span>{selectedPartner.slug}</span>
                      </div>
                      <div className="stacked-cell">
                        <strong>Type</strong>
                        <span>{formatConstantLabel(selectedPartner.partnerType)}</span>
                      </div>
                      <div className="stacked-cell">
                        <strong>Status</strong>
                        <span>{formatConstantLabel(selectedPartner.status)}</span>
                      </div>
                      <div className="stacked-cell">
                        <strong>Readiness</strong>
                        <span>{selectedPartner.readiness.statusLabel}</span>
                      </div>
                      <div className="stacked-cell">
                        <strong>Corridors</strong>
                        <span>
                          {selectedPartner.productionAccess.approvedCorridorCount} granted
                        </span>
                      </div>
                      <div className="stacked-cell">
                        <strong>Counts</strong>
                        <span>
                          {selectedPartner.counts.activeCredentialCount} keys ·{" "}
                          {selectedPartner.counts.activeSigningKeyCount} signers ·{" "}
                          {selectedPartner.counts.activeRecipientCount} recipients
                        </span>
                      </div>
                      {selectedPartner.latestProductionApprovalRequest
                        ?.requestedCorridors.length ? (
                        <div className="stacked-cell">
                          <strong>Latest requested scope</strong>
                          <span>
                            {selectedPartner.latestProductionApprovalRequest.requestedCorridors
                              .map((requestedCorridor) =>
                                formatAvailableCorridorLabel(
                                  requestedCorridor.assetNetwork,
                                ),
                              )
                              .join(", ")}
                          </span>
                        </div>
                      ) : null}
                      {selectedPartner.latestProductionApprovalRequest
                        ?.approvedCorridors.length ? (
                        <div className="stacked-cell">
                          <strong>Latest approved scope</strong>
                          <span>
                            {selectedPartner.latestProductionApprovalRequest.approvedCorridors
                              .map((approvedCorridor) =>
                                formatAvailableCorridorLabel(
                                  approvedCorridor.assetNetwork,
                                ),
                              )
                              .join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </article>

                  <article className="detail-card">
                    <span>Admin controls</span>
                    <strong>Update partner state</strong>
                    <p className="panel-copy">
                      Use these guarded controls to adjust capability flags and
                      readiness state. Production enablement still flows through
                      approval review.
                    </p>

                    <form
                      action="/setup/actions/update-partner-admin-state"
                      className="console-form"
                      method="POST"
                    >
                      <input name="partnerId" type="hidden" value={selectedPartner.id} />
                      <input
                        name="partnerSlug"
                        type="hidden"
                        value={selectedPartner.slug}
                      />

                      <div className="filter-grid">
                        <label className="field">
                          <span>Status</span>
                          <select defaultValue={selectedPartner.status} name="status">
                            {(adminOptions?.partnerStatuses ?? []).map((option) => (
                              <option key={option} value={option}>
                                {formatConstantLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span>Onboarding stage</span>
                          <select
                            defaultValue={selectedPartner.onboarding.stage}
                            name="onboardingStage"
                          >
                            {(adminOptions?.partnerOnboardingStages ?? []).map((option) => (
                              <option key={option} value={option}>
                                {formatConstantLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="field">
                          <span>Feed health</span>
                          <select
                            defaultValue={selectedPartner.readiness.feedHealthStatus}
                            name="feedHealthStatus"
                          >
                            {(adminOptions?.partnerFeedHealthStatuses ?? []).map((option) => (
                              <option key={option} value={option}>
                                {formatConstantLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="detail-grid">
                        <label className="field checkbox-field">
                          <input
                            defaultChecked={selectedPartner.capabilities.apiConsumerEnabled}
                            name="apiConsumerEnabled"
                            type="checkbox"
                          />
                          <span>API consumer enabled</span>
                        </label>
                        <label className="field checkbox-field">
                          <input
                            defaultChecked={selectedPartner.capabilities.dataPartnerEnabled}
                            name="dataPartnerEnabled"
                            type="checkbox"
                          />
                          <span>Data partner enabled</span>
                        </label>
                        <label className="field checkbox-field">
                          <input
                            defaultChecked={
                              selectedPartner.capabilities
                                .fullAttestationPartnerEnabled
                            }
                            name="fullAttestationPartnerEnabled"
                            type="checkbox"
                          />
                          <span>Full attestation enabled</span>
                        </label>
                        <label className="field checkbox-field">
                          <input
                            defaultChecked={selectedPartner.capabilities.webhooksEnabled}
                            name="webhooksEnabled"
                            type="checkbox"
                          />
                          <span>Webhooks enabled</span>
                        </label>
                        <label className="field checkbox-field">
                          <input
                            defaultChecked={
                              selectedPartner.capabilities
                                .batchVerificationEnabled
                            }
                            name="batchVerificationEnabled"
                            type="checkbox"
                          />
                          <span>Batch verification enabled</span>
                        </label>
                        <label className="field checkbox-field">
                          <input
                            defaultChecked={
                              selectedPartner.capabilities.auditExportsEnabled
                            }
                            name="auditExportsEnabled"
                            type="checkbox"
                          />
                          <span>Audit exports enabled</span>
                        </label>
                        <label className="field checkbox-field">
                          <input
                            defaultChecked={selectedPartner.capabilities.sandboxEnabled}
                            name="sandboxEnabled"
                            type="checkbox"
                          />
                          <span>Sandbox enabled</span>
                        </label>
                      </div>

                      <button className="primary-button" type="submit">
                        Update partner state
                      </button>
                    </form>
                  </article>

                  <article className="detail-card">
                    <span>Production corridor controls</span>
                    <strong>Grant or revoke corridor access</strong>
                    <p className="panel-copy">
                      Production approval is org-wide, but live access is now
                      corridor-scoped. Use these controls to grant or revoke
                      asset-network access after review.
                    </p>

                    {selectedPartnerGrantedCorridors.length === 0 ? (
                      <div className="detail-list">
                        <div className="stacked-cell">
                          <strong>Current state</strong>
                          <span>No corridors granted yet.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="detail-list">
                        {selectedPartnerGrantedCorridors.map((corridor) => (
                          <div className="stacked-cell" key={corridor.id}>
                            <strong>{formatGrantedCorridorLabel(corridor)}</strong>
                            <span>
                              Granted {formatDateTime(corridor.grantedAt)}
                              {corridor.note ? ` · ${corridor.note}` : ""}
                            </span>
                            <form
                              action="/setup/actions/update-production-corridor"
                              className="table-actions"
                              method="POST"
                            >
                              <input
                                name="partnerId"
                                type="hidden"
                                value={selectedPartner.id}
                              />
                              <input
                                name="partnerSlug"
                                type="hidden"
                                value={selectedPartner.slug}
                              />
                              <input
                                name="assetNetworkId"
                                type="hidden"
                                value={corridor.assetNetwork.id}
                              />
                              <input name="enabled" type="hidden" value="false" />
                              <button className="secondary-button" type="submit">
                                Revoke corridor
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      action="/setup/actions/update-production-corridor"
                      className="console-form"
                      method="POST"
                    >
                      <input name="partnerId" type="hidden" value={selectedPartner.id} />
                      <input
                        name="partnerSlug"
                        type="hidden"
                        value={selectedPartner.slug}
                      />
                      <input name="enabled" type="hidden" value="true" />

                      <label className="field">
                        <span>Grant corridor</span>
                        <select
                          defaultValue=""
                          name="assetNetworkId"
                          disabled={grantableCorridors.length === 0}
                        >
                          <option value="">
                            {grantableCorridors.length === 0
                              ? "All available corridors are already granted"
                              : "Select an asset-network corridor"}
                          </option>
                          {grantableCorridors.map((corridor) => (
                            <option key={corridor.id} value={corridor.id}>
                              {formatAvailableCorridorLabel(corridor)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Admin note</span>
                        <textarea
                          name="note"
                          placeholder="Optional corridor scope or launch note."
                        />
                      </label>

                      <button
                        className="primary-button"
                        disabled={grantableCorridors.length === 0}
                        type="submit"
                      >
                        Grant corridor
                      </button>
                    </form>
                  </article>
                </div>
              ) : null}
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function buildDateTimeLocalValue(): string {
  return new Date().toISOString().slice(0, 16);
}

function formatGrantedCorridorLabel(
  corridor: AdminPartnerRecord["productionAccess"]["approvedCorridors"][number],
) {
  return `${corridor.assetNetwork.chain.displayName} / ${corridor.assetNetwork.asset.symbol}`;
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
