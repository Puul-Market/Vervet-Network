import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  deactivatePartnerUser,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const userId = readRequiredTextField(formData.get("userId"));

  if (!userId) {
    await setDashboardFlash({
      level: "error",
      title: "User deactivation failed",
      message: "A user identifier is required.",
    });

    return NextResponse.redirect(new URL("/access/team", request.url), 303);
  }

  try {
    const user = await deactivatePartnerUser(session.accessToken, userId);

    await setDashboardFlash({
      level: "success",
      title: "User deactivated",
      message: `${user.fullName} can no longer access the dashboard.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "User deactivation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/access/team", request.url), 303);
}
