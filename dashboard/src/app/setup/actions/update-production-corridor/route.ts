import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readCheckboxField,
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearAdminSetupSession, getAdminSetupSession } from "@/lib/session";
import {
  DashboardAdminAuthError,
  humanizeDashboardError,
  updateAdminPartnerProductionCorridor,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getAdminSetupSession();

  if (!session) {
    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  const formData = await request.formData();
  const partnerId = readRequiredTextField(formData.get("partnerId"));
  const partnerSlug = readRequiredTextField(formData.get("partnerSlug"));
  const assetNetworkId = readRequiredTextField(formData.get("assetNetworkId"));
  const enabled = readCheckboxField(formData.get("enabled"));
  const note = readOptionalTextField(formData.get("note"));

  if (!partnerId || !partnerSlug || !assetNetworkId) {
    await setDashboardFlash({
      level: "error",
      title: "Production corridor update failed",
      message:
        "Partner, corridor, and action details are required before updating corridor access.",
    });

    return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
  }

  try {
    await updateAdminPartnerProductionCorridor(session.adminToken, partnerId, {
      assetNetworkId,
      enabled,
      note,
    });

    await setDashboardFlash({
      level: "success",
      title: enabled ? "Production corridor granted" : "Production corridor revoked",
      message: `${
        enabled ? "Granted" : "Revoked"
      } production corridor access for '${partnerSlug}'.`,
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
      title: "Production corridor update failed",
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
