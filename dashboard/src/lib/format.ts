export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function summarizeMetadata(value: unknown): string {
  if (value === null || value === undefined) {
    return "No metadata";
  }

  const serializedValue = JSON.stringify(value);

  if (serializedValue.length <= 120) {
    return serializedValue;
  }

  return `${serializedValue.slice(0, 117)}...`;
}

export function truncateMiddle(
  value: string | null | undefined,
  visibleCharacters = 6,
): string {
  if (!value) {
    return "Not available";
  }

  if (value.length <= visibleCharacters * 2 + 3) {
    return value;
  }

  return `${value.slice(0, visibleCharacters)}...${value.slice(
    -visibleCharacters,
  )}`;
}

export function formatConstantLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function formatResolutionQueryType(value: string): string {
  switch (value) {
    case "RESOLVE":
      return "By Recipient";
    case "CONFIRM_ADDRESS":
      return "By Address";
    case "VERIFY_ADDRESS":
      return "Verify Transfer";
    case "BATCH_VERIFY":
      return "Batch Verify";
    default:
      return formatConstantLabel(value);
  }
}

export function formatDisclosureMode(value: string): string {
  switch (value) {
    case "FULL_LABEL":
      return "Full Label";
    case "MASKED_LABEL":
      return "Masked Label";
    case "VERIFICATION_ONLY":
      return "Verification Only";
    default:
      return formatConstantLabel(value);
  }
}

export function expiresWithinDays(
  value: string | null | undefined,
  days: number,
): boolean {
  if (!value) {
    return false;
  }

  const expiresAtMs = new Date(value).getTime();
  const currentTimeMs = Date.now();
  const thresholdMs = days * 24 * 60 * 60 * 1000;

  return expiresAtMs - currentTimeMs <= thresholdMs;
}

export function isOlderThanDays(
  value: string | null | undefined,
  days: number,
): boolean {
  if (!value) {
    return true;
  }

  const updatedAtMs = new Date(value).getTime();
  const currentTimeMs = Date.now();
  const thresholdMs = days * 24 * 60 * 60 * 1000;

  return currentTimeMs - updatedAtMs > thresholdMs;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCurrencyUsd(
  value: number | null | undefined,
  options?: {
    maximumFractionDigits?: number;
  },
): string {
  if (value === null || value === undefined) {
    return "Custom";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}
