/**
 * A deploy removes the old build's chunks, and Cloudflare Pages answers an old chunk
 * URL with index.html, so a tab left open on the old build fails its next lazy import.
 * Vite fires `vite:preloadError` for that failure; a reload loads the new build.
 *
 * Guards: no reload while offline (the reload would land on the browser's offline
 * page, because the service worker does not serve navigations), and no second reload
 * within RELOAD_COOLDOWN_MS, so a chunk that is missing from the new build too cannot
 * loop. Without a reload, the error boundary shows and its Try again reloads.
 */

export const STALE_CHUNK_RELOAD_KEY = "stale-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

export function registerStaleChunkReload(): void {
  window.addEventListener("vite:preloadError", () => {
    if (!navigator.onLine) return;
    try {
      const lastReloadAt = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY));
      if (Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) return;
      sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      return; // without storage the cooldown cannot hold across the reload
    }
    window.location.reload();
  });
}
