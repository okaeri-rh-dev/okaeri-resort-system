import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";
import "./styles/print.css";

import { logger } from "@/lib/logger";
import { registerSwReload } from "@/lib/pwa-reload";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

// PWA install-prompt wiring + safe-point reload on SW updates
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallPromptStore.getState().captureEvent(event);
  });

  window.addEventListener("appinstalled", () => {
    useInstallPromptStore.getState().markInstalled();
  });

  // If we're running in standalone mode (already installed), reflect that
  if (window.matchMedia("(display-mode: standalone)").matches) {
    useInstallPromptStore.getState().markInstalled();
  }

  // Reloads onto a new SW build at a safe point, never mid-form (see pwa-reload).
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

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element missing from index.html");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
