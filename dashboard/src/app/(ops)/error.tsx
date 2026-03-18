"use client";

import { useEffect } from "react";

export default function OperationsError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="panel panel-error">
      <p className="eyebrow">Operations Error</p>
      <div className="section-heading">
        <h2>Partner operations request failed.</h2>
        <p className="panel-copy">
          The dashboard could not finish the current backend call. Retry this
          view. If the problem repeats, inspect backend health, partner
          credential scopes, and delivery processor logs.
        </p>
      </div>

      <div className="setup-actions">
        <button className="primary-button" onClick={() => reset()} type="button">
          Retry
        </button>
      </div>
    </section>
  );
}
