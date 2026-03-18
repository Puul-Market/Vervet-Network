import type { ReactNode } from "react";

interface DataTableColumn {
  key: string;
  label: string;
  className?: string;
}

interface DataTableRow {
  key: string;
  cells: ReactNode[];
}

export function DataTable({
  columns,
  emptyState,
  rows,
}: {
  columns: DataTableColumn[];
  emptyState?: ReactNode;
  rows: DataTableRow[];
}) {
  if (rows.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.className} key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td className={columns[index]?.className} key={`${row.key}-${index}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
