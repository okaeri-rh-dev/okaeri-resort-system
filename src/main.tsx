import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";
import "./styles/print.css";

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
          console.log(`Page load time: ${loadTime}ms`);
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
