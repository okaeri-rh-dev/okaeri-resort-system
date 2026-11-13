import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { registerStaleChunkReload, STALE_CHUNK_RELOAD_KEY } from "../stale-chunk-reload";

function firePreloadError() {
  window.dispatchEvent(new Event("vite:preloadError"));
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
}

describe("registerStaleChunkReload", () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    registerStaleChunkReload();
  });

  beforeEach(() => {
    reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    sessionStorage.clear();
    setOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reloads once when a chunk from an older deploy fails to load", () => {
    firePreloadError();

    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload again right after its own reload", () => {
    firePreloadError();
    firePreloadError();

    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads again for a later deploy in the same tab", () => {
    vi.useFakeTimers();
    firePreloadError();
    vi.advanceTimersByTime(60_000);
    firePreloadError();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload while offline", () => {
    setOnline(false);
    firePreloadError();

    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)).toBeNull();
  });
});
