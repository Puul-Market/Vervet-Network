import type { ReactNode } from "react";

export function DetailDrawer({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <aside className="panel detail-drawer">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>Detail</h3>
        </div>
        {description ? <p className="panel-copy">{description}</p> : null}
      </div>
      {children}
    </aside>
  );
}
