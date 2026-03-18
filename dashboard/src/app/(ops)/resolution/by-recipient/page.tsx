import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  buildAssetOptions,
  buildChainOptions,
  resolveDefaultAsset,
  resolveDefaultChain,
} from "@/lib/dashboard-metadata";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canRunOperationalResolution,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  humanizeDashboardError,
  resolveRecipient,
  type ResolveResponseRecord,
} from "@/lib/vervet-api";
import { formatConstantLabel, formatDisclosureMode } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ByRecipientPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function ByRecipientPage({
  searchParams,
}: ByRecipientPageProps) {
  const session = await requireDashboardSession();
  const params = await searchParams;
  const recipientIdentifier = readSearchParam(params.recipientIdentifier) ?? "";

  let result: ResolveResponseRecord | null = null;
  let errorMessage: string | null = null;
  let chain = "";
  let asset = "";
  let chainOptions = [] as ReturnType<typeof buildChainOptions>;
  let assetOptions = [] as ReturnType<typeof buildAssetOptions>;

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    chain = resolveDefaultChain(
      metadata.assetNetworks,
      readSearchParam(params.chain),
    );
    asset = resolveDefaultAsset(
      metadata.assetNetworks,
      readSearchParam(params.asset),
    );
    chainOptions = buildChainOptions(metadata.assetNetworks);
    assetOptions = buildAssetOptions(metadata.assetNetworks);

    if (!canAccessModule(partnerProfile, "resolution")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="By Recipient"
            description="Resolve a verified destination from a recipient identifier, asset, and network."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Resolution is not enabled for this organization"
            description="Recipient-led resolution is available to API consumers and data-contributing partners once the relevant capability is enabled."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    if (!canRunOperationalResolution(partnerProfile)) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="By Recipient"
            description="Resolve a verified destination from a recipient identifier, asset, and network."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Resolution execution is currently unavailable"
            description="Enable sandbox or production access for this organization before running live recipient resolution requests."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    if (recipientIdentifier) {
      result = await resolveRecipient(session.accessToken, {
        recipientIdentifier,
        chain,
        asset,
      });
    }
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      redirect("/");
    }

    errorMessage = humanizeDashboardError(error);
  }

  return (
    <section className="panel-stack">
      <PageHeader
        title="By Recipient"
        description="Resolve a verified destination from a recipient identifier, asset, and network."
        eyebrow="Resolution"
        actions={
          <div className="page-header-actions">
            <Link className="secondary-button" href="/sandbox">
              Open Sandbox
            </Link>
            <Link className="secondary-button" href="/resolution/logs">
              View Logs
            </Link>
          </div>
        }
      />

      <div className="detail-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Forward Lookup</p>
              <h3>Resolve a verified destination</h3>
            </div>
            <p className="panel-copy">
              Enter a recipient handle like <code>jane@bybit</code> and choose
              the asset corridor to resolve.
            </p>
          </div>

          <form className="console-form" method="GET">
            <label className="field">
              <span>Recipient identifier</span>
              <input
                defaultValue={recipientIdentifier}
                name="recipientIdentifier"
                placeholder="jane@bybit"
              />
            </label>

            <div className="console-grid">
              <label className="field">
                <span>Chain</span>
                <select defaultValue={chain} name="chain">
                  {chainOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Asset</span>
                <select defaultValue={asset} name="asset">
                  {assetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button className="primary-button" type="submit">
              Resolve
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Resolved destination</p>
              <h3>Result</h3>
            </div>
          </div>

          {errorMessage ? (
            <p className="form-error">{errorMessage}</p>
          ) : result ? (
            <div className="panel-stack">
              <div className="result-summary">
                <div className="stacked-cell">
                  <strong>{result.recipientDisplayName ?? recipientIdentifier}</strong>
                  <span>{result.platform ?? "Source platform unavailable"}</span>
                </div>
                <StatusBadge status={result.verified ? "VERIFIED" : "NO_MATCH"} />
              </div>

              <div className="chip-row">
                <span className="event-chip">Forward Lookup</span>
                <span className="event-chip">{formatDisclosureMode(result.disclosureMode)}</span>
              </div>

              <div className="detail-grid">
                <div className="detail-card">
                  <span>Resolved destination</span>
                  <strong className="mono-value">{result.address ?? "Not available"}</strong>
                  <span>{`${result.chain ?? chain} / ${result.asset ?? asset}`}</span>
                </div>
                <div className="detail-card">
                  <span>Trust status</span>
                  <RiskBadge riskLevel={result.riskLevel} />
                  <span>{formatConstantLabel(result.recommendation ?? "review")}</span>
                </div>
              </div>

              <div className="chip-row">
                {result.flags.length === 0 ? (
                  <span className="event-chip">No risk flags</span>
                ) : (
                  result.flags.map((flag) => (
                    <span className="event-chip" key={flag}>
                      {formatConstantLabel(flag)}
                    </span>
                  ))
                )}
              </div>

              <div className="stacked-cell">
                <strong>Attestation expiry</strong>
                <span>{result.expiresAt ?? "No expiry returned"}</span>
              </div>

              <Link
                className="inline-link"
                href={`/resolution/by-address?platform=${encodeURIComponent(result.platform ?? "")}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(result.address ?? "")}`}
              >
                Try By Address
              </Link>
            </div>
          ) : (
            <EmptyState
              title="No recipient resolution yet"
              description="Submit a recipient handle to fetch the current verified destination."
            />
          )}
        </section>
      </div>

      {result ? <JsonPreviewPanel title="Raw response" value={result} /> : null}
    </section>
  );
}
