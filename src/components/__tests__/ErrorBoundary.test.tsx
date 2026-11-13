import { lazy, Suspense } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../ErrorBoundary";

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads the page when Try again follows a chunk from an older deploy", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const LazyTable = lazy(() =>
      Promise.reject(
        new TypeError("Failed to fetch dynamically imported module: /assets/GuestsTable-old.js")
      )
    );

    render(
      <ErrorBoundary>
        <Suspense fallback={<p>Loading</p>}>
          <LazyTable />
        </Suspense>
      </ErrorBoundary>
    );

    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(reload).toHaveBeenCalledOnce();
  });
});
