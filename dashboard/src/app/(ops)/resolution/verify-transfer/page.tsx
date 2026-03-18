import Link from "next/link";
import { redirect } from "next/navigation";
import { AddressVerificationFlowForm } from "@/components/address-verification-flow-form";
import { EmptyState } from "@/components/empty-state";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { LookupModeSwitcher } from "@/components/lookup-mode-switcher";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { DisclosurePolicyBadge } from "@/components/recipient-confirmation-card";
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
  confirmRecipientByAddress,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchSupportedPlatforms,
  humanizeDashboardError,
  verifyDestination,
  type ConfirmRecipientResponseRecord,
  type SupportedPlatformRecord,
  type VerifyResponseRecord,
} from "@/lib/vervet-api";
import { formatConstantLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type VerifyTransferMode = "RECIPIENT_CONTEXT" | "ADDRESS_CONTEXT";

interface VerifyTransferPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function VerifyTransferPage({
  searchParams,
}: VerifyTransferPageProps) {
  const session = await requireDashboardSession();
  const params = await searchParams;
  const mode = readMode(readSearchParam(params.mode));
  const recipientIdentifier = readSearchParam(params.recipientIdentifier) ?? "";
  const platform = readSearchParam(params.platform) ?? "";
  const address = readSearchParam(params.address) ?? "";

  let supportedPlatforms: SupportedPlatformRecord[] = [];
  let recipientResult: VerifyResponseRecord | null = null;
  let addressResult: ConfirmRecipientResponseRecord | null = null;
  let errorMessage: string | null = null;
  let chain = "";
  let asset = "";
  let assetNetworks = [] as Awaited<
    ReturnType<typeof fetchPartnerDashboardMetadata>
  >["assetNetworks"];
  let chainOptions = [] as ReturnType<typeof buildChainOptions>;
  let assetOptions = [] as ReturnType<typeof buildAssetOptions>;

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    assetNetworks = metadata.assetNetworks;
    chain = resolveDefaultChain(assetNetworks, readSearchParam(params.chain));
    asset = resolveDefaultAsset(assetNetworks, readSearchParam(params.asset));
    chainOptions = buildChainOptions(assetNetworks);
    assetOptions = buildAssetOptions(assetNetworks);

    if (!canAccessModule(partnerProfile, "resolution")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Verify Transfer"
            description="Evaluate whether a transfer is safe using recipient-led or address-led resolution context."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Transfer verification is unavailable"
            description="Transfer verification is available to API consumers and data-contributing partners once resolution capability is enabled."
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
            title="Verify Transfer"
            description="Evaluate whether a transfer is safe using recipient-led or address-led resolution context."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Transfer verification is currently unavailable"
            description="Enable sandbox or production access before running live verification checks for this organization."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    supportedPlatforms = await fetchSupportedPlatforms(session.accessToken, {
      chain,
      asset,
      ...(mode === "ADDRESS_CONTEXT" ? { lookupMode: "BY_ADDRESS" as const } : {}),
    });

    if (
      address &&
      ((mode === "RECIPIENT_CONTEXT" && recipientIdentifier) ||
        mode === "ADDRESS_CONTEXT")
    ) {
      if (mode === "RECIPIENT_CONTEXT") {
        recipientResult = await verifyDestination(session.accessToken, {
          recipientIdentifier,
          address,
          chain,
          asset,
        });
      } else {
        addressResult = await confirmRecipientByAddress(session.accessToken, {
          platform: platform || undefined,
          address,
          chain,
          asset,
        });
      }
    }
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      redirect("/");
    }

    errorMessage = humanizeDashboardError(error);
  }

  const result = mode === "RECIPIENT_CONTEXT" ? recipientResult : addressResult;

  return (
    <section className="panel-stack">
      <PageHeader
        title="Verify Transfer"
        description="Evaluate whether a transfer is safe using recipient-led or address-led resolution context."
        eyebrow="Resolution"
        actions={
          <div className="page-header-actions">
            <Link className="secondary-button" href="/resolution/by-recipient">
              By Recipient
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
              <p className="eyebrow">Transfer Verification</p>
              <h3>Review the destination before sending</h3>
            </div>
          </div>

          <LookupModeSwitcher currentMode={mode} />

          {mode === "RECIPIENT_CONTEXT" ? (
            <form className="console-form" method="GET">
              <input name="mode" type="hidden" value={mode} />

              <div className="detail-card">
                <p className="eyebrow">Step 1</p>
                <strong>Choose the transfer corridor</strong>
                <span>
                  Start with asset and network so the verification is evaluated
                  against the exact route the sender will use.
                </span>
                <div className="console-grid">
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

                  <label className="field">
                    <span>Network</span>
                    <select defaultValue={chain} name="chain">
                      {chainOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="detail-card">
                <p className="eyebrow">Step 2</p>
                <strong>Choose the intended recipient</strong>
                <label className="field">
                  <span>Recipient identifier</span>
                  <input
                    defaultValue={recipientIdentifier}
                    name="recipientIdentifier"
                    placeholder="jane@bybit"
                  />
                </label>
              </div>

              <div className="detail-card">
                <p className="eyebrow">Step 3</p>
                <strong>Paste the destination you want to use</strong>
                <label className="field">
                  <span>Recipient wallet address</span>
                  <textarea
                    defaultValue={address}
                    name="address"
                    placeholder="Paste destination address"
                  />
                </label>
              </div>

              <button className="primary-button" type="submit">
                Check transfer
              </button>
            </form>
          ) : (
            <AddressVerificationFlowForm
              assetNetworks={assetNetworks}
              defaultAddress={address}
              defaultAsset={asset}
              defaultChain={chain}
              defaultPlatform={platform}
              extraQuery={{ mode }}
              initialPlatforms={supportedPlatforms}
              lookupMode="BY_ADDRESS"
              submitIntent="VERIFY_TRANSFER"
              submitLabel="Check transfer"
            />
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Verification result</p>
              <h3>Safety decision</h3>
            </div>
          </div>

          {errorMessage ? (
            <p className="form-error">{errorMessage}</p>
          ) : result ? (
            <div className="panel-stack">
              {mode === "RECIPIENT_CONTEXT" && recipientResult ? (
                <>
                  <div className="result-summary">
                    <div className="stacked-cell">
                      <strong>{recipientResult.recipientDisplayName ?? recipientIdentifier}</strong>
                      <span>{recipientResult.platform ?? "Platform unavailable"}</span>
                    </div>
                    <StatusBadge status={recipientResult.match ? "SAFE_TO_SEND" : "DO_NOT_SEND"} />
                  </div>

                  <div className="chip-row">
                    <span className="event-chip">Transfer Verification</span>
                    <span className="event-chip">Recipient Context</span>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-card">
                      <span>Validation</span>
                      <strong>{recipientResult.match ? "Exact attested match" : "Address does not match"}</strong>
                      <span>{recipientResult.verified ? "Verified by active attestation" : "Not verified"}</span>
                    </div>
                    <div className="detail-card">
                      <span>Recommendation rationale</span>
                      <RiskBadge riskLevel={recipientResult.riskLevel} />
                      <span>{formatConstantLabel(recipientResult.recommendation ?? "review")}</span>
                    </div>
                  </div>

                  {!recipientResult.match ? (
                  <div className="detail-card">
                    <span>Suggested next step</span>
                    <strong>Use the resolved destination instead of the pasted address.</strong>
                    <Link
                      className="inline-link"
                      href={`/resolution/by-recipient?recipientIdentifier=${encodeURIComponent(recipientIdentifier)}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}`}
                      >
                        Use Resolved Destination
                      </Link>
                    </div>
                  ) : null}
                </>
              ) : null}

              {mode === "ADDRESS_CONTEXT" && addressResult ? (
                <>
                  <div className="result-summary">
                    <div className="stacked-cell">
                      <strong>{addressResult.recipientDisplayName ?? "Recipient hidden by policy"}</strong>
                      <span>{addressResult.platform ?? platform ?? "Platform not specified"}</span>
                    </div>
                    <StatusBadge
                      status={
                        addressResult.confirmed
                          ? "SAFE_TO_SEND"
                          : addressResult.requiresPlatformSelection
                            ? "AMBIGUOUS"
                            : "DO_NOT_SEND"
                      }
                    />
                  </div>

                  <div className="chip-row">
                    <span className="event-chip">Transfer Verification</span>
                    <span className="event-chip">Address Context</span>
                    <DisclosurePolicyBadge disclosureMode={addressResult.disclosureMode} />
                  </div>

                  <div className="detail-grid">
                    <div className="detail-card">
                      <span>Destination check</span>
                      <strong>
                        {addressResult.confirmed
                          ? "Verified destination"
                          : addressResult.requiresPlatformSelection
                            ? "Platform selection required"
                            : "Destination not confirmed"}
                      </strong>
                      <span>
                        {addressResult.confirmed
                          ? "The selected address matches an attested recipient context for this corridor."
                          : addressResult.requiresPlatformSelection
                            ? "This address maps to more than one valid platform for the corridor. Pick the intended platform before sending."
                            : "The selected address is not confirmed for this corridor."}
                      </span>
                    </div>
                    <div className="detail-card">
                      <span>Recommendation rationale</span>
                      <RiskBadge riskLevel={addressResult.riskLevel} />
                      <span>{formatConstantLabel(addressResult.recommendation ?? "review")}</span>
                    </div>
                  </div>

                  {addressResult.requiresPlatformSelection &&
                  (addressResult.candidatePlatforms?.length ?? 0) > 0 ? (
                    <div className="detail-card">
                      <span>Choose recipient platform</span>
                      <strong>Select the platform Vervet narrowed this address to.</strong>
                      <div className="table-actions">
                        {addressResult.candidatePlatforms?.map((candidate) => (
                          <Link
                            className="secondary-button"
                            href={`/resolution/verify-transfer?mode=ADDRESS_CONTEXT&platform=${encodeURIComponent(candidate.slug)}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(address)}`}
                            key={candidate.id}
                          >
                            {candidate.displayName}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="detail-card">
                    <span>Suggested next step</span>
                    <strong>
                      {addressResult.confirmed
                        ? "Safe to continue with this destination."
                        : addressResult.requiresPlatformSelection
                          ? "Select the intended recipient platform, then re-run the check."
                          : "Resolve by recipient or stop the transfer."}
                    </strong>
                    <div className="table-actions">
                      <Link className="inline-link" href="/resolution/by-recipient">
                        By Recipient
                      </Link>
                      <Link
                        className="inline-link"
                        href={`/resolution/by-address${addressResult.platform ? `?platform=${encodeURIComponent(addressResult.platform)}&chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(address)}` : `?chain=${encodeURIComponent(chain)}&asset=${encodeURIComponent(asset)}&address=${encodeURIComponent(address)}`}`}
                      >
                        Use Resolved Destination
                      </Link>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No transfer verification yet"
              description="Run transfer verification from recipient context or address context to get a safety decision."
            />
          )}
        </section>
      </div>

      {result ? <JsonPreviewPanel title="Raw response" value={result} /> : null}
    </section>
  );
}

function readMode(value: string | undefined): VerifyTransferMode {
  return value === "ADDRESS_CONTEXT" ? "ADDRESS_CONTEXT" : "RECIPIENT_CONTEXT";
}
