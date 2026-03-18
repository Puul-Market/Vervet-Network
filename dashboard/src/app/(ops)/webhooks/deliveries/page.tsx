import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { readAllowedOption } from "@/lib/dashboard-metadata";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime } from "@/lib/format";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchWebhookDeliveries,
  humanizeDashboardError,
  type DeliveryStatus,
  type WebhookEventType,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface WebhookDeliveriesPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function WebhookDeliveriesPage({
  searchParams,
}: WebhookDeliveriesPageProps) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const params = await searchParams;

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    const filters = {
      endpointId: readSearchParam(params.endpointId),
      eventType: readWebhookEventType(
        readSearchParam(params.eventType),
        metadata.optionSets.webhookEventTypes,
      ),
      status: readDeliveryStatus(
        readSearchParam(params.status),
        metadata.optionSets.deliveryStatuses,
      ),
    };

    if (!canAccessModule(partnerProfile, "webhooks")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Deliveries"
            description="Inspect webhook delivery attempts and failures."
            eyebrow="Webhook operations"
          />
          <ModuleAvailabilityBanner
            title="Webhook deliveries are unavailable"
            description="Webhook delivery monitoring appears once webhook capability is enabled for this organization."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const deliveries = await fetchWebhookDeliveries(session.accessToken, filters);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Deliveries"
          description="Inspect webhook delivery attempts and failures."
          eyebrow="Webhook operations"
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <FilterBar
          actions={
            <button className="secondary-button" type="submit">
              Apply filters
            </button>
          }
        >
          <label className="field">
            <span>Endpoint id</span>
            <input
              defaultValue={filters.endpointId ?? ""}
              name="endpointId"
              placeholder="Filter by endpoint id"
            />
          </label>
          <label className="field">
            <span>Event type</span>
            <select defaultValue={filters.eventType ?? ""} name="eventType">
              <option value="">All event types</option>
              {metadata.optionSets.webhookEventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">All statuses</option>
              {metadata.optionSets.deliveryStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        <section className="panel">
          <DataTable
            columns={[
              { key: "id", label: "Delivery id" },
              { key: "endpoint", label: "Endpoint" },
              { key: "event", label: "Event type" },
              { key: "status", label: "Status" },
              { key: "attempts", label: "Attempts" },
              { key: "last", label: "Last attempt" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No deliveries"
                description="Webhook delivery attempts will appear here once events start flowing."
              />
            }
            rows={deliveries.map((delivery) => ({
              key: delivery.id,
              cells: [
                delivery.id,
                delivery.endpoint.label,
                delivery.eventType,
                <StatusBadge key={`${delivery.id}-status`} status={delivery.status} />,
                delivery.attemptCount,
                formatDateTime(delivery.lastAttemptAt),
                <Link
                  className="inline-link"
                  href={`/webhooks/deliveries/${delivery.id}`}
                  key={`${delivery.id}-detail`}
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
          title="Deliveries unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function readDeliveryStatus(
  value: string | undefined,
  options: readonly DeliveryStatus[],
): DeliveryStatus | undefined {
  return readAllowedOption(value, options);
}

function readWebhookEventType(
  value: string | undefined,
  options: readonly WebhookEventType[],
): WebhookEventType | undefined {
  return readAllowedOption(value, options);
}
