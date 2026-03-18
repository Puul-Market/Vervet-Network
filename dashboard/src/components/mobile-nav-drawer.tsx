"use client";

import { useState } from "react";
import { logoutAction } from "@/app/session-actions";
import { DashboardNav } from "@/components/dashboard-nav";
import { PartnerCapabilityBadge } from "@/components/partner-capability-badge";
import type { PartnerProfileRecord } from "@/lib/vervet-api";

export function MobileNavDrawer({
  partnerDisplayName,
  partnerProfile,
  sessionScopes,
  userFullName,
}: {
  partnerDisplayName: string;
  partnerProfile: PartnerProfileRecord;
  sessionScopes: readonly string[];
  userFullName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Open navigation"
        className="mobile-nav-trigger"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        ☰
      </button>
      {isOpen ? (
        <div className="mobile-drawer-backdrop" onClick={() => setIsOpen(false)}>
          <aside
            aria-label="Mobile navigation drawer"
            className="mobile-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-drawer-header">
              <div>
                <p className="eyebrow">Vervet Network</p>
                <h2>Platform Dashboard</h2>
                <div className="chip-row">
                  <PartnerCapabilityBadge
                    profileLabel={partnerProfile.capabilities.profileLabel}
                  />
                </div>
              </div>
              <button
                aria-label="Close navigation"
                className="mobile-nav-trigger close"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <DashboardNav
              onNavigate={() => setIsOpen(false)}
              partnerProfile={partnerProfile}
              sessionScopes={sessionScopes}
            />

            <div className="mobile-drawer-footer">
              <strong>{userFullName}</strong>
              <span>{partnerDisplayName}</span>
              <form action={logoutAction}>
                <button className="secondary-button" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
