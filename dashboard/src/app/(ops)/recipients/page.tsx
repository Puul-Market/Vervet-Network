import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FeedHealthCard } from "@/components/feed-health-card";
import { FilterBar } from "@/components/filter-bar";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import { readAllowedOption } from "@/lib/dashboard-metadata";
import { consumeDashboardFlash } from "@/lib/flash";
import { expiresWithinDays, formatDateTime } from "@/lib/format";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchDataFeedHealth,
  fetchPartnerDashboardMetadata,
  fetchRecipients,
  fetchPartnerProfile,
  hasReachedOnboardingStage,
  humanizeDashboardError,
  type CredentialScope,
  type RecipientStatus,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface RecipientsPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function RecipientsPage({
  searchParams,
}: RecipientsPageProps) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const params = await searchParams;
  const sessionScopes = session.scopes as CredentialScope[];

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    const filters = {
      search: readSearchParam(params.search),
      status: readRecipientStatus(
        readSearchParam(params.status),
        metadata.optionSets.recipientStatuses,
      ),
    };
    const canWriteRecipients =
      canAccessScope(sessionScopes, ["recipients:write"]) &&
      hasReachedOnboardingStage(
        partnerProfile.onboarding.stage,
        "DATA_MAPPING_IN_PROGRESS",
      );
    const showWriteLockBanner =
      canAccessScope(sessionScopes, ["recipients:write"]) && !canWriteRecipients;

    if (!canAccessModule(partnerProfile, "registry")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Recipients"
            description="Recipient registry management is reserved for data partners and combined partners."
            eyebrow="Recipient registry"
          />
          <ModuleAvailabilityBanner
            title="Recipient registry is not enabled for this organization"
            description="Enable data partner onboarding to map recipient data, import destinations, and manage attestation-backed trust objects."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const [recipients, dataFeedHealth] = await Promise.all([
      fetchRecipients(session.accessToken, filters),
      fetchDataFeedHealth(session.accessToken),
    ]);
    const activeRecipients = recipients.filter(
      (recipient) => recipient.status === "ACTIVE",
    ).length;
    const recipientsWithoutDestination = recipients.filter(
      (recipient) => recipient.activeDestinationsCount === 0,
    ).length;
    const expiringAttestations = recipients.filter((recipient) =>
      recipient.recentAttestations?.some((attestation) => {
        if (!attestation.expiresAt) {
          return false;
        }

        return expiresWithinDays(attestation.expiresAt, 7);
      }),
    ).length;

    return (
      <section className="panel-stack">
        <PageHeader
          title="Recipients"
          description="Manage recipient identifiers and inspect destination and attestation coverage."
          eyebrow="Recipient registry"
          actions={
            canWriteRecipients ? (
              <a className="primary-button" href="#create-recipient">
                Create Recipient
              </a>
            ) : undefined
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        {showWriteLockBanner ? (
          <ModuleAvailabilityBanner
            title="Recipient write actions unlock during data mapping"
            description="You can review the registry now, but creation and lifecycle changes stay locked until the organization reaches the data-mapping onboarding stage."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        ) : null}

        <FeedHealthCard
          actionHref="/data-feed-health"
          actionLabel="Open Data Feed Health"
          dataFeedHealth={dataFeedHealth}
          title="Registry feed health"
        />

        <section className="summary-grid">
          <SummaryCard label="Total recipients" value={recipients.length} />
          <SummaryCard label="Active recipients" value={activeRecipients} />
          <SummaryCard
            label="Without destination"
            value={recipientsWithoutDestination}
          />
          <SummaryCard
            label="Expiring attestations"
            value={expiringAttestations}
          />
          <SummaryCard
            label="Reverse lookup ready"
            value={
              recipients.filter((recipient) => recipient.activeDestinationsCount > 0)
                .length
            }
          />
          <SummaryCard
            label="Corridors at risk"
            value={
              dataFeedHealth.metrics.degradedCorridorCount +
              dataFeedHealth.metrics.disconnectedCorridorCount
            }
          />
        </section>

        <FilterBar
          actions={
            <button className="secondary-button" type="submit">
              Apply filters
            </button>
          }
        >
          <label className="field">
            <span>Search</span>
            <input
              defaultValue={filters.search ?? ""}
              name="search"
              placeholder="Search identifier or display name"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">All statuses</option>
              {metadata.optionSets.recipientStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        {canWriteRecipients ? (
          <section className="panel" id="create-recipient">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Create recipient</p>
                <h3>Add a registry profile</h3>
              </div>
              <p className="panel-copy">
                Recipient creation only creates the registry profile and primary
                identifier. Destination trust still requires signed attestation
                coverage.
              </p>
            </div>

            <form action="/recipients/actions/create" className="console-form" method="POST">
              <div className="console-grid">
                <label className="field">
                  <span>External recipient id</span>
                  <input name="externalRecipientId" placeholder="merchant-123" />
                </label>
                <label className="field">
                  <span>Display name</span>
                  <input name="displayName" placeholder="Jane Merchant" />
                </label>
              </div>
              <div className="console-grid">
                <label className="field">
                  <span>Primary identifier</span>
                  <input name="primaryIdentifier" placeholder="jane@bybit" />
                </label>
                <label className="field">
                  <span>Identifier kind</span>
                  <select defaultValue="PARTNER_HANDLE" name="identifierKind">
                    {metadata.optionSets.identifierKinds.map((identifierKind) => (
                      <option key={identifierKind} value={identifierKind}>
                        {identifierKind}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Visibility</span>
                <select defaultValue="RESOLVABLE" name="visibility">
                  {metadata.optionSets.identifierVisibilities.map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {visibility}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="submit">
                Create Recipient
              </button>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <DataTable
            columns={[
              { key: "identifier", label: "Recipient identifier" },
              { key: "display", label: "Display name" },
              { key: "source", label: "Source partner" },
              { key: "coverage", label: "Coverage" },
              { key: "resolution", label: "Resolution methods" },
              { key: "status", label: "Status" },
              { key: "updated", label: "Last updated" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No recipients yet"
                description="Create the first recipient profile or ingest a signed attestation to start building the registry."
                action={
                  canWriteRecipients ? (
                    <a className="primary-button" href="#create-recipient">
                      Create recipient
                    </a>
                  ) : undefined
                }
              />
            }
            rows={recipients.map((recipient) => ({
              key: recipient.id,
              cells: [
                recipient.identifiers[0]?.rawValue ?? recipient.externalRecipientId,
                recipient.displayName ?? "Unnamed recipient",
                session.partnerDisplayName,
                <div className="stacked-cell" key={`${recipient.id}-coverage`}>
                  <strong>{recipient.activeDestinationsCount} destinations</strong>
                  <span>{recipient.recentAttestations?.length ?? 0} recent attestations</span>
                </div>,
                <div className="chip-row" key={`${recipient.id}-methods`}>
                  <span className="event-chip">Forward</span>
                  {recipient.activeDestinationsCount > 0 ? (
                    <span className="event-chip">Reverse</span>
                  ) : null}
                </div>,
                <StatusBadge
                  key={`${recipient.id}-status`}
                  status={recipient.status}
                />,
                formatDateTime(recipient.updatedAt),
                <div className="table-actions" key={`${recipient.id}-actions`}>
                  <Link className="inline-link" href={`/recipients/${recipient.id}`}>
                    View
                  </Link>
                  <Link className="inline-link" href={`/recipients/${recipient.id}/destinations`}>
                    Destinations
                  </Link>
                  <Link className="inline-link" href={`/recipients/${recipient.id}/attestations`}>
                    Attestations
                  </Link>
                </div>,
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
          title="Recipients unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function readRecipientStatus(
  value: string | undefined,
  options: readonly RecipientStatus[],
): RecipientStatus | undefined {
  return readAllowedOption(value, options);
}
