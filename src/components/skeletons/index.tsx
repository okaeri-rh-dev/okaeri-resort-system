import React from "react";

import {
  AvatarSkeleton,
  ButtonSkeleton,
  KPICardSkeleton,
  MobileCardSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ============================================
// BOOKINGS TABLE SKELETONS
// ============================================

interface BookingsTableSkeletonProps {
  isMobile?: boolean;
  rows?: number;
  className?: string;
}

export const BookingsTableSkeleton: React.FC<BookingsTableSkeletonProps> = ({
  isMobile = false,
  rows = 8,
  className,
}) => {
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile search and filters skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="flex space-x-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <ButtonSkeleton size="sm" className="w-20" />
              <ButtonSkeleton size="sm" className="w-24" />
            </div>
            <ButtonSkeleton size="sm" className="w-16" />
          </div>
        </div>

        {/* Mobile cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <MobileCardSkeleton key={index} hasActions={true} rowCount={5} />
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center space-x-2">
            <ButtonSkeleton size="sm" className="h-8 w-8" />
            <div className="flex space-x-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <ButtonSkeleton key={i} size="sm" className="h-8 w-8" />
              ))}
            </div>
            <ButtonSkeleton size="sm" className="h-8 w-8" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop filters skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center space-x-3">
          <Skeleton className="h-9 w-48" />
          <ButtonSkeleton size="sm" className="w-16" />
          <ButtonSkeleton size="sm" className="w-20" />
          <ButtonSkeleton size="sm" className="w-16" />
          <ButtonSkeleton size="sm" className="w-24" />
        </div>
        <ButtonSkeleton size="sm" className="w-24" />
      </div>

      {/* Desktop table skeleton */}
      <TableSkeleton
        rows={rows}
        columns={[120, 200, 120, 100, 80, 120, 100, 100, 80]}
        hasHeader={true}
        showActions={true}
        className={className}
      />

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center space-x-2">
          <ButtonSkeleton size="sm" className="h-8 w-8" />
          <div className="flex space-x-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <ButtonSkeleton key={i} size="sm" className="h-8 w-8" />
            ))}
          </div>
          <ButtonSkeleton size="sm" className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
};

// ============================================
// UNITS TABLE SKELETONS
// ============================================

interface UnitsTableSkeletonProps {
  isMobile?: boolean;
  viewMode?: "list" | "grid";
  rows?: number;
  className?: string;
}

export const UnitsTableSkeleton: React.FC<UnitsTableSkeletonProps> = ({
  isMobile = false,
  viewMode = "list",
  rows = 6,
  className,
}) => {
  if (isMobile || viewMode === "grid") {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile/Grid filters skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="flex space-x-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 flex-1" />
          </div>
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <ButtonSkeleton size="sm" className="w-20" />
              <ButtonSkeleton size="sm" className="w-24" />
            </div>
            <ButtonSkeleton size="sm" className="w-16" />
          </div>
        </div>

        {/* Grid cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
            >
              {/* Header with checkbox */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton variant="sharp" className="h-4 w-4" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                </div>
                <Skeleton variant="rounded" className="h-6 w-20" />
              </div>

              {/* Content rows */}
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex space-x-2 border-t border-neutral-100 pt-3">
                <ButtonSkeleton size="sm" className="flex-1" />
                <ButtonSkeleton size="sm" variant="outline" className="flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop filters skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Skeleton className="h-9 w-48" />
          <ButtonSkeleton size="sm" className="w-16" />
          <ButtonSkeleton size="sm" className="w-12" />
          <ButtonSkeleton size="sm" className="w-24" />
        </div>

        <div className="flex items-center space-x-2">
          <Skeleton className="h-4 w-20" />
          <ButtonSkeleton size="sm" className="w-32" />
          <ButtonSkeleton size="sm" className="w-20" />
          <ButtonSkeleton size="sm" className="w-24" />
        </div>
      </div>

      {/* Desktop table skeleton with checkbox column */}
      <TableSkeleton
        rows={rows}
        columns={[50, 100, 200, 100, 120, 120, 100, 100, 80]}
        hasHeader={true}
        showCheckbox={true}
        showActions={true}
        className={className}
      />
    </div>
  );
};

// ============================================
// GUESTS TABLE SKELETONS
// ============================================

interface GuestsTableSkeletonProps {
  isMobile?: boolean;
  rows?: number;
  className?: string;
}

export const GuestsTableSkeleton: React.FC<GuestsTableSkeletonProps> = ({
  isMobile = false,
  rows = 6,
  className,
}) => {
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile search skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <div className="flex justify-between">
            <ButtonSkeleton size="sm" className="w-24" />
            <ButtonSkeleton size="sm" className="w-16" />
          </div>
        </div>

        {/* Mobile guest cards */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
            >
              {/* Guest header with avatar */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <AvatarSkeleton size="md" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <Skeleton variant="rounded" className="h-5 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>

              {/* Expandable booking history placeholder */}
              <div className="border-t border-neutral-100 pt-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton variant="circle" className="h-4 w-4" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <ButtonSkeleton size="sm" className="flex-1" />
                <ButtonSkeleton size="sm" variant="outline" className="flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop search and filters */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <ButtonSkeleton size="sm" className="w-20" />
      </div>

      {/* Desktop table skeleton */}
      <TableSkeleton
        rows={rows}
        columns={[200, 150, 120, 100, 100, 80]}
        hasHeader={true}
        showActions={true}
        className={className}
      />
    </div>
  );
};

// ============================================
// DASHBOARD STATS SKELETONS
// ============================================

interface DashboardStatsSkeletonProps {
  cardCount?: number;
  className?: string;
}

export const DashboardStatsSkeleton: React.FC<DashboardStatsSkeletonProps> = ({
  cardCount = 4,
  className,
}) => {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: cardCount }).map((_, index) => (
        <KPICardSkeleton
          key={index}
          hasIcon={true}
          className="border border-neutral-200 p-4 shadow-sm"
        />
      ))}
    </div>
  );
};

// ============================================
// BOOKING FORM SKELETONS
// ============================================

interface BookingFormSkeletonProps {
  currentStep?: number;
  className?: string;
}

export const BookingFormSkeleton: React.FC<BookingFormSkeletonProps> = ({
  currentStep = 1,
  className,
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Step progress indicator */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <React.Fragment key={index}>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2",
                  index < currentStep ? "border-blue-600 bg-blue-600" : "border-neutral-300"
                )}
              >
                {index < currentStep ? (
                  <div className="h-2 w-2 rounded-full bg-white" />
                ) : (
                  <Skeleton variant="circle" className="h-2 w-2" />
                )}
              </div>
              {index < 3 && (
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    index < currentStep - 1 ? "bg-blue-600" : "bg-neutral-300"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Form content based on step */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-18" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form actions */}
      <div className="flex justify-between pt-4">
        <ButtonSkeleton size="md" variant="outline" className="w-20" />
        <ButtonSkeleton size="md" className="w-24" />
      </div>
    </div>
  );
};

// ============================================
// EXPENSES TABLE SKELETONS
// ============================================

interface ExpensesTableSkeletonProps {
  isMobile?: boolean;
  rows?: number;
  className?: string;
}

export const ExpensesTableSkeleton: React.FC<ExpensesTableSkeletonProps> = ({
  isMobile = false,
  rows = 8,
  className,
}) => {
  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile filters skeleton */}
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <ButtonSkeleton size="sm" className="w-16" />
              <ButtonSkeleton size="sm" className="w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>

        {/* Mobile cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <MobileCardSkeleton key={index} hasActions={true} rowCount={4} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop filters skeleton - nested card structure */}
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <ButtonSkeleton size="sm" className="h-8 w-16" />
            <ButtonSkeleton size="sm" className="h-8 w-24" />
          </div>
        </div>
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>

      {/* Desktop table skeleton - nested card structure */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <TableSkeleton
          rows={rows}
          columns={[120, 180, 300, 120, 80, 80]}
          hasHeader={true}
          showActions={true}
          className="border-0"
        />

        {/* Pagination skeleton */}
        <div className="border-t border-neutral-200 bg-neutral-50/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center space-x-2">
              <ButtonSkeleton size="sm" className="h-8 w-8" />
              <div className="flex space-x-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ButtonSkeleton key={i} size="sm" className="h-8 w-8" />
                ))}
              </div>
              <ButtonSkeleton size="sm" className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// COMPONENT-SPECIFIC EXPORTS
// ============================================

export {
  // Generic skeletons
  Skeleton,
  AvatarSkeleton,
  ButtonSkeleton,
  KPICardSkeleton,
  TableSkeleton,
  MobileCardSkeleton,
};
