import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sealCookiePayload, unsealCookiePayload } from "@/lib/secure-cookie";

const sessionCookieName = "vervet_dashboard_session";
const adminSessionCookieName = "vervet_dashboard_admin_session";
const sessionTtlSeconds = 60 * 60 * 12;

export interface DashboardSession {
  accessToken: string;
  expiresAt: string;
  partnerDisplayName: string;
  partnerSlug: string;
  userEmail: string;
  userFullName: string;
  userRole: string;
  scopes: string[];
}

export interface AdminSetupSession {
  adminToken: string;
}

export async function getDashboardSession(): Promise<DashboardSession | null> {
  const cookieStore = await cookies();
  const sealedSession = cookieStore.get(sessionCookieName)?.value;

  if (!sealedSession) {
    return null;
  }

  return unsealCookiePayload(sealedSession, isDashboardSession);
}

export async function getAdminSetupSession(): Promise<AdminSetupSession | null> {
  const cookieStore = await cookies();
  const sealedSession = cookieStore.get(adminSessionCookieName)?.value;

  if (!sealedSession) {
    return null;
  }

  return unsealCookiePayload(sealedSession, isAdminSetupSession);
}

export async function requireDashboardSession(): Promise<DashboardSession> {
  const session = await getDashboardSession();

  if (!session) {
    redirect("/");
  }

  return session;
}

export async function setDashboardSession(
  session: DashboardSession,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, sealDashboardSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionTtlSeconds,
  });
}

export async function setAdminSetupSession(
  session: AdminSetupSession,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(adminSessionCookieName, sealCookiePayload(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionTtlSeconds,
  });
}

export async function clearDashboardSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(sessionCookieName);
}

export async function clearAdminSetupSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(adminSessionCookieName);
}

function sealDashboardSession(session: DashboardSession): string {
  return sealCookiePayload(session);
}

function isDashboardSession(value: unknown): value is DashboardSession {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    typeof value.accessToken === "string" &&
    value.accessToken.length > 0 &&
    "expiresAt" in value &&
    typeof value.expiresAt === "string" &&
    value.expiresAt.length > 0 &&
    "partnerDisplayName" in value &&
    typeof value.partnerDisplayName === "string" &&
    value.partnerDisplayName.length > 0 &&
    "partnerSlug" in value &&
    typeof value.partnerSlug === "string" &&
    value.partnerSlug.length > 0 &&
    "userEmail" in value &&
    typeof value.userEmail === "string" &&
    value.userEmail.length > 0 &&
    "userFullName" in value &&
    typeof value.userFullName === "string" &&
    value.userFullName.length > 0 &&
    "userRole" in value &&
    typeof value.userRole === "string" &&
    value.userRole.length > 0 &&
    "scopes" in value &&
    Array.isArray(value.scopes) &&
    value.scopes.every((scope) => typeof scope === "string")
  );
}

function isAdminSetupSession(value: unknown): value is AdminSetupSession {
  return (
    typeof value === "object" &&
    value !== null &&
    "adminToken" in value &&
    typeof value.adminToken === "string" &&
    value.adminToken.length > 0
  );
}
