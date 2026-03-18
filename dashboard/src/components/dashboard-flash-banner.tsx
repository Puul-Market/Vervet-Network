"use client";

import { useEffect } from "react";
import type { DashboardFlash } from "@/lib/flash";

export function DashboardFlashBanner({
  flash,
}: {
  flash: DashboardFlash;
}) {
  useEffect(() => {
    void fetch("/flash/clear", {
      credentials: "include",
      method: "POST",
    });
  }, []);

  return (
    <section
      className={
        flash.level === "success"
          ? "flash-banner flash-success"
          : "flash-banner flash-error"
      }
    >
      <div className="flash-copy">
        <p className="eyebrow">{flash.title}</p>
        <p>{flash.message}</p>
      </div>
      {flash.secretValue ? (
        <div className="flash-secret">
          <span>{flash.secretLabel ?? "Secret"}</span>
          <code>{flash.secretValue}</code>
        </div>
      ) : null}
    </section>
  );
}
