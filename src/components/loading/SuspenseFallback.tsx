import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Waves, Sun, Palmtree } from "lucide-react";
import { DashboardSkeleton, CardSkeleton, FormSkeleton, TableSkeleton } from "./SkeletonLoader";

interface SuspenseFallbackProps {
  className?: string;
  message?: string;
  type?: "spinner" | "skeleton" | "progressive" | "minimal" | "resort-themed";
  size?: "sm" | "md" | "lg";
  showDelay?: number; // Delay before showing fallback (prevents flash)
  skeletonType?: "dashboard" | "card" | "form" | "table" | "list";
}

// Utility hook for delayed showing
const useDelayedShow = (delay: number = 200) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return show;
};

// Utility hook for progressive loading messages
const useProgressiveMessage = (messages: string[], interval: number = 2000) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [messages, interval]);

  return messages[currentIndex];
};

// Resort-themed loading component
const ResortLoader: React.FC<{ size: "sm" | "md" | "lg" }> = ({ size }) => {
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="relative">
        {/* Animated waves */}
        <Waves
          className={cn(iconSizes[size], "text-ocean-500 animate-bounce")}
          style={{ animationDelay: "0s" }}
        />
        <div className="absolute -inset-1">
          <Waves
            className={cn(iconSizes[size], "text-ocean-300 animate-bounce opacity-50")}
            style={{ animationDelay: "0.2s" }}
          />
        </div>
      </div>

      {/* Sun */}
      <Sun
        className={cn(iconSizes[size], "text-sunset-500 animate-spin")}
        style={{ animationDuration: "3s" }}
      />

      {/* Palm tree */}
      <Palmtree
        className={cn(iconSizes[size], "text-palm-500 animate-bounce")}
        style={{ animationDelay: "0.4s" }}
      />
    </div>
  );
};

// Minimal spinner with Philippine resort theme
const MinimalSpinner: React.FC<{ size: "sm" | "md" | "lg" }> = ({ size }) => {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={cn(
          "border-sand-200 border-t-ocean-500 animate-spin rounded-full border-2",
          sizes[size]
        )}
      />
    </div>
  );
};

// Progressive loading component
const ProgressiveLoader: React.FC<{ message: string; size: "sm" | "md" | "lg" }> = ({
  message,
  size,
}) => {
  const progressiveMessages = [
    message || "Loading your resort dashboard...",
    "Preparing your tropical experience...",
    "Gathering the latest updates...",
    "Almost ready for paradise...",
  ];

  const currentMessage = useProgressiveMessage(progressiveMessages, 2500);

  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <ResortLoader size={size} />

      <div className="space-y-2">
        <p className="text-ocean-700 font-medium">{currentMessage}</p>

        {/* Progress bar */}
        <div className="bg-sand-200 h-1 w-full rounded-full">
          <div
            className="from-ocean-400 to-coral-400 h-1 rounded-full bg-gradient-to-r transition-all duration-1000 ease-out"
            style={{
              width: `${(progressiveMessages.indexOf(currentMessage) + 1) * 25}%`,
            }}
          />
        </div>

        <p className="text-ocean-500 text-sm">Welcome to Okaeri Resort Management</p>
      </div>
    </div>
  );
};

// Main SuspenseFallback component
export const SuspenseFallback: React.FC<SuspenseFallbackProps> = ({
  className,
  message,
  type = "progressive",
  size = "md",
  showDelay = 200,
  skeletonType = "dashboard",
}) => {
  const shouldShow = useDelayedShow(showDelay);

  // Don't render anything during delay period to prevent flash
  if (!shouldShow) {
    return null;
  }

  const containerClasses = cn(
    "flex items-center justify-center p-8",
    size === "lg" && "min-h-screen",
    size === "md" && "min-h-[400px]",
    size === "sm" && "min-h-[200px]",
    className
  );

  // Skeleton fallback
  if (type === "skeleton") {
    const skeletonContainerClasses = cn("mx-auto w-full max-w-7xl space-y-6 p-4", className);

    switch (skeletonType) {
      case "dashboard":
        return (
          <div className={skeletonContainerClasses}>
            <DashboardSkeleton />
          </div>
        );
      case "form":
        return (
          <div className={skeletonContainerClasses}>
            <FormSkeleton />
          </div>
        );
      case "table":
        return (
          <div className={skeletonContainerClasses}>
            <TableSkeleton />
          </div>
        );
      case "card":
      default:
        return (
          <div className={skeletonContainerClasses}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <CardSkeleton key={index} showActions />
              ))}
            </div>
          </div>
        );
    }
  }

  return (
    <div className={containerClasses}>
      <div className="space-y-6 text-center">
        {/* Loading indicator based on type */}
        {type === "spinner" && (
          <div className="space-y-4">
            <Loader2
              className={cn(
                "text-ocean-500 mx-auto animate-spin",
                size === "sm" && "h-6 w-6",
                size === "md" && "h-8 w-8",
                size === "lg" && "h-12 w-12"
              )}
            />
            {message && <p className="text-ocean-700 font-medium">{message}</p>}
          </div>
        )}

        {type === "minimal" && (
          <div className="space-y-4">
            <MinimalSpinner size={size} />
            {message && <p className="text-ocean-600 text-sm">{message}</p>}
          </div>
        )}

        {type === "resort-themed" && (
          <div className="space-y-4">
            <ResortLoader size={size} />
            <div className="space-y-2">
              <p className="text-ocean-700 font-medium">
                {message || "Preparing your paradise..."}
              </p>
              <p className="text-ocean-500 text-sm">Okaeri Resort Management System</p>
            </div>
          </div>
        )}

        {type === "progressive" && (
          <ProgressiveLoader message={message || "Loading..."} size={size} />
        )}
      </div>
    </div>
  );
};

// Specialized suspense fallbacks for different contexts
export const PageSuspenseFallback: React.FC<{ message?: string }> = ({
  message = "Loading page...",
}) => (
  <SuspenseFallback
    type="progressive"
    size="lg"
    message={message}
    className="from-sand-25 to-ocean-25 bg-gradient-to-br via-white"
  />
);

export const ComponentSuspenseFallback: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => (
  <SuspenseFallback
    type="resort-themed"
    size="md"
    message={message}
    className="border-sand-200 rounded-lg border bg-white"
  />
);

export const ModalSuspenseFallback: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => <SuspenseFallback type="minimal" size="sm" message={message} className="py-8" />;

export const DashboardSuspenseFallback: React.FC = () => (
  <SuspenseFallback
    type="skeleton"
    skeletonType="dashboard"
    showDelay={300}
    className="bg-sand-25 min-h-screen"
  />
);

export const FormSuspenseFallback: React.FC = () => (
  <SuspenseFallback type="skeleton" skeletonType="form" showDelay={150} />
);

export const TableSuspenseFallback: React.FC = () => (
  <SuspenseFallback type="skeleton" skeletonType="table" showDelay={150} />
);

// HOC for adding suspense to components
export const withSuspense = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType
) => {
  const WrappedComponent = (props: P) => (
    <React.Suspense fallback={fallback ? <fallback /> : <ComponentSuspenseFallback />}>
      <Component {...props} />
    </React.Suspense>
  );

  WrappedComponent.displayName = `withSuspense(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default SuspenseFallback;
