import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readOptionalEnumField,
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  createRecipient,
  DashboardAuthError,
  humanizeDashboardError,
  type IdentifierKind,
  type IdentifierVisibility,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const externalRecipientId = readRequiredTextField(
    formData.get("externalRecipientId"),
  );
  const displayName = readOptionalTextField(formData.get("displayName"));
  const primaryIdentifier = readRequiredTextField(
    formData.get("primaryIdentifier"),
  );
  const identifierKind = readOptionalEnumField<IdentifierKind>(
    formData.get("identifierKind"),
  );
  const visibility = readOptionalEnumField<IdentifierVisibility>(
    formData.get("visibility"),
  );

  if (!externalRecipientId || !primaryIdentifier) {
    await setDashboardFlash({
      level: "error",
      title: "Recipient creation failed",
      message: "Recipient id and primary identifier are required.",
    });

    return NextResponse.redirect(new URL("/recipients", request.url), 303);
  }

  try {
    const recipient = await createRecipient(session.accessToken, {
      externalRecipientId,
      primaryIdentifier,
      ...(displayName ? { displayName } : {}),
      ...(identifierKind ? { identifierKind } : {}),
      ...(visibility ? { visibility } : {}),
    });

    await setDashboardFlash({
      level: "success",
      title: "Recipient created",
      message: `${recipient.displayName ?? recipient.externalRecipientId} is now in the registry.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Recipient creation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/recipients", request.url), 303);
}
