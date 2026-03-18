"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  buildAssetOptions,
  buildChainOptions,
} from "@/lib/dashboard-metadata";
import type {
  DashboardAssetNetworkRecord,
  SupportedPlatformLookupMode,
  SupportedPlatformRecord,
} from "@/lib/vervet-api";

interface AddressVerificationFlowFormProps {
  defaultAddress: string;
  defaultAsset: string;
  defaultChain: string;
  defaultPlatform: string;
  assetNetworks: DashboardAssetNetworkRecord[];
  initialPlatforms: SupportedPlatformRecord[];
  lookupMode: SupportedPlatformLookupMode;
  submitLabel: string;
  submitIntent: "BY_ADDRESS" | "VERIFY_TRANSFER";
  extraQuery?: Record<string, string>;
}

export function AddressVerificationFlowForm({
  defaultAddress,
  defaultAsset,
  defaultChain,
  defaultPlatform,
  assetNetworks,
  initialPlatforms,
  lookupMode,
  submitLabel,
  submitIntent,
  extraQuery,
}: AddressVerificationFlowFormProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [asset, setAsset] = useState(defaultAsset);
  const [chain, setChain] = useState(defaultChain);
  const [platform, setPlatform] = useState(defaultPlatform);
  const [address, setAddress] = useState(defaultAddress);
  const [platformOptions, setPlatformOptions] =
    useState<SupportedPlatformRecord[]>(initialPlatforms);
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(false);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const chainOptions = useMemo(
    () => buildChainOptions(assetNetworks),
    [assetNetworks],
  );
  const assetOptions = useMemo(
    () => buildAssetOptions(assetNetworks),
    [assetNetworks],
  );
  const trimmedAddress = address.trim();
  const addressFilter = useMemo(
    () =>
      addressLooksReadyForPlatformLookup(chain, trimmedAddress)
        ? trimmedAddress
        : "",
    [chain, trimmedAddress],
  );
  const deferredAddressFilter = useDeferredValue(addressFilter);

  useEffect(() => {
    setAsset(defaultAsset);
    setChain(defaultChain);
    setPlatform(defaultPlatform);
    setAddress(defaultAddress);
    setPlatformOptions(initialPlatforms);
    setPlatformError(null);
  }, [
    defaultAddress,
    defaultAsset,
    defaultChain,
    defaultPlatform,
    initialPlatforms,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPlatforms() {
      setIsLoadingPlatforms(true);
      setPlatformError(null);

      try {
        const params = new URLSearchParams({
          chain,
          asset,
          lookupMode,
        });

        if (deferredAddressFilter.length > 0) {
          params.set("address", deferredAddressFilter);
        }

        const response = await fetch(
          `/resolution/actions/platforms?${params.toString()}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          const payload = (await response.json()) as {
            message?: string;
          };
          throw new Error(
            payload.message ?? "The dashboard could not load recipient platforms.",
          );
        }

        const nextPlatforms = (await response.json()) as SupportedPlatformRecord[];

        if (isCancelled) {
          return;
        }

        setPlatformOptions(nextPlatforms);
        setPlatform((currentPlatform) =>
          nextPlatforms.some((entry) => entry.slug === currentPlatform)
            ? currentPlatform
            : "",
        );
      } catch (error: unknown) {
        if (!isCancelled) {
          setPlatformOptions([]);
          setPlatform("");
          setPlatformError(
            error instanceof Error
              ? error.message
              : "The dashboard could not load recipient platforms.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPlatforms(false);
        }
      }
    }

    void loadPlatforms();

    return () => {
      isCancelled = true;
    };
  }, [asset, chain, deferredAddressFilter, lookupMode]);

  const corridorLabel = useMemo(() => {
    const assetLabel =
      assetOptions.find((option) => option.value === asset)?.label ?? asset;
    const chainLabel =
      chainOptions.find((option) => option.value === chain)?.label ?? chain;

    return `${assetLabel} on ${chainLabel}`;
  }, [asset, assetOptions, chain, chainOptions]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trimmedAddress.length === 0) {
      return;
    }

    const params = new URLSearchParams();
    params.set("asset", asset);
    params.set("chain", chain);
    params.set("address", trimmedAddress);

    if (platform) {
      params.set("platform", platform);
    }

    for (const [key, value] of Object.entries(extraQuery ?? {})) {
      params.set(key, value);
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <form className="console-form" onSubmit={handleSubmit}>
      <div className="detail-card">
        <p className="eyebrow">Step 1</p>
        <strong>Choose the transfer corridor</strong>
        <span>
          Start with the asset and network so Vervet can narrow the valid
          destination platforms for this send.
        </span>
        <div className="console-grid">
          <label className="field">
            <span>Asset</span>
            <select
              name="asset"
              onChange={(event) => setAsset(event.target.value)}
              value={asset}
            >
              {assetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Network</span>
            <select
              name="chain"
              onChange={(event) => setChain(event.target.value)}
              value={chain}
            >
              {chainOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="detail-card">
        <p className="eyebrow">Step 2</p>
        <strong>Paste the recipient wallet address</strong>
        <span>
          {submitIntent === "BY_ADDRESS"
            ? "Paste the wallet address first. If Vervet finds one safe match, you do not need to choose a platform."
            : "Paste the wallet address first. Vervet will only ask for the recipient platform if more than one platform could match this corridor."}
        </span>
        <label className="field">
          <span>Recipient wallet address</span>
          <textarea
            name="address"
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Paste recipient wallet address"
            value={address}
          />
        </label>
      </div>

      <div className="detail-card">
        <p className="eyebrow">Step 3</p>
        <strong>Select the recipient platform</strong>
        <span>
          {deferredAddressFilter.length > 0
            ? `Showing platforms that match ${corridorLabel.toLowerCase()} for this address.`
            : `Showing platforms that currently support ${corridorLabel.toLowerCase()}.`}
        </span>
        <label className="field">
          <span>Recipient platform</span>
          <select
            name="platform"
            disabled={isLoadingPlatforms || platformOptions.length === 0}
            onChange={(event) => setPlatform(event.target.value)}
            value={platform}
          >
            <option value="">
              {isLoadingPlatforms
                ? "Loading supported platforms..."
                : platformOptions.length > 0
                  ? deferredAddressFilter.length > 0
                    ? "Optional: choose a matching platform"
                    : "Optional: narrow by recipient platform"
                  : deferredAddressFilter.length > 0
                    ? "No matching platforms for this address"
                    : "No supported platforms for this corridor"}
            </option>
            {platformOptions.map((entry) => (
              <option key={entry.id} value={entry.slug}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </label>
        <span className="field-hint">
          Leave this blank if the sender does not know the recipient platform.
          Vervet will ask for it only when the address maps to multiple valid
          platforms for the chosen corridor.
        </span>
        {platformError ? <p className="form-error">{platformError}</p> : null}
      </div>

      <button
        className="primary-button"
        disabled={isNavigating || trimmedAddress.length === 0}
        type="submit"
      >
        {isNavigating ? "Loading..." : submitLabel}
      </button>
    </form>
  );
}

function addressLooksReadyForPlatformLookup(chain: string, address: string) {
  if (address.length === 0) {
    return false;
  }

  if (
    ["ethereum", "base", "arbitrum", "optimism", "polygon", "bnb-smart-chain"].includes(
      chain,
    )
  ) {
    return /^0x[a-fA-F0-9]{40}$/u.test(address);
  }

  if (chain === "tron") {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/u.test(address);
  }

  if (chain === "solana") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u.test(address);
  }

  return true;
}
