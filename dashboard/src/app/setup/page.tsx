import { AdminSetupWorkspace } from "@/components/admin-setup-workspace";
import { PartnerOnboardingHome } from "@/components/partner-onboarding-home";
import { consumeDashboardFlash } from "@/lib/flash";
import { getAdminSetupSession, getDashboardSession } from "@/lib/session";
import {
  type AdminSetupMetadataRecord,
  type AvailableProductionCorridorRecord,
  type AdminPartnerRecord,
  type AdminProductionApprovalRequestRecord,
  fetchAdminAvailableProductionCorridors,
  fetchAdminSetupMetadata,
  fetchAdminPartners,
  fetchAdminProductionApprovalRequests,
  fetchAvailableProductionCorridors,
  fetchPartnerDashboardMetadata,
  fetchPartnerProfile,
  fetchProductionApprovalRequests,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

interface SetupPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const dashboardSession = await getDashboardSession();
  const adminSession = await getAdminSetupSession();
  const flash = await consumeDashboardFlash();
  const params = await searchParams;
  const partnerSlug = readSearchParam(params.partnerSlug) ?? "";

  if (dashboardSession) {
    const [
      partnerProfile,
      metadata,
      productionApprovalRequests,
      availableProductionCorridors,
    ] = await Promise.all([
      fetchPartnerProfile(dashboardSession.accessToken),
      fetchPartnerDashboardMetadata(dashboardSession.accessToken),
      fetchProductionApprovalRequests(dashboardSession.accessToken),
      fetchAvailableProductionCorridors(dashboardSession.accessToken),
    ]);

    return (
      <PartnerOnboardingHome
        availableProductionCorridors={availableProductionCorridors}
        flash={flash}
        metadata={metadata}
        partnerProfile={partnerProfile}
        productionApprovalRequests={productionApprovalRequests}
      />
    );
  }

  const [partners, productionApprovalRequests, availableProductionCorridors, metadata]: [
    AdminPartnerRecord[],
    AdminProductionApprovalRequestRecord[],
    AvailableProductionCorridorRecord[],
    AdminSetupMetadataRecord | null,
  ] = adminSession
    ? await Promise.all([
        fetchAdminPartners(adminSession.adminToken),
        fetchAdminProductionApprovalRequests(adminSession.adminToken, {
          status: "PENDING",
        }),
        fetchAdminAvailableProductionCorridors(adminSession.adminToken),
        fetchAdminSetupMetadata(adminSession.adminToken),
      ])
    : [[], [], [], null];

  return (
    <AdminSetupWorkspace
      adminSessionActive={Boolean(adminSession)}
      availableProductionCorridors={availableProductionCorridors}
      flash={flash}
      metadata={metadata}
      partners={partners}
      partnerSlug={partnerSlug}
      productionApprovalRequests={productionApprovalRequests}
    />
  );
}

function readSearchParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}
