import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  cancelProductionApprovalRequest,
  DashboardAuthError,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const requestId = readRequiredTextField(formData.get("requestId"));

  if (!requestId) {
    await setDashboardFlash({
      level: "error",
      title: "Cancellation failed",
      message: "A production approval request identifier is required.",
    });

    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  try {
    await cancelProductionApprovalRequest(session.accessToken, requestId);

    await setDashboardFlash({
      level: "success",
      title: "Production approval request cancelled",
      message:
        "The pending production approval request has been cancelled. You can submit a new request after making the required changes.",
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Cancellation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/setup", request.url), 303);
}
