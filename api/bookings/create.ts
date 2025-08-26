/**
 * Create booking API endpoint
 * POST /api/bookings/create
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  withErrorHandler,
  withMethod,
  withProject,
  withValidation,
  withAuditLog,
  compose,
} from "../_lib/middleware";
import {
  successResponse,
  ConflictError,
  NotFoundError,
  philippinePhoneSchema,
  pesoAmountSchema,
  type TenantContext,
} from "../_lib/types";
import { TenantQuery } from "../_lib/database";

// Request validation schema
const createBookingSchema = z.object({
  propertyId: z.string().uuid("Invalid property ID"),
  guestName: z.string().min(2, "Guest name is required"),
  guestEmail: z.string().email().optional(),
  guestPhone: philippinePhoneSchema.optional(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().min(1).max(20),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("PENDING"),
  source: z
    .enum([
      "DIRECT",
      "AIRBNB",
      "BOOKING_COM",
      "VRBO",
      "EXPEDIA",
      "WEBSITE",
      "PHONE",
      "WALK_IN",
      "OTHER",
    ])
    .default("DIRECT"),
  totalAmount: pesoAmountSchema,
  paidAmount: pesoAmountSchema.default(0),
  paymentMethod: z
    .enum([
      "CASH",
      "CREDIT_CARD",
      "DEBIT_CARD",
      "BANK_TRANSFER",
      "PAYPAL",
      "GCASH",
      "MAYA",
      "OTHER",
    ])
    .optional(),
  notes: z.string().optional(),
  specialRequests: z.string().optional(),
  sendConfirmation: z.boolean().default(false),
});

type CreateBookingRequest = z.infer<typeof createBookingSchema>;

async function handler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  const data = req.body as CreateBookingRequest;

  // Calculate nights
  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    throw new ConflictError("Check-out date must be after check-in date");
  }

  // Initialize tenant query
  const db = new TenantQuery(context!);

  // Start transaction
  const booking = await db.transaction(async (client) => {
    // Verify property exists and is available
    const propertyResult = await client.query(
      `SELECT id, name, status, capacity, base_rate 
       FROM properties 
       WHERE id = $1`,
      [data.propertyId]
    );

    if (propertyResult.rows.length === 0) {
      throw new NotFoundError("Property");
    }

    const property = propertyResult.rows[0];

    if (property.status !== "AVAILABLE") {
      throw new ConflictError("Property is not available");
    }

    if (data.guests > property.capacity) {
      throw new ConflictError(`Property capacity is ${property.capacity} guests`);
    }

    // Check for conflicting bookings
    const conflictResult = await client.query(
      `SELECT COUNT(*) as conflicts
       FROM bookings
       WHERE property_id = $1
         AND status IN ('CONFIRMED', 'CHECKED_IN')
         AND (
           (check_in <= $2 AND check_out > $2) OR
           (check_in < $3 AND check_out >= $3) OR
           (check_in >= $2 AND check_out <= $3)
         )`,
      [data.propertyId, data.checkIn, data.checkOut]
    );

    if (parseInt(conflictResult.rows[0].conflicts) > 0) {
      throw new ConflictError("Property is already booked for selected dates");
    }

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        property_id,
        guest_name,
        guest_email,
        guest_phone,
        check_in,
        check_out,
        nights,
        guests,
        status,
        source,
        total_amount,
        paid_amount,
        payment_status,
        payment_method,
        notes,
        special_requests,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        data.propertyId,
        data.guestName,
        data.guestEmail,
        data.guestPhone,
        data.checkIn,
        data.checkOut,
        nights,
        data.guests,
        data.status,
        data.source,
        data.totalAmount,
        data.paidAmount,
        data.paidAmount >= data.totalAmount ? "PAID" : data.paidAmount > 0 ? "PARTIAL" : "PENDING",
        data.paymentMethod,
        data.notes,
        data.specialRequests,
        context?.userId,
      ]
    );

    const booking = bookingResult.rows[0];

    // Create initial payment record if paid amount > 0
    if (data.paidAmount > 0) {
      await client.query(
        `INSERT INTO payments (
          booking_id,
          amount,
          method,
          status,
          notes
        ) VALUES ($1, $2, $3, $4, $5)`,
        [booking.id, data.paidAmount, data.paymentMethod || "CASH", "COMPLETED", "Initial payment"]
      );
    }

    // Update property status if needed
    if (data.status === "CONFIRMED" && checkIn.toDateString() === new Date().toDateString()) {
      await client.query(
        `UPDATE properties 
         SET status = 'OCCUPIED', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [data.propertyId]
      );
    }

    // TODO: Send confirmation email if requested
    if (data.sendConfirmation && data.guestEmail) {
      // Queue email sending job
      console.log("Queue confirmation email for:", data.guestEmail);
    }

    return {
      ...booking,
      property: {
        id: property.id,
        name: property.name,
      },
    };
  });

  return res.status(201).json(successResponse(booking, "Booking created successfully"));
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["POST"]),
  withProject,
  withValidation(createBookingSchema, "body"),
  withAuditLog("CREATE", "booking")
)(handler);
