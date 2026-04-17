import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SummaryCard } from "@/components/summary-card";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime, summarizeMetadata } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessScope,
  DashboardAuthError,
  fetchAuditLogs,
  fetchPartnerProfile,
  fetchPartnerSecuritySettings,
  humanizeDashboardError,
  type CredentialScope,
  type PartnerDefaultDisclosureMode,
  type PartnerRawVerificationRetentionMode,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const canWriteSecurity = canAccessScope(
    session.scopes as CredentialScope[],
    ["security:write"],
  );

  try {
    const [settings, recentActivity, partnerProfile] = await Promise.all([
      fetchPartnerSecuritySettings(session.accessToken),
      fetchAuditLogs(session.accessToken, { limit: 10 }),
      fetchPartnerProfile(session.accessToken),
    ]);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Security"
          description="Review session policy, credential hygiene, and recent sensitive actions."
          eyebrow="Keys & access"
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="summary-grid">
          <SummaryCard
            label="Session timeout"
            value={`${settings.sessionIdleTimeoutMinutes} min`}
          />
          <SummaryCard
            label="Rotation policy"
            value={`${settings.credentialRotationDays} days`}
          />
          <SummaryCard
            label="Disclosure default"
            value={formatDisclosureMode(
              settings.defaultDisclosureMode,
              settings.allowFullLabelDisclosure,
            )}
          />
          <SummaryCard
            hint="Raw verification request retention"
            label="Verification retention"
            value={formatRetentionMode(
              settings.rawVerificationRetentionMode,
              settings.rawVerificationRetentionHours,
            )}
          />
          <SummaryCard
            label="Audit exports"
            value={settings.encryptAuditExports ? "Encrypted" : "Plaintext"}
          />
          <SummaryCard
            label="Encrypted submission"
            value={settings.enableEncryptedSubmission ? "Enabled" : "Disabled"}
          />
          <SummaryCard
            hint={settings.customerKeyArn ?? "Platform-managed encryption"}
            label="Enterprise BYOK"
            value={
              settings.enterpriseByokEnabled
                ? settings.customerKeyStatus ?? "Configured"
                : "Not enabled"
            }
          />
          <SummaryCard
            label="MFA enforcement"
            value={settings.enforceMfa ? "Enabled" : "Disabled"}
          />
          <SummaryCard
            label="IP allowlist entries"
            value={settings.ipAllowlist.length}
          />
          <SummaryCard
            label="Production request"
            value={
              partnerProfile.productionApproval.latestRequest
                ? partnerProfile.productionApproval.latestRequest.status
                : "Not requested"
            }
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Readiness controls</p>
              <h3>Production state</h3>
            </div>
          </div>

          <div className="detail-list">
            <div className="stacked-cell">
              <strong>Current readiness</strong>
              <span>{partnerProfile.readiness.statusLabel}</span>
            </div>
            <div className="stacked-cell">
              <strong>Approval workflow</strong>
              <span>
                {partnerProfile.productionApproval.latestRequest
                  ? `Latest request: ${partnerProfile.productionApproval.latestRequest.status}`
                  : partnerProfile.productionApproval.blockedReasonDescription}
              </span>
            </div>
          </div>
          <div className="table-actions">
            <Link className="secondary-button" href="/setup">
              Open setup
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Policy settings</p>
              <h3>Partner defaults</h3>
            </div>
          </div>

          <form action="/access/actions/update-security" className="console-form" method="POST">
            <div className="console-grid">
              <label className="field">
                <span>Session idle timeout (minutes)</span>
                <input
                  defaultValue={settings.sessionIdleTimeoutMinutes}
                  name="sessionIdleTimeoutMinutes"
                  type="number"
                />
              </label>
              <label className="field">
                <span>Credential rotation (days)</span>
                <input
                  defaultValue={settings.credentialRotationDays}
                  name="credentialRotationDays"
                  type="number"
                />
              </label>
            </div>
            <div className="console-grid">
              <label className="field">
                <span>Default disclosure mode</span>
                <select
                  defaultValue={settings.defaultDisclosureMode}
                  name="defaultDisclosureMode"
                >
                  <option value="VERIFICATION_ONLY">Verification only</option>
                  <option value="MASKED_LABEL">Masked label</option>
                </select>
              </label>
              <label className="field">
                <span>Verification request retention</span>
                <select
                  defaultValue={settings.rawVerificationRetentionMode}
                  name="rawVerificationRetentionMode"
                >
                  <option value="NO_RETAIN">No retain</option>
                  <option value="SHORT_RETENTION">Short retention</option>
                  <option value="STANDARD_RETENTION">
                    Standard retention
                  </option>
                </select>
              </label>
            </div>
            <div className="console-grid">
              <label className="field">
                <span>Short retention window (hours)</span>
                <input
                  defaultValue={settings.rawVerificationRetentionHours}
                  max={720}
                  min={1}
                  name="rawVerificationRetentionHours"
                  type="number"
                />
              </label>
            </div>
            <span className="field-hint">
              Verification-only suppresses recipient labels. Masked-label keeps
              operator context without disclosing the full recipient name.
            </span>
            <label className="field">
              <span>IP allowlist</span>
              <textarea
                defaultValue={settings.ipAllowlist.join("\n")}
                name="ipAllowlist"
                placeholder="One CIDR per line"
              />
            </label>
            <label className="event-option">
              <input
                defaultChecked={settings.allowFullLabelDisclosure}
                disabled={!canWriteSecurity}
                name="allowFullLabelDisclosure"
                type="checkbox"
              />
              Allow full label disclosure for verified matches
            </label>
            <label className="event-option">
              <input
                defaultChecked={settings.enforceMfa}
                disabled={!canWriteSecurity}
                name="enforceMfa"
                type="checkbox"
              />
              Require MFA for partner users
            </label>
            <label className="event-option">
              <input
                defaultChecked={settings.encryptAuditExports}
                disabled={!canWriteSecurity}
                name="encryptAuditExports"
                type="checkbox"
              />
              Encrypt generated audit exports at rest
            </label>
            <label className="event-option">
              <input
                defaultChecked={settings.enableEncryptedSubmission}
                disabled={!canWriteSecurity}
                name="enableEncryptedSubmission"
                type="checkbox"
              />
              Allow encrypted submission envelopes on resolution APIs
            </label>
            <div className="detail-card">
              <span>Enterprise BYOK</span>
              <strong>
                {settings.enterpriseByokEnabled
                  ? settings.customerKeyStatus ?? "Configured"
                  : "Not enabled"}
              </strong>
              <span>
                {settings.customerKeyArn ??
                  "Customer-managed key integration is not configured for this partner."}
              </span>
            </div>
            <button className="primary-button" disabled={!canWriteSecurity} type="submit">
              Save Security Settings
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent sensitive activity</p>
              <h3>Latest partner events</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "time", label: "Time" },
              { key: "action", label: "Action" },
              { key: "actor", label: "Actor" },
              { key: "context", label: "Context" },
            ]}
            emptyState={
              <EmptyState
                title="No recent security activity"
                description="Sensitive changes to keys, users, and settings will appear here."
              />
            }
            rows={recentActivity.map((event) => ({
              key: event.id,
              cells: [
                formatDateTime(event.createdAt),
                event.action,
                event.actorIdentifier ?? event.actorType,
                summarizeMetadata(event.metadata),
              ],
            }))}
          />
        </section>
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
          title="Security unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function formatDisclosureMode(
  mode: PartnerDefaultDisclosureMode,
  allowFullLabelDisclosure: boolean,
) {
  if (allowFullLabelDisclosure) {
    return "Full label allowed";
  }

  return mode === "MASKED_LABEL" ? "Masked label" : "Verification only";
}

function formatRetentionMode(
  mode: PartnerRawVerificationRetentionMode,
  retentionHours: number,
) {
  switch (mode) {
    case "NO_RETAIN":
      return "No retain";
    case "SHORT_RETENTION":
      return `${retentionHours}h`;
    case "STANDARD_RETENTION":
    default:
      return "Standard";
  }
}
