import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/lib/query-client";
import { config } from "@/config";
import { initializeApp } from "@/lib/app-initializer";
import {
  coreWebVitalsMonitor,
  performanceBudgetManager,
  routeTransitionManager,
} from "@/lib/route-optimization";
import { imagePreloader } from "@/lib/image-optimization";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

import "./index.css";

// Create the router with file-based routing
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Initialize app version
if (typeof window !== "undefined") {
  window.__ORMS_VERSION__ = config.app.version;
  window.__ORMS_ENV__ = config.app.environment;
}

// Log app initialization in development
if (config.isDevelopment) {
  console.log(
    `%c🏝️ Okaeri Resort Management System v${config.app.version}`,
    "color: #0ea5e9; font-size: 16px; font-weight: bold;"
  );
  console.log(`%c📍 Environment: ${config.app.environment}`, "color: #10b981; font-size: 12px;");
}

// Initialize performance monitoring
if (typeof window !== "undefined") {
  // Initialize Core Web Vitals monitoring
  coreWebVitalsMonitor.initialize();

  // Track initial bundle size
  const initialBundleSize = performance.getEntriesByType("navigation")[0]?.transferSize || 0;
  if (initialBundleSize > 0) {
    performanceBudgetManager.checkBudget(
      "initialBundleSize",
      initialBundleSize,
      window.location.pathname
    );
  }

  // Preload critical images
  const criticalImages = ["/icons/icon-192x192.png", "/icons/icon-512x512.png"];

  criticalImages.forEach((src) => {
    imagePreloader.preload(src, 10); // High priority for critical images
  });

  // Register service worker for PWA functionality
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("Service Worker registered successfully:", registration.scope);

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "SW_PERFORMANCE") {
            console.log("Service Worker Performance:", event.data.data);
          }
        });

        // Handle service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New version available
                console.log("New app version available");
                // Could show update notification here
              }
            });
          }
        });
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    });
  }

  // Monitor connection changes for adaptive loading
  if ("connection" in navigator) {
    const connection = (navigator as any).connection;
    const updateConnectionInfo = () => {
      console.log(`Connection: ${connection.effectiveType}, Downlink: ${connection.downlink}Mbps`);

      // Send connection info to service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CONNECTION_CHANGE",
          connection: {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
          },
        });
      }
    };

    connection.addEventListener("change", updateConnectionInfo);
    updateConnectionInfo(); // Initial check
  }

  // Track route transitions
  let currentPath = window.location.pathname;
  const trackNavigation = () => {
    const newPath = window.location.pathname;
    if (newPath !== currentPath) {
      routeTransitionManager.queueTransition(currentPath, newPath, 5);
      currentPath = newPath;
    }
  };

  // Use both popstate and router events for comprehensive tracking
  window.addEventListener("popstate", trackNavigation);

  // Performance observer for paint timing
  if ("PerformanceObserver" in window) {
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            console.log(`First Contentful Paint: ${entry.startTime}ms`);
            performanceBudgetManager.checkBudget("renderTime", entry.startTime, currentPath);
          }
        }
      });

      paintObserver.observe({ entryTypes: ["paint"] });
    } catch (error) {
      console.warn("Performance Observer not supported:", error);
    }
  }
}

// Initialize application with all integrations
initializeApp().catch((error) => {
  console.error("Failed to initialize application:", error);
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

// Enhanced root render with providers
function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {config.isDevelopment && (
          <ReactQueryDevtools
            initialIsOpen={false}
            position="bottom-right"
            buttonPosition="bottom-right"
          />
        )}
      </QueryClientProvider>
    </StrictMode>
  );
}

root.render(<App />);
