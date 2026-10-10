/**
 * Multi-Unit Booking Creation Endpoint
 *
 * POST /api/bookings/multi-unit
 *
 * Creates a new booking with 1+ units in a single atomic transaction.
 * Implements idempotency, validation, sanitization, and audit logging.
 *
 * Phase 2B: Core Booking Operations
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/types/database.types";

import {
  sanitizeEmailWorker,
  sanitizeNameWorker,
  sanitizePhoneWorker,
  sanitizeTextWorker,
} from "../../../src/lib/security/sanitize-worker";
import { logBookingCreated } from "../../lib/audit-logger-workers";
import { requireRole, STAFF_OR_ABOVE, UnauthorizedError } from "../../lib/rbac";
import type { AuthenticatedRequest } from "../../lib/types";
import { calculateUnitPricing } from "../../lib/unit-pricing";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

// Validation schema (from spec lines 510-548)
const multiUnitBookingSchema = z
  .object({
    primary_guest: z.object({
      guest_name: z.string().min(2).max(100),
      email: z
        .string()
        .default("")
        .refine(
          (val) => val === "" || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val),
          "Invalid email address"
        ),
      contact_number: z
        .string()
        .default("")
        .refine(
          (val) => val === "" || /^[+]?[0-9\s\-()]{10,20}$/.test(val),
          "Invalid contact number"
        ),
      guest_id: z.string().uuid().optional(),
    }),
    check_in: z.string().datetime(),
    check_out: z.string().datetime(),
    units: z
      .array(
        z.object({
          unit_id: z.string().uuid(),
          num_guests: z.number().int().min(1).max(20),
          guest_assignment: z
            .object({
              guest_ids: z.array(z.string().uuid()),
              guest_names: z.array(z.string()).optional(),
            })
            .optional(),
          unit_notes: z.string().max(500).optional(),
        })
      )
      .min(1)
      .max(10), // Allow 1-10 units per booking
    payment: z.object({
      method: z.enum(["Cash", "GCash", "BankTransfer", "CreditCard"]),
      amount: z.number().positive(),
      proof_url: z.string().url().optional(),
    }),
    special_requests: z.string().max(1000).optional(),
    internal_notes: z.string().max(1000).optional(),
    is_walk_in: z.boolean().optional().default(false),
    source: z.enum(["web", "mobile", "admin"]).optional(),
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

type MultiUnitBookingRequest = z.infer<typeof multiUnitBookingSchema>;

/**
 * Main handler for multi-unit booking creation
 */
export const onRequestPost = async (context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}): Promise<Response> => {
  const { request, env, waitUntil } = context;
  const startTime = Date.now();

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key",
  };

  try {
    try {
      requireRole(request, STAFF_OR_ABOVE);
    } catch (error) {
      const unauthenticated = error instanceof UnauthorizedError;
      return Response.json(
        {
          success: false,
          error: {
            code: unauthenticated ? "UNAUTHORIZED" : "FORBIDDEN",
            message: error instanceof Error ? error.message : "Access denied",
          },
        },
        {
          status: unauthenticated ? 401 : 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate request
    const rawData = await request.json();
    const validationResult = multiUnitBookingSchema.safeParse(rawData);

    if (!validationResult.success) {
      return Response.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: {
              validation_errors: validationResult.error.errors.map((err) => ({
                field: err.path.join("."),
                message: err.message,
              })),
            },
          },
        },
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = validationResult.data;

    // Check idempotency (from spec lines 367-396)
    const idempotencyKey = request.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      const cached = await env.RATE_LIMIT_KV.get(`idempotency:${idempotencyKey}`);
      if (cached) {
        // Return cached result (200, not 201)
        return Response.json(JSON.parse(cached), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Idempotency-Replay": "true",
          },
        });
      }
    }

    // Sanitize inputs (from spec lines 602-612)
    const sanitizedData = {
      ...data,
      primary_guest: {
        ...data.primary_guest,
        guest_name: sanitizeNameWorker(data.primary_guest.guest_name),
        email: sanitizeEmailWorker(data.primary_guest.email),
        contact_number: sanitizePhoneWorker(data.primary_guest.contact_number),
      },
      special_requests: data.special_requests
        ? sanitizeTextWorker(data.special_requests)
        : undefined,
      internal_notes: data.internal_notes ? sanitizeTextWorker(data.internal_notes) : undefined,
    };

    // Check availability for all units (from spec lines 615-637)
    const availabilityCheck = await checkMultiUnitAvailability(
      env,
      sanitizedData.units.map((u) => u.unit_id),
      sanitizedData.check_in,
      sanitizedData.check_out
    );

    const unavailableUnits = availabilityCheck.filter((u) => !u.is_available);
    if (unavailableUnits.length > 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNIT_UNAVAILABLE",
            message: "One or more units are not available for the selected dates",
            details: {
              unavailable_units: unavailableUnits.map((u) => u.unit_id),
            },
          },
        },
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create booking using database function (from spec lines 640-773)
    const booking = await createMultiUnitBooking(env, sanitizedData);

    // Get user ID from request context (if authenticated)
    const userId = (request as AuthenticatedRequest).user?.id;

    // Create Supabase client for audit logging
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Log audit event (Phase 4.5: Compliance requirement)
    await logBookingCreated(supabase, booking, userId, request);

    // ✅ Invalidate availability cache for booked units (Phase 4.5)
    // Use waitUntil to not block the response
    const cacheKeys = sanitizedData.units.map(
      (unit) => `availability:${unit.unit_id}:${sanitizedData.check_in}:${sanitizedData.check_out}`
    );

    waitUntil(
      Promise.all(cacheKeys.map((key) => env.RATE_LIMIT_KV.delete(key))).catch((error) => {
        console.error("Cache invalidation failed:", error);
      })
    );

    // Cache result for idempotency (24 hours)
    if (idempotencyKey) {
      await env.RATE_LIMIT_KV.put(
        `idempotency:${idempotencyKey}`,
        JSON.stringify({
          success: true,
          data: booking,
          metadata: {
            units_booked: sanitizedData.units.length,
            processing_time_ms: Date.now() - startTime,
          },
        }),
        { expirationTtl: 86400 } // 24 hours
      );
    }

    const processingTime = Date.now() - startTime;

    return Response.json(
      {
        success: true,
        data: booking,
        metadata: {
          units_booked: sanitizedData.units.length,
          processing_time_ms: processingTime,
        },
      },
      {
        status: 201,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Processing-Time": `${processingTime}ms`,
        },
      }
    );
  } catch (error) {
    if (error instanceof UnpricedBookingError) {
      return Response.json(
        {
          success: false,
          error: {
            code: "PRICING_UNAVAILABLE",
            message: "Could not price this booking. Check the unit and global rates.",
            details: { server_total: error.serverTotal },
          },
        },
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("Multi-unit booking creation failed:", error);

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create booking",
          details: process.env.NODE_ENV === "development" ? { error: String(error) } : undefined,
        },
      },
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

class UnpricedBookingError extends Error {
  constructor(readonly serverTotal: number) {
    super(`Server priced the booking at ${serverTotal}`);
    this.name = "UnpricedBookingError";
  }
}

/**
 * Check availability for multiple units
 */
async function checkMultiUnitAvailability(
  env: Env,
  unitIds: string[],
  checkIn: string,
  checkOut: string
): Promise<Array<{ unit_id: string; is_available: boolean }>> {
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.rpc("check_multi_unit_availability", {
    p_unit_ids: unitIds,
    p_check_in: checkIn,
    p_check_out: checkOut,
  });

  if (error) throw error;
  return data as Array<{ unit_id: string; is_available: boolean }>;
}

/**
 * Create multi-unit booking using database function
 */
async function createMultiUnitBooking(env: Env, data: MultiUnitBookingRequest) {
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Fetch global pricing config (primary rate source, matching client & pricing quote API)
  const { data: pricingConfig, error: pricingConfigError } = await supabase
    .from("pricing_config")
    .select("*")
    .eq("id", "default")
    .single();

  if (pricingConfigError) {
    console.warn(
      "[PRICING] Failed to fetch pricing_config, using unit rates:",
      pricingConfigError.message
    );
  }

  // Generate booking reference
  const { data: refData, error: refError } = await supabase.rpc("generate_booking_reference");

  if (refError) {
    console.error("Error generating booking reference:", refError.message);
  }

  const bookingReference = refData || `BK-${Date.now()}`;

  // ============================================================
  // BUG-001 FIX: Calculate pricing with validation and fallback
  // ============================================================
  // Previously: If unit rates were null, pricing was ₱0.00
  // Now: Uses default rates; a zero total is rejected with 422
  // ============================================================

  const unitsWithPricing = await Promise.all(
    data.units.map(async (unit) => {
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select("*")
        .eq("unit_id", unit.unit_id)
        .single();

      if (unitError || !unitData) {
        console.error("[PRICING] Unit fetch error:", { unit_id: unit.unit_id, error: unitError });
        throw new Error(`Unit not found: ${unit.unit_id}`);
      }

      const pricing = calculateUnitPricing(
        unitData,
        data.check_in,
        data.check_out,
        unit.num_guests,
        pricingConfig
      );

      // Log pricing details for debugging (use warn to comply with lint rules)
      console.warn("[PRICING] Unit pricing calculated:", {
        unit_id: unit.unit_id,
        unit_name: unitData.unit_name,
        num_guests: unit.num_guests,
        pricing: pricing,
        used_defaults: pricing.used_defaults,
      });

      return {
        unit_id: unit.unit_id,
        unit_price: pricing.unit_price,
        weekend_surcharge: pricing.weekend_surcharge,
        extra_person_charge: pricing.extra_person_charge,
        subtotal: pricing.subtotal,
        assigned_guests: unit.num_guests,
        unit_notes: unit.unit_notes,
      };
    })
  );

  // Calculate server total and compare with client amount
  const serverTotal = unitsWithPricing.reduce((sum, u) => sum + u.subtotal, 0);
  const clientTotal = data.payment.amount;

  // Log pricing comparison for debugging (use warn to comply with lint rules)
  console.warn("[PRICING] Total comparison:", {
    server_total: serverTotal,
    client_total: clientTotal,
    difference: Math.abs(serverTotal - clientTotal),
    units_count: data.units.length,
  });

  if (serverTotal <= 0) throw new UnpricedBookingError(serverTotal);

  // Call database function to create booking
  const { data: bookingId, error } = await supabase.rpc("create_multi_unit_booking", {
    p_booking_data: {
      booking_reference: bookingReference,
      guest_name: data.primary_guest.guest_name,
      contact_number: data.primary_guest.contact_number,
      email: data.primary_guest.email,
      check_in: data.check_in,
      check_out: data.check_out,
      num_guests: data.units.reduce((sum, u) => sum + u.num_guests, 0),
      special_requests: data.special_requests,
      internal_notes: data.internal_notes,
      is_walk_in: data.is_walk_in,
      booking_status: "Pending",
      payment_status: "Pending",
    },
    p_units: unitsWithPricing,
    p_guest_id: data.primary_guest.guest_id || undefined,
  });

  if (error) {
    throw error;
  }

  // Fetch created booking with units
  const { data: createdBooking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      `
      *,
      booking_units (
        *,
        unit:units (*)
      )
    `
    )
    .eq("booking_id", bookingId)
    .single();

  if (fetchError) throw fetchError;

  return createdBooking;
}
