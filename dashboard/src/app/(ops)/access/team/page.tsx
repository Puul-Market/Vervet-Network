import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessScope,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerUsers,
  humanizeDashboardError,
  type CredentialScope,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const canWriteTeam = canAccessScope(
    session.scopes as CredentialScope[],
    ["team:write"],
  );

  try {
    const metadata = await fetchPartnerDashboardMetadata(session.accessToken);
    const { invites, users } = await fetchPartnerUsers(session.accessToken);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Team"
          description="Manage who can access the dashboard and what they can do."
          eyebrow="Keys & access"
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="summary-grid">
          <SummaryCard label="Active users" value={users.length} />
          <SummaryCard label="Pending invites" value={invites.filter((invite) => invite.status === "PENDING").length} />
          <SummaryCard label="Owners" value={users.filter((user) => user.role === "OWNER").length} />
          <SummaryCard label="Last sign-in" value={formatDateTime(users[0]?.lastLoginAt ?? null)} />
        </section>

        {canWriteTeam ? (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Invite user</p>
                <h3>Create a dashboard invite</h3>
              </div>
            </div>

            <form action="/access/actions/invite-user" className="console-form" method="POST">
              <div className="console-grid">
                <label className="field">
                  <span>Email</span>
                  <input name="email" placeholder="ops@partner.com" />
                </label>
                <label className="field">
                  <span>Full name</span>
                  <input name="fullName" placeholder="Partner Operator" />
                </label>
              </div>
              <label className="field">
                <span>Role</span>
                <select defaultValue="ANALYST" name="role">
                  {metadata.optionSets.partnerUserRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="submit">
                Invite User
              </button>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Users</p>
              <h3>Current access holders</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              { key: "status", label: "Status" },
              { key: "lastActive", label: "Last active" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No team users"
                description="Invite the first partner dashboard user to start collaboration."
              />
            }
            rows={users.map((user) => ({
              key: user.id,
              cells: [
                user.fullName,
                user.email,
                user.role,
                <StatusBadge key={`${user.id}-status`} status={user.status} />,
                formatDateTime(user.lastLoginAt),
                canWriteTeam ? (
                  <div className="table-actions" key={`${user.id}-actions`}>
                    <form action="/access/actions/update-user" method="POST">
                      <input name="userId" type="hidden" value={user.id} />
                      <input name="fullName" type="hidden" value={user.fullName} />
                      <select defaultValue={user.role} name="role">
                        {metadata.optionSets.partnerUserRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <button className="inline-link button-reset" type="submit">
                        Update role
                      </button>
                    </form>
                    <form action="/access/actions/deactivate-user" method="POST">
                      <input name="userId" type="hidden" value={user.id} />
                      <button className="inline-link button-reset" type="submit">
                        Deactivate
                      </button>
                    </form>
                  </div>
                ) : (
                  "Read only"
                ),
              ],
            }))}
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pending invites</p>
              <h3>Invitation lifecycle</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              { key: "status", label: "Status" },
              { key: "expires", label: "Expires" },
            ]}
            emptyState={
              <EmptyState
                title="No pending invites"
                description="Invite tokens will appear here until they are accepted or revoked."
              />
            }
            rows={invites.map((invite) => ({
              key: invite.id,
              cells: [
                invite.email,
                invite.role,
                <StatusBadge key={`${invite.id}-status`} status={invite.status} />,
                formatDateTime(invite.expiresAt),
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
          title="Team unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
