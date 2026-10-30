import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toISODateString } from "@/lib/timezone";
import { useExpenseStore } from "@/stores/useExpenseStore";
import { stubPaneWidth } from "@/test/pane-width";

import { ExpensesTable } from "..";

const today = new Date();
const dayThisMonth = (day: number) =>
  toISODateString(new Date(today.getFullYear(), today.getMonth(), day));

const rows = [
  { description: "Early supplies", day: 10 },
  { description: "Mid repairs", day: 15 },
  { description: "Late groceries", day: 25 },
].map(({ description, day }) => ({
  expense_id: description,
  category: "Supplies",
  description,
  amount: 100,
  expense_date: dayThisMonth(day),
  receipt_url: null,
  notes: null,
  created_at: "",
  updated_at: "",
}));

vi.mock("@/lib/supabase", () => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "or", "order"]) {
    query[method] = () => query;
  }
  query.then = (resolve: (result: unknown) => void) => resolve({ data: rows, error: null });
  return {
    supabase: { from: () => query },
    db: {},
    handleSupabaseError: (error: Error) => error.message,
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#expense">{children}</a>,
}));

vi.mock("@/hooks/useExpenseCategories", () => ({
  useExpenseCategories: () => ({ data: [] }),
}));

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExpensesTable />
    </QueryClientProvider>
  );
}

const calendar = () => document.querySelector<HTMLElement>('[data-slot="calendar"]');

describe("ExpensesTable", () => {
  beforeEach(() => {
    stubPaneWidth(1024);
    useExpenseStore.getState().resetFilters();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the date picker open between the two clicks of a range", async () => {
    const user = userEvent.setup();
    renderTable();

    await screen.findAllByText("Mid repairs");
    await user.click(screen.getByRole("button", { name: /filter by date range/i }));
    await waitFor(() => expect(calendar()).toBeInTheDocument());

    await user.click(within(calendar()!).getAllByRole("button", { name: /\b12th\b/ })[0]);
    expect(calendar()).toBeInTheDocument();

    await user.click(within(calendar()!).getAllByRole("button", { name: /\b20th\b/ })[0]);

    await waitFor(() => expect(screen.queryAllByText("Early supplies")).toHaveLength(0));
    expect(screen.getAllByText("Mid repairs").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Late groceries")).toHaveLength(0);
  });

  it("keeps the toolbar mounted while a search refetches", async () => {
    const user = userEvent.setup();
    renderTable();
    expect(screen.getByLabelText("Loading expenses")).toBeInTheDocument();

    const search = await screen.findByPlaceholderText("Search expenses...");
    await user.type(search, "repairs");

    expect(screen.queryByLabelText("Loading expenses")).not.toBeInTheDocument();
    expect(search).toBeInTheDocument();
  });
});
