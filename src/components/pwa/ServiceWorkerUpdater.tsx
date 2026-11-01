import { useEffect } from "react";

import { useRouter } from "@tanstack/react-router";
import { useRegisterSW } from "virtual:pwa-register/react";

import { atSafePoint, setWaitingUpdate } from "@/lib/pwa-reload";

const UPDATE_POLL_MS = 60 * 60 * 1000;

/** Polls for new builds; a route change is a safe point to apply one (see pwa-reload). */
export function ServiceWorkerUpdater() {
  const router = useRouter();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Without this, vite-plugin-pwa reloads on every controller change, even one
    // started by another tab. pwa-reload owns the single reload path.
    onNeedReload() {},
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, UPDATE_POLL_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    setWaitingUpdate(() => void updateServiceWorker());
    return () => setWaitingUpdate(null);
  }, [needRefresh, updateServiceWorker]);

  // Path only: filters and search boxes write search params while someone types.
  useEffect(
    () =>
      router.subscribe("onResolved", (event) => {
        if (event.pathChanged) atSafePoint();
      }),
    [router]
  );

  return null;
}
