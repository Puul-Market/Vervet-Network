import type {
  DashboardAssetNetworkRecord,
  PartnerDashboardMetadataRecord,
} from "@/lib/vervet-api";

export interface DashboardSelectOption {
  label: string;
  value: string;
}

export function buildChainOptions(
  assetNetworks: DashboardAssetNetworkRecord[],
): DashboardSelectOption[] {
  return dedupeOptions(
    assetNetworks.map((assetNetwork) => ({
      label: assetNetwork.chain.displayName,
      value: assetNetwork.chain.slug,
    })),
  );
}

export function buildAssetOptions(
  assetNetworks: DashboardAssetNetworkRecord[],
): DashboardSelectOption[] {
  return dedupeOptions(
    assetNetworks.map((assetNetwork) => ({
      label: assetNetwork.asset.symbol,
      value: assetNetwork.asset.symbol,
    })),
  );
}

export function resolveDefaultChain(
  assetNetworks: DashboardAssetNetworkRecord[],
  preferredChain?: string | null,
) {
  const chainOptions = buildChainOptions(assetNetworks);

  if (
    preferredChain &&
    chainOptions.some((option) => option.value === preferredChain)
  ) {
    return preferredChain;
  }

  return chainOptions[0]?.value ?? "";
}

export function resolveDefaultAsset(
  assetNetworks: DashboardAssetNetworkRecord[],
  preferredAsset?: string | null,
) {
  const assetOptions = buildAssetOptions(assetNetworks);

  if (
    preferredAsset &&
    assetOptions.some((option) => option.value === preferredAsset)
  ) {
    return preferredAsset;
  }

  return assetOptions[0]?.value ?? "";
}

export function describeOnboardingAction(
  metadata: Pick<PartnerDashboardMetadataRecord, "onboarding"> | null,
  action: string | null,
) {
  if (!action) {
    return "Review workspace readiness";
  }

  return metadata?.onboarding.actionLabels[action] ?? "Review workspace readiness";
}

export function describeProductionApprovalBlockedReason(
  metadata: Pick<PartnerDashboardMetadataRecord, "onboarding"> | null,
  blockedReason: string | null,
) {
  if (!blockedReason) {
    return "Review readiness requirements before requesting production approval.";
  }

  return (
    metadata?.onboarding.blockedReasonDescriptions[blockedReason] ??
    "Review readiness requirements before requesting production approval."
  );
}

export function readAllowedOption<T extends string>(
  value: string | undefined,
  options: readonly T[],
) {
  if (value && options.includes(value as T)) {
    return value as T;
  }

  return undefined;
}

export function findOnboardingTaskDefinition(
  metadata: Pick<PartnerDashboardMetadataRecord, "onboarding"> | null,
  key: string | null,
) {
  if (!key) {
    return null;
  }

  return (
    metadata?.onboarding.taskDefinitions.find((taskDefinition) => taskDefinition.key === key) ??
    null
  );
}

function dedupeOptions(options: DashboardSelectOption[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    if (seen.has(option.value)) {
      return false;
    }

    seen.add(option.value);
    return true;
  });
}
