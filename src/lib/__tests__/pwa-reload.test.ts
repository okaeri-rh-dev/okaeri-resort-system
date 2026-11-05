import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These tests capture the `controllerchange` handler that registerSwReload()
 * registers and drive it directly, so we don't depend on the environment
 * dispatching real SW events.
 */

function changeVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

let controllerChangeHandler: (() => void) | undefined;
let reloadSpy: ReturnType<typeof vi.fn>;

function stubServiceWorker(hasController: boolean) {
  controllerChangeHandler = undefined;
  const swMock = {
    controller: hasController ? {} : null,
    addEventListener: (type: string, cb: () => void) => {
      if (type === "controllerchange") controllerChangeHandler = cb;
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: swMock,
  });
}

async function loadModule({ hasController = true } = {}) {
  stubServiceWorker(hasController);
  const pwaReload = await import("../pwa-reload");
  pwaReload.registerSwReload();
  return pwaReload;
}

describe("pwa-reload", () => {
  beforeEach(() => {
    vi.resetModules(); // reset the module-level state
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadSpy },
    });
    changeVisibility("visible");
  });

  afterEach(() => {
    changeVisibility("visible");
  });

  it("does not activate a waiting update until a safe point", async () => {
    const { setWaitingUpdate, atSafePoint } = await loadModule();
    const activate = vi.fn(() => controllerChangeHandler?.());

    setWaitingUpdate(activate);
    expect(activate).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();

    atSafePoint();
    expect(activate).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    atSafePoint();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("reloads once when the tab returns after being hidden for 30 minutes or more", async () => {
    const { setWaitingUpdate, HIDDEN_RELOAD_MS } = await loadModule();
    setWaitingUpdate(() => controllerChangeHandler?.());

    changeVisibility("hidden");
    vi.setSystemTime(Date.now() + HIDDEN_RELOAD_MS);
    changeVisibility("visible");
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    changeVisibility("hidden");
    vi.setSystemTime(Date.now() + HIDDEN_RELOAD_MS);
    changeVisibility("visible");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the tab returns after a short absence", async () => {
    const { setWaitingUpdate, HIDDEN_RELOAD_MS } = await loadModule();
    const activate = vi.fn(() => controllerChangeHandler?.());
    setWaitingUpdate(activate);

    changeVisibility("hidden");
    vi.setSystemTime(Date.now() + HIDDEN_RELOAD_MS - 1000);
    changeVisibility("visible");
    expect(activate).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("never reloads a hidden tab", async () => {
    const { setWaitingUpdate, atSafePoint } = await loadModule();
    const activate = vi.fn(() => controllerChangeHandler?.());
    setWaitingUpdate(activate);

    changeVisibility("hidden");
    atSafePoint();
    controllerChangeHandler?.();
    expect(activate).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does not reload on the initial SW claim (no prior controller)", async () => {
    const { atSafePoint } = await loadModule({ hasController: false });

    controllerChangeHandler?.();
    atSafePoint();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("waits for a safe point when another tab activates the update", async () => {
    const { atSafePoint } = await loadModule();

    controllerChangeHandler?.();
    expect(reloadSpy).not.toHaveBeenCalled();

    atSafePoint();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
