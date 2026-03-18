import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredTextField } from "@/lib/form-input";
import { clearAdminSetupSession, getAdminSetupSession } from "@/lib/session";
import {
  createOwnerUser,
  DashboardAdminAuthError,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getAdminSetupSession();

  if (!session) {
    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  const formData = await request.formData();
  const partnerSlug = readRequiredTextField(formData.get("partnerSlug"));
  const fullName = readRequiredTextField(formData.get("fullName"));
  const email = readRequiredTextField(formData.get("email"));
  const password = readRequiredTextField(formData.get("password"));

  if (!partnerSlug || !fullName || !email || !password) {
    await setDashboardFlash({
      level: "error",
      title: "Owner user creation failed",
      message:
        "Partner slug, full name, work email, and a password are required.",
    });

    return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
  }

  try {
    const partnerUser = await createOwnerUser(
      session.adminToken,
      {
        email,
        fullName,
        partnerSlug,
        password,
      },
    );

    await setDashboardFlash({
      level: "success",
      title: "Owner user created",
      message: `Owner user '${partnerUser.email}' is ready to sign in to the partner dashboard.`,
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
      title: "Owner user creation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
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
