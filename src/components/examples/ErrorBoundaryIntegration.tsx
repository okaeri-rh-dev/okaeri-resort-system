/**
 * EXAMPLE: Error Boundary and Loading State Integration
 *
 * This file demonstrates how to integrate the error boundaries and loading states
 * into your Okaeri Resort Management System components.
 *
 * This is an EXAMPLE file - delete or move it once you understand the patterns.
 */

import React, { Suspense } from "react";
import {
  ErrorBoundary,
  RouteErrorBoundary,
  RetryError,
  OfflineError,
  OfflineIndicator,
  DashboardSuspenseFallback,
  FormSuspenseFallback,
  ProgressProvider,
  PageLoadProgress,
  useOnlineStatus,
  useProgress,
} from "@/components/ui";

// Example: Main App with global error boundary and progress
export const AppWithErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProgressProvider>
      <ErrorBoundary
        level="critical"
        showDetails={process.env.NODE_ENV === "development"}
        onError={(error, errorInfo) => {
          // Log to your monitoring service
          console.error("Global Error:", error, errorInfo);
        }}
      >
        <PageLoadProgress />
        <OfflineIndicator className="fixed top-4 right-4 z-50" />
        {children}
      </ErrorBoundary>
    </ProgressProvider>
  );
};

// Example: Dashboard page with suspense and error handling
const DashboardContent: React.FC = () => {
  const { startProgress, finishProgress } = useProgress();

  React.useEffect(() => {
    startProgress("Loading dashboard...");
    // Simulate data loading
    const timer = setTimeout(() => {
      finishProgress();
    }, 2000);

    return () => clearTimeout(timer);
  }, [startProgress, finishProgress]);

  return (
    <div className="space-y-6">
      <h1 className="text-ocean-900 text-3xl font-bold">Dashboard</h1>
      {/* Your dashboard content */}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DashboardSuspenseFallback />}>
        <DashboardContent />
      </Suspense>
    </ErrorBoundary>
  );
};

// Example: Form with error recovery
const BookingForm: React.FC = () => {
  const [error, setError] = React.useState<Error | null>(null);
  const { isOnline } = useOnlineStatus();

  const handleSubmit = async (data: any) => {
    try {
      setError(null);
      // Your form submission logic
      await submitBooking(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Submission failed"));
    }
  };

  if (!isOnline) {
    return (
      <OfflineError
        customMessage="You need an internet connection to create new bookings."
        showTips={true}
      />
    );
  }

  if (error) {
    return (
      <RetryError
        error={error}
        onRetry={() => {
          setError(null);
          // Optionally retry the form submission
        }}
        config={{
          maxAttempts: 3,
          strategy: "exponential",
          baseDelay: 1000,
        }}
        autoRetry={false}
        showHistory={true}
      />
    );
  }

  return (
    <ErrorBoundary level="component">
      <Suspense fallback={<FormSuspenseFallback />}>
        <form onSubmit={handleSubmit}>{/* Your form fields */}</form>
      </Suspense>
    </ErrorBoundary>
  );
};

// Example: Route-level error boundary (for TanStack Router)
export const RouteWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DashboardSuspenseFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
};

// Example: API call with automatic retry
const useBookings = () => {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bookings");
      if (!response.ok) {
        throw new Error(`Failed to fetch bookings: ${response.statusText}`);
      }
      const bookings = await response.json();
      setData(bookings);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchBookings();
  }, []);

  return { data, error, loading, refetch: fetchBookings };
};

export const BookingsList: React.FC = () => {
  const { data, error, loading, refetch } = useBookings();

  if (loading) {
    return <DashboardSuspenseFallback />;
  }

  if (error) {
    return (
      <RetryError
        error={error}
        onRetry={refetch}
        config={{
          maxAttempts: 5,
          strategy: "exponential",
          baseDelay: 2000,
        }}
        autoRetry={true}
        title="Failed to Load Bookings"
        description="We couldn't load your bookings right now."
      />
    );
  }

  return (
    <div>
      {/* Render your bookings data */}
      {data && <div>Bookings loaded successfully!</div>}
    </div>
  );
};

// Example: Higher-order component usage
const EnhancedBookingForm = withErrorBoundary(BookingForm, {
  level: "component",
  showDetails: false,
});

// Dummy function for example
const submitBooking = async (data: any): Promise<void> => {
  // Simulate API call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.7) {
        reject(new Error("Network error occurred"));
      } else {
        resolve();
      }
    }, 1000);
  });
};

/**
 * INTEGRATION GUIDELINES:
 *
 * 1. Wrap your entire app with ProgressProvider for global progress tracking
 *
 * 2. Use ErrorBoundary at different levels:
 *    - 'critical' for app-level errors
 *    - 'page' for route-level errors
 *    - 'component' for individual components
 *
 * 3. Use appropriate Suspense fallbacks:
 *    - DashboardSuspenseFallback for dashboard pages
 *    - FormSuspenseFallback for forms
 *    - TableSuspenseFallback for data tables
 *
 * 4. Handle offline states with OfflineError and OfflineIndicator
 *
 * 5. Use RetryError for recoverable operations like API calls
 *
 * 6. Add ProgressBar components for long-running operations
 *
 * 7. Use the hooks:
 *    - useOnlineStatus() to check connectivity
 *    - useProgress() for progress management
 *    - useRetry() for retry logic
 */
