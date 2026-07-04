import { useEffect } from "react";

import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_POLL_MS = 60 * 60 * 1000; // 60 minutes

export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, UPDATE_POLL_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;

    // Activate the waiting SW (skipWaiting) but pass `false` so workbox-window does
    // NOT reload here — registerSwReload() owns the reload, gated on visibility.
    // Only activate while visible so a hidden tab does not swap its own controller
    // out from under itself; defer activation until it is next shown.
    const activate = () => void updateServiceWorker(false);

    if (document.visibilityState === "visible") {
      activate();
      return;
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      activate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [needRefresh, updateServiceWorker]);

  return null;
}
