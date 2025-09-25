import { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataFetchingWrapperProps<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  children: (data: T) => ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  emptyComponent?: ReactNode;
  isEmpty?: (data: T) => boolean;
  retryFn?: () => void;
}

/**
 * Wrapper for data fetching components with loading, error, and empty states
 * Automatically handles all data fetching states with error boundaries
 */
export function DataFetchingWrapper<T>({
  data,
  isLoading,
  isError,
  error,
  children,
  loadingComponent,
  errorComponent,
  emptyComponent,
  isEmpty,
  retryFn,
}: DataFetchingWrapperProps<T>) {
  // Loading state
  if (isLoading) {
    return <>{loadingComponent || <DefaultLoader />}</>;
  }

  // Error state
  if (isError || error) {
    return <>{errorComponent || <DefaultError error={error} onRetry={retryFn} />}</>;
  }

  // Empty state
  if (data && isEmpty?.(data)) {
    return <>{emptyComponent || <DefaultEmpty />}</>;
  }

  // No data state
  if (!data) {
    return <>{emptyComponent || <DefaultEmpty />}</>;
  }

  // Success state with error boundary
  return (
    <ErrorBoundary level="component" fallback={<DefaultError error={error} onRetry={retryFn} />}>
      {children(data)}
    </ErrorBoundary>
  );
}

/**
 * Default loading component with skeleton
 */
function DefaultLoader() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

/**
 * Default error component with retry option
 */
function DefaultError({ error, onRetry }: { error?: Error | null; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Data</AlertTitle>
      <AlertDescription className="mt-2">
        {error?.message || "An unexpected error occurred while loading data."}
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Default empty state component
 */
function DefaultEmpty() {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 text-lg">No data available</p>
      <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or search criteria</p>
    </div>
  );
}

interface ListDataWrapperProps<T> {
  items: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  loadingCount?: number;
  emptyMessage?: string;
  className?: string;
}

/**
 * Wrapper specifically for list data with optimized rendering
 */
export function ListDataWrapper<T>({
  items,
  isLoading,
  isError,
  error,
  renderItem,
  keyExtractor,
  loadingCount = 3,
  emptyMessage = "No items found",
  className,
}: ListDataWrapperProps<T>) {
  return (
    <DataFetchingWrapper
      data={items}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={(data) => data.length === 0}
      loadingComponent={
        <div className={className}>
          {Array.from({ length: loadingCount }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full mb-2" />
          ))}
        </div>
      }
      emptyComponent={
        <div className="text-center py-8">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      }
    >
      {(data) => (
        <div className={className}>
          {data.map((item, index) => (
            <div key={keyExtractor(item, index)}>{renderItem(item, index)}</div>
          ))}
        </div>
      )}
    </DataFetchingWrapper>
  );
}

interface PaginatedDataWrapperProps<T> extends ListDataWrapperProps<T> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

/**
 * Wrapper for paginated data with navigation controls
 */
export function PaginatedDataWrapper<T>({
  items,
  currentPage,
  totalPages,
  onPageChange,
  hasNextPage,
  hasPreviousPage,
  ...listProps
}: PaginatedDataWrapperProps<T>) {
  const canGoPrevious = hasPreviousPage ?? currentPage > 1;
  const canGoNext = hasNextPage ?? currentPage < totalPages;

  return (
    <div>
      <ListDataWrapper items={items} {...listProps} />

      {items && items.length > 0 && totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <Button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>

          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            variant="outline"
            size="sm"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
