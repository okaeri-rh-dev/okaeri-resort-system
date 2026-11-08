import { Skeleton } from "@/components/patterns";
import { getTodayPhilippineTime } from "@/lib/timezone";

/** Stands in for `PublicAvailabilityCalendar` while its code loads, with the same weeks it opens on. */
export function CalendarSkeleton() {
  const today = getTodayPhilippineTime();
  const leadingDays = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  return (
    <section
      role="status"
      aria-label="Loading availability calendar"
      className="border-border bg-card @container overflow-hidden rounded-lg border"
    >
      <div aria-hidden="true">
        <div className="border-border bg-card border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <Skeleton className="size-8" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="size-8" />
          </div>
          <Skeleton className="mt-1.5 h-7 w-full" />
        </div>

        <div className="border-border border-b px-4 py-2">
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>

        <div className="p-2 @lg:p-3">
          <div className="mb-1 grid grid-cols-7 gap-1 @lg:mb-2 @lg:gap-2">
            {Array.from({ length: 7 }, (_, weekday) => (
              <div key={weekday} className="flex justify-center py-1 @lg:py-2">
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 @lg:gap-2">
            {Array.from({ length: dayCount }, (_, day) => (
              <Skeleton
                key={day}
                data-slot="day"
                className="min-h-12 rounded @lg:min-h-13 @2xl:min-h-15 @3xl:min-h-16"
              />
            ))}
          </div>
        </div>

        <div className="border-border bg-muted flex justify-center border-t px-4 py-2">
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    </section>
  );
}
