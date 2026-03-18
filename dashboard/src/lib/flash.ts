import { cookies } from "next/headers";
import { sealCookiePayload, unsealCookiePayload } from "@/lib/secure-cookie";

const flashCookieName = "vervet_dashboard_flash";
const flashCookieMaxAgeSeconds = 60 * 5;

export interface DashboardFlash {
  level: "success" | "error";
  title: string;
  message: string;
  secretLabel?: string;
  secretValue?: string;
}

export async function setDashboardFlash(flash: DashboardFlash): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(flashCookieName, sealCookiePayload(flash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: flashCookieMaxAgeSeconds,
  });
}

export async function clearDashboardFlash(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(flashCookieName);
}

export async function consumeDashboardFlash(): Promise<DashboardFlash | null> {
  const cookieStore = await cookies();
  const sealedFlash = cookieStore.get(flashCookieName)?.value;

  if (!sealedFlash) {
    return null;
  }

  return unsealCookiePayload(sealedFlash, isDashboardFlash);
}

function isDashboardFlash(value: unknown): value is DashboardFlash {
  return (
    typeof value === "object" &&
    value !== null &&
    "level" in value &&
    (value.level === "success" || value.level === "error") &&
    "title" in value &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    (!("secretLabel" in value) ||
      value.secretLabel === undefined ||
      typeof value.secretLabel === "string") &&
    (!("secretValue" in value) ||
      value.secretValue === undefined ||
      typeof value.secretValue === "string")
  );
}
