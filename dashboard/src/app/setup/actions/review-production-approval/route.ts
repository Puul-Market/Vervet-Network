import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readOptionalTextField, readRequiredTextField } from "@/lib/form-input";
import { clearAdminSetupSession, getAdminSetupSession } from "@/lib/session";
import {
  DashboardAdminAuthError,
  humanizeDashboardError,
  reviewAdminProductionApprovalRequest,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getAdminSetupSession();

  if (!session) {
    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  const formData = await request.formData();
  const requestId = readRequiredTextField(formData.get("requestId"));
  const partnerSlug = readRequiredTextField(formData.get("partnerSlug"));
  const decision = formData.get("decision");
  const reviewNote = readOptionalTextField(formData.get("reviewNote"));
  const approvedAssetNetworkIds = formData
    .getAll("approvedAssetNetworkIds")
    .flatMap((value) =>
      typeof value === "string" && value.trim().length > 0 ? [value.trim()] : [],
    );

  if (
    !requestId ||
    !partnerSlug ||
    (decision !== "APPROVED" && decision !== "REJECTED")
  ) {
    await setDashboardFlash({
      level: "error",
      title: "Review failed",
      message:
        "A request identifier, decision, and partner reference are required for production review.",
    });

    return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
  }

  try {
    await reviewAdminProductionApprovalRequest(session.adminToken, requestId, {
      decision,
      reviewNote,
      approvedAssetNetworkIds,
    });

    await setDashboardFlash({
      level: "success",
      title: "Production review recorded",
      message:
        decision === "APPROVED"
          ? `Approved production access for '${partnerSlug}'.`
          : `Rejected production access for '${partnerSlug}'.`,
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
      title: "Production review failed",
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
