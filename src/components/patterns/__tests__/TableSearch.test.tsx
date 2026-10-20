import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { TableSearch } from "@/components/patterns";

function GuestSearch() {
  const [query, setQuery] = useState("");
  return (
    <>
      <TableSearch value={query} onChange={setQuery} placeholder="Search guests" />
      <output>{query}</output>
    </>
  );
}

describe("TableSearch", () => {
  it("is named by its placeholder and reports what is typed", async () => {
    render(<GuestSearch />);

    await userEvent.type(screen.getByRole("textbox", { name: "Search guests" }), "maria@okaeri.ph");

    expect(screen.getByRole("status")).toHaveTextContent("maria@okaeri.ph");
  });

  it("drops characters that could act as a pattern", async () => {
    render(<GuestSearch />);

    await userEvent.type(screen.getByRole("textbox"), "ma(ria)*");

    expect(screen.getByRole("status")).toHaveTextContent(/^maria$/);
  });

  it("clears the query from its clear button", async () => {
    render(<GuestSearch />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "maria");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("has no axe violations", async () => {
    const { container } = render(<TableSearch value="maria" onChange={() => {}} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
