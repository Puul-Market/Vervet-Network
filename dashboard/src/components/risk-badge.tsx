import { formatConstantLabel } from "@/lib/format";

export function RiskBadge({
  riskLevel,
}: {
  riskLevel: string | null | undefined;
}) {
  const normalizedRiskLevel = riskLevel ?? "UNKNOWN";

  return (
    <span
      className={`risk-badge risk-${normalizedRiskLevel.toLowerCase().replaceAll("_", "-")}`}
    >
      {formatConstantLabel(normalizedRiskLevel)}
    </span>
  );
}
