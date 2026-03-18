import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readOptionalTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  requestProductionApproval,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const requestNote = readOptionalTextField(formData.get("requestNote"));
  const assetNetworkIds = formData
    .getAll("assetNetworkIds")
    .flatMap((value) =>
      typeof value === "string" && value.trim().length > 0 ? [value.trim()] : [],
    );

  try {
    await requestProductionApproval(session.accessToken, {
      assetNetworkIds,
      requestNote: requestNote ?? undefined,
    });

    await setDashboardFlash({
      level: "success",
      title: "Production approval requested",
      message:
        "Your organization has submitted a production approval request. Review status will appear in Setup.",
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Production approval request failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/setup", request.url), 303);
}
