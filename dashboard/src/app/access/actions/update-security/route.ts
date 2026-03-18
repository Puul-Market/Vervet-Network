import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readOptionalTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  updatePartnerSecuritySettings,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const sessionIdleTimeoutMinutes = readPositiveInteger(
    formData.get("sessionIdleTimeoutMinutes"),
  );
  const credentialRotationDays = readPositiveInteger(
    formData.get("credentialRotationDays"),
  );
  const ipAllowlist = readOptionalTextField(formData.get("ipAllowlist"));
  const enforceMfa = formData.get("enforceMfa") === "on";

  if (!sessionIdleTimeoutMinutes || !credentialRotationDays) {
    await setDashboardFlash({
      level: "error",
      title: "Security settings failed",
      message: "Session timeout and rotation period must be positive numbers.",
    });

    return NextResponse.redirect(new URL("/access/security", request.url), 303);
  }

  try {
    await updatePartnerSecuritySettings(session.accessToken, {
      sessionIdleTimeoutMinutes,
      credentialRotationDays,
      enforceMfa,
      ipAllowlist: ipAllowlist
        ? ipAllowlist
            .split("\n")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : [],
    });

    await setDashboardFlash({
      level: "success",
      title: "Security settings updated",
      message: "Partner security defaults are now saved.",
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Security settings failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/access/security", request.url), 303);
}

function readPositiveInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}
