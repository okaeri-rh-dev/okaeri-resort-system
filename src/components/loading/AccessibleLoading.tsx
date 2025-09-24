import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================
// ACCESSIBLE LOADING COMPONENT
// ============================================

interface AccessibleLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  loadingText?: string;
  description?: string;
  className?: string;
  announceLoading?: boolean;
  announceComplete?: boolean;
  minLoadingTime?: number;
}

export const AccessibleLoading: React.FC<AccessibleLoadingProps> = ({
  isLoading,
  children,
  skeleton,
  loadingText = "Loading content",
  description,
  className,
  announceLoading = true,
  announceComplete = true,
  minLoadingTime = 500,
}) => {
  const [hasMinTimeElapsed, setHasMinTimeElapsed] = useState(false);
  const [previousLoadingState, setPreviousLoadingState] = useState(isLoading);

  useEffect(() => {
    if (isLoading && !previousLoadingState) {
      // Started loading
      setHasMinTimeElapsed(false);

      const timer = setTimeout(() => {
        setHasMinTimeElapsed(true);
      }, minLoadingTime);

      return () => clearTimeout(timer);
    }

    setPreviousLoadingState(isLoading);
  }, [isLoading, previousLoadingState, minLoadingTime]);

  // Show loading until both data is loaded AND minimum time has elapsed
  const shouldShowLoading = isLoading || (isLoading && !hasMinTimeElapsed);

  if (shouldShowLoading) {
    return (
      <div
        className={cn("relative", className)}
        role="region"
        aria-live={announceLoading ? "polite" : "off"}
        aria-busy="true"
        aria-label={loadingText}
      >
        {/* Screen reader announcement */}
        <div className="sr-only">
          {loadingText}
          {description && `. ${description}`}
        </div>

        {/* Visual loading indicator */}
        <div aria-hidden="true" className="space-y-4">
          {skeleton || (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}
        </div>

        {/* Focus trap for keyboard users */}
        <div
          tabIndex={0}
          className="absolute inset-0 opacity-0 pointer-events-none"
          aria-label={`${loadingText}. Please wait.`}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      role="region"
      aria-live={announceComplete ? "polite" : "off"}
      aria-busy="false"
    >
      {/* Screen reader announcement for completion */}
      {announceComplete && <div className="sr-only">Content loaded successfully</div>}

      {children}
    </div>
  );
};

// ============================================
// LOADING ANNOUNCER
// ============================================

interface LoadingAnnouncerProps {
  message: string;
  type?: "loading" | "success" | "error";
  duration?: number;
}

export const LoadingAnnouncer: React.FC<LoadingAnnouncerProps> = ({ message, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  if (!isVisible) return null;

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
};

// ============================================
// PROGRESSIVE LOADING
// ============================================

interface ProgressiveLoadingProps {
  steps: Array<{
    key: string;
    label: string;
    isComplete: boolean;
    isLoading: boolean;
  }>;
  className?: string;
}

export const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({ steps, className }) => {
  const currentStep = steps.find((step) => step.isLoading);
  const completedSteps = steps.filter((step) => step.isComplete).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div
      className={cn("space-y-4", className)}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading progress"
    >
      {/* Progress bar */}
      <div className="w-full bg-neutral-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Current step announcement */}
      {currentStep && (
        <div role="status" aria-live="polite" className="text-sm text-neutral-600">
          {currentStep.label}
        </div>
      )}

      {/* Step list for screen readers */}
      <div className="sr-only">
        <h3>Loading steps:</h3>
        <ul>
          {steps.map((step) => (
            <li key={step.key}>
              {step.isComplete ? "✓" : step.isLoading ? "Loading:" : "Pending:"} {step.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Visual step indicators */}
      <div className="flex items-center space-x-2" aria-hidden="true">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                step.isComplete
                  ? "bg-green-600 text-white"
                  : step.isLoading
                    ? "bg-blue-600 text-white animate-pulse"
                    : "bg-neutral-300 text-neutral-600"
              )}
            >
              {step.isComplete ? "✓" : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn("flex-1 h-0.5", step.isComplete ? "bg-green-600" : "bg-neutral-300")}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ============================================
// KEYBOARD ACCESSIBLE LOADING
// ============================================

interface KeyboardLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  onSkipLoading?: () => void;
  className?: string;
}

export const KeyboardAccessibleLoading: React.FC<KeyboardLoadingProps> = ({
  isLoading,
  children,
  skeleton,
  onSkipLoading,
  className,
}) => {
  const [showSkipOption, setShowSkipOption] = useState(false);

  useEffect(() => {
    if (isLoading) {
      // Show skip option after 3 seconds
      const timer = setTimeout(() => {
        setShowSkipOption(true);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setShowSkipOption(false);
    }
  }, [isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && onSkipLoading && showSkipOption) {
      onSkipLoading();
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn("relative", className)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-live="polite"
        aria-label="Loading content"
      >
        {skeleton || (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {showSkipOption && onSkipLoading && (
          <div className="mt-4 text-center">
            <button
              onClick={onSkipLoading}
              className="text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              Skip loading and continue (Press Escape)
            </button>
          </div>
        )}

        {/* Invisible element for screen readers */}
        <div className="sr-only">
          Loading content. Please wait.
          {showSkipOption && onSkipLoading && " Press Escape to skip loading."}
        </div>
      </div>
    );
  }

  return (
    <div className={className} role="region" aria-live="polite">
      <div className="sr-only">Content loaded successfully</div>
      {children}
    </div>
  );
};

// ============================================
// REDUCED MOTION LOADING
// ============================================

interface ReducedMotionLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}

export const ReducedMotionLoading: React.FC<ReducedMotionLoadingProps> = ({
  isLoading,
  children,
  className,
}) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  if (isLoading) {
    return (
      <div
        className={cn("space-y-3", className)}
        role="region"
        aria-live="polite"
        aria-label="Loading content"
      >
        <div className="sr-only">Loading content. Please wait.</div>

        {prefersReducedMotion ? (
          // Static loading indicator for reduced motion
          <div className="space-y-3" aria-hidden="true">
            <div className="h-4 bg-neutral-200 rounded w-3/4" />
            <div className="h-4 bg-neutral-200 rounded w-1/2" />
            <div className="h-4 bg-neutral-200 rounded w-5/6" />
          </div>
        ) : (
          // Animated loading indicator for normal motion
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="sr-only">Content loaded successfully</div>
      {children}
    </div>
  );
};
