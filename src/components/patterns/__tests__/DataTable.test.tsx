import { useMemo } from "react";

import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { DataTable, ListCard, ListCardRow } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";

type StayRow = { guest: string; balance: number };

const stays: StayRow[] = [
  { guest: "Maria Santos", balance: 2500 },
  { guest: "Jose Rizal", balance: 1200.5 },
];

const columns: ColumnDef<StayRow>[] = [
  { accessorKey: "guest", header: "Guest" },
  {
    accessorKey: "balance",
    header: "Balance",
    meta: { align: "right" },
    cell: ({ getValue }) => formatCurrency(getValue<number>()),
  },
];

function StayCard({ row }: { row: Row<StayRow> }) {
  return (
    <ListCard>
      <ListCardRow label="Guest" value={row.original.guest} />
      <ListCardRow label="Balance" value={formatCurrency(row.original.balance)} />
    </ListCard>
  );
}

function StaysTable({ rows = stays }: { rows?: StayRow[] }) {
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <DataTable
      table={table}
      label="Stays"
      renderCard={(row) => <StayCard row={row} />}
      emptyState={<p>No stays yet</p>}
    />
  );
}

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  private targets: Element[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
  }

  unobserve() {}

  disconnect() {
    this.targets = [];
  }

  static resizeAllTo(width: number) {
    act(() => {
      for (const observer of ResizeObserverStub.instances) {
        const entries = observer.targets.map(
          (target) => ({ target, contentRect: { width } }) as unknown as ResizeObserverEntry
        );
        if (entries.length > 0) {
          observer.callback(entries, observer as unknown as ResizeObserver);
        }
      }
    });
  }
}

describe("DataTable", () => {
  beforeEach(() => {
    ResizeObserverStub.instances = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a table when its pane is 600px or wider", () => {
    render(<StaysTable />);
    ResizeObserverStub.resizeAllTo(840);

    const table = screen.getByRole("table", { name: "Stays" });
    expect(within(table).getByRole("columnheader", { name: "Balance" })).toBeVisible();
    expect(within(table).getByRole("cell", { name: "Maria Santos" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Stays" })).not.toBeInTheDocument();
  });

  it("renders the card renderer's output, and no table, below 600px", () => {
    render(<StaysTable />);
    ResizeObserverStub.resizeAllTo(390);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const cards = within(screen.getByRole("list", { name: "Stays" })).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Maria Santos")).toBeVisible();
    expect(within(cards[0]).getByText("₱2,500.00")).toBeVisible();
  });

  it("switches trees as the pane is resized across 600px", () => {
    render(<StaysTable />);

    ResizeObserverStub.resizeAllTo(1280);
    expect(screen.getByRole("table", { name: "Stays" })).toBeInTheDocument();

    ResizeObserverStub.resizeAllTo(599);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Stays" })).toBeInTheDocument();

    ResizeObserverStub.resizeAllTo(600);
    expect(screen.getByRole("table", { name: "Stays" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Stays" })).not.toBeInTheDocument();
  });

  it("shows money as ₱2,500.00 in a right-aligned column", () => {
    render(<StaysTable />);
    ResizeObserverStub.resizeAllTo(840);

    const balanceHeader = screen.getByRole("columnheader", { name: "Balance" });
    const balanceCell = screen.getByRole("cell", { name: "₱2,500.00" });
    expect(balanceHeader).toHaveStyle({ textAlign: "right" });
    expect(balanceCell).toHaveStyle({ textAlign: "right" });
    expect(screen.getByRole("cell", { name: "₱1,200.50" })).toBeVisible();
  });

  it("shows the empty state in place of cards when there are no rows", () => {
    render(<StaysTable rows={[]} />);
    ResizeObserverStub.resizeAllTo(390);

    expect(screen.getByText("No stays yet")).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("keeps the column headers above the empty state in table form", () => {
    render(<StaysTable rows={[]} />);
    ResizeObserverStub.resizeAllTo(840);

    expect(screen.getByRole("columnheader", { name: "Guest" })).toBeVisible();
    expect(screen.getByText("No stays yet")).toBeVisible();
  });

  it("has no axe violations as a table", async () => {
    const { container } = render(<StaysTable />);
    ResizeObserverStub.resizeAllTo(840);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations as cards", async () => {
    const { container } = render(<StaysTable />);
    ResizeObserverStub.resizeAllTo(390);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("renders an expanded row's detail in a full-width row under it", () => {
    render(<ExpandableStaysTable />);
    ResizeObserverStub.resizeAllTo(840);

    const rows = within(screen.getByRole("table", { name: "Stays" })).getAllByRole("row");
    // header, Maria, Maria's detail, Jose
    expect(rows.map((row) => row.textContent)).toEqual([
      "GuestBalance",
      "Maria Santos₱2,500.00",
      "Past stays of Maria Santos",
      "Jose Rizal₱1,200.50",
    ]);
    expect(within(rows[2]).getByRole("cell")).toHaveAttribute("colspan", "2");
  });
});

type NotedStayRow = StayRow & { note: string };

const notedColumns: ColumnDef<NotedStayRow>[] = [
  ...(columns as ColumnDef<NotedStayRow>[]),
  { accessorKey: "note", header: "Note", meta: { priority: "low" } },
];

function NotedStaysTable() {
  const rows = useMemo(() => stays.map((stay) => ({ ...stay, note: "Late arrival" })), []);
  const table = useReactTable({
    data: rows,
    columns: notedColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <DataTable table={table} label="Stays" renderCard={() => null} />;
}

// jsdom has no layout, so each column takes this many pixels and the scroller overflows the pane.
const FAKE_COLUMN_WIDTH = 300;

function stubTableLayout(getPaneWidth: () => number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(getPaneWidth);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
    this: HTMLElement
  ) {
    const columnCount = this.querySelectorAll("th").length;
    return Math.max(getPaneWidth(), columnCount * FAKE_COLUMN_WIDTH);
  });
}

describe("DataTable low-priority columns", () => {
  let paneWidth = 0;

  function resizePane(width: number) {
    paneWidth = width;
    ResizeObserverStub.resizeAllTo(width);
  }

  beforeEach(() => {
    ResizeObserverStub.instances = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    stubTableLayout(() => paneWidth);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows every column when the full table fits its pane", () => {
    render(<NotedStaysTable />);
    resizePane(1200);

    expect(screen.getByRole("columnheader", { name: "Note" })).toBeVisible();
    expect(screen.getAllByRole("cell", { name: "Late arrival" })).toHaveLength(2);
  });

  it("hides low-priority columns when the full table is wider than its pane", () => {
    render(<NotedStaysTable />);
    resizePane(899);

    expect(screen.queryByRole("columnheader", { name: "Note" })).not.toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Late arrival" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Balance" })).toBeVisible();
  });

  it("shows them again once the pane is as wide as the full table, without flicker at the edge", () => {
    render(<NotedStaysTable />);
    resizePane(899);
    resizePane(899.5);
    expect(screen.queryByRole("columnheader", { name: "Note" })).not.toBeInTheDocument();

    resizePane(900);
    expect(screen.getByRole("columnheader", { name: "Note" })).toBeVisible();

    resizePane(899);
    expect(screen.queryByRole("columnheader", { name: "Note" })).not.toBeInTheDocument();
  });

  it("still renders cards below 600px", () => {
    render(<NotedStaysTable />);
    resizePane(390);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Stays" })).toBeInTheDocument();
  });
});

function ExpandableStaysTable() {
  const table = useReactTable({
    data: stays,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    initialState: { expanded: { "0": true } },
  });

  return (
    <DataTable
      table={table}
      label="Stays"
      renderCard={(row) => <StayCard row={row} />}
      renderExpandedRow={(row) => <p>Past stays of {row.original.guest}</p>}
    />
  );
}
