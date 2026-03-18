import Link from "next/link";

export function ModuleAvailabilityBanner({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="panel panel-warning">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Module availability</p>
          <h3>{title}</h3>
        </div>
        <p className="panel-copy">{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <div className="table-actions">
          <Link className="secondary-button" href={actionHref}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
