"use server";

import { redirect } from "next/navigation";
import {
  DashboardAdminAuthError,
  DashboardAuthError,
  DashboardApiError,
  loginDashboardUser,
  logoutDashboardSession,
  verifyAdminSetupToken,
} from "@/lib/vervet-api";
import {
  clearAdminSetupSession,
  clearDashboardSession,
  getDashboardSession,
  setAdminSetupSession,
  setDashboardSession,
} from "@/lib/session";

export interface LoginFormState {
  errorMessage: string | null;
}

export interface AdminSetupFormState {
  errorMessage: string | null;
}

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || email.trim().length === 0) {
    return {
      errorMessage: "Enter your work email address.",
    };
  }

  if (typeof password !== "string" || password.length === 0) {
    return {
      errorMessage: "Enter your dashboard password.",
    };
  }

  const trimmedEmail = email.trim().toLowerCase();

  try {
    const session = await loginDashboardUser({
      email: trimmedEmail,
      password,
    });

    await setDashboardSession({
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      partnerDisplayName: session.partner.displayName,
      partnerSlug: session.partner.slug,
      userEmail: session.user.email,
      userFullName: session.user.fullName,
      userRole: session.user.role,
      scopes: session.user.scopes,
    });
  } catch (error: unknown) {
    return {
      errorMessage:
        error instanceof DashboardApiError ||
        error instanceof DashboardAuthError
          ? error.message
          : "The dashboard could not validate your sign-in against the backend.",
    };
  }

  redirect("/overview");
}

export async function logoutAction(): Promise<void> {
  const session = await getDashboardSession();

  if (session) {
    try {
      await logoutDashboardSession(session.accessToken);
    } catch {
      // Clearing the local session cookie is still correct if the backend session
      // is already expired or otherwise unavailable.
    }
  }

  await clearDashboardSession();
  redirect("/");
}

export async function adminSetupLoginAction(
  _previousState: AdminSetupFormState,
  formData: FormData,
): Promise<AdminSetupFormState> {
  const adminToken = formData.get("adminToken");

  if (typeof adminToken !== "string" || adminToken.trim().length === 0) {
    return {
      errorMessage: "Enter the admin setup token to access partner onboarding.",
    };
  }

  const trimmedToken = adminToken.trim();

  try {
    await verifyAdminSetupToken(trimmedToken);
    await setAdminSetupSession({
      adminToken: trimmedToken,
    });
  } catch (error: unknown) {
    return {
      errorMessage:
        error instanceof DashboardAdminAuthError
          ? error.message
          : "The dashboard could not validate the admin setup token against the backend.",
    };
  }

  redirect("/setup");
}

export async function adminSetupLogoutAction(): Promise<void> {
  await clearAdminSetupSession();
  redirect("/setup");
}
