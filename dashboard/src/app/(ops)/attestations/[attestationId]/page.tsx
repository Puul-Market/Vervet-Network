import Link from "next/link";
import { redirect } from "next/navigation";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { ResolutionAvailabilityCard } from "@/components/resolution-availability-card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchAttestation,
  fetchPartnerProfile,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function AttestationDetailPage({
  params,
}: {
  params: Promise<{ attestationId: string }>;
}) {
  const session = await requireDashboardSession();
  const { attestationId } = await params;

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);

    if (!canAccessModule(partnerProfile, "registry")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Attestation detail"
            description="Inspect one attestation and its linked trust objects."
            eyebrow="Recipient registry"
          />
          <ModuleAvailabilityBanner
            title="Attestation detail is unavailable"
            description="Attestation detail is available to data-contributing partners once registry capability is enabled."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const attestation = await fetchAttestation(session.accessToken, attestationId);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Attestation Detail"
          description="Deep inspection of a single destination trust artifact."
          eyebrow="Attestation"
          actions={
            <Link className="secondary-button" href="/attestations">
              Back to attestations
            </Link>
          }
        />

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Summary</p>
                <h3>{attestation.id}</h3>
              </div>
            </div>

            <div className="chip-row">
              <StatusBadge status={attestation.verificationStatus} />
              <StatusBadge status={attestation.attestationType} />
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Issued</span>
                <strong>{formatDateTime(attestation.issuedAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Expires</span>
                <strong>{formatDateTime(attestation.expiresAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Verification</span>
                <strong>{formatDateTime(attestation.verifiedAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Signing key</span>
                <strong>{attestation.signingKey.keyId}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Linked entities</p>
                <h3>Recipient and destination</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Recipient</span>
                <strong>
                  <Link className="inline-link" href={`/recipients/${attestation.recipient.id}`}>
                    {attestation.recipient.displayName ?? attestation.recipient.externalRecipientId}
                  </Link>
                </strong>
              </div>
              <div className="metadata-row">
                <span>Destination</span>
                <strong>
                  {attestation.destination ? (
                    <Link
                      className="inline-link"
                      href={`/destinations/${attestation.destination.id}`}
                    >
                      {attestation.destination.address}
                    </Link>
                  ) : (
                    "No linked destination"
                  )}
                </strong>
              </div>
              <div className="metadata-row">
                <span>Asset network</span>
                <strong>
                  {attestation.assetNetwork
                    ? `${attestation.assetNetwork.assetSymbol} on ${attestation.assetNetwork.chainDisplayName}`
                    : "Not attached"}
                </strong>
              </div>
              <div className="metadata-row">
                <span>Payload hash</span>
                <strong>{attestation.payloadHash}</strong>
              </div>
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Resolution policy</p>
              <h3>Lookup and disclosure controls</h3>
            </div>
          </div>

          <ResolutionAvailabilityCard
            byRecipient
            byAddress
            disclosureMode={attestation.resolutionPolicy?.disclosureMode ?? "FULL_LABEL"}
            platforms={[attestation.recipient.identifier]}
          />
        </section>

        <JsonPreviewPanel title="Canonical payload" value={attestation.canonicalPayload} />
        <JsonPreviewPanel title="Signed payload" value={attestation.payload} />
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
          title="Attestation unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
