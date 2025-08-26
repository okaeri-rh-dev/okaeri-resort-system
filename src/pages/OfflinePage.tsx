/**
 * Offline Page Component
 * Provides meaningful offline experience for resort staff
 * Shows cached data and offline functionality
 */

import { useEffect, useState } from "react";
import { useNavigationStore } from "@/lib/store-router-integration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WifiOff,
  RefreshCw,
  BookOpen,
  Calendar,
  Receipt,
  BarChart3,
  Clock,
  CheckCircle,
} from "lucide-react";

interface OfflineAction {
  id: string;
  type: string;
  description: string;
  timestamp: number;
  synced: boolean;
}

export function OfflinePage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load pending offline actions
  useEffect(() => {
    loadPendingActions();
  }, []);

  // Listen for service worker messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_ACTION_ADDED") {
        loadPendingActions();
      } else if (event.data?.type === "SYNC_COMPLETED") {
        setLastSync(new Date());
        loadPendingActions();
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, []);

  const loadPendingActions = async () => {
    try {
      // Get pending actions from IndexedDB
      const actions = await getOfflineActions();
      setPendingActions(actions);
    } catch (error) {
      console.error("Failed to load pending actions:", error);
    }
  };

  const handleRetryConnection = async () => {
    setIsRetrying(true);

    try {
      // Try to fetch a small resource to test connectivity
      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-cache",
      });

      if (response.ok) {
        // Connection restored, try to sync pending actions
        await syncPendingActions();

        // Navigate to dashboard
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.log("Still offline");
    } finally {
      setIsRetrying(false);
    }
  };

  const syncPendingActions = async () => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SYNC_OFFLINE_ACTIONS" });
    }
  };

  const getOfflineActions = async (): Promise<OfflineAction[]> => {
    return new Promise((resolve) => {
      const request = indexedDB.open("OkaeriOfflineDB", 1);

      request.onsuccess = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("offline-actions")) {
          resolve([]);
          return;
        }

        const transaction = db.transaction(["offline-actions"], "readonly");
        const store = transaction.objectStore("offline-actions");
        const getRequest = store.getAll();

        getRequest.onsuccess = () => {
          const actions = getRequest.result || [];
          resolve(
            actions.map((action) => ({
              id: action.id,
              type: action.method,
              description: getActionDescription(action.url, action.method),
              timestamp: action.timestamp,
              synced: false,
            }))
          );
        };

        getRequest.onerror = () => resolve([]);
      };

      request.onerror = () => resolve([]);
    });
  };

  const getActionDescription = (url: string, method: string): string => {
    if (url.includes("/bookings")) {
      return method === "POST" ? "New booking created" : "Booking updated";
    } else if (url.includes("/expenses")) {
      return method === "POST" ? "Expense recorded" : "Expense updated";
    } else if (url.includes("/payments")) {
      return "Payment processed";
    }
    return "Data updated";
  };

  const formatTime = (timestamp: number) => {
    return new Intl.DateTimeFormat("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(timestamp));
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <WifiOff className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">You're Offline</h1>
              <p className="text-muted-foreground">
                {isOnline
                  ? "Connection detected, trying to reconnect..."
                  : "No internet connection available"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WifiOff className="h-5 w-5" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span className={`font-medium ${isOnline ? "text-green-600" : "text-orange-600"}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {lastSync && (
                <div className="flex items-center justify-between">
                  <span>Last Sync:</span>
                  <span className="text-muted-foreground text-sm">
                    {formatTime(lastSync.getTime())}
                  </span>
                </div>
              )}

              <Button onClick={handleRetryConnection} disabled={isRetrying} className="w-full">
                <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Reconnecting..." : "Try Again"}
              </Button>
            </CardContent>
          </Card>

          {/* Pending Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Sync
              </CardTitle>
              <CardDescription>{pendingActions.length} actions waiting to sync</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingActions.length === 0 ? (
                  <div className="text-muted-foreground py-4 text-center">
                    <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
                    All data is synced
                  </div>
                ) : (
                  pendingActions.slice(0, 5).map((action) => (
                    <div
                      key={action.id}
                      className="bg-muted/50 flex items-center gap-3 rounded p-2"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{action.description}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatTime(action.timestamp)}
                        </p>
                      </div>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                        <Clock className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                  ))
                )}

                {pendingActions.length > 5 && (
                  <p className="text-muted-foreground text-center text-sm">
                    +{pendingActions.length - 5} more actions
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Available Features */}
          <Card>
            <CardHeader>
              <CardTitle>Available Offline</CardTitle>
              <CardDescription>Features you can still use without internet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <OfflineFeature
                  icon={<Calendar className="h-4 w-4" />}
                  title="View Bookings"
                  description="Browse cached booking data"
                  available={true}
                />
                <OfflineFeature
                  icon={<Receipt className="h-4 w-4" />}
                  title="Record Expenses"
                  description="Add new expenses (will sync later)"
                  available={true}
                />
                <OfflineFeature
                  icon={<BookOpen className="h-4 w-4" />}
                  title="Property Information"
                  description="View property details"
                  available={true}
                />
                <OfflineFeature
                  icon={<BarChart3 className="h-4 w-4" />}
                  title="Reports"
                  description="View cached reports"
                  available={false}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tips Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Working Offline - Tips</CardTitle>
            <CardDescription>How to make the most of your offline experience</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium">What you can do:</h4>
                <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                  <li>• View previously loaded bookings</li>
                  <li>• Add new expenses and payments</li>
                  <li>• Browse property information</li>
                  <li>• View cached dashboard data</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium">What happens when you're back online:</h4>
                <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                  <li>• All changes sync automatically</li>
                  <li>• Fresh data loads for all pages</li>
                  <li>• Real-time features resume</li>
                  <li>• Notifications work normally</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface OfflineFeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  available: boolean;
}

function OfflineFeature({ icon, title, description, available }: OfflineFeatureProps) {
  return (
    <div className={`flex items-start gap-3 ${!available && "opacity-50"}`}>
      <div
        className={`flex h-8 w-8 items-center justify-center rounded ${
          available
            ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
            : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}
