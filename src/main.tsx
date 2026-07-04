import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";
import "./styles/print.css";

import { logger } from "@/lib/logger";
import { registerSwReload } from "@/lib/pwa-reload";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

// PWA install-prompt wiring + multi-tab auto-reload on SW activation
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallPromptStore.getState().captureEvent(event as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    useInstallPromptStore.getState().markInstalled();
  });

  // If we're running in standalone mode (already installed), reflect that
  if (window.matchMedia("(display-mode: standalone)").matches) {
    useInstallPromptStore.getState().markInstalled();
  }

  // When a new SW takes control, reload open tabs so they run against the fresh
  // precached assets. registerSwReload() gates the reload on tab visibility: a
  // hidden tab defers until refocused, avoiding the blank-page-on-return caused by
  // reloading a backgrounded (and possibly frozen) tab.
  registerSwReload();
}

// Performance monitoring for production
if (import.meta.env.PROD) {
  // Basic error tracking
  window.addEventListener("error", (e) => {
    console.error("Global error:", e.error);
    // In future phases, send to monitoring service
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled promise rejection:", e.reason);
    // In future phases, send to monitoring service
  });

  // Performance monitoring
  if ("performance" in window) {
    window.addEventListener("load", () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;
        if (perfData) {
          const loadTime = perfData.loadEventEnd - perfData.fetchStart;
          logger.info(`Page load time: ${loadTime}ms`);
          // In future phases, send to analytics
        }
      }, 0);
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
