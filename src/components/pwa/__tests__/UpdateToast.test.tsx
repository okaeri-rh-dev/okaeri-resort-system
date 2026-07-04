import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpdateToast } from "../UpdateToast";

const useRegisterSWMock = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (...args: unknown[]) => useRegisterSWMock(...args),
}));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("<UpdateToast />", () => {
  afterEach(() => {
    vi.clearAllMocks();
    setVisibility("visible");
  });

  it("does not activate when needRefresh is false", () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });
    render(<UpdateToast />);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it("activates without a workbox reload (updateServiceWorker(false)) when visible", () => {
    setVisibility("visible");
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });
    render(<UpdateToast />);
    expect(updateServiceWorker).toHaveBeenCalledWith(false);
  });

  it("defers activation while hidden, then activates on next visibility", () => {
    setVisibility("hidden");
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });
    render(<UpdateToast />);

    // Hidden tab must not activate the waiting SW yet.
    expect(updateServiceWorker).not.toHaveBeenCalled();

    // When the tab becomes visible, it activates (still reload-free).
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(updateServiceWorker).toHaveBeenCalledWith(false);
  });
});
