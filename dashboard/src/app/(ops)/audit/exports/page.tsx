import { redirect } from "next/navigation";
import { DashboardFlashBanner } from "@/components/dashboard-flash-banner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { consumeDashboardFlash } from "@/lib/flash";
import { formatDateTime } from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  fetchAuditExports,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function AuditExportsPage() {
  const session = await requireDashboardSession();
  const flash = await consumeDashboardFlash();

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);

    if (!partnerProfile.capabilities.auditExportsEnabled) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Audit Exports"
            description="Audit export jobs are not enabled for this organization."
            eyebrow="Audit"
          />
          <ModuleAvailabilityBanner
            title="Audit exports are unavailable"
            description="Export jobs unlock when compliance export capability is enabled for your organization."
            actionHref="/setup"
            actionLabel="Review readiness"
          />
        </section>
      );
    }

    const exports = await fetchAuditExports(session.accessToken);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Audit Exports"
          description="Generate and manage audit exports for compliance and reporting."
          eyebrow="Audit"
        />

        {flash ? <DashboardFlashBanner flash={flash} /> : null}

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Request export</p>
              <h3>Create a compliance export job</h3>
            </div>
          </div>

          <form action="/audit/actions/create-export" className="console-form" method="POST">
            <div className="console-grid">
              <label className="field">
                <span>Format</span>
                <select defaultValue="CSV" name="format">
                  {metadata.optionSets.auditExportFormats.map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Actor type</span>
                <select defaultValue="" name="actorType">
                  <option value="">All actor types</option>
                  {metadata.optionSets.auditActorTypes.map((actorType) => (
                    <option key={actorType} value={actorType}>
                      {actorType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="console-grid">
              <label className="field">
                <span>Action filter</span>
                <input name="action" placeholder="Optional action filter" />
              </label>
              <label className="field">
                <span>Entity type filter</span>
                <input name="entityType" placeholder="Optional entity type" />
              </label>
            </div>
            <div className="console-grid">
              <label className="field">
                <span>Date from</span>
                <input name="dateFrom" type="date" />
              </label>
              <label className="field">
                <span>Date to</span>
                <input name="dateTo" type="date" />
              </label>
            </div>
            <button className="primary-button" type="submit">
              Request Export
            </button>
          </form>
        </section>

        <section className="panel">
          <DataTable
            columns={[
              { key: "id", label: "Export id" },
              { key: "format", label: "Format" },
              { key: "status", label: "Status" },
              { key: "created", label: "Requested" },
              { key: "expires", label: "Expires" },
              { key: "download", label: "Download" },
            ]}
            emptyState={
              <EmptyState
                title="No exports"
                description="Request an audit export to capture partner activity for compliance or reporting."
              />
            }
            rows={exports.map((job) => ({
              key: job.id,
              cells: [
                job.id,
                job.format,
                <StatusBadge key={`${job.id}-status`} status={job.status} />,
                formatDateTime(job.createdAt),
                formatDateTime(job.expiresAt),
                job.downloadContent ? (
                  <a
                    className="inline-link"
                    download={job.downloadFilename ?? `${job.id}.${job.format.toLowerCase()}`}
                    href={`data:${job.downloadMimeType ?? "text/plain"};charset=utf-8,${encodeURIComponent(job.downloadContent)}`}
                    key={`${job.id}-download`}
                  >
                    Download
                  </a>
                ) : (
                  <span>Not ready</span>
                ),
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
          title="Audit exports unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
