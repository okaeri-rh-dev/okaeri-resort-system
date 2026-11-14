import { StatusBadge } from "@/components/patterns";
import type { BookingSource } from "@/lib/bookings";
import { sourceTone } from "@/lib/status-tone";

/** One badge for Walk-in, Airbnb and Website bookings; Direct shows none. */
export function SourceBadge({ source }: { source: BookingSource | undefined }) {
  const tone = source && sourceTone(source);
  return tone ? <StatusBadge tone={tone}>{source}</StatusBadge> : null;
}
