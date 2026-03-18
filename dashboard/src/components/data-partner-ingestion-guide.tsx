import Link from "next/link";
import type { DashboardDataSubmissionGuideRecord } from "@/lib/vervet-api";

export function DataPartnerIngestionGuide({
  guide,
  eyebrow = "Data submission",
  title = "How data partners send data",
}: {
  guide: DashboardDataSubmissionGuideRecord;
  eyebrow?: string;
  title?: string;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <p className="panel-copy">{guide.summary}</p>
      </div>

      <div className="detail-grid">
        <article className="detail-card">
          <span>Operational flow</span>
          <strong>From signing key to accepted trust update</strong>
          <div className="detail-list">
            {guide.steps.map((step, index) => (
              <div className="stacked-cell" key={step.title}>
                <strong>{`${index + 1}. ${step.title}`}</strong>
                <span>{step.description}</span>
                <Link className="inline-link" href={step.href}>
                  Open
                </Link>
              </div>
            ))}
          </div>
        </article>

        <article className="detail-card">
          <span>Important notes</span>
          <strong>What the dashboard is and is not doing</strong>
          <div className="detail-list">
            {guide.notes.map((note) => (
              <div className="stacked-cell" key={note}>
                <span>{note}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="detail-grid">
        <article className="detail-card">
          <span>Payload example</span>
          <strong>{guide.endpointPath}</strong>
          <pre className="json-preview">
            {JSON.stringify(guide.examplePayload, null, 2)}
          </pre>
        </article>

        <article className="detail-card">
          <span>cURL example</span>
          <strong>Signed attestation request</strong>
          <pre className="json-preview">{guide.exampleCurl}</pre>
        </article>
      </div>
    </section>
  );
}
