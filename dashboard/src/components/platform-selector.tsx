import type { SupportedPlatformRecord } from "@/lib/vervet-api";

type PlatformSelectorCapability = "ANY" | "BY_ADDRESS" | "BY_RECIPIENT";

interface PlatformSelectorProps {
  defaultValue?: string;
  name?: string;
  options: SupportedPlatformRecord[];
  capability?: PlatformSelectorCapability;
  emptyLabel?: string;
}

export function PlatformSelector({
  defaultValue = "",
  name = "platform",
  options,
  capability = "BY_ADDRESS",
  emptyLabel,
}: PlatformSelectorProps) {
  const filteredOptions = options.filter((option) => {
    if (capability === "BY_ADDRESS") {
      return option.supportsByAddress;
    }

    if (capability === "BY_RECIPIENT") {
      return option.supportsByRecipient;
    }

    return true;
  });
  const selectedPlatformMissing =
    defaultValue.length > 0 &&
    !filteredOptions.some((option) => option.slug === defaultValue);

  return (
    <label className="field">
      <span>Platform</span>
      <select
        defaultValue={defaultValue}
        disabled={filteredOptions.length === 0 && !selectedPlatformMissing}
        name={name}
      >
        <option value="">
          {emptyLabel ??
            (filteredOptions.length > 0
              ? "Select a supported platform"
              : "No supported platforms available")}
        </option>
        {selectedPlatformMissing ? (
          <option value={defaultValue}>{`${defaultValue} (Unavailable)`}</option>
        ) : null}
        {filteredOptions.map((platform) => (
          <option key={platform.id} value={platform.slug}>
            {platform.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
