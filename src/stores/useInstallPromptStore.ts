import { create } from "zustand";

type DismissalState = "visible" | "snoozed" | "permanent" | "installed";

interface InstallPromptState {
  installPromptEvent: BeforeInstallPromptEvent | null;
  dismissalState: DismissalState;
  captureEvent: (event: BeforeInstallPromptEvent) => void;
  triggerInstall: () => Promise<void>;
  snoozeForDays: (days: number) => void;
  dismissPermanently: () => void;
  markInstalled: () => void;
  rehydrate: () => void;
  reset: () => void;
}

const SNOOZE_KEY = "pwa-install-snoozed-until";
const DISMISS_KEY = "pwa-install-dismissed-permanently";

function readInitialDismissalState(): DismissalState {
  if (typeof window === "undefined") return "visible";
  if (localStorage.getItem(DISMISS_KEY) === "true") return "permanent";
  const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
  if (snoozeUntil) {
    const until = new Date(snoozeUntil);
    if (!Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
      return "snoozed";
    }
    localStorage.removeItem(SNOOZE_KEY);
  }
  return "visible";
}

export const useInstallPromptStore = create<InstallPromptState>((set, get) => ({
  installPromptEvent: null,
  dismissalState: readInitialDismissalState(),

  captureEvent: (event) => set({ installPromptEvent: event }),

  triggerInstall: async () => {
    const event = get().installPromptEvent;
    if (!event) return;
    await event.prompt();
    set({ installPromptEvent: null });
  },

  snoozeForDays: (days) => {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(SNOOZE_KEY, until);
    set({ dismissalState: "snoozed" });
  },

  dismissPermanently: () => {
    localStorage.setItem(DISMISS_KEY, "true");
    set({ dismissalState: "permanent" });
  },

  markInstalled: () => set({ dismissalState: "installed" }),

  rehydrate: () => set({ dismissalState: readInitialDismissalState() }),

  reset: () => {
    localStorage.removeItem(SNOOZE_KEY);
    localStorage.removeItem(DISMISS_KEY);
    // Keep installPromptEvent — beforeinstallprompt fires once per page load,
    // and the escape hatch must be able to re-show the native prompt without
    // requiring a navigation.
    set({ dismissalState: "visible" });
  },
}));
