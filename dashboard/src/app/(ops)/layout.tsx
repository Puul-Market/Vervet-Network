import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { fetchPartnerProfile } from "@/lib/vervet-api";
import { requireDashboardSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OperationsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await requireDashboardSession();
  const partnerProfile = await fetchPartnerProfile(session.accessToken);

  return (
    <AppShell partnerProfile={partnerProfile} session={session}>
      {children}
    </AppShell>
  );
}
