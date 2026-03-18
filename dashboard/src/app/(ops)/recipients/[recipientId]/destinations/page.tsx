import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, truncateMiddle } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchDestinations,
  fetchPartnerProfile,
  fetchRecipient,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function RecipientDestinationsPage({
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
            title="Recipient Destinations"
            description="Inspect destination coverage linked to a single recipient."
            eyebrow="Recipient detail"
          />
          <ModuleAvailabilityBanner
            title="Recipient destinations are unavailable"
            description="Destination coverage is available to data-contributing partners once registry capability is enabled."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const [recipient, destinations] = await Promise.all([
      fetchRecipient(session.accessToken, recipientId),
      fetchDestinations(session.accessToken, { recipientId }),
    ]);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Recipient Destinations"
          description={`Destinations for ${recipient.displayName ?? recipient.externalRecipientId}`}
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
              { key: "asset", label: "Asset / Chain" },
              { key: "address", label: "Address" },
              { key: "status", label: "Status" },
              { key: "expires", label: "Expires" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No destinations"
                description="No destinations are currently registered for this recipient."
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
          title="Recipient destinations unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
