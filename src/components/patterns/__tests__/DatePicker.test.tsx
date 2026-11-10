import { useState, type ReactNode } from "react";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { AppShell, DatePicker, DateRangePicker, type DateRange } from "@/components/patterns";

// The setup file's vi.fn() ResizeObserver is reset between tests; Radix Popover measures with it
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function dayButton(dayOfMonth: number) {
  const [grid] = screen.getAllByRole("grid");
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

  async function tapDays(...days: number[]) {
    for (const day of days) await userEvent.click(dayButton(day) as HTMLElement);
  }

  const trigger = () => screen.getByRole("button", { name: "Stay dates" });

  it("sets only the start on the first tap", async () => {
    render(<StayDates />);

    await userEvent.click(trigger());
    await tapDays(10);

    expect(trigger()).toHaveTextContent(/^\w{3} 10, \d{4}$/);
  });

  it("makes a second tap before the start the new start, with no end", async () => {
    render(<StayDates />);

    await userEvent.click(trigger());
    await tapDays(10, 8);

    expect(trigger()).toHaveTextContent(/^\w{3} 08, \d{4}$/);
  });

  it("starts a new range on a third tap", async () => {
    render(<StayDates />);

    await userEvent.click(trigger());
    await tapDays(10, 12, 20);

    expect(trigger()).toHaveTextContent(/^\w{3} 20, \d{4}$/);
  });

  it("gives a one-day range for two taps on the same day", async () => {
    render(<StayDates />);

    await userEvent.click(trigger());
    await tapDays(10, 10);

    expect(trigger()).toHaveTextContent(/^\w{3} 10, \d{4} - \w{3} 10, \d{4}$/);
  });

  it("has no axe violations", async () => {
    const { container } = render(<StayDates />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("DatePicker in a shell", () => {
  function renderInShell(ui: ReactNode, compact: boolean) {
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: compact,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList
    );
    const rootRoute = createRootRoute({
      component: () => (
        <AppShell surface="guest" brand={{ name: "Okaeri Resort", to: "/" }} destinations={[]}>
          {ui}
        </AppShell>
      ),
    });
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    return render(<RouterProvider router={router} />);
  }

  it("opens in a bottom sheet on a compact window and closes once a date is picked", async () => {
    const onChange = vi.fn();
    renderInShell(<DatePicker onChange={onChange} placeholder="Check-in date" />, true);

    await userEvent.click(await screen.findByRole("button", { name: /Check-in date/ }));
    expect(screen.getByRole("dialog", { name: "Select Date" })).toBeVisible();

    await userEvent.click(dayButton(15) as HTMLElement);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Select Date" })).not.toBeInTheDocument();
  });

  describe("range picker", () => {
    function StayDates() {
      const [range, setRange] = useState<DateRange | undefined>();
      return (
        <DateRangePicker
          value={range}
          onChange={setRange}
          placeholder="Stay dates"
          aria-label="Stay dates"
        />
      );
    }

    // an open sheet aria-hides the page, trigger included
    const rangeTrigger = () => screen.getByRole("button", { name: "Stay dates", hidden: true });
    const rangeSheet = () => screen.queryByRole("dialog", { name: "Select Date Range" });
    // the sheet used to close on a timer once both ends were set
    const outlastOldAutoClose = () => new Promise((resolve) => setTimeout(resolve, 300));

    async function openAndTap(compact: boolean, ...days: number[]) {
      renderInShell(<StayDates />, compact);
      await userEvent.click(await screen.findByRole("button", { name: "Stay dates" }));
      for (const day of days) await userEvent.click(dayButton(day) as HTMLElement);
      await outlastOldAutoClose();
    }

    it("keeps the sheet open after tap 1, tap 2 and tap 3", async () => {
      await openAndTap(true, 10);
      expect(rangeSheet()).toBeVisible();

      await userEvent.click(dayButton(12) as HTMLElement);
      await outlastOldAutoClose();
      expect(rangeSheet()).toBeVisible();

      await userEvent.click(dayButton(20) as HTMLElement);
      await outlastOldAutoClose();
      expect(rangeSheet()).toBeVisible();
      expect(rangeTrigger()).toHaveTextContent(/^\w{3} 20, \d{4}$/);
    });

    it("closes the sheet with Done and keeps the selection", async () => {
      await openAndTap(true, 10, 12);

      await userEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(rangeSheet()).not.toBeInTheDocument();
      expect(rangeTrigger()).toHaveTextContent(/10, \d{4} - .*12/);
    });

    it("enables Done with no selection and with only a start", async () => {
      await openAndTap(true);
      expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();

      await userEvent.click(dayButton(10) as HTMLElement);
      await userEvent.click(screen.getByRole("button", { name: "Done" }));

      expect(rangeSheet()).not.toBeInTheDocument();
      expect(rangeTrigger()).toHaveTextContent(/^\w{3} 10, \d{4}$/);
    });

    it("keeps the selection when the sheet is dismissed without Done", async () => {
      await openAndTap(true, 10, 12);

      await userEvent.keyboard("{Escape}");

      expect(rangeSheet()).not.toBeInTheDocument();
      expect(rangeTrigger()).toHaveTextContent(/10, \d{4} - .*12/);
    });

    it("reaches Done by keyboard", async () => {
      await openAndTap(true, 10);

      const done = screen.getByRole("button", { name: "Done" });
      for (let tab = 0; tab < 60 && document.activeElement !== done; tab++) {
        await userEvent.tab();
      }
      expect(done).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      expect(rangeSheet()).not.toBeInTheDocument();
    });

    it("has no axe violations with the sheet open", async () => {
      await openAndTap(true, 10);

      expect(await axe(rangeSheet() as HTMLElement)).toHaveNoViolations();
    });

    it("keeps the popover open after tap 2 and closes it on Escape", async () => {
      await openAndTap(false, 10, 12);

      const popover = screen.getByRole("dialog", { name: "Select date range" });
      expect(popover).toBeVisible();
      expect(within(popover).queryByRole("button", { name: "Done" })).not.toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "Select date range" })).not.toBeInTheDocument();
      expect(rangeTrigger()).toHaveTextContent(/10, \d{4} - .*12/);
    });
  });

  it("opens in a popover on a wider window", async () => {
    renderInShell(<DatePicker onChange={() => {}} placeholder="Check-in date" />, false);

    await userEvent.click(await screen.findByRole("button", { name: /Check-in date/ }));
    expect(screen.getByRole("dialog", { name: "Select date" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Select Date" })).not.toBeInTheDocument();
  });
});
