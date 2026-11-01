import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { atSafePoint, setWaitingUpdate } from "@/lib/pwa-reload";

import { ServiceWorkerUpdater } from "../ServiceWorkerUpdater";

const useRegisterSWMock = vi.fn();
let onResolved: ((event: { pathChanged: boolean }) => void) | undefined;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (...args: unknown[]) => useRegisterSWMock(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    subscribe: (eventType: string, listener: typeof onResolved) => {
      if (eventType === "onResolved") onResolved = listener;
      return () => {};
    },
  }),
}));

vi.mock("@/lib/pwa-reload", () => ({
  atSafePoint: vi.fn(),
  setWaitingUpdate: vi.fn(),
}));

function renderWithUpdate(needRefresh: boolean) {
  const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
  useRegisterSWMock.mockReturnValue({
    needRefresh: [needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  });
  render(<ServiceWorkerUpdater />);
  return updateServiceWorker;
}

describe("<ServiceWorkerUpdater />", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registers nothing when no update is waiting", () => {
    renderWithUpdate(false);
    expect(setWaitingUpdate).not.toHaveBeenCalled();
  });

  it("registers a waiting update without activating it", () => {
    const updateServiceWorker = renderWithUpdate(true);
    expect(updateServiceWorker).not.toHaveBeenCalled();

    const activate = vi.mocked(setWaitingUpdate).mock.calls[0][0];
    activate?.();
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it("stops vite-plugin-pwa from reloading on its own", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { reload: reloadSpy } });
    renderWithUpdate(true);

    const { onNeedReload } = useRegisterSWMock.mock.calls[0][0];
    expect(onNeedReload).toBeTypeOf("function");
    onNeedReload();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("treats a route change as a safe point, but not a search-param change", () => {
    renderWithUpdate(true);

    onResolved?.({ pathChanged: false });
    expect(atSafePoint).not.toHaveBeenCalled();

    onResolved?.({ pathChanged: true });
    expect(atSafePoint).toHaveBeenCalledTimes(1);
  });
});
