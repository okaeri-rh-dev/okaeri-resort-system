import { render } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpdateToast } from "../UpdateToast";

const useRegisterSWMock = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (...args: unknown[]) => useRegisterSWMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const mockedToastMessage = vi.mocked(toast.message);

describe("<UpdateToast />", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not show toast when needRefresh is false", () => {
    useRegisterSWMock.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });
    render(<UpdateToast />);
    expect(mockedToastMessage).not.toHaveBeenCalled();
  });

  it("shows toast when needRefresh becomes true", () => {
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    });
    render(<UpdateToast />);
    expect(mockedToastMessage).toHaveBeenCalledOnce();
    const [title, opts] = mockedToastMessage.mock.calls[0] as [
      string,
      {
        duration: number;
        action: { label: string; onClick: () => void };
        cancel: { label: string; onClick: () => void };
      },
    ];
    expect(title).toMatch(/new version/i);
    expect(opts.duration).toBe(Infinity);
    expect(opts.action.label).toMatch(/reload/i);
    expect(opts.cancel.label).toMatch(/later/i);
  });

  it("calls updateServiceWorker(true) when Reload action is invoked", () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSWMock.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    });
    render(<UpdateToast />);
    const [, opts] = mockedToastMessage.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    opts.action.onClick();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
