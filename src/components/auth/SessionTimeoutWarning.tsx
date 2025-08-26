/**
 * Session timeout warning modal
 * Displays warning before session expires with option to extend
 */

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { sessionMonitor, TOKEN_EXPIRY } from "@/lib/security";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock } from "lucide-react";

export function SessionTimeoutWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const logout = useAuthStore((state) => state.logout);
  const refreshToken = useAuthStore((state) => state.refreshToken);

  useEffect(() => {
    // Start session monitoring
    sessionMonitor.start({
      timeout: TOKEN_EXPIRY.SESSION_TIMEOUT,
      warningTime: 5 * 60 * 1000, // 5 minutes warning
      onTimeout: () => {
        handleTimeout();
      },
      onWarning: (timeLeft) => {
        setTimeRemaining(Math.floor(timeLeft / 1000));
        setShowWarning(true);
      },
    });

    // Update countdown timer
    const interval = setInterval(() => {
      const remaining = sessionMonitor.getTimeUntilTimeout();
      if (remaining > 0 && remaining < 5 * 60 * 1000) {
        setTimeRemaining(Math.floor(remaining / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleTimeout = async () => {
    setShowWarning(false);
    await logout();
    window.location.href = "/login?reason=session_timeout";
  };

  const handleExtendSession = async () => {
    try {
      // Refresh token to extend session
      await refreshToken();

      // Extend session timer
      sessionMonitor.extendSession();

      // Hide warning
      setShowWarning(false);
      setTimeRemaining(0);
    } catch (error) {
      console.error("Failed to extend session:", error);
      handleTimeout();
    }
  };

  const handleLogout = async () => {
    setShowWarning(false);
    await logout();
    window.location.href = "/login";
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Session Timeout Warning
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <p>Your session will expire due to inactivity in:</p>
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-amber-600">
              <Clock className="h-6 w-6" />
              {formatTime(timeRemaining)}
            </div>
            <p className="text-sm">Would you like to continue your session?</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleLogout} className="flex-1 sm:flex-none">
            Logout
          </Button>
          <Button onClick={handleExtendSession} className="flex-1 sm:flex-none">
            Continue Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Session activity tracker component
 * Displays current session status and last activity
 */
export function SessionActivityTracker() {
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Monitor session activity
    const unsubscribe = sessionMonitor.onActivity(() => {
      setLastActivity(new Date());
      setIsActive(true);
    });

    // Check session status periodically
    const interval = setInterval(() => {
      setIsActive(sessionMonitor.isSessionActive());

      const lastActivityTime = sessionMonitor.getLastActivity();
      if (lastActivityTime) {
        setLastActivity(new Date(lastActivityTime));
      }
    }, 10000); // Update every 10 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed right-4 bottom-4 rounded-lg bg-white p-3 text-xs text-gray-600 opacity-50 shadow-lg transition-opacity hover:opacity-100">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500" : "bg-gray-400"}`} />
        <span>Session Active</span>
      </div>
      {lastActivity && (
        <div className="mt-1 text-[10px]">Last activity: {lastActivity.toLocaleTimeString()}</div>
      )}
    </div>
  );
}

/**
 * Hook to monitor session status
 */
export function useSessionStatus() {
  const [status, setStatus] = useState({
    isActive: false,
    timeRemaining: 0,
    lastActivity: null as Date | null,
  });

  useEffect(() => {
    const updateStatus = () => {
      setStatus({
        isActive: sessionMonitor.isSessionActive(),
        timeRemaining: sessionMonitor.getTimeUntilTimeout(),
        lastActivity: new Date(sessionMonitor.getLastActivity()),
      });
    };

    // Update immediately
    updateStatus();

    // Update periodically
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
