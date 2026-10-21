import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Button, Form, FormField, SelectControl, SelectItem } from "@/components/patterns";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

function SeasonForm({ onSubmit }: { onSubmit: (values: { season: string }) => void }) {
  const form = useForm<{ season: string }>({ defaultValues: { season: "" } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="season"
          label="Season"
          description="Rates apply to every night in the season."
          rules={{ required: "Choose a season." }}
        >
          {({ value, onChange, ...field }) => (
            <SelectControl
              {...field}
              value={value}
              onValueChange={onChange}
              placeholder="Choose a season"
            >
              <SelectItem value="peak">Peak</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
            </SelectControl>
          )}
        </FormField>
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}

describe("SelectControl", () => {
  it("is named by the field label and shows the placeholder until a choice is made", () => {
    render(<SeasonForm onSubmit={() => {}} />);

    const trigger = screen.getByLabelText("Season");
    expect(trigger).toHaveRole("combobox");
    expect(trigger).toHaveTextContent("Choose a season");
    expect(trigger).toHaveAccessibleDescription("Rates apply to every night in the season.");
  });

  it("reports the chosen value to the form", async () => {
    const onSubmit = vi.fn();
    render(<SeasonForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByLabelText("Season"));
    await userEvent.click(await screen.findByRole("option", { name: "Peak" }));
    expect(screen.getByLabelText("Season")).toHaveTextContent("Peak");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ season: "peak" });
  });

  it("marks the trigger invalid and describes it with the error", async () => {
    render(<SeasonForm onSubmit={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const trigger = screen.getByLabelText("Season");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-invalid", "true"));
    expect(trigger).toHaveAccessibleDescription(
      "Rates apply to every night in the season. Choose a season."
    );
  });

  it("has no axe violations, closed and open", async () => {
    const { container } = render(<SeasonForm onSubmit={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByLabelText("Season"));
    const listbox = await screen.findByRole("listbox");
    expect(await axe(listbox)).toHaveNoViolations();
  });
});
