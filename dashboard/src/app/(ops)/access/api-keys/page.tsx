import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime, formatConstantLabel, isOlderThanDays } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchPartnerApiCredentials,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  humanizeDashboardError,
  isDataContributorEnabled,
  type CredentialScope,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const sessionScopes = session.scopes as CredentialScope[];
  const canWriteKeys = canAccessScope(sessionScopes, ["partners:write"]);

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);

    if (!canAccessModule(partnerProfile, "api_keys")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="API Keys"
            description="API key management is available to API consumers and combined partners."
            eyebrow="Keys & access"
          />
          <ModuleAvailabilityBanner
            title="API key management is unavailable"
            description={
              isDataContributorEnabled(partnerProfile)
                ? "This organization can contribute trust data, but API credential issuance is still disabled. Enable API consumer access to issue credentials for resolution and verification workflows."
                : "This organization is not currently enabled for API consumption. Enable API consumer onboarding to issue credentials for resolution and verification workflows."
            }
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    if (!canWriteKeys) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="API Keys"
            description="Create, rotate, and revoke credentials used to call the API."
            eyebrow="Keys & access"
          />
          <ModuleAvailabilityBanner
            title="API key management requires elevated access"
            description="Only owners, admins, and developers can manage API credentials for this organization."
            actionHref="/overview"
            actionLabel="Return to overview"
          />
        </section>
      );
    }

    const credentials = await fetchPartnerApiCredentials(session.accessToken);

    return (
      <section className="panel-stack">
        <PageHeader
          title="API Keys"
          description="Create, rotate, and revoke credentials used to call the API."
          eyebrow="Keys & access"
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="summary-grid">
          <SummaryCard
            label="Active keys"
            value={credentials.filter((item) => item.status === "ACTIVE").length}
          />
          <SummaryCard
            label="Revoked keys"
            value={credentials.filter((item) => item.revokedAt !== null).length}
          />
          <SummaryCard
            label="Unused 30d"
            value={
              credentials.filter((item) => {
                if (!item.lastUsedAt) {
                  return true;
                }

                return isOlderThanDays(item.lastUsedAt, 30);
              }).length
            }
          />
          <SummaryCard
            label="Current credential"
            value={credentials.find((item) => item.isCurrent)?.label ?? "None"}
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Create API key</p>
              <h3>Issue a new integration credential</h3>
            </div>
          </div>

          <form action="/access/actions/create-credential" className="console-form" method="POST">
            <label className="field">
              <span>Label</span>
              <input name="label" placeholder="Treasury integration" />
            </label>
            <fieldset className="event-fieldset">
              <legend>Scopes</legend>
              <p className="panel-copy">
                Choose the minimum access this key needs. Each scope includes a short
                description, and hovering the card will also show the same help text.
              </p>
              <div className="event-grid">
                {metadata.optionSets.credentialScopeDefinitions.map((scopeDefinition) => (
                  <label
                    className="event-option event-option-detailed"
                    key={scopeDefinition.value}
                    title={scopeDefinition.description}
                  >
                    <input
                      defaultChecked={metadata.optionSets.recommendedCredentialScopes.includes(
                        scopeDefinition.value,
                      )}
                      name="scopes"
                      type="checkbox"
                      value={scopeDefinition.value}
                    />
                    <span className="event-option-copy">
                      <span className="event-option-kicker">
                        {formatConstantLabel(scopeDefinition.value)}
                      </span>
                      <span className="event-option-label">
                        {scopeDefinition.label}
                      </span>
                      <span className="event-option-description">
                        {scopeDefinition.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary-button" type="submit">
              Create API Key
            </button>
          </form>
        </section>

        <section className="panel">
          <DataTable
            columns={[
              { key: "label", label: "Label" },
              { key: "prefix", label: "Prefix" },
              { key: "scopes", label: "Scopes" },
              { key: "usage", label: "Last used" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No API keys"
                description="Issue the first API key to authenticate partner integrations."
              />
            }
            rows={credentials.map((credential) => ({
              key: credential.id,
              cells: [
                credential.label,
                credential.keyPrefix,
                credential.scopes.join(", "),
                formatDateTime(credential.lastUsedAt),
                <StatusBadge
                  key={`${credential.id}-status`}
                  status={credential.revokedAt ? "REVOKED" : credential.status}
                />,
                <form
                  action="/access/actions/revoke-credential"
                  key={`${credential.id}-action`}
                  method="POST"
                >
                  <input name="credentialId" type="hidden" value={credential.id} />
                  <button
                    className="inline-link button-reset"
                    disabled={credential.revokedAt !== null}
                    type="submit"
                  >
                    Revoke
                  </button>
                </form>,
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
          title="API keys unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
