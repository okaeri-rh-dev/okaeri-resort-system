import { E2E_GUEST_ID, E2E_REFERENCE_PREFIX, E2E_UNIT_ID, E2E_USER } from "./fixtures";
import { getServiceRoleClient } from "./supabase-client";

type Supabase = ReturnType<typeof getServiceRoleClient>;

async function findUserIdByEmail(supabase: Supabase, email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`auth.listUsers failed: ${error.message}`);
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function cleanup(): Promise<void> {
  const supabase = getServiceRoleClient();

  // Find E2E booking IDs first; cascading deletes need them.
  const { data: bookings, error: bookingsLookupError } = await supabase
    .from("bookings")
    .select("booking_id")
    .like("booking_reference", `${E2E_REFERENCE_PREFIX}%`);
  if (bookingsLookupError) {
    throw new Error(`bookings lookup failed: ${bookingsLookupError.message}`);
  }
  const bookingIds = bookings?.map((b) => b.booking_id) ?? [];

  const summary: Record<string, number> = {};

  if (bookingIds.length > 0) {
    // Payments first (tolerate missing table).
    const { count: payCount, error: payError } = await supabase
      .from("payments")
      .delete({ count: "exact" })
      .in("booking_id", bookingIds);
    if (payError && !/relation .* does not exist/.test(payError.message)) {
      console.warn(`! payments delete: ${payError.message}`);
    }
    summary.payments = payCount ?? 0;

    // Delete bookings one-at-a-time. FK ON DELETE CASCADE handles
    // booking_units. Going one row at a time avoids the same multi-row
    // trigger-cascade-with-empty-changed-fields pitfall that bites seed.
    let bookingCount = 0;
    for (const id of bookingIds) {
      const { error: bErr } = await supabase.from("bookings").delete().eq("booking_id", id);
      if (bErr) {
        console.warn(`! booking ${id} delete: ${bErr.message}`);
      } else {
        bookingCount += 1;
      }
    }
    summary.bookings = bookingCount;
  } else {
    summary.bookings = 0;
    summary.payments = 0;
  }

  // unit (by static id)
  const { count: unitCount } = await supabase
    .from("units")
    .delete({ count: "exact" })
    .eq("unit_id", E2E_UNIT_ID);
  summary.units = unitCount ?? 0;

  // guest (by static id)
  const { count: guestCount } = await supabase
    .from("guests")
    .delete({ count: "exact" })
    .eq("guest_id", E2E_GUEST_ID);
  summary.guests = guestCount ?? 0;

  // app_roles + auth user
  const userId = await findUserIdByEmail(supabase, E2E_USER.email);
  if (userId) {
    const { count: roleCount } = await supabase
      .from("app_roles")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    summary.app_roles = roleCount ?? 0;

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    summary.auth_users = deleteUserError ? 0 : 1;
    if (deleteUserError) {
      console.warn(`! could not delete auth user: ${deleteUserError.message}`);
    }
  } else {
    summary.app_roles = 0;
    summary.auth_users = 0;
  }

  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const breakdown = Object.entries(summary)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}:${n}`)
    .join(" ");
  console.log(
    `✓ Cleaned ${total} E2E row${total === 1 ? "" : "s"}${breakdown ? ` (${breakdown})` : ""}.`
  );
}

cleanup().catch((err) => {
  console.error("✗ Cleanup failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
