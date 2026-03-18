import Link from "next/link";
import { redirect } from "next/navigation";
import { AddressVerificationFlowForm } from "@/components/address-verification-flow-form";
import { EmptyState } from "@/components/empty-state";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import {
  DisclosurePolicyBadge,
  RecipientConfirmationCard,
} from "@/components/recipient-confirmation-card";
import { RiskBadge } from "@/components/risk-badge";
import {
  resolveDefaultAsset,
  resolveDefaultChain,
} from "@/lib/dashboard-metadata";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canRunOperationalResolution,
  confirmRecipientByAddress,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchSupportedPlatforms,
  humanizeDashboardError,
  type ConfirmRecipientResponseRecord,
  type SupportedPlatformRecord,
} from "@/lib/vervet-api";
import { formatConstantLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ByAddressPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function ByAddressPage({
  searchParams,
}: ByAddressPageProps) {
  const session = await requireDashboardSession();
  const params = await searchParams;
  const platform = readSearchParam(params.platform) ?? "";
  const address = readSearchParam(params.address) ?? "";

  let supportedPlatforms: SupportedPlatformRecord[] = [];
  let result: ConfirmRecipientResponseRecord | null = null;
  let errorMessage: string | null = null;
  let chain = "";
  let asset = "";
  let assetNetworks = [] as Awaited<
    ReturnType<typeof fetchPartnerDashboardMetadata>
  >["assetNetworks"];

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    assetNetworks = metadata.assetNetworks;
    chain = resolveDefaultChain(assetNetworks, readSearchParam(params.chain));
    asset = resolveDefaultAsset(assetNetworks, readSearchParam(params.asset));

    if (!canAccessModule(partnerProfile, "resolution")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="By Address"
            description="Confirm who a destination belongs to on a selected platform before sending."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Address-led resolution is unavailable"
            description="By Address workflows are available to API consumers and data-contributing partners once resolution capability is enabled."
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
            title="By Address"
            description="Confirm who a destination belongs to on a selected platform before sending."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Address confirmation is currently unavailable"
            description="Enable sandbox or production access before running live reverse-lookup requests for this organization."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    supportedPlatforms = await fetchSupportedPlatforms(session.accessToken, {
      chain,
      asset,
      lookupMode: "BY_ADDRESS",
    });

    if (address) {
      result = await confirmRecipientByAddress(session.accessToken, {
        platform: platform || undefined,
        address,
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
        title="By Address"
        description="Confirm who a destination belongs to on a selected platform before sending."
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
              <p className="eyebrow">Address-first send flow</p>
              <h3>Verify the destination before you send</h3>
            </div>
            <p className="panel-copy">
              Match the sender flow directly: choose the corridor, paste the
              wallet address, optionally narrow by recipient platform, and let
              Vervet confirm who controls the destination before send.
            </p>
          </div>

          <AddressVerificationFlowForm
            assetNetworks={assetNetworks}
            defaultAddress={address}
            defaultAsset={asset}
            defaultChain={chain}
            defaultPlatform={platform}
            initialPlatforms={supportedPlatforms}
            lookupMode="BY_ADDRESS"
            submitIntent="BY_ADDRESS"
            submitLabel="Verify destination"
          />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Step 4</p>
              <h3>Recipient confirmation</h3>
            </div>
          </div>

          {errorMessage ? (
            <p className="form-error">{errorMessage}</p>
          ) : result ? (
            <div className="panel-stack">
              <RecipientConfirmationCard result={result} />

              <div className="detail-card">
                <span>Transfer corridor</span>
                <strong>{`${result.asset ?? asset} on ${result.chain ?? chain}`}</strong>
                <span>
                  {result.confirmed
                    ? "This destination is confirmed for the selected corridor."
                    : result.requiresPlatformSelection
                      ? "Vervet found more than one plausible recipient platform for this address. Choose one to finish confirmation."
                      : "This destination is not confirmed for the selected corridor."}
                </span>
              </div>

              <div className="detail-card">
                <span>Verification policy</span>
                <div className="chip-row">
                  <DisclosurePolicyBadge disclosureMode={result.disclosureMode} />
                </div>
                <span>
                  {result.confirmed
                    ? "Show this confirmation to the sender before the final send action."
                    : result.recommendation}
                </span>
              </div>

              {result.requiresPlatformSelection &&
              (result.candidatePlatforms?.length ?? 0) > 0 ? (
                <div className="detail-card">
                  <span>Recipient platform required</span>
                  <strong>Choose the platform Vervet narrowed this address to.</strong>
                  <div className="table-actions">
                    {result.candidatePlatforms?.map((candidate) => (
                      <Link
                        className="secondary-button"
                        href={`/resolution/by-address?platform=${encodeURIComponent(candidate.slug)}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(address)}`}
                        key={candidate.id}
                      >
                        {candidate.displayName}
                      </Link>
                    ))}
                  </div>
                  <span>
                    If the sender knows the destination platform, pick it here
                    and rerun confirmation before allowing the transfer.
                  </span>
                </div>
              ) : null}

              <div className="detail-card">
                <span>Transfer safety</span>
                <RiskBadge riskLevel={result.riskLevel} />
                <span>{result.flags.map(formatConstantLabel).join(", ") || "No risk flags"}</span>
              </div>

              <div className="table-actions">
                <Link className="secondary-button" href={`/resolution/verify-transfer?mode=ADDRESS_CONTEXT${result.platform ? `&platform=${encodeURIComponent(result.platform)}` : platform ? `&platform=${encodeURIComponent(platform)}` : ""}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(address)}`}>
                  Continue in Verify Transfer
                </Link>
                <Link className="secondary-button" href="/resolution/by-recipient">
                  Try By Recipient
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No recipient confirmation yet"
              description="Choose the corridor, paste the wallet address, and optionally select the recipient platform. Vervet will only ask for platform if more than one valid match exists."
            />
          )}
        </section>
      </div>

      {result ? <JsonPreviewPanel title="Raw response" value={result} /> : null}
    </section>
  );
}
