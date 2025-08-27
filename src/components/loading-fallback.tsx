/**
 * Loading Fallback Components for Okaeri Resort System
 * Provides consistent loading states across the application
 */

import React from "react";
import { Loader2, Waves } from "lucide-react";

interface LoadingFallbackProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "skeleton" | "resort";
  className?: string;
}

// Main loading fallback component
export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = "Loading...",
  size = "md",
  variant = "spinner",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const containerSizeClasses = {
    sm: "p-2",
    md: "p-4",
    lg: "p-8",
  };

  if (variant === "resort") {
    return (
      <div
        className={`flex flex-col items-center justify-center ${containerSizeClasses[size]} ${className}`}
      >
        <div className="relative">
          <Waves className={`${sizeClasses[size]} animate-pulse text-blue-600`} />
          <div className="absolute inset-0 animate-spin">
            <div className="h-full w-full rounded-full border-2 border-transparent border-t-blue-300"></div>
          </div>
        </div>
        {message && (
          <p className="mt-2 animate-pulse text-sm text-slate-600 dark:text-slate-400">{message}</p>
        )}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center ${containerSizeClasses[size]} ${className}`}
    >
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>}
    </div>
  );
};

// Page-level loading component
export const PageLoading: React.FC<{ message?: string }> = ({ message = "Loading page..." }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="text-center">
      <LoadingFallback variant="resort" size="lg" message={message} />
    </div>
  </div>
);

// Section loading component
export const SectionLoading: React.FC<{
  message?: string;
  height?: string;
}> = ({ message = "Loading...", height = "h-32" }) => (
  <div
    className={`${height} flex items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800`}
  >
    <LoadingFallback variant="spinner" size="md" message={message} />
  </div>
);

// Card skeleton for loading lists
export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="flex items-start space-x-4">
          <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Table skeleton for loading data tables
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
}> = ({ rows = 5, columns = 4 }) => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
    <div className="animate-pulse">
      {/* Header */}
      <div className="border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="flex space-x-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-700"></div>
          ))}
        </div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="border-b border-slate-100 p-4 dark:border-slate-700">
          <div className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-3 flex-1 rounded bg-slate-200 dark:bg-slate-700"
              ></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Form loading overlay
export const FormLoading: React.FC<{ message?: string }> = ({ message = "Saving..." }) => (
  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm dark:bg-slate-800/80">
    <LoadingFallback variant="spinner" size="md" message={message} />
  </div>
);
