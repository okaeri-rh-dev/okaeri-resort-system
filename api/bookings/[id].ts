/**
 * Get, Update, Delete booking API endpoint
 * GET/PUT/DELETE /api/bookings/[id]
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
  NotFoundError,
  ConflictError,
  philippinePhoneSchema,
  pesoAmountSchema,
  type TenantContext,
} from "../_lib/types";
import { TenantQuery } from "../_lib/database";

// Update booking schema
const updateBookingSchema = z.object({
  guestName: z.string().min(2).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: philippinePhoneSchema.optional(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  guests: z.number().min(1).max(20).optional(),
  status: z
    .enum(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"])
    .optional(),
  totalAmount: pesoAmountSchema.optional(),
  paidAmount: pesoAmountSchema.optional(),
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
});

type UpdateBookingRequest = z.infer<typeof updateBookingSchema>;

// GET handler
async function getHandler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  const { id } = req.query;

  const db = new TenantQuery(context!);

  const booking = await db.query<any>(
    `SELECT 
      b.*,
      p.name as property_name,
      p.type as property_type,
      p.capacity as property_capacity,
      (
        SELECT json_agg(
          json_build_object(
            'id', pay.id,
            'amount', pay.amount,
            'method', pay.method,
            'status', pay.status,
            'transactionId', pay.transaction_id,
            'processedAt', pay.processed_at,
            'notes', pay.notes
          )
          ORDER BY pay.processed_at DESC
        )
        FROM payments pay
        WHERE pay.booking_id = b.id
      ) as payments
    FROM bookings b
    LEFT JOIN properties p ON p.id = b.property_id
    WHERE b.id = $1`,
    [id]
  );

  if (booking.length === 0) {
    throw new NotFoundError("Booking");
  }

  return res.status(200).json(successResponse(booking[0]));
}

// PUT handler
async function updateHandler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  const { id } = req.query;
  const updates = req.body as UpdateBookingRequest;

  const db = new TenantQuery(context!);

  const updatedBooking = await db.transaction(async (client) => {
    // Check if booking exists
    const existingResult = await client.query("SELECT * FROM bookings WHERE id = $1", [id]);

    if (existingResult.rows.length === 0) {
      throw new NotFoundError("Booking");
    }

    const existing = existingResult.rows[0];

    // If dates are being updated, check for conflicts
    if (updates.checkIn || updates.checkOut) {
      const checkIn = updates.checkIn || existing.check_in;
      const checkOut = updates.checkOut || existing.check_out;

      const conflictResult = await client.query(
        `SELECT COUNT(*) as conflicts
         FROM bookings
         WHERE property_id = $1
           AND id != $2
           AND status IN ('CONFIRMED', 'CHECKED_IN')
           AND (
             (check_in <= $3 AND check_out > $3) OR
             (check_in < $4 AND check_out >= $4) OR
             (check_in >= $3 AND check_out <= $4)
           )`,
        [existing.property_id, id, checkIn, checkOut]
      );

      if (parseInt(conflictResult.rows[0].conflicts) > 0) {
        throw new ConflictError("Property is already booked for selected dates");
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        updateFields.push(`${dbField} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (updateFields.length === 0) {
      return existing;
    }

    // Add updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Update payment status if amounts changed
    if (updates.paidAmount !== undefined || updates.totalAmount !== undefined) {
      const totalAmount = updates.totalAmount || existing.total_amount;
      const paidAmount = updates.paidAmount || existing.paid_amount;

      const paymentStatus =
        paidAmount >= totalAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";

      updateFields.push(`payment_status = $${paramIndex++}`);
      values.push(paymentStatus);
    }

    values.push(id);

    const updateResult = await client.query(
      `UPDATE bookings 
       SET ${updateFields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Update property status if needed
    if (updates.status === "CHECKED_IN") {
      await client.query(
        `UPDATE properties 
         SET status = 'OCCUPIED' 
         WHERE id = $1`,
        [existing.property_id]
      );
    } else if (updates.status === "CHECKED_OUT" || updates.status === "CANCELLED") {
      // Check if property has other active bookings
      const activeBookingsResult = await client.query(
        `SELECT COUNT(*) as active
         FROM bookings
         WHERE property_id = $1
           AND id != $2
           AND status IN ('CONFIRMED', 'CHECKED_IN')
           AND CURRENT_DATE BETWEEN check_in AND check_out`,
        [existing.property_id, id]
      );

      if (parseInt(activeBookingsResult.rows[0].active) === 0) {
        await client.query(
          `UPDATE properties 
           SET status = 'AVAILABLE' 
           WHERE id = $1`,
          [existing.property_id]
        );
      }
    }

    return updateResult.rows[0];
  });

  return res.status(200).json(successResponse(updatedBooking, "Booking updated successfully"));
}

// DELETE handler
async function deleteHandler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  const { id } = req.query;

  const db = new TenantQuery(context!);

  await db.transaction(async (client) => {
    // Check if booking exists
    const existingResult = await client.query("SELECT * FROM bookings WHERE id = $1", [id]);

    if (existingResult.rows.length === 0) {
      throw new NotFoundError("Booking");
    }

    const booking = existingResult.rows[0];

    // Soft delete - update status to CANCELLED
    await client.query(
      `UPDATE bookings 
       SET status = 'CANCELLED', 
           updated_at = CURRENT_TIMESTAMP,
           notes = COALESCE(notes || E'\\n', '') || 'Cancelled by: ' || $2 || ' at ' || CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, context?.userId]
    );

    // Update property status if needed
    const activeBookingsResult = await client.query(
      `SELECT COUNT(*) as active
       FROM bookings
       WHERE property_id = $1
         AND id != $2
         AND status IN ('CONFIRMED', 'CHECKED_IN')
         AND CURRENT_DATE BETWEEN check_in AND check_out`,
      [booking.property_id, id]
    );

    if (parseInt(activeBookingsResult.rows[0].active) === 0) {
      await client.query(
        `UPDATE properties 
         SET status = 'AVAILABLE' 
         WHERE id = $1`,
        [booking.property_id]
      );
    }
  });

  return res.status(200).json(successResponse(null, "Booking cancelled successfully"));
}

// Main handler
async function handler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  switch (req.method) {
    case "GET":
      return getHandler(req, res, context);
    case "PUT":
    case "PATCH":
      return withValidation(
        updateBookingSchema,
        "body"
      )(withAuditLog("UPDATE", "booking")(updateHandler))(req, res, context);
    case "DELETE":
      return withAuditLog("DELETE", "booking")(deleteHandler)(req, res, context);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["GET", "PUT", "PATCH", "DELETE"]),
  withProject
)(handler);
