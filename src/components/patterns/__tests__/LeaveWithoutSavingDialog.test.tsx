import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { LeaveWithoutSavingDialog } from "@/components/patterns";

const renderDialog = () => {
  const onKeepEditing = vi.fn();
  const onLeave = vi.fn();
  render(
    <LeaveWithoutSavingDialog
      open
      description="Your changes are not saved."
      onKeepEditing={onKeepEditing}
      onLeave={onLeave}
    />
  );
  return { onKeepEditing, onLeave };
};

describe("LeaveWithoutSavingDialog", () => {
  it("asks before leaving and runs Leave", async () => {
    const { onKeepEditing, onLeave } = renderDialog();

    const dialog = screen.getByRole("alertdialog", { name: "Leave without saving?" });
    expect(dialog).toHaveAccessibleDescription("Your changes are not saved.");
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onKeepEditing).not.toHaveBeenCalled();
  });

  it("keeps editing from the button and from Escape", async () => {
    const { onKeepEditing, onLeave } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await userEvent.keyboard("{Escape}");

    expect(onKeepEditing).toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("has no axe violations while open", async () => {
    renderDialog();

    expect(await axe(screen.getByRole("alertdialog"))).toHaveNoViolations();
  });
});
