"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  canAccessModule,
  canAccessScope,
  type CredentialScope,
  type DashboardModule,
  type PartnerProfileRecord,
} from "@/lib/vervet-api";

interface NavigationItem {
  href: string;
  label: string;
  module?: DashboardModule;
  scopes?: readonly CredentialScope[];
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

const navigationGroups: readonly NavigationGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/overview", label: "Overview", module: "overview" },
      { href: "/access/plan-usage", label: "Plan & Usage", module: "plan_usage", scopes: ["partners:read"] },
    ],
  },
  {
    label: "Data Feed",
    items: [
      {
        href: "/data-feed-health",
        label: "Health",
        module: "data_feed",
        scopes: ["partners:read"],
      },
    ],
  },
  {
    label: "Resolution",
    items: [
      { href: "/resolution/by-recipient", label: "By Recipient", module: "resolution", scopes: ["resolution:read"] },
      { href: "/resolution/by-address", label: "By Address", module: "resolution", scopes: ["resolution:read"] },
      { href: "/resolution/verify-transfer", label: "Verify Transfer", module: "resolution", scopes: ["resolution:read"] },
      { href: "/resolution/batch", label: "Batch Verify", module: "batch_verification", scopes: ["resolution:batch"] },
      { href: "/resolution/logs", label: "Logs", module: "resolution", scopes: ["resolution:read"] },
    ],
  },
  {
    label: "Recipients",
    items: [
      { href: "/recipients", label: "Recipients", module: "registry", scopes: ["recipients:read"] },
      { href: "/destinations", label: "Destinations", module: "registry", scopes: ["destinations:read"] },
      { href: "/attestations", label: "Attestations", module: "registry", scopes: ["attestations:read"] },
    ],
  },
  {
    label: "Webhooks",
    items: [
      { href: "/webhooks", label: "Subscriptions", module: "webhooks", scopes: ["webhooks:read"] },
      { href: "/webhooks/deliveries", label: "Deliveries", module: "webhooks", scopes: ["webhooks:read"] },
    ],
  },
  {
    label: "Keys & Access",
    items: [
      { href: "/access/api-keys", label: "API Keys", module: "api_keys", scopes: ["partners:write"] },
      { href: "/access/signing-keys", label: "Signing Keys", module: "signing_keys", scopes: ["partners:write"] },
      { href: "/access/team", label: "Team", module: "team", scopes: ["team:read"] },
      { href: "/access/security", label: "Security", module: "security", scopes: ["security:read"] },
    ],
  },
  {
    label: "Audit",
    items: [
      { href: "/audit/logs", label: "Audit Log", module: "audit", scopes: ["audit:read"] },
      { href: "/audit/exports", label: "Exports", module: "audit_exports", scopes: ["audit:export"] },
    ],
  },
  {
    label: "Docs",
    items: [
      { href: "/docs/quickstart", label: "Quickstart", module: "docs" },
      { href: "/docs/api", label: "API Reference", module: "docs" },
      { href: "/docs/webhooks", label: "Webhooks", module: "docs" },
      { href: "/sandbox", label: "Sandbox", module: "sandbox" },
    ],
  },
] as const;

export function DashboardNav({
  partnerProfile,
  sessionScopes,
  onNavigate,
}: {
  partnerProfile: PartnerProfileRecord;
  sessionScopes: readonly string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const typedScopes = sessionScopes as CredentialScope[];

  return (
    <nav className="dashboard-nav" aria-label="Dashboard navigation">
      {navigationGroups.map((group) => {
        const visibleItems = group.items.filter(
          (item) =>
            (!item.scopes || canAccessScope(typedScopes, item.scopes)) &&
            (!item.module || canAccessModule(partnerProfile, item.module)),
        );

        if (visibleItems.length === 0) {
          return null;
        }

        const groupActive = visibleItems.some(
          (item) =>
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.href !== "/overview" && pathname.startsWith(item.href)),
        );
        const normalizedGroupActive =
          groupActive ||
          (group.label === "Docs" &&
            (pathname === "/docs" ||
              pathname.startsWith("/docs/") ||
              pathname === "/sandbox"));

        return (
          <section
            className={
              normalizedGroupActive
                ? "nav-group nav-group-active"
                : "nav-group"
            }
            key={group.label}
          >
            <p className="nav-group-label">{group.label}</p>
            <div className="nav-group-items">
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    className={isActive ? "nav-item is-active" : "nav-item"}
                    href={item.href}
                    key={item.href}
                    onClick={onNavigate}
                  >
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
