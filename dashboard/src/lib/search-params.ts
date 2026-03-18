export type DashboardSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

export function readSearchParamArray(
  value: string | string[] | undefined,
): string[] {
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => item.trim().length > 0)
      .map((item) => item.trim());
  }

  return [];
}

export function readPositiveIntParam(
  value: string | string[] | undefined,
  fallback: number,
): number {
  const parsedValue = Number.parseInt(readSearchParam(value) ?? "", 10);

  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}
