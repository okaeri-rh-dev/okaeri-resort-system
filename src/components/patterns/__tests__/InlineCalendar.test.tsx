import { useState } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { InlineCalendar, type CalendarDayButtonProps, type DateRange } from "@/components/patterns";

const OCTOBER_2026 = new Date(2026, 9, 1);

function dayButton(dayOfMonth: number) {
  const grid = screen.getByRole("grid");
  return within(grid)
    .getAllByRole("button")
    .find(
      (button) => button.textContent === String(dayOfMonth) && !button.closest("[data-outside]")
    ) as HTMLElement;
}

function StayRange({ onSelect }: { onSelect: (range: DateRange | undefined) => void }) {
  const [range, setRange] = useState<DateRange | undefined>();
  return (
    <InlineCalendar
      variant="range"
      defaultMonth={OCTOBER_2026}
      selected={range}
      onSelect={(next) => {
        setRange(next);
        onSelect(next);
      }}
    />
  );
}

function NoteDay({ day, modifiers: _modifiers, ...props }: CalendarDayButtonProps) {
  const note = day.date.getDate() === 21 ? "2 stays" : undefined;
  return (
    <button {...props} aria-label={note ? `October 21, ${note}` : undefined}>
      {day.date.getDate()}
      {note && <span>{note}</span>}
    </button>
  );
}

describe("InlineCalendar, month grid", () => {
  it("shows the given month with the caller's day cells and no navigation of its own", () => {
    render(<InlineCalendar variant="month-grid" month={OCTOBER_2026} dayButton={NoteDay} />);

    expect(screen.getByRole("grid", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "October 21, 2 stays" })).toHaveTextContent(
      "212 stays"
    );
    expect(screen.queryByRole("button", { name: /previous month/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next month/i })).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <InlineCalendar variant="month-grid" month={OCTOBER_2026} dayButton={NoteDay} compact />
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("InlineCalendar, range", () => {
  it("shows an open calendar and reports the picked range", async () => {
    const onSelect = vi.fn();
    render(<StayRange onSelect={onSelect} />);

    await userEvent.click(dayButton(12));
    await userEvent.click(dayButton(15));

    const range = onSelect.mock.lastCall?.[0] as DateRange;
    expect(range.from?.getDate()).toBe(12);
    expect(range.to?.getDate()).toBe(15);
  });

  it("has no axe violations", async () => {
    const { container } = render(<StayRange onSelect={() => {}} />);
    await userEvent.click(dayButton(12));

    expect(await axe(container)).toHaveNoViolations();
  });
});
