import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  revokeDestination,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const destinationId = readRequiredTextField(formData.get("destinationId"));
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!destinationId) {
    await setDashboardFlash({
      level: "error",
      title: "Destination revocation failed",
      message: "Destination id is required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/destinations", request.url),
      303,
    );
  }

  try {
    const destination = await revokeDestination(session.accessToken, destinationId);

    await setDashboardFlash({
      level: "success",
      title: "Destination revoked",
      message: `Destination ${destination.address} is now ${destination.status.toLowerCase()}.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Destination revocation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? "/destinations", request.url),
    303,
  );
}
