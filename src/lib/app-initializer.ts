/**
 * Application Initializer
 * Sets up all integrations between Zustand stores, TanStack Query, and routing
 * Handles offline support, cache synchronization, and performance optimizations
 */

import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import {
  cacheSyncManager,
  offlineSyncManager,
  routeStateManager,
  useNavigationStore,
} from "@/lib/store-router-integration";
import { router } from "@tanstack/react-router";

/**
 * Initialize the application with all integrations
 */
export async function initializeApp() {
  console.log("🚀 Initializing Okaeri Resort System...");

  // 1. Initialize stores
  await initializeStores();

  // 2. Set up router integrations
  setupRouterIntegrations();

  // 3. Initialize offline support
  setupOfflineSupport();

  // 4. Set up performance monitoring
  setupPerformanceMonitoring();

  // 5. Initialize cache synchronization
  cacheSyncManager.initialize();

  // 6. Set up global error handling
  setupErrorHandling();

  // 7. Initialize authentication
  await initializeAuthentication();

  console.log("✅ Application initialized successfully");
}

/**
 * Initialize stores with persisted data
 */
async function initializeStores() {
  console.log("📦 Initializing stores...");

  // Restore UI preferences
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    useUIStore.getState().setTheme(savedTheme as "light" | "dark" | "system");
  }

  // Detect mobile device
  const isMobile = window.innerWidth < 768;
  useUIStore.getState().setIsMobile(isMobile);

  // Restore offline queue
  offlineSyncManager.restoreQueue();

  // Check for pending project data
  const projectStore = useProjectStore.getState();
  if (projectStore.projects.length === 0 && projectStore.activeProjectId) {
    // Clear invalid state
    projectStore.setActiveProjectLocal(null);
  }
}

/**
 * Set up router integrations with stores
 */
function setupRouterIntegrations() {
  console.log("🔄 Setting up router integrations...");

  // Subscribe to route changes
  router.subscribe("onBeforeLoad", ({ location }) => {
    const navigationStore = useNavigationStore.getState();
    navigationStore.startNavigation(location.pathname);
  });

  router.subscribe("onLoad", ({ location }) => {
    const navigationStore = useNavigationStore.getState();
    navigationStore.completeNavigation(location.pathname);

    // Update breadcrumbs
    updateBreadcrumbs(location.pathname);
  });

  router.subscribe("onError", ({ error }) => {
    const navigationStore = useNavigationStore.getState();
    navigationStore.failNavigation(error as Error);
  });

  // Handle browser back/forward navigation
  window.addEventListener("popstate", () => {
    const navigationStore = useNavigationStore.getState();
    const currentPath = window.location.pathname;

    // Clean up previous route
    if (navigationStore.currentRoute !== currentPath) {
      routeStateManager.cleanupRoute(navigationStore.currentRoute);
    }
  });
}

/**
 * Set up offline support and PWA features
 */
function setupOfflineSupport() {
  console.log("📡 Setting up offline support...");

  // Monitor online/offline status
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Check initial connection status
  if (!navigator.onLine) {
    handleOffline();
  }

  // Set up service worker for offline caching
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration);
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  }
}

/**
 * Handle online event
 */
async function handleOnline() {
  console.log("✅ Connection restored");

  const toast = useUIStore.getState().toast;
  toast.success("Back online", "Connection restored. Syncing data...");

  // Process offline queue
  await offlineSyncManager.processOfflineQueue();

  // Refresh critical data
  const projectStore = useProjectStore.getState();
  if (projectStore.activeProjectId) {
    await projectStore.refreshIfNeeded();
  }

  // Invalidate stale queries
  queryClient.invalidateQueries({
    predicate: (query) => {
      const queryData = query.state.data;
      const queryTime = query.state.dataUpdatedAt;
      const staleTime = 5 * 60 * 1000; // 5 minutes

      return Date.now() - queryTime > staleTime;
    },
  });
}

/**
 * Handle offline event
 */
function handleOffline() {
  console.log("⚠️ Connection lost");

  const toast = useUIStore.getState().toast;
  toast.warning(
    "Offline mode",
    "You're currently offline. Changes will be synced when connection is restored."
  );

  // Set offline indicator
  useUIStore.getState().setGlobalLoading(false);
}

/**
 * Set up performance monitoring
 */
function setupPerformanceMonitoring() {
  console.log("📊 Setting up performance monitoring...");

  // Monitor React Query performance
  queryClient.setMutationDefaults(["*"], {
    meta: {
      measure: true,
    },
  });

  // Monitor long tasks
  if ("PerformanceObserver" in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn("Long task detected:", {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          });
        }
      }
    });

    try {
      observer.observe({ entryTypes: ["longtask"] });
    } catch (e) {
      // Long task monitoring not supported
    }
  }

  // Monitor memory usage (Chrome only)
  if ("memory" in performance) {
    setInterval(() => {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      const totalMB = Math.round(memory.jsHeapSizeLimit / 1048576);

      if (usedMB / totalMB > 0.9) {
        console.warn(`High memory usage: ${usedMB}MB / ${totalMB}MB`);

        // Clear old cache entries
        queryClient.clear();
        routeStateManager.clearAll();
      }
    }, 30000); // Check every 30 seconds
  }
}

/**
 * Set up global error handling
 */
function setupErrorHandling() {
  console.log("🛡️ Setting up error handling...");

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);

    const toast = useUIStore.getState().toast;
    toast.error("An error occurred", "Something went wrong. Please try refreshing the page.");

    // Prevent default browser error handling
    event.preventDefault();
  });

  // Handle global errors
  window.addEventListener("error", (event) => {
    console.error("Global error:", event.error);

    // Log to error tracking service in production
    if (import.meta.env.PROD) {
      // TODO: Send to error tracking service
    }
  });

  // React Query global error handler
  queryClient.setDefaultOptions({
    queries: {
      onError: (error) => {
        console.error("Query error:", error);

        // Handle specific error types
        if ((error as any)?.status === 401) {
          // Session expired
          useAuthStore.getState().logout();
          window.location.href = "/login?reason=session_expired";
        }
      },
    },
    mutations: {
      onError: (error) => {
        console.error("Mutation error:", error);

        const toast = useUIStore.getState().toast;
        toast.error("Operation failed", (error as any)?.message || "Please try again later");
      },
    },
  });
}

/**
 * Initialize authentication and session
 */
async function initializeAuthentication() {
  console.log("🔐 Initializing authentication...");

  const authStore = useAuthStore.getState();

  try {
    // Initialize auth from stored tokens
    await authStore.initializeAuth();

    // If authenticated, fetch user projects
    if (authStore.isAuthenticated) {
      const projectStore = useProjectStore.getState();
      await projectStore.fetchProjects();

      // Set up session refresh interval
      setInterval(() => {
        if (authStore.checkAuth()) {
          // Session is valid
        }
      }, 60000); // Check every minute
    }
  } catch (error) {
    console.error("Auth initialization error:", error);

    // Clear invalid auth state
    authStore.logout();
  }
}

/**
 * Update breadcrumbs based on route
 */
function updateBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: "Home", href: "/dashboard" },
  ];

  let currentPath = "";
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    // Skip underscore routes
    if (segment.startsWith("_")) return;

    // Format segment
    const label = segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    breadcrumbs.push({
      label,
      href: index === segments.length - 1 ? undefined : currentPath,
    });
  });

  useUIStore.getState().setBreadcrumbs(breadcrumbs);
}

/**
 * Clean up function for app teardown
 */
export function cleanupApp() {
  console.log("🧹 Cleaning up application...");

  // Clean up event listeners
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);

  // Clean up stores
  cacheSyncManager.cleanup();
  routeStateManager.clearAll();

  // Clear query cache
  queryClient.clear();

  console.log("✅ Cleanup complete");
}

// Auto-cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanupApp);
}
