import { useEffect } from "react";

import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

const TOAST_ID = "pwa-update-toast";
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
    toast.message("A new version of Okaeri is available.", {
      id: TOAST_ID,
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => {
          void updateServiceWorker(true);
        },
      },
      cancel: {
        label: "Later",
        onClick: () => {
          toast.dismiss(TOAST_ID);
        },
      },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
