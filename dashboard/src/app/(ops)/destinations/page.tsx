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
import { consumeDashboardFlash } from "@/lib/flash";
import {
  buildAssetOptions,
  buildChainOptions,
  readAllowedOption,
} from "@/lib/dashboard-metadata";
import { formatDateTime, truncateMiddle } from "@/lib/format";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchDataFeedHealth,
  fetchDestinations,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchRecipients,
  hasReachedOnboardingStage,
  humanizeDashboardError,
  type CredentialScope,
  type DestinationStatus,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface DestinationsPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function DestinationsPage({
  searchParams,
}: DestinationsPageProps) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const params = await searchParams;
  const sessionScopes = session.scopes as CredentialScope[];

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    const chainOptions = buildChainOptions(metadata.assetNetworks);
    const assetOptions = buildAssetOptions(metadata.assetNetworks);
    const filters = {
      recipientId: readSearchParam(params.recipientId),
      chain: readSearchParam(params.chain),
      asset: readSearchParam(params.asset),
      status: readDestinationStatus(
        readSearchParam(params.status),
        metadata.optionSets.destinationStatuses,
      ),
    };
    const canWriteDestinations =
      canAccessScope(sessionScopes, ["destinations:write"]) &&
      hasReachedOnboardingStage(
        partnerProfile.onboarding.stage,
        "DATA_MAPPING_IN_PROGRESS",
      );
    const showWriteLockBanner =
      canAccessScope(sessionScopes, ["destinations:write"]) &&
      !canWriteDestinations;

    if (!canAccessModule(partnerProfile, "registry")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Destinations"
            description="Destination registry operations are available after data partner onboarding is enabled."
            eyebrow="Recipient registry"
          />
          <ModuleAvailabilityBanner
            title="Destinations are unavailable for this organization"
            description="This module becomes operational when your organization is approved as a data partner and begins mapping recipient and destination data into Vervet."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const [destinations, recipients, dataFeedHealth] = await Promise.all([
      fetchDestinations(session.accessToken, filters),
      fetchRecipients(session.accessToken, { limit: 100 }),
      fetchDataFeedHealth(session.accessToken),
    ]);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Destinations"
          description="Inspect all registered transfer destinations across recipients."
          eyebrow="Recipient registry"
          actions={
            canWriteDestinations ? (
              <a className="primary-button" href="#create-destination">
                Add Destination
              </a>
            ) : undefined
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        {showWriteLockBanner ? (
          <ModuleAvailabilityBanner
            title="Destination write actions unlock during data mapping"
            description="You can inspect destination coverage now, but destination drafts and lifecycle changes remain locked until data mapping is in progress."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        ) : null}

        <FeedHealthCard
          actionHref="/data-feed-health"
          actionLabel="Open Data Feed Health"
          dataFeedHealth={dataFeedHealth}
          title="Destination feed health"
        />

        <section className="summary-grid">
          <SummaryCard label="Total destinations" value={destinations.length} />
          <SummaryCard
            label="Active"
            value={destinations.filter((item) => item.status === "ACTIVE").length}
          />
          <SummaryCard
            label="Pending"
            value={destinations.filter((item) => item.status === "PENDING").length}
          />
          <SummaryCard
            label="Revoked / expired"
            value={
              destinations.filter(
                (item) => item.status === "REVOKED" || item.status === "EXPIRED",
              ).length
            }
          />
          <SummaryCard
            label="Ingestion failures (7d)"
            value={dataFeedHealth.metrics.recentIngestionFailureCount7d}
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
            <span>Recipient id</span>
            <input
              defaultValue={filters.recipientId ?? ""}
              name="recipientId"
              placeholder="Filter by recipient id"
            />
          </label>
          <label className="field">
            <span>Chain</span>
            <select defaultValue={filters.chain ?? ""} name="chain">
              <option value="">All chains</option>
              {chainOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Asset</span>
            <select defaultValue={filters.asset ?? ""} name="asset">
              <option value="">All assets</option>
              {assetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">All statuses</option>
              {metadata.optionSets.destinationStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        {canWriteDestinations ? (
          <section className="panel" id="create-destination">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Add destination</p>
                <h3>Create a pending destination record</h3>
              </div>
              <p className="panel-copy">
                Destinations created here remain operational drafts until a
                matching signed attestation is ingested from the partner.
              </p>
            </div>

            <form action="/destinations/actions/create" className="console-form" method="POST">
              <label className="field">
                <span>Recipient</span>
                <select defaultValue={filters.recipientId ?? ""} name="recipientId">
                  <option value="">Select recipient</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.displayName ?? recipient.externalRecipientId}
                    </option>
                  ))}
                </select>
              </label>
              <div className="console-grid">
                <label className="field">
                  <span>Chain</span>
                  <select
                    defaultValue={filters.chain ?? chainOptions[0].value}
                    name="chain"
                  >
                    {chainOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Asset</span>
                  <select defaultValue={filters.asset ?? "USDC"} name="asset">
                    {assetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Address</span>
                <textarea name="address" placeholder="Destination address" />
              </label>
              <label className="field">
                <span>Memo / tag</span>
                <input name="memoValue" placeholder="Optional memo or tag" />
              </label>
              <label className="event-option">
                <input name="isDefault" type="checkbox" />
                Mark as default destination
              </label>
              <button className="primary-button" type="submit">
                Create Destination
              </button>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <DataTable
            columns={[
              { key: "recipient", label: "Recipient" },
              { key: "route", label: "Chain / Asset" },
              { key: "address", label: "Address" },
              { key: "status", label: "Status" },
              { key: "resolution", label: "Lookup availability" },
              { key: "expiry", label: "Expiry" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No destinations"
                description="Create a pending destination or ingest a signed attestation to populate this surface."
              />
            }
            rows={destinations.map((destination) => ({
              key: destination.id,
              cells: [
                destination.recipient.displayName ?? destination.recipient.externalRecipientId,
                `${destination.assetNetwork.assetSymbol} on ${destination.assetNetwork.chainDisplayName}`,
                truncateMiddle(destination.address, 10),
                <StatusBadge
                  key={`${destination.id}-status`}
                  status={destination.status}
                />,
                destination.status === "ACTIVE" ? "Both" : "Restricted",
                formatDateTime(destination.expiresAt),
                <Link
                  className="inline-link"
                  href={`/destinations/${destination.id}`}
                  key={`${destination.id}-detail`}
                >
                  View detail
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
          title="Destinations unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function readDestinationStatus(
  value: string | undefined,
  options: readonly DestinationStatus[],
): DestinationStatus | undefined {
  return readAllowedOption(value, options);
}
