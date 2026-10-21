import { vi } from "vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * Sets the width every element measures, so a `DataTable` renders as a table (600px or wider)
 * or as cards (narrower). jsdom has no layout and otherwise measures 0, which means cards.
 */
export function stubPaneWidth(width: number) {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height: 0,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 0,
    toJSON: () => ({}),
  });
}
