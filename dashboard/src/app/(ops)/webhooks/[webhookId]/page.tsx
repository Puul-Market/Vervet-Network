import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SummaryCard } from "@/components/summary-card";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchPartnerProfile,
  fetchWebhookEndpoint,
  humanizeDashboardError,
  type CredentialScope,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function WebhookDetailPage({
  params,
}: {
  params: Promise<{ webhookId: string }>;
}) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const { webhookId } = await params;
  const canWriteWebhooks = canAccessScope(
    session.scopes as CredentialScope[],
    ["webhooks:write"],
  );

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);

    if (!canAccessModule(partnerProfile, "webhooks")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Webhook detail"
            description="Inspect one webhook endpoint and its recent delivery behavior."
            eyebrow="Webhook operations"
          />
          <ModuleAvailabilityBanner
            title="Webhook detail is unavailable"
            description="Webhook management is available once webhook capability is enabled for this organization."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const endpoint = await fetchWebhookEndpoint(session.accessToken, webhookId);

    return (
      <section className="panel-stack">
        <PageHeader
          title={endpoint.label}
          description={endpoint.url}
          eyebrow="Webhook detail"
          actions={
            <Link className="secondary-button" href="/webhooks">
              Back to webhooks
            </Link>
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="summary-grid">
          <SummaryCard label="Status" value={endpoint.status} />
          <SummaryCard
            label="Events"
            value={endpoint.eventTypes.length}
            hint={endpoint.eventTypes.join(", ")}
          />
          <SummaryCard
            label="Signing secret version"
            value={`v${endpoint.signingSecretVersion}`}
          />
          <SummaryCard
            label="Last delivered"
            value={formatDateTime(endpoint.lastDeliveredAt ?? null)}
          />
        </section>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Endpoint summary</p>
                <h3>Configuration</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>URL</span>
                <strong>{endpoint.url}</strong>
              </div>
              <div className="metadata-row">
                <span>Status</span>
                <strong>{endpoint.status}</strong>
              </div>
              <div className="metadata-row">
                <span>Subscribed events</span>
                <strong>{endpoint.eventTypes.join(", ")}</strong>
              </div>
              <div className="metadata-row">
                <span>Created</span>
                <strong>{formatDateTime(endpoint.createdAt)}</strong>
              </div>
            </div>

            {canWriteWebhooks ? (
              <div className="table-actions">
                <form action="/webhooks/actions/test" method="POST">
                  <input name="endpointId" type="hidden" value={endpoint.id} />
                  <input name="redirectTo" type="hidden" value={`/webhooks/${endpoint.id}`} />
                  <button className="secondary-button" type="submit">
                    Test Endpoint
                  </button>
                </form>
                <form action="/webhooks/actions/rotate-secret" method="POST">
                  <input name="endpointId" type="hidden" value={endpoint.id} />
                  <input name="redirectTo" type="hidden" value={`/webhooks/${endpoint.id}`} />
                  <button className="secondary-button" type="submit">
                    Rotate Secret
                  </button>
                </form>
                <form action="/webhooks/actions/status" method="POST">
                  <input name="endpointId" type="hidden" value={endpoint.id} />
                  <input name="redirectTo" type="hidden" value={`/webhooks/${endpoint.id}`} />
                  <input
                    name="nextStatus"
                    type="hidden"
                    value={endpoint.status === "PAUSED" ? "ACTIVE" : "PAUSED"}
                  />
                  <button className="secondary-button" type="submit">
                    {endpoint.status === "PAUSED" ? "Resume" : "Pause"}
                  </button>
                </form>
                <form action="/webhooks/actions/status" method="POST">
                  <input name="endpointId" type="hidden" value={endpoint.id} />
                  <input name="redirectTo" type="hidden" value={`/webhooks/${endpoint.id}`} />
                  <input name="nextStatus" type="hidden" value="DISABLED" />
                  <button className="secondary-button danger-button" type="submit">
                    Disable
                  </button>
                </form>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Delivery health</p>
                <h3>Recent delivery stats</h3>
              </div>
            </div>

            <div className="summary-grid compact-summary-grid">
              <SummaryCard label="Succeeded" value={endpoint.deliveryStats?.SUCCEEDED ?? 0} />
              <SummaryCard label="Failed" value={endpoint.deliveryStats?.FAILED ?? 0} />
              <SummaryCard label="Pending" value={endpoint.deliveryStats?.PENDING ?? 0} />
              <SummaryCard label="Abandoned" value={endpoint.deliveryStats?.ABANDONED ?? 0} />
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent deliveries</p>
              <h3>Latest endpoint attempts</h3>
            </div>
          </div>

          <DataTable
            columns={[
              { key: "event", label: "Event type" },
              { key: "status", label: "Status" },
              { key: "attempts", label: "Attempts" },
              { key: "response", label: "Response code" },
              { key: "last", label: "Last attempt" },
              { key: "actions", label: "Actions" },
            ]}
            emptyState={
              <EmptyState
                title="No deliveries yet"
                description="Webhook deliveries will appear here once subscribed partner events start flowing."
              />
            }
            rows={(endpoint.deliveries ?? []).map((delivery) => ({
              key: delivery.id,
              cells: [
                delivery.eventType,
                <StatusBadge key={`${delivery.id}-status`} status={delivery.status} />,
                delivery.attemptCount,
                delivery.responseCode ?? "None",
                formatDateTime(delivery.lastAttemptAt),
                <Link
                  className="inline-link"
                  href={`/webhooks/deliveries/${delivery.id}`}
                  key={`${delivery.id}-detail`}
                >
                  View delivery
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
          title="Webhook unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
