import { formatConstantLabel } from "@/lib/format";
import type { PartnerProfileRecord } from "@/lib/vervet-api";

export function OnboardingProgressCard({
  onboarding,
}: {
  onboarding: PartnerProfileRecord["onboarding"];
}) {
  return (
    <article className="context-card">
      <p className="eyebrow">Onboarding</p>
      <strong>{formatConstantLabel(onboarding.stage)}</strong>
      <span>
        {onboarding.completedTasks.length} completed
        {onboarding.blockedTasks.length > 0
          ? ` · ${onboarding.blockedTasks.length} blocked`
          : ""}
      </span>
      <span>
        Next: {onboarding.nextRecommendedActionLabel}
      </span>
    </article>
  );
}
