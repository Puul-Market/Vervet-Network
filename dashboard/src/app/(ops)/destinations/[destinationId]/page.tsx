import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { ResolutionAvailabilityCard } from "@/components/resolution-availability-card";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchDestination,
  fetchPartnerProfile,
  hasReachedOnboardingStage,
  humanizeDashboardError,
  type CredentialScope,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ destinationId: string }>;
}) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const { destinationId } = await params;
  const sessionScopes = session.scopes as CredentialScope[];

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);

    if (!canAccessModule(partnerProfile, "registry")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Destination detail"
            description="Inspect one destination, its coverage, and its trust history."
            eyebrow="Recipient registry"
          />
          <ModuleAvailabilityBanner
            title="Destination detail is unavailable"
            description="Destination registry detail is available to data-contributing partners once registry capability is enabled."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const canWriteDestinations =
      canAccessScope(sessionScopes, ["destinations:write"]) &&
      hasReachedOnboardingStage(
        partnerProfile.onboarding.stage,
        "DATA_MAPPING_IN_PROGRESS",
      );
    const showWriteLockBanner =
      canAccessScope(sessionScopes, ["destinations:write"]) &&
      !canWriteDestinations;
    const destination = await fetchDestination(session.accessToken, destinationId);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Destination Detail"
          description={`${destination.assetNetwork.assetSymbol} on ${destination.assetNetwork.chainDisplayName}`}
          eyebrow="Destination"
          actions={
            <Link className="secondary-button" href="/destinations">
              Back to destinations
            </Link>
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        {showWriteLockBanner ? (
          <ModuleAvailabilityBanner
            title="Destination changes unlock during data mapping"
            description="You can inspect this destination now, but replacement and revocation actions stay locked until the organization reaches data mapping."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        ) : null}

        <section className="summary-grid">
          <SummaryCard label="Status" value={destination.status} />
          <SummaryCard
            label="Latest attestation"
            value={destination.latestAttestation?.verificationStatus ?? "Not available"}
          />
          <SummaryCard
            label="Verification usage (30d)"
            value={destination.recentUsage?.length ?? 0}
          />
          <SummaryCard
            label="Expiry"
            value={destination.expiresAt ?? "No expiry"}
          />
        </section>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Destination details</p>
                <h3>{destination.address}</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Normalized address</span>
                <strong>{destination.normalizedAddress}</strong>
              </div>
              <div className="metadata-row">
                <span>Recipient</span>
                <strong>{destination.recipient.displayName ?? destination.recipient.externalRecipientId}</strong>
              </div>
              <div className="metadata-row">
                <span>Status</span>
                <strong>{destination.status}</strong>
              </div>
              <div className="metadata-row">
                <span>Effective from</span>
                <strong>{formatDateTime(destination.effectiveFrom)}</strong>
              </div>
            </div>

            <ResolutionAvailabilityCard
              byRecipient={destination.status === "ACTIVE"}
              byAddress={destination.status === "ACTIVE"}
              disclosureMode={
                destination.resolutionAvailability?.disclosureMode ?? "FULL_LABEL"
              }
              platforms={
                destination.resolutionAvailability?.platformScope ?? [
                  destination.recipient.externalRecipientId,
                ]
              }
              currentLookupStatus={
                destination.resolutionAvailability?.currentLookupStatus ??
                (destination.status === "ACTIVE" ? "AVAILABLE" : "UNAVAILABLE")
              }
            />

            {canWriteDestinations ? (
              <>
                <form action="/destinations/actions/replace" className="console-form" method="POST">
                  <input name="destinationId" type="hidden" value={destination.id} />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={`/destinations/${destination.id}`}
                  />
                  <label className="field">
                    <span>Replacement address</span>
                    <textarea name="address" placeholder="New destination address" />
                  </label>
                  <label className="field">
                    <span>Replacement memo / tag</span>
                    <input name="memoValue" placeholder="Optional memo or tag" />
                  </label>
                  <button className="secondary-button" type="submit">
                    Replace Destination
                  </button>
                </form>

                <form action="/destinations/actions/revoke" method="POST">
                  <input name="destinationId" type="hidden" value={destination.id} />
                  <input
                    name="redirectTo"
                    type="hidden"
                    value={`/destinations/${destination.id}`}
                  />
                  <button className="secondary-button danger-button" type="submit">
                    Revoke Destination
                  </button>
                </form>
              </>
            ) : null}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recent verification usage</p>
                <h3>How the destination was used</h3>
              </div>
            </div>

            <DataTable
              columns={[
                { key: "time", label: "Time" },
                { key: "mode", label: "Mode" },
                { key: "outcome", label: "Outcome" },
                { key: "recommendation", label: "Recommendation" },
              ]}
              emptyState={
                <EmptyState
                  title="No recent verification usage"
                  description="Verification history for this destination will appear here as partners resolve or verify it."
                />
              }
              rows={(destination.recentUsage ?? []).map((usage) => ({
                key: usage.id,
                cells: [
                  formatDateTime(usage.requestedAt),
                  usage.queryType,
                  <StatusBadge key={`${usage.id}-status`} status={usage.outcome} />,
                  usage.recommendation ?? "No recommendation",
                ],
              }))}
            />
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Attestation history</p>
              <h3>Linked trust artifacts</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "id", label: "Attestation id" },
              { key: "type", label: "Type" },
              { key: "status", label: "Status" },
              { key: "issued", label: "Issued" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No attestation history"
                description="Signed attestation history will appear here once the destination has been attested."
              />
            }
            rows={(destination.attestationHistory ?? []).map((attestation) => ({
              key: attestation.id,
              cells: [
                attestation.id,
                attestation.attestationType,
                <StatusBadge
                  key={`${attestation.id}-status`}
                  status={attestation.verificationStatus}
                />,
                formatDateTime(attestation.issuedAt),
                <Link
                  className="inline-link"
                  href={`/attestations/${attestation.id}`}
                  key={`${attestation.id}-action`}
                >
                  View attestation
                </Link>,
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
          title="Destination unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
