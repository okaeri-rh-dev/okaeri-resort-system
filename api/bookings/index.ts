/**
 * List bookings API endpoint
 * GET /api/bookings
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  withErrorHandler,
  withMethod,
  withProject,
  withValidation,
  compose,
} from "../_lib/middleware";
import {
  successResponse,
  paginationSchema,
  dateRangeSchema,
  type TenantContext,
  type PaginatedResponse,
  type Booking,
} from "../_lib/types";
import { TenantQuery, queryHelpers } from "../_lib/database";

// Query validation schema
const listBookingsSchema = paginationSchema.extend({
  ...dateRangeSchema.shape,
  status: z.array(z.string()).optional(),
  propertyId: z.string().uuid().optional(),
  search: z.string().optional(),
  checkInFrom: z.string().optional(),
  checkInTo: z.string().optional(),
  paymentStatus: z.array(z.string()).optional(),
});

type ListBookingsQuery = z.infer<typeof listBookingsSchema>;

async function handler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  const query = req.query as unknown as ListBookingsQuery;
  const { page, limit, sortBy, sortOrder, ...filters } = query;

  // Initialize tenant query
  if (!context) {
    throw new Error("Tenant context is required");
  }
  const db = new TenantQuery(context);

  // Build query components
  const { clause: whereClause, params: whereParams } = queryHelpers.buildWhereClause(filters);
  const orderByClause = queryHelpers.buildOrderByClause(sortBy, sortOrder);
  const { clause: paginationClause } = queryHelpers.buildPaginationClause(page, limit);

  // Get bookings
  const bookingsQuery = `
    SELECT 
      b.id,
      b.property_id,
      b.guest_name,
      b.guest_email,
      b.guest_phone,
      b.check_in,
      b.check_out,
      b.nights,
      b.guests,
      b.status,
      b.source,
      b.total_amount,
      b.paid_amount,
      b.payment_status,
      b.payment_method,
      b.notes,
      b.special_requests,
      b.created_at,
      b.updated_at,
      p.name as property_name,
      p.type as property_type,
      (
        SELECT json_agg(
          json_build_object(
            'id', pay.id,
            'amount', pay.amount,
            'method', pay.method,
            'status', pay.status,
            'processed_at', pay.processed_at
          )
        )
        FROM payments pay
        WHERE pay.booking_id = b.id
      ) as payments
    FROM bookings b
    LEFT JOIN properties p ON p.id = b.property_id
    ${whereClause}
    ${orderByClause}
    ${paginationClause}
  `;

  interface BookingRow {
    id: string;
    property_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    check_in: string;
    check_out: string;
    nights: number;
    guests: number;
    status: string;
    source: string;
    total_amount: string;
    paid_amount: string;
    payment_status: string;
    payment_method: string;
    notes: string;
    special_requests: string;
    created_at: string;
    updated_at: string;
    property_name: string;
    property_type: string;
    payments: unknown;
  }

  const bookings = await db.query<BookingRow>(bookingsQuery, whereParams);

  // Get total count for pagination
  const total = await queryHelpers.countRows("bookings", whereClause, whereParams, context);

  // Calculate pagination meta
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  // Get summary statistics
  const statsQuery = `
    SELECT 
      COUNT(*) as total_bookings,
      COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_bookings,
      COUNT(*) FILTER (WHERE check_in = CURRENT_DATE) as today_checkins,
      COUNT(*) FILTER (WHERE check_out = CURRENT_DATE) as today_checkouts,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(SUM(paid_amount), 0) as total_paid,
      COALESCE(AVG(nights), 0) as avg_stay_length,
      COALESCE(AVG(guests), 0) as avg_guests
    FROM bookings b
    ${whereClause}
  `;

  interface StatsRow {
    total_bookings: string;
    confirmed_bookings: string;
    today_checkins: string;
    today_checkouts: string;
    total_revenue: string;
    total_paid: string;
    avg_stay_length: string;
    avg_guests: string;
  }

  const statsResult = await db.query<StatsRow>(statsQuery, whereParams);
  const stats = statsResult[0];

  const response: PaginatedResponse<Booking> = {
    data: bookings.map((booking) => ({
      ...booking,
      totalAmount: parseFloat(booking.total_amount),
      paidAmount: parseFloat(booking.paid_amount),
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      property: booking.property_name
        ? {
            id: booking.property_id,
            name: booking.property_name,
            type: booking.property_type,
          }
        : undefined,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    },
  };

  return res.status(200).json(
    successResponse({
      ...response,
      stats: {
        totalBookings: parseInt(stats.total_bookings),
        confirmedBookings: parseInt(stats.confirmed_bookings),
        todayCheckIns: parseInt(stats.today_checkins),
        todayCheckOuts: parseInt(stats.today_checkouts),
        totalRevenue: parseFloat(stats.total_revenue),
        totalPaid: parseFloat(stats.total_paid),
        avgStayLength: parseFloat(stats.avg_stay_length),
        avgGuests: parseFloat(stats.avg_guests),
      },
    })
  );
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["GET"]),
  withProject,
  withValidation(listBookingsSchema, "query")
)(handler);
