import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { readAllowedOption } from "@/lib/dashboard-metadata";
import { formatDateTime, summarizeMetadata } from "@/lib/format";
import { readSearchParam, type DashboardSearchParams } from "@/lib/search-params";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  fetchAuditLogs,
  fetchPartnerDashboardMetadata,
  humanizeDashboardError,
  type AuditActorType,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface AuditLogsPageProps {
  searchParams: Promise<DashboardSearchParams>;
}

export default async function AuditLogsPage({
  searchParams,
}: AuditLogsPageProps) {
  const session = await requireDashboardSession();
  const params = await searchParams;

  try {
    const metadata = await fetchPartnerDashboardMetadata(session.accessToken);
    const filters = {
      actorType: readActorType(
        readSearchParam(params.actorType),
        metadata.optionSets.auditActorTypes,
      ),
      action: readSearchParam(params.action),
      entityType: readSearchParam(params.entityType),
      entityId: readSearchParam(params.entityId),
    };
    const auditLogs = await fetchAuditLogs(session.accessToken, filters);

    return (
      <section className="panel-stack">
        <PageHeader
          title="Audit Log"
          description="Review operational and security-relevant events across the partner workspace."
          eyebrow="Audit"
          actions={
            <Link className="secondary-button" href="/audit/exports">
              Export
            </Link>
          }
        />

        <FilterBar
          actions={
            <button className="secondary-button" type="submit">
              Apply filters
            </button>
          }
        >
          <label className="field">
            <span>Actor type</span>
            <select defaultValue={filters.actorType ?? ""} name="actorType">
              <option value="">All actor types</option>
              {metadata.optionSets.auditActorTypes.map((actorType) => (
                <option key={actorType} value={actorType}>
                  {actorType}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Action</span>
            <input defaultValue={filters.action ?? ""} name="action" placeholder="PARTNER_USER_INVITED" />
          </label>
          <label className="field">
            <span>Resource type</span>
            <input defaultValue={filters.entityType ?? ""} name="entityType" placeholder="WebhookEndpoint" />
          </label>
          <label className="field">
            <span>Resource id</span>
            <input defaultValue={filters.entityId ?? ""} name="entityId" placeholder="Optional entity id" />
          </label>
        </FilterBar>

        <section className="panel">
          <DataTable
            columns={[
              { key: "time", label: "Timestamp" },
              { key: "actor", label: "Actor" },
              { key: "action", label: "Action" },
              { key: "resource", label: "Resource" },
              { key: "context", label: "Context" },
              { key: "detail", label: "Detail" },
            ]}
            emptyState={
              <EmptyState
                title="No audit events"
                description="Partner mutations and system-side actions will appear here."
              />
            }
            rows={auditLogs.map((event) => ({
              key: event.id,
              cells: [
                formatDateTime(event.createdAt),
                event.actorIdentifier ?? event.actorType,
                event.action,
                `${event.entityType} · ${event.entityId}`,
                summarizeMetadata(event.metadata),
                <Link
                  className="inline-link"
                  href={`/audit/logs/${event.id}`}
                  key={`${event.id}-detail`}
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
          title="Audit log unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}

function readActorType(
  value: string | undefined,
  options: readonly AuditActorType[],
): AuditActorType | undefined {
  return readAllowedOption(value, options);
}
