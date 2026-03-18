"use client";

import { useState, useTransition } from "react";
import { RiskBadge } from "@/components/risk-badge";
import { StatusBadge } from "@/components/status-badge";
import {
  buildAssetOptions,
  buildChainOptions,
} from "@/lib/dashboard-metadata";
import type {
  BatchVerifyRecord,
  DashboardAssetNetworkRecord,
  ResolutionBatchLookupMode,
  ResolutionBatchInputFormat,
} from "@/lib/vervet-api";
import { formatConstantLabel, formatDisclosureMode } from "@/lib/format";

export function BatchVerifyConsole({
  assetNetworks,
  defaultInput,
  inputFormatOptions,
  lookupModeOptions,
}: {
  assetNetworks: DashboardAssetNetworkRecord[];
  defaultInput: string;
  inputFormatOptions: ResolutionBatchInputFormat[];
  lookupModeOptions: ResolutionBatchLookupMode[];
}) {
  const chainOptions = buildChainOptions(assetNetworks);
  const assetOptions = buildAssetOptions(assetNetworks);
  const [inputFormat, setInputFormat] = useState<ResolutionBatchInputFormat>(
    inputFormatOptions[0] ?? "CSV",
  );
  const [lookupMode, setLookupMode] = useState<ResolutionBatchLookupMode>(
    lookupModeOptions[0] ?? "BY_RECIPIENT",
  );
  const [chain, setChain] = useState<string>(chainOptions[0]?.value ?? "");
  const [asset, setAsset] = useState<string>(assetOptions[0]?.value ?? "");
  const [input, setInput] = useState(
    defaultInput,
  );
  const [stopOnFirstHighRisk, setStopOnFirstHighRisk] = useState(false);
  const [requireExactAttestedMatch, setRequireExactAttestedMatch] = useState(true);
  const [result, setResult] = useState<BatchVerifyRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch("/resolution/actions/batch", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          inputFormat,
          lookupMode,
          chain,
          asset,
          input,
          stopOnFirstHighRisk,
          requireExactAttestedMatch,
        }),
      });

      const payload = (await response.json()) as
        | BatchVerifyRecord
        | { message?: string };

      if (!response.ok) {
        setResult(null);
        setErrorMessage(
          "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "Batch verification failed.",
        );
        return;
      }

      setResult(payload as BatchVerifyRecord);
    });
  }

  return (
    <div className="panel-stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Input methods</p>
            <h3>Upload or paste batch rows</h3>
          </div>
          <p className="panel-copy">
            Use CSV, pipe-delimited rows, or JSON. Batch verification runs
            synchronously and is capped at 250 rows for this MVP.
          </p>
        </div>

        <div className="tab-strip">
          {inputFormatOptions.map((format) => (
            <button
              className={
                inputFormat === format ? "secondary-button is-selected" : "secondary-button"
              }
              key={format}
              onClick={() => setInputFormat(format)}
              type="button"
            >
              {format}
            </button>
          ))}
        </div>

        <div className="tab-strip">
          {lookupModeOptions.map((mode) => (
            <button
              className={
                lookupMode === mode ? "secondary-button is-selected" : "secondary-button"
              }
              key={mode}
              onClick={() => setLookupMode(mode)}
              type="button"
            >
              {mode === "BY_RECIPIENT"
                ? "By Recipient"
                : mode === "BY_ADDRESS"
                  ? "By Address"
                  : "Mixed"}
            </button>
          ))}
        </div>

        <div className="console-grid">
          <label className="field">
            <span>Chain</span>
            <select onChange={(event) => setChain(event.target.value)} value={chain}>
              {chainOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Asset</span>
            <select onChange={(event) => setAsset(event.target.value)} value={asset}>
              {assetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Batch input</span>
          <textarea
            onChange={(event) => setInput(event.target.value)}
            value={input}
          />
        </label>

        <p className="panel-copy">
          Include <code>platform</code> for address-led rows and <code>lookup_mode</code> when using mixed batches.
        </p>

        <div className="chip-row">
          <label className="event-option">
            <input
              checked={stopOnFirstHighRisk}
              onChange={(event) => setStopOnFirstHighRisk(event.target.checked)}
              type="checkbox"
            />
            Stop on first high-risk result
          </label>
          <label className="event-option">
            <input
              checked={requireExactAttestedMatch}
              onChange={(event) => setRequireExactAttestedMatch(event.target.checked)}
              type="checkbox"
            />
            Require exact attested match
          </label>
        </div>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

        <button className="primary-button" disabled={isPending} onClick={handleSubmit} type="button">
          {isPending ? "Running verification..." : "Run Verification"}
        </button>
      </section>

      {result ? (
        <>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Batch summary</p>
                <h3>Verification outcomes</h3>
              </div>
            </div>

            <div className="summary-grid">
              <article className="summary-card">
                <span>Total rows</span>
                <strong>{result.totalRows}</strong>
              </article>
              <article className="summary-card">
                <span>Verified</span>
                <strong>{result.verifiedRows}</strong>
              </article>
              <article className="summary-card">
                <span>Warnings</span>
                <strong>{result.warningRows}</strong>
              </article>
              <article className="summary-card">
                <span>Blocked</span>
                <strong>{result.blockedRows}</strong>
              </article>
              <article className="summary-card">
                <span>Unsupported</span>
                <strong>{result.unsupportedRows}</strong>
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Results</p>
                <h3>Per-row output</h3>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Client ref</th>
                    <th scope="col">Lookup mode</th>
                    <th scope="col">Platform</th>
                    <th scope="col">Recipient</th>
                    <th scope="col">Address</th>
                    <th scope="col">Result</th>
                    <th scope="col">Risk</th>
                    <th scope="col">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`${row.platform ?? row.recipientIdentifier ?? "row"}-${index}`}>
                      <td>{row.clientReference ?? "—"}</td>
                      <td>{row.lookupMode === "BY_ADDRESS" ? "By Address" : "By Recipient"}</td>
                      <td>{row.platform ?? "—"}</td>
                      <td>{row.recipientIdentifier ?? row.recipientDisplayName ?? "Not disclosed"}</td>
                      <td>
                        <span className="mono-value">{row.submittedAddress}</span>
                      </td>
                      <td>
                        <StatusBadge status={row.match ? "VERIFIED" : "MISMATCH"} />
                      </td>
                      <td>
                        <RiskBadge riskLevel={row.riskLevel} />
                      </td>
                      <td>
                        <div className="stacked-cell">
                          <strong>{formatConstantLabel(row.recommendation ?? "review")}</strong>
                          <span>
                            {[row.disclosureMode ? formatDisclosureMode(row.disclosureMode) : null, ...row.flags.map(formatConstantLabel)]
                              .filter(Boolean)
                              .join(", ") || "No flags"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
