import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchAttestations,
  fetchPartnerProfile,
  fetchRecipient,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function RecipientAttestationsPage({
  params,
}: {
  params: Promise<{ recipientId: string }>;
}) {
  const session = await requireDashboardSession();
  const { recipientId } = await params;

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);

    if (!canAccessModule(partnerProfile, "registry")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Recipient Attestations"
            description="Inspect attestation history linked to a single recipient."
            eyebrow="Recipient detail"
          />
          <ModuleAvailabilityBanner
            title="Recipient attestations are unavailable"
            description="Attestation history is available to data-contributing partners once registry capability is enabled."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const [recipient, attestations] = await Promise.all([
      fetchRecipient(session.accessToken, recipientId),
      fetchAttestations(session.accessToken, { recipientId, limit: 50 }),
    ]);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Recipient Attestations"
          description={`Attestation history for ${recipient.displayName ?? recipient.externalRecipientId}`}
          eyebrow="Recipient detail"
          actions={
            <Link className="secondary-button" href={`/recipients/${recipient.id}`}>
              Back to recipient
            </Link>
          }
        />

        <section className="panel">
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
                description="No signed attestations have been recorded for this recipient."
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
          title="Recipient attestations unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
