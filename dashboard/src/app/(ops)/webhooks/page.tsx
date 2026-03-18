import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import { readAllowedOption } from "@/lib/dashboard-metadata";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime, truncateMiddle } from "@/lib/format";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessScope,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchWebhookEndpoints,
  humanizeDashboardError,
  type CredentialScope,
  type WebhookEventType,
  type WebhookStatus,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface WebhooksPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function WebhooksPage({
  searchParams,
}: WebhooksPageProps) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const params = await searchParams;
  const canWriteWebhooks = canAccessScope(
    session.scopes as CredentialScope[],
    ["webhooks:write"],
  );

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);
    const filters = {
      status: readWebhookStatus(
        readSearchParam(params.status),
        metadata.optionSets.webhookStatuses,
      ),
      eventType: readWebhookEventType(
        readSearchParam(params.eventType),
        metadata.optionSets.webhookEventTypes,
      ),
      search: readSearchParam(params.search),
    };

    if (!partnerProfile.capabilities.webhooksEnabled) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Webhooks"
            description="Webhook operations are disabled for this organization."
            eyebrow="Webhook operations"
          />
          <ModuleAvailabilityBanner
            title="Webhooks are not enabled"
            description="This organization cannot configure query-side or data-feed webhooks until webhook capability is enabled during onboarding."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const endpoints = (await fetchWebhookEndpoints(session.accessToken)).filter(
      (endpoint) => {
        if (filters.status && endpoint.status !== filters.status) {
          return false;
        }
        if (filters.eventType && !endpoint.eventTypes.includes(filters.eventType)) {
          return false;
        }
        if (
          filters.search &&
          !endpoint.label.toLowerCase().includes(filters.search.toLowerCase()) &&
          !endpoint.url.toLowerCase().includes(filters.search.toLowerCase())
        ) {
          return false;
        }
        return true;
      },
    );

    return (
      <section className="panel-stack">
        <PageHeader
          title="Webhooks"
          description="Manage subscriptions and monitor endpoint health."
          eyebrow="Webhook operations"
          actions={
            canWriteWebhooks ? (
              <a className="primary-button" href="#create-webhook">
                Create Webhook
              </a>
            ) : undefined
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="summary-grid">
          <SummaryCard
            label="Active endpoints"
            value={endpoints.filter((endpoint) => endpoint.status === "ACTIVE").length}
          />
          <SummaryCard
            label="Paused endpoints"
            value={endpoints.filter((endpoint) => endpoint.status === "PAUSED").length}
          />
          <SummaryCard
            label="Recent failures"
            value={endpoints.reduce(
              (total, endpoint) => total + (endpoint.deliveryStats?.FAILED ?? 0),
              0,
            )}
          />
          <SummaryCard
            label="Delivery success"
            value={`${calculateWebhookSuccessRate(endpoints)}%`}
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
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">All statuses</option>
              {metadata.optionSets.webhookStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
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
            <span>Search URL or label</span>
            <input
              defaultValue={filters.search ?? ""}
              name="search"
              placeholder="Search endpoint"
            />
          </label>
        </FilterBar>

        {canWriteWebhooks ? (
          <section className="panel" id="create-webhook">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Create subscription</p>
                <h3>Register a webhook endpoint</h3>
              </div>
            </div>

            <form action="/webhooks/actions/create" className="console-form" method="POST">
              <div className="console-grid">
                <label className="field">
                  <span>Label</span>
                  <input name="label" placeholder="Operations webhook" />
                </label>
                <label className="field">
                  <span>Endpoint URL</span>
                  <input name="url" placeholder="https://partner.example/webhooks" />
                </label>
              </div>

              <fieldset className="event-fieldset">
                <legend>Subscribed events</legend>
                <div className="event-grid">
                  {metadata.optionSets.webhookEventTypes.map((eventType) => (
                    <label className="event-option" key={eventType}>
                      <input
                        defaultChecked={eventType === "DESTINATION_UPDATED"}
                        name="eventTypes"
                        type="checkbox"
                        value={eventType}
                      />
                      {eventType}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button className="primary-button" type="submit">
                Create Webhook
              </button>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <DataTable
            columns={[
              { key: "url", label: "Endpoint" },
              { key: "events", label: "Events" },
              { key: "status", label: "Status" },
              { key: "health", label: "Health" },
              { key: "created", label: "Created" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No webhooks configured"
                description="Create the first webhook endpoint to start receiving partner events."
                action={
                  canWriteWebhooks ? (
                    <a className="primary-button" href="#create-webhook">
                      Create webhook
                    </a>
                  ) : undefined
                }
              />
            }
            rows={endpoints.map((endpoint) => ({
              key: endpoint.id,
              cells: [
                <div className="stacked-cell" key={`${endpoint.id}-endpoint`}>
                  <strong>{endpoint.label}</strong>
                  <span>{truncateMiddle(endpoint.url, 18)}</span>
                </div>,
                endpoint.eventTypes.join(", "),
                <StatusBadge key={`${endpoint.id}-status`} status={endpoint.status} />,
                `${endpoint.deliveryStats?.SUCCEEDED ?? 0} succeeded / ${
                  endpoint.deliveryStats?.FAILED ?? 0
                } failed`,
                formatDateTime(endpoint.createdAt),
                <Link
                  className="inline-link"
                  href={`/webhooks/${endpoint.id}`}
                  key={`${endpoint.id}-detail`}
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
          title="Webhooks unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function calculateWebhookSuccessRate(
  endpoints: Awaited<ReturnType<typeof fetchWebhookEndpoints>>,
): number {
  const totals = endpoints.reduce(
    (accumulator, endpoint) => {
      const deliveryStats = endpoint.deliveryStats ?? {};
      return {
        succeeded: accumulator.succeeded + (deliveryStats.SUCCEEDED ?? 0),
        failed: accumulator.failed + (deliveryStats.FAILED ?? 0),
      };
    },
    { succeeded: 0, failed: 0 },
  );

  const attempts = totals.succeeded + totals.failed;

  if (attempts === 0) {
    return 100;
  }

  return Math.round((totals.succeeded / attempts) * 100);
}

function readWebhookStatus(
  value: string | undefined,
  options: readonly WebhookStatus[],
): WebhookStatus | undefined {
  return readAllowedOption(value, options);
}

function readWebhookEventType(
  value: string | undefined,
  options: readonly WebhookEventType[],
): WebhookEventType | undefined {
  return readAllowedOption(value, options);
}
