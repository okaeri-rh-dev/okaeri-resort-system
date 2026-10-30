/**
 * Admin API: Pending Bookings Queue
 *
 * GET /api/admin/pending-bookings
 *
 * Fetches all pending guest bookings with urgency scoring
 *
 * Authentication: JWT required (admin role)
 * Source: vault note [[04-admin-interface]]
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { calculateUrgencyScore, getUrgencyLevel } from "../../../src/lib/urgency-scoring";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ============================================
// Main Handler
// ============================================

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Only accept GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ============================================
    // Authentication Check
    // ============================================
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - Missing or invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);

    // Create Supabase client with service role
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    // Verify JWT and extract user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Phase 1: All authenticated users have admin access (checked in middleware)
    // Phase 2: TODO - Role verification will be handled by _middleware.ts

    // ============================================
    // Fetch Pending Bookings
    // ============================================
    const { data: bookings, error: queryError } = await supabase
      .from("bookings")
      .select(
        `
        booking_id,
        booking_reference,
        guest_name,
        contact_number,
        email,
        check_in,
        check_out,
        total_amount,
        payment_status,
        created_at,
        guest_booking_unit_requests (
          id,
          guests_per_unit
        )
      `
      )
      .eq("is_guest_booking", true)
      .eq("unit_assignment_status", "pending")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Database query error:", queryError);

      // Check if this is a missing column/relation error (migration not applied)
      const errorMessage = queryError.message || "";
      const isMigrationError =
        errorMessage.includes("column") ||
        errorMessage.includes("does not exist") ||
        errorMessage.includes("relation") ||
        errorMessage.includes("guest_booking_unit_requests");

      return new Response(
        JSON.stringify({
          error: isMigrationError
            ? "Multi-unit booking feature not yet configured"
            : "Failed to fetch bookings",
          details: queryError.message,
          hint: isMigrationError
            ? "Database migration 021 (multi_unit_guest_booking_schema) may not be applied to production"
            : undefined,
        }),
        {
          status: isMigrationError ? 503 : 500, // 503 Service Unavailable for migration issues
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // Apply Urgency Scoring
    // ============================================
    const bookingsWithUrgency = (bookings || []).map((booking) => {
      const requested_unit_count = booking.guest_booking_unit_requests?.length || 0;

      const urgency_score = calculateUrgencyScore({
        check_in_date: booking.check_in, // Map DB column to expected parameter name
        created_at: booking.created_at,
        total_amount: booking.total_amount,
        requested_unit_count,
      });

      const urgency_level = getUrgencyLevel(urgency_score);

      return {
        booking_id: booking.booking_id,
        booking_reference: booking.booking_reference,
        guest_name: booking.guest_name,
        guest_contact: booking.email || booking.contact_number, // Combine for frontend compatibility
        check_in_date: booking.check_in, // Map DB column to frontend expectation
        check_out_date: booking.check_out, // Map DB column to frontend expectation
        requested_unit_count,
        total_amount: booking.total_amount,
        payment_status: booking.payment_status,
        urgency_score,
        urgency_level,
        created_at: booking.created_at,
      };
    });

    // Sort by urgency score (highest first)
    bookingsWithUrgency.sort((a, b) => b.urgency_score - a.urgency_score);

    // ============================================
    // Return Response
    // ============================================
    return new Response(
      JSON.stringify({
        bookings: bookingsWithUrgency,
        count: bookingsWithUrgency.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
