export default function OperationsLoading() {
  return (
    <section className="panel">
      <p className="eyebrow">Loading</p>
      <div className="section-heading">
        <h2>Refreshing partner operations.</h2>
        <p className="panel-copy">
          Loading live webhook, audit, recipient, and resolution data from the
          backend.
        </p>
      </div>
    </section>
  );
}
