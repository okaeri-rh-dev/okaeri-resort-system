import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Environment type
interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
}

/**
 * Scheduled cleanup for expired guest booking uploads
 * Run hourly via Cloudflare Scheduled Triggers
 *
 * Removes bookings where:
 * - is_guest_booking = true
 * - booking_status = 'Pending'
 * - upload_status = null or 'pending'
 * - created_at > 90 minutes ago
 */
export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;

  try {
    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin(env);

    // Find expired uploads (1 hour upload window + 30 min buffer = 90 minutes)
    const expiryTime = new Date(Date.now() - 90 * 60 * 1000).toISOString();

    const { data: expiredBookings, error } = await supabaseAdmin
      .from("bookings")
      .select("booking_id, payment_proof_url")
      .eq("is_guest_booking", true)
      .eq("booking_status", "Pending")
      .or("upload_status.is.null,upload_status.eq.pending")
      .lt("created_at", expiryTime);

    if (error) {
      console.error("Failed to fetch expired bookings:", error);
      return new Response(JSON.stringify({ error: "Query failed", details: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No expired bookings found",
          count: 0,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Process cleanup
    const deleted = [];
    const failed = [];

    for (const booking of expiredBookings) {
      try {
        // Delete file if exists (best effort, don't fail if file doesn't exist)
        if (booking.payment_proof_url) {
          await supabaseAdmin.storage
            .from("payment-proofs")
            .remove([booking.payment_proof_url])
            .catch((err) => {
              console.warn(`Failed to delete file for booking ${booking.booking_id}:`, err.message);
            });
        }

        // Delete booking record
        const { error: deleteError } = await supabaseAdmin
          .from("bookings")
          .delete()
          .eq("booking_id", booking.booking_id);

        if (deleteError) {
          console.error(`Failed to delete booking ${booking.booking_id}:`, deleteError);
          failed.push(booking.booking_id);
        } else {
          deleted.push(booking.booking_id);
        }
      } catch (err) {
        console.error(`Error processing booking ${booking.booking_id}:`, err);
        failed.push(booking.booking_id);
      }
    }

    // Log cleanup results
    const result = {
      message: "Cleanup completed",
      timestamp: new Date().toISOString(),
      expired: expiredBookings.length,
      deleted: deleted.length,
      failed: failed.length,
      details: {
        deleted_ids: deleted,
        failed_ids: failed,
      },
    };

    console.warn("Cleanup results:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Manual trigger for cleanup (for testing)
 * Can be called via POST request with admin authentication
 */
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  // You could add admin authentication here
  // For now, just run the same cleanup logic
  return onRequestGet(context);
}
