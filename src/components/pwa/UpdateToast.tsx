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
    void updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  return null;
}
