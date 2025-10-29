/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NumberInput } from "../input";

describe("NumberInput", () => {
  it("calls onChange when user types a number", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<NumberInput onChange={onChange} aria-label="Test input" />);

    const input = screen.getByLabelText("Test input");

    // Type a number
    await user.type(input, "5");

    // onChange should be called with the parsed number
    expect(onChange).toHaveBeenCalled();

    // Check if onChange was called with 5
    const calls = onChange.mock.calls;
    console.log("onChange calls:", calls);

    const callsWithFive = calls.filter((call) => call[0] === 5);
    expect(callsWithFive.length).toBeGreaterThan(0);
  });

  it("calls onChange with null when input is cleared", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<NumberInput onChange={onChange} aria-label="Test input" value={10} />);

    const input = screen.getByLabelText("Test input");

    // Clear the input
    await user.clear(input);

    // onChange should be called with null
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
