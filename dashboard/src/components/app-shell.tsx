import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/session-actions";
import { DashboardNav } from "@/components/dashboard-nav";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { OnboardingProgressCard } from "@/components/onboarding-progress-card";
import { PartnerCapabilityBadge } from "@/components/partner-capability-badge";
import { ProductionReadinessCard } from "@/components/production-readiness-card";
import type { DashboardSession } from "@/lib/session";
import {
  shouldSurfaceOnboardingSetup,
  type PartnerProfileRecord,
} from "@/lib/vervet-api";

export function AppShell({
  children,
  partnerProfile,
  session,
}: {
  children: ReactNode;
  partnerProfile: PartnerProfileRecord;
  session: DashboardSession;
}) {
  const showSetupAction = shouldSurfaceOnboardingSetup(partnerProfile);
  const nextActionLabel = partnerProfile.onboarding.nextRecommendedActionLabel;

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-rail">
        <div className="rail-header">
          <div className="rail-brand">
            <svg width="18" height="22" viewBox="0 0 22 28" fill="none">
              <path d="M11 1L21 8.5L11 27L1 8.5L11 1Z" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M1 8.5H21" stroke="#34d399" strokeWidth="1.5"/>
              <path d="M11 1L7 8.5L11 27L15 8.5L11 1Z" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <p className="eyebrow">Vervet Network</p>
          </div>
          <h1>Platform Dashboard</h1>
          <div className="chip-row">
            <PartnerCapabilityBadge
              profileLabel={partnerProfile.capabilities.profileLabel}
            />
          </div>
        </div>

        <div className="rail-context">
          <OnboardingProgressCard onboarding={partnerProfile.onboarding} />
          <ProductionReadinessCard readiness={partnerProfile.readiness} />
          {showSetupAction ? (
            <div className="session-chip rail-setup-card">
              <span>Next action</span>
              <strong>{nextActionLabel}</strong>
              <div className="setup-actions">
                <Link className="secondary-button" href="/setup">
                  Continue setup
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <DashboardNav partnerProfile={partnerProfile} sessionScopes={session.scopes} />

        <div className="rail-footer">
          <div className="identity-block">
            <strong>{session.userFullName}</strong>
            <span>{session.userRole}</span>
          </div>
          <div className="identity-block">
            <strong>{session.partnerDisplayName}</strong>
            <span>{session.partnerSlug}</span>
          </div>
          <form action={logoutAction}>
            <button className="secondary-button" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="dashboard-stage">
        <div className="mobile-topbar">
          <MobileNavDrawer
            partnerDisplayName={session.partnerDisplayName}
            partnerProfile={partnerProfile}
            sessionScopes={session.scopes}
            userFullName={session.userFullName}
          />
          <div className="mobile-topbar-copy">
            <strong>{session.partnerDisplayName}</strong>
            <span>{session.userFullName}</span>
          </div>
        </div>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
