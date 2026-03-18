import { formatConstantLabel } from "@/lib/format";

export function StatusBadge({
  status,
}: {
  status: string | null | undefined;
}) {
  const normalizedStatus = status ?? "UNKNOWN";

  return (
    <span
      className={`status-badge status-${normalizedStatus.toLowerCase().replaceAll("_", "-")}`}
    >
      {formatConstantLabel(normalizedStatus)}
    </span>
  );
}
