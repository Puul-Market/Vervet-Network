import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchPartnerSigningKeys,
  humanizeDashboardError,
  isDataContributorEnabled,
  type CredentialScope,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function SigningKeysPage() {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const canWriteKeys = canAccessScope(
    session.scopes as CredentialScope[],
    ["partners:write"],
  );

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);

    if (!canAccessModule(partnerProfile, "signing_keys")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Signing Keys"
            description="Signing key operations are available to data partners and attestation partners."
            eyebrow="Keys & access"
          />
          <ModuleAvailabilityBanner
            title="Signing keys are unavailable"
            description={
              isDataContributorEnabled(partnerProfile)
                ? "This organization can contribute trust data, but signing-key operations are still unavailable in the current state."
                : "This organization is not currently enabled to contribute signed trust artifacts. Signing key registration will unlock when data partner or attestation onboarding is approved."
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
            title="Signing Keys"
            description="Manage public keys used to verify attestation signatures."
            eyebrow="Keys & access"
          />
          <ModuleAvailabilityBanner
            title="Signing key management requires elevated access"
            description="Only owners, admins, and developers can manage signing keys for this organization."
            actionHref="/overview"
            actionLabel="Return to overview"
          />
        </section>
      );
    }

    const signingKeys = await fetchPartnerSigningKeys(session.accessToken);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Signing Keys"
          description="Manage public keys used to verify attestation signatures."
          eyebrow="Keys & access"
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="summary-grid">
          <SummaryCard
            label="Active key versions"
            value={signingKeys.filter((item) => item.status === "ACTIVE").length}
          />
          <SummaryCard
            label="Latest rotation"
            value={formatDateTime(signingKeys[0]?.createdAt ?? null)}
          />
          <SummaryCard
            label="Revoked"
            value={signingKeys.filter((item) => item.revokedAt !== null).length}
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Register signing key</p>
              <h3>Add a public key for attestation verification</h3>
            </div>
          </div>

          <form action="/access/actions/register-signing-key" className="console-form" method="POST">
            <div className="console-grid">
              <label className="field">
                <span>Key id</span>
                <input name="keyId" placeholder="attestation-key-2026-01" />
              </label>
              <label className="field">
                <span>Algorithm</span>
                <select
                  defaultValue={metadata.optionSets.signingKeyAlgorithms[0]}
                  name="algorithm"
                >
                  {metadata.optionSets.signingKeyAlgorithms.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Public key PEM</span>
              <textarea name="publicKeyPem" placeholder="-----BEGIN PUBLIC KEY-----" />
            </label>
            <div className="console-grid">
              <label className="field">
                <span>Valid from</span>
                <input name="validFrom" type="datetime-local" />
              </label>
              <label className="field">
                <span>Valid to</span>
                <input name="validTo" type="datetime-local" />
              </label>
            </div>
            <button className="primary-button" type="submit">
              Register Signing Key
            </button>
          </form>
        </section>

        <section className="panel">
          <DataTable
            columns={[
              { key: "key", label: "Key id" },
              { key: "algorithm", label: "Algorithm" },
              { key: "fingerprint", label: "Fingerprint" },
              { key: "created", label: "Created" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No signing keys"
                description="Register the first public key to start verifying partner attestations."
              />
            }
            rows={signingKeys.map((signingKey) => ({
              key: signingKey.id,
              cells: [
                signingKey.keyId,
                signingKey.algorithm,
                signingKey.fingerprint,
                formatDateTime(signingKey.createdAt),
                <StatusBadge key={`${signingKey.id}-status`} status={signingKey.status} />,
                <form
                  action="/access/actions/revoke-signing-key"
                  key={`${signingKey.id}-action`}
                  method="POST"
                >
                  <input name="signingKeyId" type="hidden" value={signingKey.id} />
                  <button
                    className="inline-link button-reset"
                    disabled={signingKey.revokedAt !== null}
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
          title="Signing keys unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
