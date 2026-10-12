import {
  E2E_BOOKINGS,
  E2E_GUEST,
  E2E_PAYMENT_PROOF_BUCKET,
  E2E_PAYMENT_PROOF_PATHS,
  E2E_REFERENCE_PREFIX,
  E2E_UNIT,
  E2E_USER,
} from "./fixtures";
import { getServiceRoleClient } from "./supabase-client";

type Supabase = ReturnType<typeof getServiceRoleClient>;

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

async function findUserIdByEmail(supabase: Supabase, email: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`auth.listUsers failed: ${error.message}`);
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function ensureE2EUser(supabase: Supabase): Promise<string> {
  const existing = await findUserIdByEmail(supabase, E2E_USER.email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email: E2E_USER.email,
    password: E2E_USER.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`auth.admin.createUser failed: ${error?.message ?? "no user returned"}`);
  }
  return data.user.id;
}

async function clearExistingE2E(supabase: Supabase): Promise<void> {
  // Order matters for FK constraints. Delete-then-insert avoids upsert/audit
  // trigger interactions that fire on UPDATE.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_id")
    .like("booking_reference", `${E2E_REFERENCE_PREFIX}%`);
  const bookingIds = bookings?.map((b) => b.booking_id) ?? [];

  if (bookingIds.length > 0) {
    await supabase.from("booking_units").delete().in("booking_id", bookingIds);
    await supabase.from("bookings").delete().in("booking_id", bookingIds);
  }
  await supabase.from("units").delete().eq("unit_id", E2E_UNIT.unit_id);
  await supabase.from("guests").delete().eq("guest_id", E2E_GUEST.guest_id);
}

async function uploadPaymentProofs(supabase: Supabase): Promise<void> {
  for (const path of E2E_PAYMENT_PROOF_PATHS) {
    const { error } = await supabase.storage
      .from(E2E_PAYMENT_PROOF_BUCKET)
      .upload(path, ONE_PIXEL_PNG, { upsert: true, contentType: "image/png" });
    if (error) throw new Error(`payment proof upload (${path}) failed: ${error.message}`);
  }
}

async function seed(): Promise<void> {
  const supabase = getServiceRoleClient();

  const userId = await ensureE2EUser(supabase);
  const { error: roleError } = await supabase.from("app_roles").upsert(
    {
      user_id: userId,
      email: E2E_USER.email,
      role: E2E_USER.role,
      is_active: true,
      notes: "E2E test user — managed by scripts/e2e",
    },
    { onConflict: "user_id" }
  );
  if (roleError) throw new Error(`app_roles upsert failed: ${roleError.message}`);

  await clearExistingE2E(supabase);

  const { error: guestError } = await supabase.from("guests").insert(E2E_GUEST);
  if (guestError) throw new Error(`guests insert failed: ${guestError.message}`);

  const { error: unitError } = await supabase.from("units").insert(E2E_UNIT);
  if (unitError) throw new Error(`units insert failed: ${unitError.message}`);

  // Cancelled bookings keep guest_id NULL so update_guest_statistics
  // doesn't run for them (their guest stats would be no-ops anyway).
  const bookingRows = E2E_BOOKINGS.map(({ awaiting_unit_assignment, ...b }) => ({
    ...b,
    guest_id: b.booking_status === "Cancelled" ? null : E2E_GUEST.guest_id,
    guest_name: E2E_GUEST.guest_name,
    contact_number: E2E_GUEST.phone_number,
    email: E2E_GUEST.email,
    is_walk_in: false,
    is_multi_unit: Boolean(awaiting_unit_assignment),
    ...(awaiting_unit_assignment && {
      is_guest_booking: true,
      unit_assignment_status: "pending",
    }),
  }));

  const { data: insertedBookings, error: bookingError } = await supabase
    .from("bookings")
    .insert(bookingRows)
    .select("booking_id, booking_reference");

  if (bookingError || !insertedBookings) {
    throw new Error(`bookings insert failed: ${bookingError?.message ?? "no rows returned"}`);
  }

  const fixtureFor = (reference: string) =>
    E2E_BOOKINGS.find((f) => f.booking_reference === reference)!;
  const queuedBookings = insertedBookings.filter(
    (b) => fixtureFor(b.booking_reference).awaiting_unit_assignment
  );
  const assignedBookings = insertedBookings.filter(
    (b) => !fixtureFor(b.booking_reference).awaiting_unit_assignment
  );

  const bookingUnitRows = assignedBookings.map((b) => {
    const fixture = fixtureFor(b.booking_reference);
    return {
      booking_id: b.booking_id,
      unit_id: E2E_UNIT.unit_id,
      subtotal: fixture.total_amount,
      unit_price: fixture.total_amount,
      assigned_guests: fixture.num_guests,
      check_in_date: fixture.check_in,
      check_out_date: fixture.check_out,
      status: fixture.booking_status,
    };
  });

  const { error: buError } = await supabase.from("booking_units").insert(bookingUnitRows);
  if (buError) {
    throw new Error(`booking_units insert failed: ${buError.message}`);
  }

  const unitRequestRows = queuedBookings.map((b) => ({
    booking_id: b.booking_id,
    unit_type: E2E_UNIT.unit_type,
    quantity: 2,
    guests_per_unit: 2,
  }));
  const { error: requestError } = await supabase
    .from("guest_booking_unit_requests")
    .insert(unitRequestRows);
  if (requestError) {
    throw new Error(`guest_booking_unit_requests insert failed: ${requestError.message}`);
  }

  await uploadPaymentProofs(supabase);

  console.log(
    `✓ Seeded 1 user (${E2E_USER.email}), 1 guest, 1 unit, ${insertedBookings.length} bookings (prefix ${E2E_REFERENCE_PREFIX}*), ${E2E_PAYMENT_PROOF_PATHS.length} payment proof(s).`
  );
}

seed().catch((err) => {
  console.error("✗ Seed failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
