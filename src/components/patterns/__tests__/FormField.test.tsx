import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { Button, Form, FormField, Input } from "@/components/patterns";

function GuestEmailForm() {
  const form = useForm<{ email: string }>({ defaultValues: { email: "" } });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="email"
          label="Email"
          description="We send the booking reference here."
          rules={{ required: "Enter an email so we can send your booking reference." }}
        >
          {(field) => <Input type="email" {...field} />}
        </FormField>
        <Button type="submit">Continue</Button>
      </form>
    </Form>
  );
}

describe("FormField", () => {
  it("ties the label and description to the control", () => {
    render(<GuestEmailForm />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("We send the booking reference here.");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("shows the validation message next to the field and marks it invalid", async () => {
    render(<GuestEmailForm />);

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const input = screen.getByLabelText("Email");
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(input).toHaveAccessibleDescription(
      "We send the booking reference here. Enter an email so we can send your booking reference."
    );
  });

  it("has no axe violations, before and after an error", async () => {
    const { container } = render(<GuestEmailForm />);
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Enter an email so we can send your booking reference.");
    expect(await axe(container)).toHaveNoViolations();
  });
});
