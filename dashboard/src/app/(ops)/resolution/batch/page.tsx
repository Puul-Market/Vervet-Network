import Link from "next/link";
import { redirect } from "next/navigation";
import { BatchVerifyConsole } from "@/components/batch-verify-console";
import { ModuleAvailabilityBanner } from "@/components/module-availability-banner";
import { PageHeader } from "@/components/page-header";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  canAccessModule,
  canRunOperationalResolution,
  DashboardAuthError,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function BatchVerifyPage() {
  const session = await requireDashboardSession();

  try {
    const [partnerProfile, metadata] = await Promise.all([
      fetchPartnerProfile(session.accessToken),
      fetchPartnerDashboardMetadata(session.accessToken),
    ]);

    if (!canAccessModule(partnerProfile, "resolution")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Batch Verify"
            description="Upload or paste multiple transfer destinations and verify them synchronously against the partner resolution network."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Batch verification is unavailable"
            description="Batch verification is available to API consumers and data-contributing partners once resolution capability is enabled."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    if (!canAccessModule(partnerProfile, "batch_verification")) {
      return (
        <section className="panel-stack">
          <PageHeader
            title="Batch Verify"
            description="Upload or paste multiple transfer destinations and verify them synchronously against the partner resolution network."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Batch verification is disabled"
            description="Enable batch verification capability for this organization before using treasury-scale verification workflows."
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
            title="Batch Verify"
            description="Upload or paste multiple transfer destinations and verify them synchronously against the partner resolution network."
            eyebrow="Resolution"
          />
          <ModuleAvailabilityBanner
            title="Batch verification is currently unavailable"
            description="Enable sandbox or production access before running live batch verification requests for this organization."
            actionHref="/setup"
            actionLabel="Continue setup"
          />
        </section>
      );
    }

    return (
      <section className="panel-stack">
        <PageHeader
          title="Batch Verify"
          description="Upload or paste multiple transfer destinations and verify them synchronously against the partner resolution network."
          eyebrow="Resolution"
          actions={
            <div className="page-header-actions">
              <Link className="secondary-button" href="/docs/quickstart">
                Download format guide
              </Link>
              <Link className="secondary-button" href="/resolution/logs">
                View Logs
              </Link>
            </div>
          }
        />

        <BatchVerifyConsole
          assetNetworks={metadata.assetNetworks}
          defaultInput={
            metadata.sandbox.batchDefaultInput ??
            "client_ref,recipient_identifier,address\nsample-1,jane@bybit,0x0000000000000000000000000000000000000000"
          }
          inputFormatOptions={metadata.optionSets.resolutionBatchInputFormats}
          lookupModeOptions={metadata.optionSets.resolutionBatchLookupModes}
        />
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
          title="Batch verification unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
