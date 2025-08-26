import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { createContext, useContext } from "react";

// Progress bar context for global state management
interface ProgressContextValue {
  isLoading: boolean;
  progress: number;
  message: string;
  startProgress: (message?: string) => void;
  updateProgress: (progress: number, message?: string) => void;
  finishProgress: () => void;
  setMessage: (message: string) => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

// Hook to use progress context
export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
};

// Progress Provider component
interface ProgressProviderProps {
  children: React.ReactNode;
}

export const ProgressProvider: React.FC<ProgressProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const startProgress = useCallback((initialMessage?: string) => {
    setIsLoading(true);
    setProgress(0);
    setMessage(initialMessage || "Loading...");
  }, []);

  const updateProgress = useCallback((newProgress: number, newMessage?: string) => {
    setProgress(Math.min(100, Math.max(0, newProgress)));
    if (newMessage) {
      setMessage(newMessage);
    }
  }, []);

  const finishProgress = useCallback(() => {
    setProgress(100);
    // Small delay to show completion before hiding
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
      setMessage("");
    }, 500);
  }, []);

  const value: ProgressContextValue = {
    isLoading,
    progress,
    message,
    startProgress,
    updateProgress,
    finishProgress,
    setMessage,
  };

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
};

// Main ProgressBar component
interface ProgressBarProps {
  className?: string;
  variant?: "fixed" | "inline" | "modal";
  showPercentage?: boolean;
  showMessage?: boolean;
  color?: "ocean" | "coral" | "sunset" | "palm";
  animate?: boolean;
  height?: "thin" | "normal" | "thick";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  className,
  variant = "fixed",
  showPercentage = false,
  showMessage = false,
  color = "ocean",
  animate = true,
  height = "normal",
}) => {
  const { isLoading, progress, message } = useProgress();

  if (!isLoading) {
    return null;
  }

  const getColorClasses = (colorName: string) => {
    switch (colorName) {
      case "coral":
        return {
          bg: "bg-coral-500",
          shadow: "shadow-coral-500/30",
          glow: "shadow-lg shadow-coral-400/50",
        };
      case "sunset":
        return {
          bg: "bg-gradient-to-r from-sunset-400 to-coral-500",
          shadow: "shadow-sunset-500/30",
          glow: "shadow-lg shadow-sunset-400/50",
        };
      case "palm":
        return {
          bg: "bg-palm-500",
          shadow: "shadow-palm-500/30",
          glow: "shadow-lg shadow-palm-400/50",
        };
      default: // ocean
        return {
          bg: "bg-gradient-to-r from-ocean-400 to-ocean-600",
          shadow: "shadow-ocean-500/30",
          glow: "shadow-lg shadow-ocean-400/50",
        };
    }
  };

  const getHeightClasses = (heightSize: string) => {
    switch (heightSize) {
      case "thin":
        return "h-1";
      case "thick":
        return "h-3";
      default: // normal
        return "h-2";
    }
  };

  const colorClasses = getColorClasses(color);
  const heightClasses = getHeightClasses(height);

  // Fixed top progress bar (typical for page loads)
  if (variant === "fixed") {
    return (
      <div className={cn("fixed top-0 right-0 left-0 z-50", className)}>
        <div className={cn("bg-sand-200 w-full", heightClasses)}>
          <div
            className={cn(
              colorClasses.bg,
              heightClasses,
              "transition-all duration-500 ease-out",
              animate && progress < 100 && "animate-pulse",
              progress === 100 && colorClasses.glow
            )}
            style={{
              width: `${progress}%`,
              boxShadow:
                progress > 0
                  ? `0 0 10px ${color === "ocean" ? "rgba(59, 130, 246, 0.5)" : "rgba(251, 146, 60, 0.5)"}`
                  : "none",
            }}
          />
        </div>

        {/* Optional message display */}
        {showMessage && message && (
          <div className="border-sand-200 border-b bg-white/95 px-4 py-2 text-center backdrop-blur-sm">
            <div className="text-ocean-700 flex items-center justify-center gap-3 text-sm">
              {showPercentage && (
                <span className="font-mono font-medium">{Math.round(progress)}%</span>
              )}
              <span>{message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Inline progress bar (for forms, uploads, etc.)
  if (variant === "inline") {
    return (
      <div className={cn("w-full space-y-2", className)}>
        {showMessage && message && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ocean-700">{message}</span>
            {showPercentage && (
              <span className="text-ocean-600 font-mono font-medium">{Math.round(progress)}%</span>
            )}
          </div>
        )}

        <div className={cn("bg-sand-200 w-full rounded-full", heightClasses)}>
          <div
            className={cn(
              colorClasses.bg,
              heightClasses,
              "rounded-full transition-all duration-500 ease-out",
              animate && progress < 100 && "animate-pulse",
              progress === 100 && colorClasses.glow
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Modal/overlay progress bar
  if (variant === "modal") {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm",
          className
        )}
      >
        <div className="mx-4 w-full max-w-md rounded-lg bg-white p-8 shadow-2xl">
          <div className="space-y-6 text-center">
            {/* Loading indicator */}
            <div className="mx-auto h-16 w-16">
              <div className="relative">
                <div className="border-sand-200 h-16 w-16 rounded-full border-4"></div>
                <div
                  className={cn(
                    "absolute top-0 left-0 h-16 w-16 rounded-full border-4 border-transparent transition-all duration-500",
                    colorClasses.bg === "from-ocean-400 to-ocean-600 bg-gradient-to-r"
                      ? "border-t-ocean-500 border-r-ocean-500"
                      : "border-t-coral-500 border-r-coral-500"
                  )}
                  style={{
                    transform: `rotate(${(progress / 100) * 360}deg)`,
                    transition: "transform 0.5s ease-out",
                  }}
                ></div>
              </div>
            </div>

            {/* Progress info */}
            <div className="space-y-3">
              {message && <h3 className="text-ocean-900 text-lg font-semibold">{message}</h3>}

              {showPercentage && (
                <p className="text-ocean-600 font-mono text-2xl font-bold">
                  {Math.round(progress)}%
                </p>
              )}

              {/* Progress bar */}
              <div className={cn("bg-sand-200 w-full rounded-full", heightClasses)}>
                <div
                  className={cn(
                    colorClasses.bg,
                    heightClasses,
                    "rounded-full transition-all duration-500 ease-out",
                    animate && progress < 100 && "animate-pulse"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-ocean-600 text-sm">Please wait while we process your request...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Specialized progress bars for different use cases
export const PageLoadProgress: React.FC = () => (
  <ProgressBar variant="fixed" color="ocean" showMessage height="thin" />
);

export const FormProgress: React.FC<{ className?: string }> = ({ className }) => (
  <ProgressBar variant="inline" color="coral" showPercentage showMessage className={className} />
);

export const ModalProgress: React.FC = () => (
  <ProgressBar variant="modal" color="sunset" showPercentage showMessage />
);

// Hook for automatic progress tracking
export const useAutoProgress = (steps: string[]) => {
  const { startProgress, updateProgress, finishProgress } = useProgress();
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = useCallback(() => {
    const nextStepIndex = currentStep + 1;
    if (nextStepIndex <= steps.length) {
      setCurrentStep(nextStepIndex);
      const progress = (nextStepIndex / steps.length) * 100;
      const message = nextStepIndex < steps.length ? steps[nextStepIndex] : "Completing...";
      updateProgress(progress, message);

      if (nextStepIndex >= steps.length) {
        finishProgress();
      }
    }
  }, [currentStep, steps, updateProgress, finishProgress]);

  const start = useCallback(() => {
    setCurrentStep(0);
    startProgress(steps[0]);
  }, [startProgress, steps]);

  const reset = useCallback(() => {
    setCurrentStep(0);
  }, []);

  return {
    start,
    nextStep,
    reset,
    currentStep,
    totalSteps: steps.length,
    isComplete: currentStep >= steps.length,
  };
};

// Hook for tracking async operations
export const useAsyncProgress = () => {
  const { startProgress, updateProgress, finishProgress, setMessage } = useProgress();

  const trackAsync = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      options: {
        message?: string;
        steps?: { progress: number; message: string }[];
      } = {}
    ): Promise<T> => {
      try {
        startProgress(options.message || "Processing...");

        if (options.steps) {
          // Simulate progress steps
          for (const step of options.steps) {
            updateProgress(step.progress, step.message);
            await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay for UX
          }
        }

        const result = await asyncFn();
        finishProgress();
        return result;
      } catch (error) {
        finishProgress();
        throw error;
      }
    },
    [startProgress, updateProgress, finishProgress, setMessage]
  );

  return { trackAsync };
};

export default ProgressBar;
