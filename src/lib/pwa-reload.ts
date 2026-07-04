/**
 * Single reload path for service-worker updates.
 *
 * When a new service worker takes control of the page (via `skipWaiting` +
 * `clientsClaim`), the page must reload so it runs against the freshly precached
 * build assets. But we must NEVER reload a hidden tab: a background reload tears
 * the current document down to blank and then stalls, because browsers defer (and
 * may freeze/discard) navigations in hidden tabs. The user then returns to a white
 * page that only a manual refresh recovers.
 *
 * So this handler reloads immediately when the tab is visible, and otherwise defers
 * the reload until the tab is next shown. It is the ONLY reload path — `UpdateToast`
 * calls `updateServiceWorker(false)` so workbox-window does not add a second one.
 */

let registered = false;

export function registerSwReload(): void {
  if (registered) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  registered = true;

  // Capture whether a controller already exists BEFORE the event fires. On a first
  // visit under `clientsClaim`, the SW claims a previously-uncontrolled page and
  // `controllerchange` fires once — we must not treat that initial claim as an
  // update-triggered reload. Only reload when replacing an existing controller.
  const hadController = !!navigator.serviceWorker.controller;

  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return; // initial SW claim, not an update

    if (document.visibilityState === "visible") {
      reload();
      return;
    }

    // Hidden tab: defer the reload until it is next made visible.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      reload();
    };
    document.addEventListener("visibilitychange", onVisible);
  });
}
