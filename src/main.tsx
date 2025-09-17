// Enable Immer MapSet plugin before any store imports
// This MUST be at the very top to prevent "plugin not loaded" errors
import { enableMapSet } from "immer";
enableMapSet();

// Install mock API handler in development to provide mock data
// for endpoints that don't have server implementations yet
if (import.meta.env.DEV) {
  import("@/lib/mock-api-handler").then(({ MockApiHandler }) => {
    MockApiHandler.interceptFetch();
  });
}

import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Lazy load heavy dependencies to reduce initial bundle size and improve TBT
const lazyImports = {
  RouterProvider: () =>
    import("@tanstack/react-router").then((m) => ({
      RouterProvider: m.RouterProvider,
      createRouter: m.createRouter,
    })),
  QueryClient: () =>
    import("@tanstack/react-query").then((m) => ({ QueryClientProvider: m.QueryClientProvider })),
  ReactQueryDevtools: () =>
    import("@tanstack/react-query-devtools").then((m) => ({
      ReactQueryDevtools: m.ReactQueryDevtools,
    })),
  routeTree: () => import("./routeTree.gen").then((m) => ({ routeTree: m.routeTree })),
  stores: () =>
    Promise.all([import("@/stores/authStore"), import("@/stores/projectStore")]).then(
      ([auth, project]) => ({
        useAuthStore: auth.useAuthStore,
        useProjectStore: project.useProjectStore,
      })
    ),
  appInitializer: () =>
    import("@/lib/app-initializer").then((m) => ({ initializeApp: m.initializeApp })),
  performance: () =>
    import("@/lib/performance/core-web-vitals").then((m) => ({
      initPerformanceMonitoring: m.initPerformanceMonitoring,
      getPerformanceMonitor: m.getPerformanceMonitor,
    })),
  // imagePreloader: () =>
  //   import("@/lib/image-optimization").then((m) => ({ imagePreloader: m.imagePreloader })),
  queryClient: () => import("@/lib/query-client").then((m) => ({ queryClient: m.queryClient })),
  config: () => import("@/config").then((m) => ({ config: m.config })),
};

// Import only critical CSS initially
// Non-critical CSS will be loaded after initial render
import "./styles/critical.css";

// Minimal loading component for critical path
const MinimalLoader = () => (
  <div className="bg-background flex min-h-screen items-center justify-center">
    <div className="text-center">
      <div className="loading-spinner mx-auto" />
      <p className="text-muted-foreground mt-4 text-sm">Loading...</p>
    </div>
  </div>
);

// Global variables to hold lazy-loaded dependencies
let router: any;
let queryClient: any;
let config: any;

// Async initialization function to load all dependencies
async function loadDependencies() {
  const startTime = performance.now();

  try {
    // Load critical dependencies first
    const [{ queryClient: qc }, { config: cfg }, { routeTree }, { RouterProvider, createRouter }] =
      await Promise.all([
        lazyImports.queryClient(),
        lazyImports.config(),
        lazyImports.routeTree(),
        lazyImports.RouterProvider(),
      ]);

    // Assign to global variables
    queryClient = qc;
    config = cfg;

    // Create router after dependencies are loaded
    router = createRouter({
      routeTree,
      context: {
        queryClient,
        // Auth context will be provided by the InnerApp component
        auth: undefined!,
        project: undefined!,
      },
      defaultPreload: "intent",
      defaultPreloadStaleTime: 0,
      defaultPendingComponent: MinimalLoader,
      defaultErrorComponent: ({ error, reset }) => (
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-foreground mt-4 text-lg font-semibold">Application Error</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Something went wrong while loading the application.
              </p>
              {error.message && (
                <p className="bg-muted text-foreground mt-2 rounded p-2 font-mono text-xs">
                  {error.message}
                </p>
              )}
              <div className="mt-6">
                <button type="button" onClick={reset} className="btn-primary w-full">
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
    });

    // Router instance is created and ready

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
      console.log(
        `%c📍 Environment: ${config.app.environment}`,
        "color: #10b981; font-size: 12px;"
      );
      const loadTime = performance.now() - startTime;
      console.log(
        `%c⚡ Dependencies loaded in ${loadTime.toFixed(2)}ms`,
        "color: #f59e0b; font-size: 12px;"
      );
    }

    return true;
  } catch (error) {
    console.error("Failed to load dependencies:", error);
    return false;
  }
}

// Initialize comprehensive monitoring system (Phase 5.4)
async function initializeMonitoringSystem() {
  if (typeof window === "undefined") return;

  try {
    // Initialize monitoring system with error tracking and performance monitoring
    const [{ ResortMonitoringSystem }, { initPerformanceMonitoring: initCoreWebVitals }] =
      await Promise.all([import("@/lib/monitoring/init"), lazyImports.performance()]);

    // Initialize comprehensive monitoring system
    ResortMonitoringSystem.init({
      sentry: {
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: config?.app?.environment,
        sampleRate: config?.app?.environment === "production" ? 0.1 : 1.0,
        replaySampleRate: 1.0,
      },
      performance: {
        enableConsoleLog: config?.isDevelopment,
        enableAnalytics: config?.app?.environment === "production",
        samplingRate: 0.8, // 80% sampling for performance
        endpoint: "/api/monitoring/performance",
      },
    });

    console.log("✅ Comprehensive monitoring system initialized");

    // Track initial bundle size for performance monitoring
    const initialBundleSize = performance.getEntriesByType("navigation")[0]?.transferSize || 0;
    if (initialBundleSize > 0 && config?.isDevelopment) {
      console.log(`📦 Initial bundle size: ${(initialBundleSize / 1024).toFixed(2)} KB`);
    }

    // Preload critical images (basic implementation)
    const criticalImages = ["/icons/icon-192x192.png", "/icons/icon-512x512.png"];

    const preloadImages = () => {
      criticalImages.forEach((src) => {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = src;
        document.head.appendChild(link);
      });
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(preloadImages, { timeout: 5000 });
    } else {
      setTimeout(preloadImages, 100);
    }

    // Register service worker for PWA functionality
    if ("serviceWorker" in navigator) {
      const registerSW = async () => {
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
                  console.log("New app version available");
                }
              });
            }
          });
        } catch (error) {
          console.error("Service Worker registration failed:", error);
        }
      };

      // Register SW after initial load
      if (window.requestIdleCallback) {
        window.requestIdleCallback(registerSW, { timeout: 5000 });
      } else {
        setTimeout(registerSW, 1000);
      }
    }

    // Monitor connection changes for adaptive loading
    if ("connection" in navigator) {
      const { connection } = navigator as any;
      const updateConnectionInfo = () => {
        if (config?.isDevelopment) {
          console.log(
            `Connection: ${connection.effectiveType}, Downlink: ${connection.downlink}Mbps`
          );
        }

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

    // Performance observer for paint timing
    if ("PerformanceObserver" in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          const currentPath = window.location.pathname;
          for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") {
              console.log(`🎨 First Contentful Paint: ${entry.startTime.toFixed(2)}ms`);
              // Custom performance tracking can be added here
              if (entry.startTime > 2500) {
                console.warn("⚠️ Slow FCP detected - consider optimizing critical path");
              }
            }
          }
        });

        paintObserver.observe({ entryTypes: ["paint"] });
      } catch (error) {
        console.warn("Performance Observer not supported:", error);
      }
    }
  } catch (error) {
    console.warn("Failed to initialize performance monitoring:", error);
  }
}

// Get root element first
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Optimized app startup with progressive loading
async function startApp() {
  const startTime = performance.now();

  // Show minimal loader immediately
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <MinimalLoader />
    </StrictMode>
  );

  try {
    // Load critical dependencies
    const dependenciesLoaded = await loadDependencies();
    if (!dependenciesLoaded) {
      throw new Error("Failed to load critical dependencies");
    }

    // Load remaining lazy dependencies
    const [{ useAuthStore, useProjectStore }, { initializeApp }] = await Promise.all([
      lazyImports.stores(),
      lazyImports.appInitializer(),
    ]);

    // Initialize app after dependencies are loaded
    await initializeApp();

    // Development helpers
    if (config.isDevelopment) {
      (window as any).__AUTH_STORE__ = useAuthStore;
      console.log("[DEV] Auth persistence helpers loaded:");
      console.log("  - window.__AUTH_STORE__ (useAuthStore)");

      const totalLoadTime = performance.now() - startTime;
      console.log(
        `%c🚀 Total app startup: ${totalLoadTime.toFixed(2)}ms`,
        "color: #16a34a; font-size: 12px;"
      );
    }

    // Load App component and render
    const App = () => <MainApp useAuthStore={useAuthStore} useProjectStore={useProjectStore} />;
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    // Initialize comprehensive monitoring system in the background
    initializeMonitoringSystem();

    // Load non-critical CSS after initial render
    if (window.requestIdleCallback) {
      window.requestIdleCallback(
        () => {
          import("./index.css").catch(console.warn);
        },
        { timeout: 5000 }
      );
    } else {
      setTimeout(() => {
        import("./index.css").catch(console.warn);
      }, 100);
    }
  } catch (error) {
    console.error("Failed to start application:", error);

    // Fallback: render error state
    root.render(
      <StrictMode>
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="p-6 text-center">
            <h1 className="text-foreground mb-2 text-lg font-semibold">
              Failed to Load Application
            </h1>
            <p className="text-muted-foreground mb-4 text-sm">
              Please refresh the page to try again.
            </p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Refresh Page
            </button>
          </div>
        </div>
      </StrictMode>
    );
  }
}

// Main App component with providers
function MainApp({ useAuthStore, useProjectStore }: { useAuthStore: any; useProjectStore: any }) {
  const [isReady, setIsReady] = React.useState(false);
  const [providers, setProviders] = React.useState<{
    QueryClientProvider: any;
    ReactQueryDevtools: any;
  }>({ QueryClientProvider: null, ReactQueryDevtools: null });

  React.useEffect(() => {
    // Load remaining React dependencies
    Promise.all([lazyImports.QueryClient(), lazyImports.ReactQueryDevtools()])
      .then(([queryModule, devtoolsModule]) => {
        setProviders({
          QueryClientProvider: queryModule.QueryClientProvider,
          ReactQueryDevtools: devtoolsModule.ReactQueryDevtools,
        });
        setIsReady(true);
      })
      .catch(console.error);
  }, []);

  if (!isReady || !router || !queryClient || !providers.QueryClientProvider) {
    return <MinimalLoader />;
  }

  const { QueryClientProvider, ReactQueryDevtools } = providers;

  return (
    <QueryClientProvider client={queryClient}>
      <InnerApp useAuthStore={useAuthStore} useProjectStore={useProjectStore} />
      {config?.isDevelopment && ReactQueryDevtools && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom-right"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

// Inner app component that provides auth context to router
function InnerApp({ useAuthStore, useProjectStore }: { useAuthStore: any; useProjectStore: any }) {
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

  // Lazy load RouterProvider
  const [RouterProvider, setRouterProvider] = React.useState<any>(null);

  React.useEffect(() => {
    lazyImports.RouterProvider().then(({ RouterProvider: RP }) => {
      setRouterProvider(() => RP);
    });
  }, []);

  if (!RouterProvider) {
    return <MinimalLoader />;
  }

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

// Start the application
startApp();
