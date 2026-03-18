"use client";

import { useEffect } from "react";

export default function RootError({
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
    <main className="landing-shell">
      <section className="landing-panel">
        <section className="panel panel-error">
          <p className="eyebrow">Dashboard Error</p>
          <div className="section-heading">
            <h2>Dashboard request failed.</h2>
            <p className="panel-copy">
              The operations console hit an unexpected runtime error. Retry the
              request. If it keeps failing, inspect the backend logs and the
              dashboard server output.
            </p>
          </div>

          <div className="setup-actions">
            <button className="primary-button" onClick={() => reset()} type="button">
              Retry
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
