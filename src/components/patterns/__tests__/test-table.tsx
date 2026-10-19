import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Table,
} from "@tanstack/react-table";

import { SortableHeader, TablePagination } from "@/components/patterns";

type GuestRow = { name: string; nights: number };

const guestRows: GuestRow[] = Array.from({ length: 23 }, (_, index) => ({
  name: `Guest ${String(index + 1).padStart(2, "0")}`,
  nights: (index % 5) + 1,
}));

const columns: ColumnDef<GuestRow>[] = [
  {
    accessorKey: "name",
    header: ({ header }) => <SortableHeader header={header}>Guest</SortableHeader>,
  },
  {
    accessorKey: "nights",
    enableSorting: false,
    header: ({ header }) => <SortableHeader header={header}>Nights</SortableHeader>,
  },
];

/** A real TanStack table, so the table patterns are driven the way product lists drive them. */
export function GuestTable({
  rows = guestRows,
  pageSize = 10,
}: {
  rows?: GuestRow[];
  pageSize?: number;
}) {
  const table: Table<GuestRow> = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div>
      <table>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <TablePagination table={table} totalItems={rows.length} />
    </div>
  );
}
