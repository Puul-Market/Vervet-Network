import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readRequiredEnumField,
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  invitePartnerUser,
  type PartnerUserRole,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const email = readRequiredTextField(formData.get("email"));
  const fullName = readOptionalTextField(formData.get("fullName"));
  const role = readRequiredEnumField<PartnerUserRole>(formData.get("role"));

  if (!email || !role) {
    await setDashboardFlash({
      level: "error",
      title: "Invite failed",
      message: "Email address and role are required to invite a team user.",
    });

    return NextResponse.redirect(new URL("/access/team", request.url), 303);
  }

  try {
    const invite = await invitePartnerUser(session.accessToken, {
      email,
      ...(fullName ? { fullName } : {}),
      role,
    });

    await setDashboardFlash({
      level: "success",
      title: "Invite created",
      message: `Invite ready for ${invite.email}. Copy the invite token below into your delivery workflow.`,
      secretLabel: "Invite token",
      secretValue: invite.inviteToken,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Invite failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/access/team", request.url), 303);
}
