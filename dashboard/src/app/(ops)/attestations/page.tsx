import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FeedHealthCard } from "@/components/feed-health-card";
import { FilterBar } from "@/components/filter-bar";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import {
  buildAssetOptions,
  buildChainOptions,
  readAllowedOption,
} from "@/lib/dashboard-metadata";
import { expiresWithinDays, formatDateTime, truncateMiddle } from "@/lib/format";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchDataFeedHealth,
  fetchAttestations,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  humanizeDashboardError,
  type AttestationType,
  type VerificationStatus,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface AttestationsPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function AttestationsPage({
  searchParams,
}: AttestationsPageProps) {
  const session = await requireDashboardSession();
  const params = await searchParams;

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    const chainOptions = buildChainOptions(metadata.assetNetworks);
    const assetOptions = buildAssetOptions(metadata.assetNetworks);
    const filters = {
      recipientIdentifier: readSearchParam(params.recipientIdentifier),
      chain: readSearchParam(params.chain),
      asset: readSearchParam(params.asset),
      attestationType: readAttestationType(
        readSearchParam(params.attestationType),
        metadata.optionSets.attestationTypes,
      ),
      verificationStatus: readVerificationStatus(
        readSearchParam(params.verificationStatus),
        metadata.optionSets.verificationStatuses,
      ),
    };

    if (!canAccessModule(partnerProfile, "registry")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Attestations"
            description="Attestation operations are enabled for data partners and combined partners."
            eyebrow="Recipient registry"
          />
          <ModuleAvailabilityBanner
            title="Attestations are not enabled for this organization"
            description="Register a signing key and complete data partner onboarding to begin contributing signed trust artifacts into Vervet."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const [attestations, dataFeedHealth] = await Promise.all([
      fetchAttestations(session.accessToken, filters),
      fetchDataFeedHealth(session.accessToken),
    ]);
    const expiringSoon = attestations.filter((attestation) => {
      if (!attestation.expiresAt) {
        return false;
      }

      return expiresWithinDays(attestation.expiresAt, 7);
    }).length;

    return (
      <section className="panel-stack">
        <PageHeader
          title="Attestations"
          description="Inspect active, expired, and revoked destination attestations."
          eyebrow="Recipient registry"
        />

        <FeedHealthCard
          actionHref="/data-feed-health"
          actionLabel="Open Data Feed Health"
          dataFeedHealth={dataFeedHealth}
          title="Attestation feed health"
        />

        <section className="summary-grid">
          <SummaryCard label="Active" value={attestations.filter((item) => item.verificationStatus === "VERIFIED").length} />
          <SummaryCard label="Expiring soon" value={expiringSoon} />
          <SummaryCard label="Expired" value={attestations.filter((item) => item.verificationStatus === "EXPIRED").length} />
          <SummaryCard label="Revoked" value={attestations.filter((item) => item.verificationStatus === "REVOKED").length} />
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
            <span>Recipient identifier</span>
            <input
              defaultValue={filters.recipientIdentifier ?? ""}
              name="recipientIdentifier"
              placeholder="jane@bybit"
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
            <span>Type</span>
            <select defaultValue={filters.attestationType ?? ""} name="attestationType">
              <option value="">All types</option>
              {metadata.optionSets.attestationTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              defaultValue={filters.verificationStatus ?? ""}
              name="verificationStatus"
            >
              <option value="">All statuses</option>
              {metadata.optionSets.verificationStatuses.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Signed flow only</p>
              <h3>Attestation creation stays in the signed API</h3>
            </div>
            <p className="panel-copy">
              The dashboard does not generate or hold partner private keys. New
              trust artifacts must still be created through the signed
              attestation ingestion flow.
            </p>
          </div>

          <DataTable
            columns={[
              { key: "id", label: "Attestation id" },
              { key: "recipient", label: "Recipient" },
              { key: "destination", label: "Destination" },
              { key: "type", label: "Type" },
              { key: "policy", label: "Policy" },
              { key: "status", label: "Status" },
              { key: "expires", label: "Expires" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No attestations"
                description="Signed destination attestations will appear here after ingestion."
              />
            }
            rows={attestations.map((attestation) => ({
              key: attestation.id,
              cells: [
                attestation.id,
                attestation.recipientDisplayName ?? attestation.recipientExternalId,
                attestation.address ? truncateMiddle(attestation.address, 10) : "No destination",
                attestation.attestationType,
                "Both · Full label",
                <StatusBadge
                  key={`${attestation.id}-status`}
                  status={attestation.verificationStatus}
                />,
                formatDateTime(attestation.expiresAt),
                <Link
                  className="inline-link"
                  href={`/attestations/${attestation.id}`}
                  key={`${attestation.id}-action`}
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
          title="Attestations unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function readAttestationType(
  value: string | undefined,
  options: readonly AttestationType[],
): AttestationType | undefined {
  return readAllowedOption(value, options);
}

function readVerificationStatus(
  value: string | undefined,
  options: readonly VerificationStatus[],
): VerificationStatus | undefined {
  return readAllowedOption(value, options);
}
