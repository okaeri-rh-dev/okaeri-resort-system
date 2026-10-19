import type { StatusTone } from "@/components/patterns";

// Booking, payment and cabin statuses share one pill vocabulary (DESIGN.md, Colour)
const tonesByStatus: Record<string, StatusTone> = {
  confirmed: "success",
  checkedin: "success",
  paid: "success",
  completed: "success",
  available: "success",
  pending: "warning",
  partial: "warning",
  reserved: "warning",
  cancelled: "danger",
  refunded: "danger",
  maintenance: "danger",
  checkedout: "neutral",
  occupied: "neutral",
};

/** The `StatusBadge` tone for a booking, payment or cabin status. Unknown statuses are neutral. */
export function statusTone(status: string): StatusTone {
  return tonesByStatus[status.toLowerCase()] ?? "neutral";
}
