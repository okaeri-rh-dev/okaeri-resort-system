import type { SupabaseClient } from "@supabase/supabase-js";

import { uploadPaymentProof } from "@/lib/storage-security";
import { toManilaDateString } from "@/lib/timezone";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database.types";
import { formDateToUTC } from "@/utils/date-helpers";

// Booking payment status is derived by the database from these rows (docs/adr/0001).

type Client = SupabaseClient<Database>;
export type PaymentRow = Tables<"payments">;

export interface PaymentInput {
  booking_id: string;
  account_id?: string | null;
  amount: number;
  payment_method: string;
  /** The calendar day picked; stored as that Manila day at noon. */
  payment_date: Date;
  notes?: string | null;
}

export type PaymentChanges = Partial<PaymentInput> & { proof_url?: string | null };

type Result<T> = { data: T | null; error: { message: string } | null };

function rowFrom<T>({ data, error }: Result<T>): NonNullable<T> {
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error("The payment was not returned");
  return data;
}

const toPaymentDateColumn = (day: Date) => formDateToUTC(day, "12:00");

export async function createPayment(
  client: Client,
  input: PaymentInput,
  proofFile?: File
): Promise<PaymentRow> {
  const proof = proofFile ? await uploadPaymentProof(proofFile, input.booking_id, client) : null;

  return rowFrom(
    await client
      .from("payments")
      .insert({
        booking_id: input.booking_id,
        account_id: input.account_id ?? null,
        amount: input.amount,
        payment_method: input.payment_method,
        payment_date: toPaymentDateColumn(input.payment_date),
        notes: input.notes ?? null,
        proof_url: proof?.url ?? null,
      } satisfies TablesInsert<"payments">)
      .select()
      .single()
  );
}

export async function updatePayment(
  client: Client,
  paymentId: string,
  changes: PaymentChanges,
  proofFile?: File
): Promise<PaymentRow> {
  const { payment_date, ...columns } = changes;
  const update: TablesUpdate<"payments"> = { ...columns };

  if (payment_date) update.payment_date = toPaymentDateColumn(payment_date);

  if (proofFile) {
    const bookingId = changes.booking_id ?? (await bookingIdOf(client, paymentId));
    update.proof_url = (await uploadPaymentProof(proofFile, bookingId, client)).url;
  }

  return rowFrom(
    await client.from("payments").update(update).eq("payment_id", paymentId).select().single()
  );
}

export async function softDeletePayment(client: Client, paymentId: string): Promise<void> {
  const { error } = await client
    .from("payments")
    .update({ status: "Deleted" } satisfies TablesUpdate<"payments">)
    .eq("payment_id", paymentId);
  if (error) throw new Error(error.message);
}

export async function appendVerificationNote(
  client: Client,
  paymentId: string,
  verifiedBy: string,
  verifiedAt: Date = new Date()
): Promise<PaymentRow> {
  const { notes } = rowFrom(
    await client.from("payments").select("notes").eq("payment_id", paymentId).single()
  );
  const line = `Verified by ${verifiedBy} on ${toManilaDateString(verifiedAt)}`;

  return updatePayment(client, paymentId, { notes: notes ? `${notes}\n${line}` : line });
}

/** Proof that the guest paid the rest: records the outstanding balance with the proof. */
export async function recordProofPayment(
  client: Client,
  bookingId: string,
  proofFile: File
): Promise<PaymentRow> {
  const outstanding = await outstandingBalanceOf(client, bookingId);
  if (outstanding <= 0) throw new Error("This booking is already fully paid.");

  return createPayment(
    client,
    {
      booking_id: bookingId,
      amount: outstanding,
      payment_method: "Other",
      payment_date: new Date(),
    },
    proofFile
  );
}

async function bookingIdOf(client: Client, paymentId: string): Promise<string> {
  const { booking_id } = rowFrom(
    await client.from("payments").select("booking_id").eq("payment_id", paymentId).single()
  );
  if (!booking_id) throw new Error("The payment has no booking to file its proof under");
  return booking_id;
}

async function outstandingBalanceOf(client: Client, bookingId: string): Promise<number> {
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("total_amount")
    .eq("booking_id", bookingId)
    .single();
  if (bookingError) throw new Error(bookingError.message);
  const { data: payments, error } = await client
    .from("payments")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("status", "Active");
  if (error) throw new Error(error.message);

  const paid = (payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
  return booking.total_amount - paid;
}
