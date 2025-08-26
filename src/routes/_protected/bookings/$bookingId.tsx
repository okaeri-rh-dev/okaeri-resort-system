import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { queryClient } from "@/lib/query-client";
import { BookingDetailPage } from "@/pages/BookingDetailPage";
import {
  PrefetchManager,
  RouteErrorBoundary,
  RouteLoadingFallback,
  createRouteLoader,
  requireActiveProject,
} from "@/lib/route-utils";
import {
  BookingParamsSchema,
  BookingSearchSchema,
  type BookingParams,
  type BookingSearchParams,
  validateSearchParams,
  validateRouteParams,
} from "@/types/route-params";

// Initialize prefetch manager
const prefetcher = new PrefetchManager(queryClient);

// Enhanced booking detail loader with comprehensive prefetching
const bookingDetailLoader = createRouteLoader<{
  params: BookingParams;
  search: BookingSearchParams;
}>(async ({ params, search }) => {
  const projectId = requireActiveProject();
  const { bookingId } = validateRouteParams(BookingParamsSchema, params);
  const searchParams = validateSearchParams(BookingSearchSchema, search);

  // Prefetch booking details and related data
  await prefetcher.prefetchBooking(projectId, bookingId);

  return { projectId, bookingId, searchParams };
});

export const Route = createFileRoute("/_protected/bookings/$bookingId")({
  parseParams: (params) => ({
    bookingId: params.bookingId as string,
  }),

  validateSearch: BookingSearchSchema,

  beforeLoad: ({ params, search }) => {
    // Validate route and search parameters early
    const validatedParams = validateRouteParams(BookingParamsSchema, params);
    const validatedSearch = validateSearchParams(BookingSearchSchema, search);
    return { validatedParams, validatedSearch };
  },

  loader: bookingDetailLoader,

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      info={{ componentStack: "Booking Detail Route" }}
    />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading booking details..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading booking..." />}>
      <BookingDetailPage />
    </Suspense>
  ),
});
