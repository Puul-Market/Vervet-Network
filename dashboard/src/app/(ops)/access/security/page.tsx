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
          <SummaryCard label="MFA enforcement" value={settings.enforceMfa ? "Enabled" : "Disabled"} />
          <SummaryCard label="IP allowlist entries" value={settings.ipAllowlist.length} />
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
                defaultChecked={settings.enforceMfa}
                disabled={!canWriteSecurity}
                name="enforceMfa"
                type="checkbox"
              />
              Require MFA for partner users
            </label>
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
