import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SummaryCard } from "@/components/summary-card";
import {
  formatCurrencyUsd,
  formatDateTime,
  formatInteger,
} from "@/lib/format";
import { clearDashboardSession, requireDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  fetchPartnerProfile,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export const dynamic = "force-dynamic";

export default async function PlanUsagePage() {
  const session = await requireDashboardSession();

  try {
    const partnerProfile = await fetchPartnerProfile(session.accessToken);
    const { billing } = partnerProfile;

    const requirementUnmet =
      billing.plan.requirements.requirementStatus === "UNMET";

    return (
      <section className="panel-stack">
        <PageHeader
          title="Plan & Usage"
          description="Review your current pricing tier, monthly verification usage, overage exposure, and plan-gated capabilities."
          eyebrow="Billing"
          actions={
            <div className="page-header-actions">
              <Link className="secondary-button" href="/overview">
                Back to Overview
              </Link>
              <Link className="secondary-button" href="/setup">
                Review Setup
              </Link>
            </div>
          }
        />

        <section className="summary-grid">
          <SummaryCard
            label="Current plan"
            value={billing.plan.label}
            hint={billing.plan.bestFor}
          />
          <SummaryCard
            label="Verifications this month"
            value={formatInteger(billing.usage.verificationsUsed)}
            hint={`${formatDateTime(billing.usage.billingPeriodStart)} to ${formatDateTime(
              billing.usage.billingPeriodEnd,
            )}`}
          />
          <SummaryCard
            label="Included monthly volume"
            value={
              billing.plan.includedVerifications === null
                ? "Unlimited"
                : formatInteger(billing.plan.includedVerifications)
            }
            hint={
              billing.plan.monthlyBasePriceUsd === null
                ? "Custom pricing"
                : `${formatCurrencyUsd(billing.plan.monthlyBasePriceUsd, {
                    maximumFractionDigits: 0,
                  })}/month`
            }
          />
          <SummaryCard
            label="Remaining included"
            value={
              billing.usage.remainingIncludedVerifications === null
                ? "Unlimited"
                : formatInteger(billing.usage.remainingIncludedVerifications)
            }
            hint={
              billing.usage.usagePercent === null
                ? "No fixed monthly cap"
                : `${billing.usage.usagePercent}% of included volume used`
            }
          />
          <SummaryCard
            label="Projected overage"
            value={formatCurrencyUsd(billing.usage.projectedOverageUsd)}
            hint={
              billing.plan.overagePriceUsd === null
                ? "No standard overage rate"
                : `${formatCurrencyUsd(billing.plan.overagePriceUsd)} per verification above plan`
            }
          />
        </section>

        {requirementUnmet ? (
          <section className="panel panel-warning">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Plan requirement</p>
                <h3>Starter requires your own attestation contribution</h3>
              </div>
              <p className="panel-copy">
                {billing.plan.requirements.requirementNote ??
                  "This plan expects your organization to contribute signed trust data for its own platform."}
              </p>
            </div>
            <div className="page-header-actions">
              <Link className="primary-button" href="/setup">
                Continue setup
              </Link>
              <Link className="secondary-button" href="/access/signing-keys">
                Open Signing Keys
              </Link>
            </div>
          </section>
        ) : null}

        <div className="detail-grid">
          <article className="detail-card">
            <span>Plan profile</span>
            <strong>{billing.plan.label}</strong>
            <p className="panel-copy">{billing.plan.bestFor}</p>
            <div className="detail-list">
              <div className="stacked-cell">
                <strong>Support tier</strong>
                <span>{billing.plan.supportTierLabel}</span>
              </div>
              <div className="stacked-cell">
                <strong>Base price</strong>
                <span>
                  {billing.plan.monthlyBasePriceUsd === null
                    ? "Custom pricing"
                    : `${formatCurrencyUsd(billing.plan.monthlyBasePriceUsd, {
                        maximumFractionDigits: 0,
                      })}/month`}
                </span>
              </div>
              <div className="stacked-cell">
                <strong>Included verifications</strong>
                <span>
                  {billing.plan.includedVerifications === null
                    ? "Unlimited"
                    : formatInteger(billing.plan.includedVerifications)}
                </span>
              </div>
              <div className="stacked-cell">
                <strong>Overage rate</strong>
                <span>
                  {billing.plan.overagePriceUsd === null
                    ? "Custom"
                    : `${formatCurrencyUsd(billing.plan.overagePriceUsd)} per verification`}
                </span>
              </div>
              <div className="stacked-cell">
                <strong>Overage handling</strong>
                <span>{billing.plan.overagePolicyNote}</span>
              </div>
            </div>
          </article>

          <article className="detail-card">
            <span>Entitlements</span>
            <strong>What this plan unlocks</strong>
            <div className="detail-list">
              {billing.plan.featureHighlights.map((feature) => (
                <div className="stacked-cell" key={feature}>
                  <strong>{feature}</strong>
                </div>
              ))}
              <div className="stacked-cell">
                <strong>Verification analytics</strong>
                <span>
                  {billing.plan.entitlements.verificationAnalyticsEnabled
                    ? "Included"
                    : "Upgrade to Growth or above"}
                </span>
              </div>
              <div className="stacked-cell">
                <strong>Bulk verification</strong>
                <span>
                  {billing.plan.entitlements.bulkVerificationEnabled
                    ? "Included"
                    : "Upgrade to Scale or Enterprise"}
                </span>
              </div>
            </div>
          </article>
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Usage breakdown</p>
              <h3>Current billing-period verification volume</h3>
            </div>
            <p className="panel-copy">
              {billing.plan.entitlements.verificationAnalyticsEnabled
                ? "Detailed verification analytics are included on your current plan."
                : "Starter includes monthly usage totals, but detailed verification analytics unlock on Growth and above."}
            </p>
          </div>

          {billing.plan.entitlements.verificationAnalyticsEnabled ? (
            <section className="summary-grid compact-summary-grid">
              <SummaryCard
                label="By Recipient"
                value={formatInteger(billing.usage.byRecipientVerifications)}
              />
              <SummaryCard
                label="By Address"
                value={formatInteger(billing.usage.byAddressVerifications)}
              />
              <SummaryCard
                label="Verify Transfer"
                value={formatInteger(billing.usage.verifyTransferVerifications)}
              />
              <SummaryCard
                label="Batch rows"
                value={formatInteger(billing.usage.batchVerifications)}
              />
            </section>
          ) : (
            <article className="detail-card">
              <span>Analytics upgrade</span>
              <strong>Detailed verification analytics are not in this plan</strong>
              <p className="panel-copy">
                Your organization is currently on {billing.plan.label}. Upgrade
                to Growth for a verification analytics dashboard, or to Scale
                for analytics plus bulk verification operations.
              </p>
            </article>
          )}
        </section>
      </section>
    );
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      redirect("/");
    }

    return (
      <section className="panel panel-error">
        <PageHeader
          title="Plan & usage unavailable"
          description={humanizeDashboardError(error)}
          eyebrow="Backend error"
        />
      </section>
    );
  }
}
