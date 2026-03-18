import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { PlatformSelector } from "@/components/platform-selector";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  formatConstantLabel,
  formatDateTime,
  formatDisclosureMode,
  formatResolutionQueryType,
  truncateMiddle,
} from "@/lib/format";
import {
  buildAssetOptions,
  buildChainOptions,
} from "@/lib/dashboard-metadata";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchSupportedPlatforms,
  fetchResolutionLogs,
  humanizeDashboardError,
  type QueryType,
  type ResolutionOutcome,
  type RiskLevel,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface ResolutionLogsPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function ResolutionLogsPage({
  searchParams,
}: ResolutionLogsPageProps) {
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
      queryType: readQueryType(
        readSearchParam(params.queryType),
        metadata.optionSets.queryTypes,
      ),
      outcome: readResolutionOutcome(
        readSearchParam(params.outcome),
        metadata.optionSets.resolutionOutcomes,
      ),
      riskLevel: readRiskLevel(
        readSearchParam(params.riskLevel),
        metadata.optionSets.riskLevels,
      ),
      platform: readSearchParam(params.platform),
      chain: readSearchParam(params.chain),
      asset: readSearchParam(params.asset),
      recipientIdentifier: readSearchParam(params.recipientIdentifier),
    };

    if (!canAccessModule(partnerProfile, "resolution")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Logs"
            description="Review by-recipient resolution, by-address confirmation, transfer verification, and batch outcomes over time."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Resolution logs are unavailable"
            description="Resolution history is available once recipient-led or address-led resolution capability is enabled for this organization."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const [logs, supportedPlatforms] = await Promise.all([
      fetchResolutionLogs(session.accessToken, filters),
      fetchSupportedPlatforms(session.accessToken, {
        chain: filters.chain,
        asset: filters.asset,
      }),
    ]);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Logs"
          description="Review by-recipient resolution, by-address confirmation, transfer verification, and batch outcomes over time."
          eyebrow="Resolution"
        />

        <FilterBar
          actions={
            <button className="secondary-button" type="submit">
              Apply filters
            </button>
          }
        >
          <label className="field">
              <span>Mode</span>
              <select defaultValue={filters.queryType ?? ""} name="queryType">
                <option value="">All modes</option>
              {metadata.optionSets.queryTypes.map((option) => (
                <option key={option} value={option}>
                  {formatResolutionQueryType(option)}
                </option>
              ))}
            </select>
          </label>
          <PlatformSelector
            capability="ANY"
            defaultValue={filters.platform ?? ""}
            emptyLabel="All listed platforms"
            name="platform"
            options={supportedPlatforms}
          />
          <label className="field">
              <span>Outcome</span>
              <select defaultValue={filters.outcome ?? ""} name="outcome">
                <option value="">All outcomes</option>
              {metadata.optionSets.resolutionOutcomes.map((option) => (
                <option key={option} value={option}>
                  {formatConstantLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
              <span>Risk</span>
              <select defaultValue={filters.riskLevel ?? ""} name="riskLevel">
                <option value="">All levels</option>
              {metadata.optionSets.riskLevels.map((option) => (
                <option key={option} value={option}>
                  {formatConstantLabel(option)}
                </option>
              ))}
            </select>
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
            <span>Recipient identifier</span>
            <input
              defaultValue={filters.recipientIdentifier ?? ""}
              name="recipientIdentifier"
              placeholder="jane@bybit"
            />
          </label>
        </FilterBar>

        <section className="panel">
          <DataTable
            columns={[
              { key: "time", label: "Timestamp" },
              { key: "mode", label: "Lookup type" },
              { key: "platform", label: "Platform" },
              { key: "recipient", label: "Recipient" },
              { key: "address", label: "Submitted address" },
              { key: "result", label: "Result" },
              { key: "recommendation", label: "Recommendation" },
            ]}
            emptyState={
              <EmptyState
                title="No resolution logs"
                description="Run a by-recipient, by-address, verify-transfer, or batch request and the history will appear here."
              />
            }
            rows={logs.map((log) => ({
              key: log.id,
              cells: [
                formatDateTime(log.requestedAt),
                formatResolutionQueryType(log.queryType),
                log.platform ?? "—",
                log.recipientIdentifier || "—",
                log.providedAddress ? truncateMiddle(log.providedAddress, 7) : "—",
                <div className="stacked-cell" key={`${log.id}-result`}>
                  <StatusBadge status={log.outcome} />
                  <RiskBadge riskLevel={log.riskLevel} />
                </div>,
                <div className="stacked-cell" key={`${log.id}-recommendation`}>
                  <strong>{formatConstantLabel(log.recommendation ?? "review")}</strong>
                  <span>{formatDisclosureMode(log.disclosureMode)}</span>
                  <Link className="inline-link" href={`/resolution/logs/${log.id}`}>
                    View details
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
          title="Resolution logs unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function readQueryType(
  value: string | undefined,
  options: QueryType[],
): QueryType | undefined {
  if (value && options.includes(value as QueryType)) {
    return value as QueryType;
  }

  return undefined;
}

function readResolutionOutcome(
  value: string | undefined,
  options: ResolutionOutcome[],
): ResolutionOutcome | undefined {
  if (value && options.includes(value as ResolutionOutcome)) {
    return value as ResolutionOutcome;
  }

  return undefined;
}

function readRiskLevel(
  value: string | undefined,
  options: RiskLevel[],
): RiskLevel | undefined {
  if (value && options.includes(value as RiskLevel)) {
    return value as RiskLevel;
  }

  return undefined;
}
