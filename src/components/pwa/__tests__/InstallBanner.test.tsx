import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

import { InstallBanner } from "../InstallBanner";

function makePromptEvent() {
  return {
    platforms: ["web"],
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    prompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as BeforeInstallPromptEvent;
}

describe("<InstallBanner />", () => {
  beforeEach(() => {
    localStorage.clear();
    useInstallPromptStore.getState().reset();
    // reset() preserves the captured event by design (production escape-hatch
    // semantics). Tests need to start with a clean event slate.
    useInstallPromptStore.setState({ installPromptEvent: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when dismissalState is 'permanent'", () => {
    useInstallPromptStore.getState().dismissPermanently();
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when dismissalState is 'snoozed'", () => {
    useInstallPromptStore.getState().snoozeForDays(7);
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when dismissalState is 'installed'", () => {
    useInstallPromptStore.getState().markInstalled();
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Install button when beforeinstallprompt has fired", () => {
    useInstallPromptStore.getState().captureEvent(makePromptEvent());
    render(<InstallBanner />);
    expect(screen.getByRole("button", { name: /^install$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /maybe later/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /don't show again/i })).toBeInTheDocument();
  });

  it("renders iOS instructions when no event and userAgent looks like iOS Safari", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    render(<InstallBanner />);
    expect(screen.getByText(/share/i)).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it("renders nothing when no event and not iOS Safari (e.g. Firefox)", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
    });
    const { container } = render(<InstallBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls triggerInstall when Install is clicked", () => {
    const event = makePromptEvent();
    useInstallPromptStore.getState().captureEvent(event);
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));
    expect(event.prompt).toHaveBeenCalledOnce();
  });

  it("snoozes for 7 days when Maybe later is clicked", () => {
    useInstallPromptStore.getState().captureEvent(makePromptEvent());
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /maybe later/i }));
    expect(useInstallPromptStore.getState().dismissalState).toBe("snoozed");
    const until = localStorage.getItem("pwa-install-snoozed-until");
    expect(until).not.toBeNull();
    const diffDays = (new Date(until!).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("dismisses permanently when Don't show again is clicked", () => {
    useInstallPromptStore.getState().captureEvent(makePromptEvent());
    render(<InstallBanner />);
    fireEvent.click(screen.getByRole("button", { name: /don't show again/i }));
    expect(useInstallPromptStore.getState().dismissalState).toBe("permanent");
    expect(localStorage.getItem("pwa-install-dismissed-permanently")).toBe("true");
  });
});
