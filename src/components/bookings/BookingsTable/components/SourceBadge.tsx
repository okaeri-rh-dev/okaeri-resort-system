import { StatusBadge, type StatusTone } from "@/components/patterns";

const SOURCE_TONES: Record<string, StatusTone> = {
  "Walk-in": "warning",
  Airbnb: "info",
  Website: "neutral",
};

/** One badge for Walk-in, Airbnb and Website bookings; Direct shows none. */
export function SourceBadge({ source }: { source: string | undefined }) {
  const tone = source && SOURCE_TONES[source];
  return tone ? <StatusBadge tone={tone}>{source}</StatusBadge> : null;
}
