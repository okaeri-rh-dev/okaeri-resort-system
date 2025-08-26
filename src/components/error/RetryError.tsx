import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types for retry strategies
type RetryStrategy = "immediate" | "exponential" | "linear" | "custom";

interface RetryConfig {
  maxAttempts: number;
  strategy: RetryStrategy;
  baseDelay: number; // in milliseconds
  maxDelay?: number;
  backoffMultiplier?: number;
  customDelays?: number[];
}

interface RetryState {
  attempt: number;
  isRetrying: boolean;
  nextRetryIn: number;
  lastError: Error | null;
  retryHistory: Array<{
    attempt: number;
    timestamp: Date;
    success: boolean;
    error?: string;
  }>;
}

interface RetryErrorProps {
  error: Error;
  onRetry: () => Promise<void> | void;
  config?: Partial<RetryConfig>;
  className?: string;
  title?: string;
  description?: string;
  showHistory?: boolean;
  autoRetry?: boolean;
  onGiveUp?: () => void;
  children?: React.ReactNode;
}

const defaultConfig: RetryConfig = {
  maxAttempts: 3,
  strategy: "exponential",
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

export const RetryError: React.FC<RetryErrorProps> = ({
  error,
  onRetry,
  config: userConfig,
  className,
  title,
  description,
  showHistory = false,
  autoRetry = false,
  onGiveUp,
  children,
}) => {
  const config = { ...defaultConfig, ...userConfig };

  const [retryState, setRetryState] = useState<RetryState>({
    attempt: 0,
    isRetrying: false,
    nextRetryIn: 0,
    lastError: error,
    retryHistory: [],
  });

  const [showDetails, setShowDetails] = useState(false);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);

  // Calculate delay based on strategy
  const calculateDelay = useCallback(
    (attempt: number): number => {
      switch (config.strategy) {
        case "immediate":
          return 0;

        case "linear":
          return Math.min(config.baseDelay * attempt, config.maxDelay || 30000);

        case "exponential":
          return Math.min(
            config.baseDelay * Math.pow(config.backoffMultiplier || 2, attempt - 1),
            config.maxDelay || 30000
          );

        case "custom":
          if (config.customDelays && attempt <= config.customDelays.length) {
            return config.customDelays[attempt - 1];
          }
          return config.baseDelay;

        default:
          return config.baseDelay;
      }
    },
    [config]
  );

  // Handle retry logic
  const handleRetry = useCallback(async () => {
    if (retryState.attempt >= config.maxAttempts) {
      onGiveUp?.();
      return;
    }

    const nextAttempt = retryState.attempt + 1;
    const delay = calculateDelay(nextAttempt);

    setRetryState((prev) => ({
      ...prev,
      isRetrying: true,
      nextRetryIn: delay,
    }));

    // Start countdown if there's a delay
    if (delay > 0) {
      let timeLeft = delay;
      const interval = setInterval(() => {
        timeLeft -= 1000;
        setRetryState((prev) => ({ ...prev, nextRetryIn: Math.max(0, timeLeft) }));

        if (timeLeft <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      setCountdownInterval(interval);

      // Wait for the delay
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Attempt the retry
    try {
      await onRetry();

      // Success - update history
      setRetryState((prev) => ({
        ...prev,
        attempt: nextAttempt,
        isRetrying: false,
        nextRetryIn: 0,
        retryHistory: [
          ...prev.retryHistory,
          {
            attempt: nextAttempt,
            timestamp: new Date(),
            success: true,
          },
        ],
      }));
    } catch (retryError) {
      const error = retryError instanceof Error ? retryError : new Error(String(retryError));

      // Failed - update state and history
      setRetryState((prev) => ({
        ...prev,
        attempt: nextAttempt,
        isRetrying: false,
        nextRetryIn: 0,
        lastError: error,
        retryHistory: [
          ...prev.retryHistory,
          {
            attempt: nextAttempt,
            timestamp: new Date(),
            success: false,
            error: error.message,
          },
        ],
      }));

      // Auto-retry if enabled and attempts remaining
      if (autoRetry && nextAttempt < config.maxAttempts) {
        setTimeout(handleRetry, 2000); // Wait 2 seconds before auto-retry
      }
    }
  }, [retryState.attempt, config.maxAttempts, calculateDelay, onRetry, onGiveUp, autoRetry]);

  // Auto-retry effect
  useEffect(() => {
    if (autoRetry && retryState.attempt === 0 && !retryState.isRetrying) {
      // Start auto-retry after initial mount
      const timer = setTimeout(handleRetry, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoRetry, retryState.attempt, retryState.isRetrying, handleRetry]);

  // Cleanup countdown interval
  useEffect(() => {
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [countdownInterval]);

  // Determine error type for styling and messaging
  const getErrorType = () => {
    const message = error.message.toLowerCase();

    if (!navigator.onLine || message.includes("network") || message.includes("fetch")) {
      return {
        type: "network",
        icon: WifiOff,
        color: "coral",
        suggestion: "Check your internet connection and try again.",
      };
    }

    if (message.includes("timeout")) {
      return {
        type: "timeout",
        icon: Clock,
        color: "sunset",
        suggestion: "The request timed out. Your connection might be slow.",
      };
    }

    if (message.includes("500") || message.includes("server")) {
      return {
        type: "server",
        icon: AlertCircle,
        color: "coral",
        suggestion: "Server error. This is usually temporary.",
      };
    }

    return {
      type: "generic",
      icon: XCircle,
      color: "coral",
      suggestion: "An unexpected error occurred.",
    };
  };

  const errorInfo = getErrorType();
  const IconComponent = errorInfo.icon;
  const canRetry = retryState.attempt < config.maxAttempts;
  const isOnline = navigator.onLine;

  // Format countdown display
  const formatCountdown = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return seconds > 0 ? `${seconds}s` : "";
  };

  return (
    <Card className={cn("mx-auto max-w-2xl", className)}>
      <CardHeader className="space-y-4 text-center">
        <div className="bg-coral-100 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
          <IconComponent className="text-coral-600 h-8 w-8" />
        </div>

        <div>
          <CardTitle className="text-ocean-900 text-2xl">{title || "Operation Failed"}</CardTitle>
          <CardDescription className="mt-2 text-lg">
            {description || errorInfo.suggestion}
          </CardDescription>
        </div>

        {/* Network status */}
        {!isOnline && (
          <div className="bg-coral-100 text-coral-800 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm">
            <WifiOff className="h-4 w-4" />
            <span>You're offline</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Retry attempts indicator */}
        <div className="bg-sand-50 flex items-center justify-center gap-4 rounded-lg p-4">
          <div className="text-ocean-700 text-sm">
            <strong>Attempts:</strong> {retryState.attempt} / {config.maxAttempts}
          </div>

          {retryState.isRetrying && (
            <div className="text-ocean-600 flex items-center gap-2 text-sm">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {retryState.nextRetryIn > 0 ? (
                <span>Retrying in {formatCountdown(retryState.nextRetryIn)}</span>
              ) : (
                <span>Retrying now...</span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={handleRetry}
            disabled={!canRetry || retryState.isRetrying || !isOnline}
            className="flex-1"
            size="lg"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", retryState.isRetrying && "animate-spin")} />
            {retryState.isRetrying
              ? "Retrying..."
              : canRetry
                ? `Retry${retryState.nextRetryIn > 0 ? ` (${formatCountdown(retryState.nextRetryIn)})` : ""}`
                : "Max Attempts Reached"}
          </Button>

          {onGiveUp && (
            <Button onClick={onGiveUp} variant="outline" className="flex-1" size="lg">
              Give Up
            </Button>
          )}
        </div>

        {/* Auto-retry indicator */}
        {autoRetry && canRetry && (
          <div className="text-ocean-600 bg-ocean-50 flex items-center justify-center gap-2 rounded-lg p-3 text-sm">
            <Info className="h-4 w-4" />
            <span>Auto-retry is enabled. We'll keep trying automatically.</span>
          </div>
        )}

        {/* Error details toggle */}
        <div className="space-y-3">
          <Button
            onClick={() => setShowDetails(!showDetails)}
            variant="ghost"
            size="sm"
            className="w-full justify-between"
          >
            <span>Error Details</span>
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {showDetails && (
            <div className="bg-sand-50 border-sand-200 space-y-3 rounded-lg border p-4">
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Error:</strong> {retryState.lastError?.message || error.message}
                </div>
                <div>
                  <strong>Type:</strong> {errorInfo.type}
                </div>
                <div>
                  <strong>Time:</strong> {new Date().toLocaleString()}
                </div>
                {(retryState.lastError as any)?.status && (
                  <div>
                    <strong>Status:</strong> {(retryState.lastError as any).status}
                  </div>
                )}
              </div>

              {/* Retry strategy info */}
              <div className="mt-3 border-t pt-3">
                <div className="space-y-1 text-sm">
                  <div>
                    <strong>Strategy:</strong> {config.strategy}
                  </div>
                  <div>
                    <strong>Base delay:</strong> {config.baseDelay}ms
                  </div>
                  {config.maxDelay && (
                    <div>
                      <strong>Max delay:</strong> {config.maxDelay}ms
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Retry history */}
        {showHistory && retryState.retryHistory.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-ocean-800 font-semibold">Retry History</h4>
            <div className="space-y-2">
              {retryState.retryHistory.map((entry, index) => (
                <div
                  key={index}
                  className="bg-sand-50 flex items-center gap-3 rounded-lg p-3 text-sm"
                >
                  {entry.success ? (
                    <CheckCircle2 className="text-palm-600 h-4 w-4 flex-shrink-0" />
                  ) : (
                    <XCircle className="text-coral-600 h-4 w-4 flex-shrink-0" />
                  )}

                  <div className="flex-1">
                    <div className="font-medium">
                      Attempt #{entry.attempt} - {entry.success ? "Success" : "Failed"}
                    </div>
                    <div className="text-ocean-600">{entry.timestamp.toLocaleTimeString()}</div>
                    {entry.error && (
                      <div className="text-coral-600 mt-1 text-xs">{entry.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom children content */}
        {children}
      </CardContent>
    </Card>
  );
};

// Hook for managing retry logic
export const useRetry = (config?: Partial<RetryConfig>) => {
  const [retryState, setRetryState] = useState<RetryState>({
    attempt: 0,
    isRetrying: false,
    nextRetryIn: 0,
    lastError: null,
    retryHistory: [],
  });

  const retry = useCallback(
    async (operation: () => Promise<void>) => {
      const finalConfig = { ...defaultConfig, ...config };

      for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
        try {
          setRetryState((prev) => ({ ...prev, attempt, isRetrying: true }));

          await operation();

          // Success
          setRetryState((prev) => ({
            ...prev,
            isRetrying: false,
            retryHistory: [...prev.retryHistory, { attempt, timestamp: new Date(), success: true }],
          }));
          return;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          setRetryState((prev) => ({
            ...prev,
            lastError: err,
            retryHistory: [
              ...prev.retryHistory,
              {
                attempt,
                timestamp: new Date(),
                success: false,
                error: err.message,
              },
            ],
          }));

          if (attempt < finalConfig.maxAttempts) {
            // Calculate delay for next attempt
            const delay =
              finalConfig.strategy === "exponential"
                ? Math.min(
                    finalConfig.baseDelay * Math.pow(2, attempt - 1),
                    finalConfig.maxDelay || 30000
                  )
                : finalConfig.baseDelay;

            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            setRetryState((prev) => ({ ...prev, isRetrying: false }));
            throw err;
          }
        }
      }
    },
    [config]
  );

  const reset = useCallback(() => {
    setRetryState({
      attempt: 0,
      isRetrying: false,
      nextRetryIn: 0,
      lastError: null,
      retryHistory: [],
    });
  }, []);

  return {
    retry,
    reset,
    state: retryState,
  };
};

export default RetryError;
