"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type LookupMode = "RECIPIENT_CONTEXT" | "ADDRESS_CONTEXT";

export function LookupModeSwitcher({
  currentMode,
  name = "mode",
}: {
  currentMode: LookupMode;
  name?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="chip-row" role="radiogroup" aria-label="Transfer verification mode">
      {[
        { label: "Recipient Context", value: "RECIPIENT_CONTEXT" as const },
        { label: "Address Context", value: "ADDRESS_CONTEXT" as const },
      ].map((mode) => (
        <label
          className={
            currentMode === mode.value
              ? "secondary-button is-selected"
              : "secondary-button"
          }
          key={mode.value}
        >
          <input
            checked={currentMode === mode.value}
            name={name}
            onChange={() => {
              const nextSearchParams = new URLSearchParams(searchParams.toString());
              nextSearchParams.set(name, mode.value);
              router.push(`${pathname}?${nextSearchParams.toString()}`);
            }}
            type="radio"
            value={mode.value}
          />
          {mode.label}
        </label>
      ))}
    </div>
  );
}
