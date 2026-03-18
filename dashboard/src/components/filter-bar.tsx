import type { ReactNode } from "react";

export function FilterBar({
  actions,
  children,
  method = "GET",
}: {
  actions?: ReactNode;
  children: ReactNode;
  method?: "GET" | "POST";
}) {
  return (
    <section className="panel">
      <form className="filter-form" method={method}>
        <div className="filter-fields">{children}</div>
        {actions ? <div className="filter-actions">{actions}</div> : null}
      </form>
    </section>
  );
}
