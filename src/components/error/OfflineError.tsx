import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Download,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  Smartphone,
  Globe,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineData {
  pendingOperations: number;
  cachedPages: number;
  lastSync: Date | null;
  offlineSince: Date | null;
}

interface OfflineErrorProps {
  className?: string;
  onRetry?: () => void;
  showOfflineData?: boolean;
  showTips?: boolean;
  enableAutoRetry?: boolean;
  customMessage?: string;
  children?: React.ReactNode;
}

// Hook for online/offline detection
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [reconnectedAt, setReconnectedAt] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setReconnectedAt(new Date());
      if (offlineSince) {
        // Clear offline timestamp when coming back online
        setTimeout(() => {
          setOfflineSince(null);
        }, 3000); // Keep for 3 seconds to show reconnection message
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineSince(new Date());
      setReconnectedAt(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check in case the browser starts offline
    if (!navigator.onLine && !offlineSince) {
      setOfflineSince(new Date());
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [offlineSince]);

  return {
    isOnline,
    offlineSince,
    reconnectedAt,
    duration: offlineSince ? Date.now() - offlineSince.getTime() : 0,
  };
};

// Hook for offline data management
export const useOfflineData = () => {
  const [offlineData, setOfflineData] = useState<OfflineData>({
    pendingOperations: 0,
    cachedPages: 0,
    lastSync: null,
    offlineSince: null,
  });

  const updateOfflineData = useCallback((updates: Partial<OfflineData>) => {
    setOfflineData((prev) => ({ ...prev, ...updates }));
  }, []);

  const addPendingOperation = useCallback(() => {
    setOfflineData((prev) => ({
      ...prev,
      pendingOperations: prev.pendingOperations + 1,
    }));
  }, []);

  const removePendingOperation = useCallback(() => {
    setOfflineData((prev) => ({
      ...prev,
      pendingOperations: Math.max(0, prev.pendingOperations - 1),
    }));
  }, []);

  const clearPendingOperations = useCallback(() => {
    setOfflineData((prev) => ({ ...prev, pendingOperations: 0 }));
  }, []);

  return {
    offlineData,
    updateOfflineData,
    addPendingOperation,
    removePendingOperation,
    clearPendingOperations,
  };
};

export const OfflineError: React.FC<OfflineErrorProps> = ({
  className,
  onRetry,
  showOfflineData = true,
  showTips = true,
  enableAutoRetry = true,
  customMessage,
  children,
}) => {
  const { isOnline, offlineSince, reconnectedAt, duration } = useOnlineStatus();
  const { offlineData } = useOfflineData();
  const [isRetrying, setIsRetrying] = useState(false);
  const [autoRetryCount, setAutoRetryCount] = useState(0);

  // Auto-retry when coming back online
  useEffect(() => {
    if (isOnline && reconnectedAt && enableAutoRetry && onRetry) {
      setIsRetrying(true);
      const timer = setTimeout(async () => {
        try {
          await onRetry();
        } catch (error) {
          console.error("Auto-retry failed:", error);
        } finally {
          setIsRetrying(false);
        }
      }, 1000); // Wait 1 second after reconnection

      return () => clearTimeout(timer);
    }
  }, [isOnline, reconnectedAt, enableAutoRetry, onRetry]);

  // Manual retry handler
  const handleRetry = useCallback(async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    setAutoRetryCount((prev) => prev + 1);

    try {
      await onRetry();
    } catch (error) {
      console.error("Manual retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  // Format duration display
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Show success message briefly when reconnected
  if (reconnectedAt && Date.now() - reconnectedAt.getTime() < 5000) {
    return (
      <Card className={cn("border-palm-200 bg-palm-50 mx-auto max-w-md", className)}>
        <CardContent className="p-6">
          <div className="space-y-4 text-center">
            <div className="bg-palm-100 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              <CheckCircle2 className="text-palm-600 h-8 w-8" />
            </div>

            <div>
              <h3 className="text-palm-900 font-semibold">Back Online!</h3>
              <p className="text-palm-700 mt-1 text-sm">
                Connection restored. {isRetrying && "Syncing data..."}
              </p>
            </div>

            {isRetrying && (
              <div className="flex justify-center">
                <RefreshCw className="text-palm-600 h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show if online and no recent offline period
  if (isOnline && !offlineSince) {
    return null;
  }

  return (
    <Card className={cn("border-coral-200 mx-auto max-w-2xl", className)}>
      <CardHeader className="space-y-4 text-center">
        <div className="bg-coral-100 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
          <WifiOff className="text-coral-600 h-10 w-10" />
        </div>

        <div>
          <CardTitle className="text-ocean-900 text-2xl">You're Offline</CardTitle>
          <CardDescription className="mt-2 text-lg">
            {customMessage ||
              "No internet connection detected. Don't worry - you can still use some features!"}
          </CardDescription>
        </div>

        {/* Offline duration */}
        {offlineSince && (
          <div className="bg-coral-100 text-coral-800 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Offline for {formatDuration(duration)}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Connection status */}
        <div className="bg-sand-50 flex items-center justify-between rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Globe className="text-ocean-600 h-5 w-5" />
            <div>
              <div className="text-ocean-900 font-medium">Connection Status</div>
              <div className="text-ocean-600 text-sm">
                {isOnline ? "Connected" : "Disconnected"}
              </div>
            </div>
          </div>

          <div className={cn("h-3 w-3 rounded-full", isOnline ? "bg-palm-500" : "bg-coral-500")} />
        </div>

        {/* Offline capabilities */}
        <div className="space-y-4">
          <h4 className="text-ocean-900 flex items-center gap-2 font-semibold">
            <Smartphone className="h-5 w-5" />
            What You Can Still Do
          </h4>

          <div className="grid gap-3">
            <div className="bg-palm-50 flex items-center gap-3 rounded-lg p-3">
              <CheckCircle2 className="text-palm-600 h-5 w-5 flex-shrink-0" />
              <div className="text-sm">
                <div className="text-ocean-900 font-medium">View Cached Data</div>
                <div className="text-ocean-600">Browse previously loaded content</div>
              </div>
            </div>

            <div className="bg-palm-50 flex items-center gap-3 rounded-lg p-3">
              <CheckCircle2 className="text-palm-600 h-5 w-5 flex-shrink-0" />
              <div className="text-sm">
                <div className="text-ocean-900 font-medium">Create & Edit Offline</div>
                <div className="text-ocean-600">Changes will sync when you're back online</div>
              </div>
            </div>

            <div className="bg-sand-50 flex items-center gap-3 rounded-lg p-3">
              <AlertCircle className="text-sunset-600 h-5 w-5 flex-shrink-0" />
              <div className="text-sm">
                <div className="text-ocean-900 font-medium">Limited Features</div>
                <div className="text-ocean-600">Some actions require an internet connection</div>
              </div>
            </div>
          </div>
        </div>

        {/* Offline data summary */}
        {showOfflineData && (
          <div className="space-y-4">
            <h4 className="text-ocean-900 flex items-center gap-2 font-semibold">
              <Database className="h-5 w-5" />
              Offline Data
            </h4>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="border-sand-200 rounded-lg border bg-white p-4 text-center">
                <div className="text-ocean-900 text-2xl font-bold">
                  {offlineData.pendingOperations}
                </div>
                <div className="text-ocean-600 mt-1 flex items-center justify-center gap-1 text-sm">
                  <Upload className="h-3 w-3" />
                  Pending Syncs
                </div>
              </div>

              <div className="border-sand-200 rounded-lg border bg-white p-4 text-center">
                <div className="text-ocean-900 text-2xl font-bold">{offlineData.cachedPages}</div>
                <div className="text-ocean-600 mt-1 flex items-center justify-center gap-1 text-sm">
                  <Download className="h-3 w-3" />
                  Cached Pages
                </div>
              </div>

              <div className="border-sand-200 rounded-lg border bg-white p-4 text-center">
                <div className="text-ocean-900 text-2xl font-bold">
                  {offlineData.lastSync
                    ? formatDuration(Date.now() - offlineData.lastSync.getTime())
                    : "Never"}
                </div>
                <div className="text-ocean-600 mt-1 flex items-center justify-center gap-1 text-sm">
                  <RefreshCw className="h-3 w-3" />
                  Last Sync
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleRetry} disabled={isRetrying} className="flex-1" size="lg">
            <RefreshCw className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")} />
            {isRetrying ? "Checking Connection..." : "Try Again"}
          </Button>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex-1"
            size="lg"
          >
            Refresh Page
          </Button>
        </div>

        {/* Auto-retry indicator */}
        {enableAutoRetry && (
          <div className="text-ocean-600 bg-ocean-50 flex items-center justify-center gap-2 rounded-lg p-3 text-sm">
            <Info className="h-4 w-4" />
            <span>
              We'll automatically try to reconnect when your internet is back.
              {autoRetryCount > 0 && ` (${autoRetryCount} attempts so far)`}
            </span>
          </div>
        )}

        {/* Offline tips */}
        {showTips && (
          <div className="space-y-3 border-t pt-6">
            <h4 className="text-ocean-900 font-semibold">💡 Offline Tips</h4>
            <div className="text-ocean-700 grid gap-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-coral-500 font-bold">•</span>
                <span>Check your WiFi or mobile data connection</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-coral-500 font-bold">•</span>
                <span>Try moving to an area with better signal strength</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-coral-500 font-bold">•</span>
                <span>Disable airplane mode if it's enabled</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-coral-500 font-bold">•</span>
                <span>Your changes will be saved and synced automatically when you reconnect</span>
              </div>
            </div>
          </div>
        )}

        {/* Custom content */}
        {children}
      </CardContent>
    </Card>
  );
};

// Simplified offline indicator for headers/navigation
export const OfflineIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "bg-coral-100 text-coral-800 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm",
        className
      )}
    >
      <WifiOff className="h-3 w-3" />
      <span>Offline</span>
    </div>
  );
};

// Toast-style offline notification
export const OfflineToast: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  const { isOnline, offlineSince } = useOnlineStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline && offlineSince) {
      setVisible(true);
    } else if (isOnline) {
      // Hide toast when back online
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, offlineSince]);

  if (!visible) return null;

  return (
    <div className="animate-in slide-in-from-right fixed top-4 right-4 z-50 duration-300">
      <Card className="border-coral-200 w-80 bg-white shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-coral-100 mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
              {isOnline ? (
                <Wifi className="text-palm-600 h-4 w-4" />
              ) : (
                <WifiOff className="text-coral-600 h-4 w-4" />
              )}
            </div>

            <div className="flex-1">
              <div className="text-ocean-900 font-medium">
                {isOnline ? "Back Online!" : "You're Offline"}
              </div>
              <div className="text-ocean-600 mt-1 text-sm">
                {isOnline
                  ? "Connection restored. Data will sync automatically."
                  : "Some features may be limited. Changes will sync when you reconnect."}
              </div>
            </div>

            <Button
              onClick={() => {
                setVisible(false);
                onDismiss?.();
              }}
              variant="ghost"
              size="sm"
              className="h-auto p-1"
            >
              ×
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OfflineError;
