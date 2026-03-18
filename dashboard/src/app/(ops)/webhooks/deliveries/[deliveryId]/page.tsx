import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { JsonPreviewPanel } from "@/components/json-preview-panel";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canAccessScope,
  DashboardAuthError,
  fetchPartnerProfile,
  fetchWebhookDelivery,
  humanizeDashboardError,
  type CredentialScope,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function WebhookDeliveryDetailPage({
  params,
}: {
  params: Promise<{ deliveryId: string }>;
}) {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();
  const { deliveryId } = await params;
  const canReplay = canAccessScope(
    session.scopes as CredentialScope[],
    ["webhooks:replay"],
  );

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);

    if (!canAccessModule(partnerProfile, "webhooks")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Delivery detail"
            description="Inspect one webhook delivery attempt and its payload."
            eyebrow="Webhook operations"
          />
          <ModuleAvailabilityBanner
            title="Delivery detail is unavailable"
            description="Webhook delivery detail appears once webhook capability is enabled for this organization."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    const delivery = await fetchWebhookDelivery(session.accessToken, deliveryId);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Delivery Detail"
          description={`Webhook delivery ${delivery.id}`}
          eyebrow="Webhook operations"
          actions={
            <Link className="secondary-button" href="/webhooks/deliveries">
              Back to deliveries
            </Link>
          }
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Summary</p>
                <h3>{delivery.eventType}</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Endpoint</span>
                <strong>{delivery.endpoint.label}</strong>
              </div>
              <div className="metadata-row">
                <span>Status</span>
                <strong>{delivery.status}</strong>
              </div>
              <div className="metadata-row">
                <span>Attempts</span>
                <strong>{delivery.attemptCount}</strong>
              </div>
              <div className="metadata-row">
                <span>Response code</span>
                <strong>{delivery.responseCode ?? "None"}</strong>
              </div>
            </div>

            <div className="chip-row">
              <StatusBadge status={delivery.status} />
            </div>

            {canReplay ? (
              <form action="/webhooks/actions/replay-delivery" method="POST">
                <input name="deliveryId" type="hidden" value={delivery.id} />
                <input
                  name="redirectTo"
                  type="hidden"
                  value={`/webhooks/deliveries/${delivery.id}`}
                />
                <button className="secondary-button" type="submit">
                  Replay Delivery
                </button>
              </form>
            ) : null}
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Attempt timing</p>
                <h3>Latest delivery timestamps</h3>
              </div>
            </div>

            <div className="metadata-grid">
              <div className="metadata-row">
                <span>Created</span>
                <strong>{formatDateTime(delivery.createdAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Last attempt</span>
                <strong>{formatDateTime(delivery.lastAttemptAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Next attempt</span>
                <strong>{formatDateTime(delivery.nextAttemptAt)}</strong>
              </div>
              <div className="metadata-row">
                <span>Last error</span>
                <strong>{delivery.lastError ?? "None"}</strong>
              </div>
            </div>
          </section>
        </section>

        {delivery.payload ? (
          <JsonPreviewPanel title="Payload" value={delivery.payload} />
        ) : null}
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
          title="Delivery unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
