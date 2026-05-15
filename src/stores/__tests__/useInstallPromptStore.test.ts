import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInstallPromptStore } from "../useInstallPromptStore";

const SNOOZE_KEY = "pwa-install-snoozed-until";
const DISMISS_KEY = "pwa-install-dismissed-permanently";

function makePromptEvent(): BeforeInstallPromptEvent {
  return {
    platforms: ["web"],
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    prompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as BeforeInstallPromptEvent;
}

describe("useInstallPromptStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useInstallPromptStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with dismissalState 'visible' and no captured event", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    expect(result.current.dismissalState).toBe("visible");
    expect(result.current.installPromptEvent).toBeNull();
  });

  it("captures a beforeinstallprompt event", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    const event = makePromptEvent();
    act(() => {
      result.current.captureEvent(event);
    });
    expect(result.current.installPromptEvent).toBe(event);
  });

  it("dismissPermanently sets state and persists in localStorage", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    act(() => {
      result.current.dismissPermanently();
    });
    expect(result.current.dismissalState).toBe("permanent");
    expect(localStorage.getItem(DISMISS_KEY)).toBe("true");
  });

  it("snoozeForDays sets a future ISO date and state 'snoozed'", () => {
    const { result } = renderHook(() => useInstallPromptStore());
    const now = new Date("2026-05-16T00:00:00Z");
    vi.setSystemTime(now);
    act(() => {
      result.current.snoozeForDays(7);
    });
    const stored = localStorage.getItem(SNOOZE_KEY);
    expect(stored).not.toBeNull();
    const until = new Date(stored!);
    const expected = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(until.toISOString()).toBe(expected.toISOString());
    expect(result.current.dismissalState).toBe("snoozed");
  });

  it("rehydrates 'permanent' from localStorage on init", () => {
    localStorage.setItem(DISMISS_KEY, "true");
    useInstallPromptStore.getState().reset();
    expect(useInstallPromptStore.getState().dismissalState).toBe("permanent");
  });

  it("rehydrates 'snoozed' when localStorage date is in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, future);
    useInstallPromptStore.getState().reset();
    expect(useInstallPromptStore.getState().dismissalState).toBe("snoozed");
  });

  it("treats expired snooze as 'visible' and clears the key", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, past);
    useInstallPromptStore.getState().reset();
    expect(useInstallPromptStore.getState().dismissalState).toBe("visible");
    expect(localStorage.getItem(SNOOZE_KEY)).toBeNull();
  });

  it("reset clears all dismissal state and storage keys", () => {
    localStorage.setItem(DISMISS_KEY, "true");
    localStorage.setItem(SNOOZE_KEY, "anything");
    useInstallPromptStore.getState().reset();
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    expect(localStorage.getItem(SNOOZE_KEY)).toBeNull();
    expect(useInstallPromptStore.getState().dismissalState).toBe("visible");
  });

  it("triggerInstall calls prompt() on the captured event and clears it", async () => {
    const { result } = renderHook(() => useInstallPromptStore());
    const event = makePromptEvent();
    act(() => {
      result.current.captureEvent(event);
    });
    await act(async () => {
      await result.current.triggerInstall();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.installPromptEvent).toBeNull();
  });

  it("triggerInstall is a no-op when no event captured", async () => {
    const { result } = renderHook(() => useInstallPromptStore());
    await act(async () => {
      await result.current.triggerInstall();
    });
    expect(result.current.installPromptEvent).toBeNull();
  });
});
