import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * registerSwReload() is the single, visibility-gated reload path for SW updates.
 * These tests capture the `controllerchange` handler it registers and drive it
 * directly, so we don't depend on the environment dispatching real SW events.
 */

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
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

describe("registerSwReload", () => {
  beforeEach(() => {
    vi.resetModules(); // reset the module-level `registered` guard
    reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadSpy },
    });
    setVisibility("visible");
  });

  afterEach(() => {
    setVisibility("visible");
  });

  it("reloads immediately when the tab is visible and a controller already existed", async () => {
    stubServiceWorker(true);
    const { registerSwReload } = await import("../pwa-reload");
    registerSwReload();

    controllerChangeHandler?.();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("defers the reload while hidden, then reloads on next visibility", async () => {
    setVisibility("hidden");
    stubServiceWorker(true);
    const { registerSwReload } = await import("../pwa-reload");
    registerSwReload();

    controllerChangeHandler?.();
    expect(reloadSpy).not.toHaveBeenCalled();

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("does not reload on the initial SW claim (no prior controller)", async () => {
    stubServiceWorker(false);
    const { registerSwReload } = await import("../pwa-reload");
    registerSwReload();

    controllerChangeHandler?.();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
