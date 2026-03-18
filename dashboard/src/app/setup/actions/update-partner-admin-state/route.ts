import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readCheckboxField,
  readRequiredEnumField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearAdminSetupSession, getAdminSetupSession } from "@/lib/session";
import {
  DashboardAdminAuthError,
  humanizeDashboardError,
  updateAdminPartnerState,
  type PartnerFeedHealthStatus,
  type PartnerOnboardingStage,
  type PartnerStatus,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getAdminSetupSession();

  if (!session) {
    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  const formData = await request.formData();
  const partnerId = readRequiredTextField(formData.get("partnerId"));
  const partnerSlug = readRequiredTextField(formData.get("partnerSlug"));
  const status = readRequiredEnumField<PartnerStatus>(formData.get("status"));
  const onboardingStage = readRequiredEnumField<PartnerOnboardingStage>(
    formData.get("onboardingStage"),
  );
  const feedHealthStatus = readRequiredEnumField<PartnerFeedHealthStatus>(
    formData.get("feedHealthStatus"),
  );

  if (
    !partnerId ||
    !partnerSlug ||
    !status ||
    !onboardingStage ||
    !feedHealthStatus
  ) {
    await setDashboardFlash({
      level: "error",
      title: "Partner update failed",
      message:
        "Partner status, onboarding stage, and feed health must be selected before updating admin state.",
    });

    return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
  }

  try {
    await updateAdminPartnerState(session.adminToken, partnerId, {
      status,
      onboardingStage,
      feedHealthStatus,
      apiConsumerEnabled: readCheckboxField(formData.get("apiConsumerEnabled")),
      dataPartnerEnabled: readCheckboxField(formData.get("dataPartnerEnabled")),
      fullAttestationPartnerEnabled: readCheckboxField(
        formData.get("fullAttestationPartnerEnabled"),
      ),
      webhooksEnabled: readCheckboxField(formData.get("webhooksEnabled")),
      batchVerificationEnabled: readCheckboxField(
        formData.get("batchVerificationEnabled"),
      ),
      auditExportsEnabled: readCheckboxField(
        formData.get("auditExportsEnabled"),
      ),
      sandboxEnabled: readCheckboxField(formData.get("sandboxEnabled")),
    });

    await setDashboardFlash({
      level: "success",
      title: "Partner state updated",
      message: `Updated admin capability and readiness controls for '${partnerSlug}'.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAdminAuthError) {
      await clearAdminSetupSession();
      await setDashboardFlash({
        level: "error",
        title: "Admin setup expired",
        message: error.message,
      });

      return NextResponse.redirect(new URL("/setup", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Partner update failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
}

function buildSetupRedirectUrl(requestUrl: string, partnerSlug: string | null): URL {
  const url = new URL("/setup", requestUrl);

  if (partnerSlug) {
    url.searchParams.set("partnerSlug", partnerSlug);
  }

  return url;
}
