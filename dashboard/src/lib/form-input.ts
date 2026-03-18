import type {
  CredentialScope,
  SigningKeyAlgorithm,
} from "@/lib/vervet-api";

export function readRequiredTextField(
  value: FormDataEntryValue | null,
): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

export function readOptionalTextField(
  value: FormDataEntryValue | null,
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

export function readCheckboxField(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

export function readIsoDateTimeField(
  value: FormDataEntryValue | null,
  required: boolean,
): string | null | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return required ? null : undefined;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

export function isCredentialScopeValue(
  value: FormDataEntryValue,
): value is CredentialScope {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSigningKeyAlgorithmValue(
  value: FormDataEntryValue | null,
): value is SigningKeyAlgorithm {
  return typeof value === "string" && value.trim().length > 0;
}

export function readRequiredEnumField<T extends string>(
  value: FormDataEntryValue | null,
): T | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim() as T;
}

export function readOptionalEnumField<T extends string>(
  value: FormDataEntryValue | null,
): T | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim() as T;
}
