// Enable Immer MapSet plugin before any store imports
// This MUST be at the very top to prevent "plugin not loaded" errors
import { enableMapSet } from "immer";
enableMapSet();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
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

// Create the router with file-based routing and auth context
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    // Auth context will be provided by the InnerApp component
    auth: undefined!,
    project: undefined!,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  // Enable better error handling and loading states
  defaultPendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="border-ocean-600 mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    </div>
  ),
  defaultErrorComponent: ({ error, reset }) => (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
            Application Error
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Something went wrong while loading the application.
          </p>
          {error.message && (
            <p className="mt-2 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error.message}
            </p>
          )}
          <div className="mt-6">
            <button
              type="button"
              onClick={reset}
              className="bg-ocean-600 hover:bg-ocean-700 focus:ring-ocean-500 w-full rounded-md px-4 py-2 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  ),
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
    const { connection } = navigator as any;
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

// Get root element first
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Initialize application without router (router isn't ready yet)
// This will set up stores, offline support, performance monitoring, and error handling
async function startApp() {
  try {
    await initializeApp(); // No router parameter

    // Development helpers for testing auth persistence
    if (config.isDevelopment) {
      // Expose auth store and token manager for testing
      const authStore = useAuthStore;
      const { secureTokenManager } = await import("@/lib/security/secure-token-manager");

      (window as any).__AUTH_STORE__ = authStore;
      (window as any).__TOKEN_MANAGER__ = secureTokenManager;

      console.log("[DEV] Auth persistence helpers loaded:");
      console.log("  - window.__AUTH_STORE__ (useAuthStore)");
      console.log("  - window.__TOKEN_MANAGER__ (secureTokenManager)");
    }

    // NOW create and render React after initialization is complete
    const root = createRoot(rootElement);
    root.render(<App />);
  } catch (error) {
    console.error("Failed to start application:", error);
    // Still try to render even if initialization fails
    const root = createRoot(rootElement);
    root.render(<App />);
  }
}

// Start the application
startApp();

// Inner app component that provides auth context to router
function InnerApp() {
  const authStore = useAuthStore();
  const projectStore = useProjectStore();

  // Create auth context for router
  const authContext = {
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user,
    login: authStore.login,
    logout: authStore.logout,
    checkAuth: authStore.checkAuth,
    hasPermission: authStore.hasPermission,
    hasRole: authStore.hasRole,
    refreshToken: authStore.refreshTokens,
    initializeAuth: authStore.initializeAuth,
    isLoading: authStore.isLoading,
    error: authStore.error,
  };

  return (
    <RouterProvider
      router={router}
      context={{
        queryClient,
        auth: authContext,
        project: projectStore,
      }}
    />
  );
}

// Enhanced root render with providers
function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <InnerApp />
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

// Render is now handled in startApp() function above
