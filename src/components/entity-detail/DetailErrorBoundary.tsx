// src/components/entity-detail/DetailErrorBoundary.tsx

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Props for DetailErrorBoundary component
 */
export interface DetailErrorBoundaryProps {
  error: Error;
  reset: () => void;
  entityName?: string;
}

/**
 * Error display component with retry/back functionality
 *
 * Use as `errorComponent` in route definitions for consistent error handling.
 * Provides:
 * - Clear error message display
 * - Try Again button to retry the operation
 * - Go Back button to return to previous page
 *
 * @example
 * ```typescript
 * export const Route = createFileRoute('/_authenticated/bookings/$bookingId')({
 *   errorComponent: ({ error, reset }) => (
 *     <DetailErrorBoundary error={error} reset={reset} entityName="Booking" />
 *   ),
 * })
 * ```
 */
export function DetailErrorBoundary({
  error,
  reset,
  entityName = "Item",
}: DetailErrorBoundaryProps) {
  return (
    <div className="container mx-auto py-12">
      <div className="max-w-md mx-auto text-center space-y-4">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        {/* Error Title */}
        <h2 className="text-xl font-semibold text-red-600">
          Failed to load {entityName.toLowerCase()}
        </h2>

        {/* Error Message */}
        <p className="text-neutral-600">{error.message}</p>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} variant="default">
            Try Again
          </Button>
          <Button onClick={() => window.history.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
