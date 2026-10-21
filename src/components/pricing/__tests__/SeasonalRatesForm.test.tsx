import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubPaneWidth } from "@/test/pane-width";

import { SeasonalRatesForm, type SeasonalRate } from "../SeasonalRatesForm";

const rates: SeasonalRate[] = [
  {
    id: "low",
    season_id: "low_season",
    name: "Low Season",
    start_date: "06-01",
    end_date: "09-30",
    multiplier: 0.8,
    priority: 10,
    is_active: true,
    color: "blue",
  },
  {
    id: "peak",
    season_id: "peak_summer",
    name: "Peak Summer",
    start_date: "03-01",
    end_date: "05-31",
    multiplier: 1.5,
    priority: 30,
    is_active: false,
    color: "orange",
  },
];

describe("SeasonalRatesForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists each season as a card on a narrow pane, highest priority first", () => {
    stubPaneWidth(390);
    render(<SeasonalRatesForm rates={rates} onSave={vi.fn()} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const cards = within(screen.getByRole("list", { name: "Seasonal rates" })).getAllByRole(
      "listitem"
    );
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Peak Summer")).toBeVisible();
    expect(within(cards[0]).getByText("Mar 1 - May 31")).toBeVisible();
    expect(within(cards[0]).getByText("(+50%)")).toBeVisible();
    expect(within(cards[0]).getByRole("switch", { name: "Peak Summer active" })).not.toBeChecked();
    expect(within(cards[0]).getByRole("button", { name: "Edit Peak Summer" })).toBeVisible();
    expect(within(cards[0]).getByRole("button", { name: "Delete Peak Summer" })).toBeVisible();
  });

  it("shows a table on a wide pane", () => {
    stubPaneWidth(1280);
    render(<SeasonalRatesForm rates={rates} onSave={vi.fn()} />);

    const table = screen.getByRole("table", { name: "Seasonal rates" });
    expect(within(table).getByRole("columnheader", { name: "Multiplier" })).toBeVisible();
    expect(within(table).getByRole("row", { name: /Low Season/ })).toBeVisible();
  });
});
