import { Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { ErrorBoundary } from "react-error-boundary";
import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  X,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

export function RootLayout() {
  const theme = useUIStore((state) => state.theme);
  const notifications = useUIStore((state) => state.notifications);
  const removeNotification = useUIStore((state) => state.removeNotification);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    // Apply theme class to html element
    const root = document.documentElement;
    if (
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    // Handle online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    // Auto-hide offline message after connection is restored
    if (isOnline && showOfflineMessage) {
      const timer = setTimeout(() => {
        setShowOfflineMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showOfflineMessage]);

  const ErrorFallback = ({
    error,
    resetErrorBoundary,
  }: {
    error: Error;
    resetErrorBoundary: () => void;
  }) => (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 via-white to-pink-50 p-6 dark:from-red-950 dark:via-gray-900 dark:to-pink-950">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-red-800 dark:bg-gray-900/95">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          Oops! Something went wrong
        </h1>

        <p className="mb-6 text-gray-600 dark:text-gray-300">
          We're sorry, but there was an unexpected error in your resort management system. Our team
          has been notified.
        </p>

        <div className="mb-6 rounded-lg bg-red-50 p-4 text-left dark:bg-red-900/20">
          <h3 className="mb-2 text-sm font-semibold text-red-800 dark:text-red-300">
            Error Details:
          </h3>
          <code className="text-xs break-all text-red-700 dark:text-red-400">{error.message}</code>
        </div>

        <button
          onClick={resetErrorBoundary}
          className="from-ocean-500 to-coral-500 hover:from-ocean-600 hover:to-coral-600 w-full rounded-xl bg-gradient-to-r px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl"
        >
          Try Again
        </button>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          If this problem persists, please contact support at support@okaeri-resort.com
        </p>
      </div>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <QueryClientProvider client={queryClient}>
        <div className="from-sand-25 to-ocean-25 dark:to-ocean-950 min-h-screen bg-gradient-to-br via-white dark:from-gray-950 dark:via-gray-900">
          {/* Offline Banner */}
          {!isOnline && (
            <div className="fixed top-0 right-0 left-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white shadow-lg">
              <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
                <WifiOff className="h-5 w-5 flex-shrink-0" />
                <div className="text-center">
                  <p className="text-sm font-semibold">You're currently offline</p>
                  <p className="text-xs opacity-90">
                    Some features may be limited. We'll sync your data when connection is restored.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Online Restoration Message */}
          {isOnline && showOfflineMessage && (
            <div className="fixed top-0 right-0 left-0 z-50 bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-white shadow-lg">
              <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
                <Wifi className="h-5 w-5 flex-shrink-0" />
                <div className="text-center">
                  <p className="text-sm font-semibold">Connection restored!</p>
                  <p className="text-xs opacity-90">Syncing your offline changes...</p>
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className={!isOnline ? "pt-16" : isOnline && showOfflineMessage ? "pt-16" : ""}>
            <Outlet />
          </div>

          {/* Toast notifications */}
          {notifications.length > 0 && (
            <div className="pointer-events-none fixed right-0 bottom-0 z-50 flex max-h-screen flex-col gap-3 overflow-y-auto p-4">
              {notifications.map((notification) => {
                const getNotificationIcon = () => {
                  switch (notification.type) {
                    case "success":
                      return <CheckCircle className="h-5 w-5" />;
                    case "error":
                      return <AlertCircle className="h-5 w-5" />;
                    case "warning":
                      return <AlertTriangle className="h-5 w-5" />;
                    case "info":
                      return <Info className="h-5 w-5" />;
                    default:
                      return <Info className="h-5 w-5" />;
                  }
                };

                const getNotificationStyles = () => {
                  switch (notification.type) {
                    case "success":
                      return "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-900 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-700 dark:text-green-100";
                    case "error":
                      return "bg-gradient-to-r from-red-50 to-pink-50 border-red-200 text-red-900 dark:from-red-900/20 dark:to-pink-900/20 dark:border-red-700 dark:text-red-100";
                    case "warning":
                      return "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-900 dark:from-amber-900/20 dark:to-yellow-900/20 dark:border-amber-700 dark:text-amber-100";
                    case "info":
                      return "bg-gradient-to-r from-ocean-50 to-sky-50 border-ocean-200 text-ocean-900 dark:from-ocean-900/20 dark:to-sky-900/20 dark:border-ocean-700 dark:text-ocean-100";
                    default:
                      return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 text-gray-900 dark:from-gray-900/20 dark:to-slate-900/20 dark:border-gray-700 dark:text-gray-100";
                  }
                };

                return (
                  <div
                    key={notification.id}
                    className={`pointer-events-auto flex max-w-md min-w-[320px] transform items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-105 ${getNotificationStyles()} `}
                  >
                    <div className="mt-0.5 flex-shrink-0">{getNotificationIcon()}</div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight font-semibold">{notification.title}</p>
                      {notification.message && (
                        <p className="mt-1 text-sm leading-relaxed opacity-90">
                          {notification.message}
                        </p>
                      )}
                      {notification.action && (
                        <button
                          onClick={notification.action.onClick}
                          className="mt-3 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
                        >
                          {notification.action.label}
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => removeNotification(notification.id)}
                      className="group flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-4 w-4 opacity-60 transition-opacity group-hover:opacity-100" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Global loading indicator */}
          <GlobalLoadingIndicator />
        </div>

        {/* React Query Devtools */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function GlobalLoadingIndicator() {
  const globalLoading = useUIStore((state) => state.globalLoading);
  const loadingMessage = useUIStore((state) => state.loadingMessage);

  if (!globalLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="border-sand-200 mx-4 max-w-sm rounded-2xl border bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95">
        <div className="flex flex-col items-center">
          {/* Enhanced loading spinner */}
          <div className="relative">
            <div className="border-ocean-200 border-t-ocean-600 dark:border-ocean-800 dark:border-t-ocean-400 h-16 w-16 animate-spin rounded-full border-4" />
            <div className="absolute inset-0 flex items-center justify-center">
              <RefreshCw className="text-ocean-600 dark:text-ocean-400 h-6 w-6 animate-pulse" />
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
              {loadingMessage || "Processing..."}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please wait while we handle your request
            </p>
          </div>

          {/* Progress animation */}
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="from-ocean-400 to-coral-500 h-full animate-pulse rounded-full bg-gradient-to-r"
              style={{ width: "60%", animation: "loading-bar 2s ease-in-out infinite" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
