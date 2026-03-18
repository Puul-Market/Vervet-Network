import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readIsoDateTimeField,
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  replaceDestination,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const destinationId = readRequiredTextField(formData.get("destinationId"));
  const address = readRequiredTextField(formData.get("address"));
  const memoValue = readOptionalTextField(formData.get("memoValue"));
  const chain = readOptionalTextField(formData.get("chain"));
  const asset = readOptionalTextField(formData.get("asset"));
  const effectiveFrom = readIsoDateTimeField(formData.get("effectiveFrom"), false);
  const expiresAt = readIsoDateTimeField(formData.get("expiresAt"), false);
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!destinationId || !address) {
    await setDashboardFlash({
      level: "error",
      title: "Destination replacement failed",
      message: "Destination id and the replacement address are required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/destinations", request.url),
      303,
    );
  }

  try {
    const destination = await replaceDestination(session.accessToken, destinationId, {
      address,
      memoValue: memoValue ?? undefined,
      chain: chain ?? undefined,
      asset: asset ?? undefined,
      isDefault: formData.get("isDefault") === "on",
      effectiveFrom: effectiveFrom ?? undefined,
      expiresAt: expiresAt ?? undefined,
    });

    await setDashboardFlash({
      level: "success",
      title: "Destination replaced",
      message: `Replacement destination ${destination.address} is now pending attestation coverage.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Destination replacement failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? "/destinations", request.url),
    303,
  );
}
