// src/components/audit/__tests__/ActionBadge.test.tsx

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionBadge } from "../ActionBadge";

describe("ActionBadge", () => {
  it("labels trigger rows by their SQL operation", () => {
    render(<ActionBadge log={{ action: "UPDATE", source: "trigger", metadata: null }} />);
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("labels app rows by metadata.action, not the INSERT every app row is stored with", () => {
    render(
      <ActionBadge log={{ action: "INSERT", source: "app", metadata: { action: "updated" } }} />
    );
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
  });

  it("turns multi-word app actions into words", () => {
    render(
      <ActionBadge log={{ action: "INSERT", source: "app", metadata: { action: "checked_in" } }} />
    );
    expect(screen.getByText("Checked in")).toBeInTheDocument();
  });

  it("falls back to Event for app rows without metadata.action", () => {
    render(<ActionBadge log={{ action: "INSERT", source: "app", metadata: { logged_at: "x" } }} />);
    expect(screen.getByText("Event")).toBeInTheDocument();
  });
});
