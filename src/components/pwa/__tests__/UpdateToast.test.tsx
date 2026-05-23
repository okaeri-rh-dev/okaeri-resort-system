import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpdateToast } from "../UpdateToast";

const useRegisterSWMock = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (...args: unknown[]) => useRegisterSWMock(...args),
}));

describe("<UpdateToast />", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not reload when needRefresh is false", () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });
    render(<UpdateToast />);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it("calls updateServiceWorker(true) when needRefresh becomes true", () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });
    render(<UpdateToast />);
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
