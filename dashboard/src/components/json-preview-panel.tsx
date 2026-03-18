export function JsonPreviewPanel({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>Structured payload</h3>
        </div>
      </div>
      <pre className="json-preview">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}
