import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readIsoDateTimeField,
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  createDestination,
  DashboardAuthError,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const recipientId = readRequiredTextField(formData.get("recipientId"));
  const chain = readRequiredTextField(formData.get("chain"));
  const asset = readRequiredTextField(formData.get("asset"));
  const address = readRequiredTextField(formData.get("address"));
  const memoValue = readOptionalTextField(formData.get("memoValue"));
  const effectiveFrom = readIsoDateTimeField(formData.get("effectiveFrom"), false);
  const expiresAt = readIsoDateTimeField(formData.get("expiresAt"), false);
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!recipientId || !chain || !asset || !address) {
    await setDashboardFlash({
      level: "error",
      title: "Destination creation failed",
      message: "Recipient, chain, asset, and address are required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/destinations", request.url),
      303,
    );
  }

  try {
    const destination = await createDestination(session.accessToken, {
      recipientId,
      chain,
      asset,
      address,
      memoValue: memoValue ?? undefined,
      isDefault: formData.get("isDefault") === "on",
      effectiveFrom: effectiveFrom ?? undefined,
      expiresAt: expiresAt ?? undefined,
    });

    await setDashboardFlash({
      level: "success",
      title: "Destination created",
      message: `Destination ${destination.address} is now pending signed attestation coverage.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Destination creation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? "/destinations", request.url),
    303,
  );
}
