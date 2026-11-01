/**
 * Single reload path for service-worker updates.
 *
 * A new build must not reload the page while someone is typing in a form, so an
 * update waits for a safe point: the next route change (ServiceWorkerUpdater calls
 * atSafePoint), or the tab coming back after it was hidden for at least
 * HIDDEN_RELOAD_MS. At a safe point the waiting service worker is activated, and the
 * `controllerchange` that follows reloads the page. A controller change started by
 * another tab also waits for this tab's next safe point.
 *
 * A hidden tab never reloads: browsers defer (and may freeze/discard) navigations in
 * hidden tabs, so the user would return to a blank page that only a manual refresh
 * recovers.
 */

export const HIDDEN_RELOAD_MS = 30 * 60 * 1000;

let registered = false;
let activateWaitingUpdate: (() => void) | null = null;
let controllerChanged = false;
let activatedHere = false;
let reloaded = false;

function reload() {
  if (reloaded) return;
  reloaded = true;
  window.location.reload();
}

export function setWaitingUpdate(activate: (() => void) | null): void {
  activateWaitingUpdate = activate;
}

export function atSafePoint(): void {
  if (document.visibilityState !== "visible") return;
  if (controllerChanged) {
    reload();
    return;
  }
  if (!activateWaitingUpdate) return;
  const activate = activateWaitingUpdate;
  activateWaitingUpdate = null;
  activatedHere = true;
  activate();
}

export function registerSwReload(): void {
  if (registered) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  registered = true;

  // On a first visit under `clientsClaim`, the SW claims an uncontrolled page and
  // `controllerchange` fires once. That claim is not an update, so it never reloads.
  let hasController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    controllerChanged = true;
    if (activatedHere) atSafePoint();
  });

  let hiddenAt = document.visibilityState === "hidden" ? Date.now() : null;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    const hiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (hiddenFor >= HIDDEN_RELOAD_MS) atSafePoint();
  });
}
