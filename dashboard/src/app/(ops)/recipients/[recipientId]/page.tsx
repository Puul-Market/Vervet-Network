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
import { formatDateTime, truncateMiddle } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchAttestations,
  fetchDestinations,
  fetchPartnerProfile,
  fetchRecipient,
  hasReachedOnboardingStage,
  humanizeDashboardError,
  type CredentialScope,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function RecipientDetailPage({
  params,
}: {
  params: Promise<{ recipientId: string }>;
}) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const sessionScopes = session.scopes as CredentialScope[];
  const { recipientId } = await params;

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);

    if (!canAccessModule(partnerProfile, "registry")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Recipient detail"
            description="Inspect recipient metadata, destinations, and trust coverage."
            eyebrow="Recipient registry"
          />
          <ModuleAvailabilityBanner
            title="Recipient detail is unavailable"
            description="Recipient registry detail is available to data-contributing partners once registry capability is enabled."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const canWriteRecipients =
      canAccessScope(sessionScopes, ["recipients:write"]) &&
      hasReachedOnboardingStage(
        partnerProfile.onboarding.stage,
        "DATA_MAPPING_IN_PROGRESS",
      );
    const showWriteLockBanner =
      canAccessScope(sessionScopes, ["recipients:write"]) && !canWriteRecipients;

    const [recipient, destinations, attestations] = await Promise.all([
      fetchRecipient(session.accessToken, recipientId),
      fetchDestinations(session.accessToken, { recipientId }),
      fetchAttestations(session.accessToken, { recipientId, limit: 10 }),
    ]);

    return (
      <section className="panel-stack">
        <PageHeader
          title={recipient.displayName ?? recipient.externalRecipientId}
          description={`${recipient.identifiers[0]?.rawValue ?? recipient.externalRecipientId} · ${session.partnerDisplayName}`}
          eyebrow="Recipient detail"
          actions={
            <div className="page-header-actions">
              <Link className="secondary-button" href="/recipients">
                Back to recipients
              </Link>
              <Link
                className="primary-button"
                href={`/destinations?recipientId=${recipient.id}`}
              >
                Add Destination
              </Link>
            </div>
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        {showWriteLockBanner ? (
          <ModuleAvailabilityBanner
            title="Recipient changes unlock during data mapping"
            description="This recipient can be reviewed now, but update and disable actions stay locked until the organization reaches data mapping."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        ) : null}

        <section className="summary-grid">
          <SummaryCard
            label="Active destinations"
            value={recipient.activeDestinationsCount}
          />
          <SummaryCard
            label="Recent attestations"
            value={attestations.length}
          />
          <SummaryCard
            label="Recent verifications"
            value={recipient.recentVerificationAttempts?.length ?? 0}
          />
          <SummaryCard label="Current status" value={recipient.status} />
        </section>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recipient profile</p>
                <h3>Registry metadata</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Display name</span>
                <strong>{recipient.displayName ?? "Not set"}</strong>
              </div>
              <div className="metadata-row">
                <span>Identifier</span>
                <strong>{recipient.identifiers[0]?.rawValue ?? recipient.externalRecipientId}</strong>
              </div>
              <div className="metadata-row">
                <span>Status</span>
                <strong>{recipient.status}</strong>
              </div>
              <div className="metadata-row">
                <span>Updated</span>
                <strong>{formatDateTime(recipient.updatedAt)}</strong>
              </div>
            </div>

            {canWriteRecipients ? (
              <form action="/recipients/actions/update" className="console-form" method="POST">
                <input name="recipientId" type="hidden" value={recipient.id} />
                <input
                  name="redirectTo"
                  type="hidden"
                  value={`/recipients/${recipient.id}`}
                />
                <label className="field">
                  <span>Display name</span>
                  <input
                    defaultValue={recipient.displayName ?? ""}
                    name="displayName"
                    placeholder="Update display name"
                  />
                </label>
                <div className="table-actions">
                  <button className="secondary-button" type="submit">
                    Update Recipient
                  </button>
                  <button
                    className="secondary-button danger-button"
                    formAction="/recipients/actions/disable"
                    type="submit"
                  >
                    Disable Recipient
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Coverage snapshot</p>
                <h3>Destination, attestation, and lookup state</h3>
              </div>
            </div>

            <ResolutionAvailabilityCard
              byRecipient={recipient.activeDestinationsCount > 0}
              byAddress={recipient.activeDestinationsCount > 0}
              disclosureMode={
                recipient.resolutionAvailability?.disclosureMode ?? "FULL_LABEL"
              }
              platforms={
                recipient.resolutionAvailability?.supportedPlatforms ?? [
                  session.partnerSlug,
                ]
              }
            />

            <div className="detail-list">
              {recipient.identifiers.map((identifier) => (
                <article className="detail-card" key={identifier.id}>
                  <div className="stacked-cell">
                    <strong>{identifier.rawValue}</strong>
                    <span>{identifier.kind}</span>
                  </div>
                  <StatusBadge status={identifier.status} />
                </article>
              ))}
            </div>

            <div className="tab-strip">
              <Link className="inline-link" href={`/recipients/${recipient.id}/destinations`}>
                Destinations
              </Link>
              <Link className="inline-link" href={`/recipients/${recipient.id}/attestations`}>
                Attestations
              </Link>
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Destinations</p>
              <h3>Current coverage</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "asset", label: "Asset / Chain" },
              { key: "address", label: "Address" },
              { key: "status", label: "Status" },
              { key: "attested", label: "Last attested" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No destinations"
                description="This recipient has no registered destinations yet."
              />
            }
            rows={destinations.map((destination) => ({
              key: destination.id,
              cells: [
                `${destination.assetNetwork.assetSymbol} on ${destination.assetNetwork.chainDisplayName}`,
                truncateMiddle(destination.address, 10),
                <StatusBadge
                  key={`${destination.id}-status`}
                  status={destination.status}
                />,
                formatDateTime(destination.lastAttestedAt),
                <Link
                  className="inline-link"
                  href={`/destinations/${destination.id}`}
                  key={`${destination.id}-detail`}
                >
                  View destination
                </Link>,
              ],
            }))}
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Attestations</p>
              <h3>Recent trust artifacts</h3>
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
                title="No attestations"
                description="No signed attestations have been ingested for this recipient yet."
              />
            }
            rows={attestations.map((attestation) => ({
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
                  key={`${attestation.id}-detail`}
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
          title="Recipient unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
