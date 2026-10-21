import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubPaneWidth } from "@/test/pane-width";

import { DiscountRulesForm, type DiscountRule } from "../DiscountRulesForm";

const rules: DiscountRule[] = [
  {
    id: "early",
    name: "Early Bird",
    description: "Book a month ahead",
    discount_type: "fixed",
    discount_value: 1500,
    conditions: [{ type: "advance_booking", value: 30 }],
    priority: 2,
    is_active: false,
  },
  {
    id: "week",
    name: "Week Stay",
    discount_type: "percentage",
    discount_value: 5,
    conditions: [{ type: "min_nights", value: 7 }],
    priority: 1,
    is_active: true,
  },
];

describe("DiscountRulesForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists each rule as a card on a narrow pane, lowest priority number first", () => {
    stubPaneWidth(390);
    render(<DiscountRulesForm rules={rules} onSave={vi.fn()} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const cards = within(screen.getByRole("list", { name: "Discount rules" })).getAllByRole(
      "listitem"
    );
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Week Stay")).toBeVisible();
    expect(within(cards[1]).getByText("Early Bird")).toBeVisible();
    expect(within(cards[1]).getByText("Book a month ahead")).toBeVisible();
    expect(within(cards[1]).getByText("Fixed Amount")).toBeVisible();
    expect(within(cards[1]).getByText("₱1,500.00")).toBeVisible();
    expect(within(cards[1]).getByText("30+ days ahead")).toBeVisible();
    expect(within(cards[1]).getByRole("switch", { name: "Early Bird active" })).not.toBeChecked();
    expect(within(cards[1]).getByRole("button", { name: "Edit Early Bird" })).toBeVisible();
    expect(within(cards[1]).getByRole("button", { name: "Delete Early Bird" })).toBeVisible();
  });

  it("shows a table on a wide pane", () => {
    stubPaneWidth(1280);
    render(<DiscountRulesForm rules={rules} onSave={vi.fn()} />);

    const table = screen.getByRole("table", { name: "Discount rules" });
    expect(within(table).getByRole("columnheader", { name: "Condition" })).toBeVisible();
    expect(within(table).getByRole("row", { name: /Week Stay/ })).toBeVisible();
  });
});
