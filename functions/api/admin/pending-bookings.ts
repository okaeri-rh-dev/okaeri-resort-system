/**
 * Admin API: Pending Bookings Queue
 *
 * GET /api/admin/pending-bookings
 *
 * Fetches all pending multi-unit bookings with urgency scoring
 *
 * Authentication: JWT required (admin role)
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 150-167
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { calculateUrgencyScore, getUrgencyLevel } from "../../../src/lib/urgency-scoring";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================
// Main Handler
// ============================================

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);

    // Create Supabase client with service role
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role (assuming role stored in user metadata)
    const userRole = user.user_metadata?.role || user.app_metadata?.role;
    if (userRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        guest_contact,
        check_in_date,
        check_out_date,
        total_amount,
        payment_status,
        created_at,
        guest_booking_unit_requests (
          id,
          guests_per_unit
        )
      `
      )
      .eq("is_multi_unit", true)
      .eq("is_guest_booking", true)
      .eq("unit_assignment_status", "pending")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Database query error:", queryError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch bookings",
          details: queryError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // Apply Urgency Scoring
    // ============================================
    const bookingsWithUrgency = (bookings || []).map((booking) => {
      const requested_unit_count = booking.guest_booking_unit_requests?.length || 0;

      const urgency_score = calculateUrgencyScore({
        check_in_date: booking.check_in_date,
        created_at: booking.created_at,
        total_amount: booking.total_amount,
        requested_unit_count,
      });

      const urgency_level = getUrgencyLevel(urgency_score);

      return {
        booking_id: booking.booking_id,
        booking_reference: booking.booking_reference,
        guest_name: booking.guest_name,
        guest_contact: booking.guest_contact,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
