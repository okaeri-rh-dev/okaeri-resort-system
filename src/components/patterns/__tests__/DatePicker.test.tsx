import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { DatePicker, DateRangePicker, type DateRange } from "@/components/patterns";

// The setup file's vi.fn() ResizeObserver is reset between tests; Radix Popover measures with it
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function dayButton(dayOfMonth: number) {
  const grid = screen.getByRole("grid");
  return within(grid)
    .getAllByRole("button")
    .find(
      (button) =>
        button.textContent === String(dayOfMonth) &&
        !button.closest("[data-outside]") &&
        !button.closest(".rdp-outside")
    );
}

describe("DatePicker", () => {
  it("shows the placeholder until a date is picked", () => {
    render(<DatePicker onChange={() => {}} placeholder="Check-in date" />);

    expect(screen.getByRole("button", { name: /Check-in date/ })).toBeVisible();
  });

  it("opens a calendar and reports the picked date", async () => {
    const onChange = vi.fn();
    render(<DatePicker onChange={onChange} placeholder="Check-in date" />);

    await userEvent.click(screen.getByRole("button", { name: /Check-in date/ }));
    const day = dayButton(15);
    expect(day).toBeDefined();
    await userEvent.click(day as HTMLElement);

    expect(onChange).toHaveBeenCalledTimes(1);
    const picked = onChange.mock.calls[0][0] as Date;
    expect(picked.getDate()).toBe(15);
  });

  it("shows the picked date on the trigger", () => {
    render(<DatePicker value={new Date(2026, 9, 19)} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: /October 19th, 2026/ })).toBeVisible();
  });

  it("blocks dates the caller disables", async () => {
    render(
      <DatePicker onChange={() => {}} placeholder="Check-in date" isDateDisabled={() => true} />
    );

    await userEvent.click(screen.getByRole("button", { name: /Check-in date/ }));

    expect(dayButton(15)).toBeDisabled();
  });

  it("has no axe violations, closed and open", async () => {
    const { container } = render(
      <DatePicker onChange={() => {}} placeholder="Check-in date" aria-label="Check-in date" />
    );
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: /Check-in date/ }));
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe("DateRangePicker", () => {
  function StayDates() {
    const [range, setRange] = useState<DateRange | undefined>();
    return (
      <DateRangePicker
        value={range}
        onChange={setRange}
        numberOfMonths={1}
        placeholder="Stay dates"
        aria-label="Stay dates"
      />
    );
  }

  it("picks a from and to date", async () => {
    render(<StayDates />);

    await userEvent.click(screen.getByRole("button", { name: "Stay dates" }));
    await userEvent.click(dayButton(10) as HTMLElement);
    await userEvent.click(dayButton(12) as HTMLElement);

    expect(screen.getByRole("button", { name: "Stay dates" })).toHaveTextContent(
      /10, \d{4} - .*12/
    );
  });

  it("has no axe violations", async () => {
    const { container } = render(<StayDates />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
