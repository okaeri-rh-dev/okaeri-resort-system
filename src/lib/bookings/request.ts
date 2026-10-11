import { supabase } from "@/lib/supabase";
import type { AdminMultiUnitBookingCreate, MultiUnitBooking } from "@/types";

// Browser only. Creates through the Worker: server price, availability re-check, availability row.

type RouteResponse =
  | { success: true; data: MultiUnitBooking }
  | { success: false; error: { code: string; message: string } };

export async function requestBooking(
  booking: AdminMultiUnitBookingCreate
): Promise<MultiUnitBooking> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch("/api/bookings/multi-unit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
    },
    body: JSON.stringify(booking),
  });
  const body = (await response.json().catch(() => null)) as RouteResponse | null;

  if (body?.success) return body.data;
  throw new Error(body?.error.message ?? "Failed to create booking");
}
