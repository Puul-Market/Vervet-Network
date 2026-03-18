import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredEnumField, readRequiredTextField } from "@/lib/form-input";
import { clearAdminSetupSession, getAdminSetupSession } from "@/lib/session";
import {
  createPartner,
  DashboardAdminAuthError,
  humanizeDashboardError,
  type PartnerType,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getAdminSetupSession();

  if (!session) {
    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  const formData = await request.formData();
  const slug = readRequiredTextField(formData.get("slug"));
  const displayName = readRequiredTextField(formData.get("displayName"));
  const partnerType = readRequiredEnumField<PartnerType>(formData.get("partnerType"));

  if (!slug || !displayName || !partnerType) {
    await setDashboardFlash({
      level: "error",
      title: "Partner creation failed",
      message: "Slug, display name, and a supported partner type are required.",
    });

    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  try {
    const partner = await createPartner(session.adminToken, {
      displayName,
      partnerType,
      slug,
    });

    await setDashboardFlash({
      level: "success",
      title: "Partner created",
      message: `Partner '${partner.slug}' is ready for key registration and owner-user setup.`,
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
      title: "Partner creation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(buildSetupRedirectUrl(request.url, slug), 303);
}

function buildSetupRedirectUrl(
  requestUrl: string,
  partnerSlug: string | null,
): URL {
  const url = new URL("/setup", requestUrl);

  if (partnerSlug) {
    url.searchParams.set("partnerSlug", partnerSlug);
  }

  return url;
}
