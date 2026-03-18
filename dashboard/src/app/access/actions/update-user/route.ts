import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readOptionalEnumField,
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  type PartnerUserRole,
  updatePartnerUser,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const userId = readRequiredTextField(formData.get("userId"));
  const fullName = readOptionalTextField(formData.get("fullName"));
  const role = readOptionalEnumField<PartnerUserRole>(formData.get("role"));

  if (!userId || (!fullName && !role)) {
    await setDashboardFlash({
      level: "error",
      title: "User update failed",
      message: "A user id and at least one field to update are required.",
    });

    return NextResponse.redirect(new URL("/access/team", request.url), 303);
  }

  try {
    const user = await updatePartnerUser(session.accessToken, userId, {
      ...(fullName ? { fullName } : {}),
      ...(role ? { role } : {}),
    });

    await setDashboardFlash({
      level: "success",
      title: "User updated",
      message: `${user.fullName} now has the ${user.role.toLowerCase()} role.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "User update failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/access/team", request.url), 303);
}
