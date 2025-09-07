/**
 * Record Booking Income API Endpoint
 * POST /api/income/booking
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { IncomeService } from "@/features/financial/services/income.service";
import { Money } from "@/lib/money";
import { withAuth } from "@/api/_lib/middleware";
import { ApiError } from "@/lib/api-error";
import { BookingPlatform } from "@/features/financial/types/financial.types";

// Zod schema for booking income
const bookingIncomeSchema = z.object({
  bookingId: z.string().uuid(),
  platform: z.nativeEnum(BookingPlatform),
  grossAmount: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
    .transform((val) => new Money(val)),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  roomTypes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number().int().positive(),
      rate: z
        .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
        .transform((val) => new Money(val)),
    })
  ),
  extras: z
    .array(
      z.object({
        name: z.string(),
        amount: z
          .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
          .transform((val) => new Money(val)),
      })
    )
    .optional(),
  discounts: z
    .array(
      z.object({
        type: z.enum(["SENIOR", "PWD", "PROMOTIONAL"]),
        percentage: z.number().min(0).max(100),
        idNumber: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .optional(),
  paymentMethod: z.string(),
  paymentReference: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const { userId, projectId } = authContext;
    const body = await req.json();
    const validatedData = bookingIncomeSchema.parse(body);

    const incomeService = new IncomeService();
    const income = await incomeService.recordBookingIncome({
      ...validatedData,
      projectId,
      recordedBy: userId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          income,
          breakdown: {
            grossAmount: income.grossAmount.toString(),
            platformFees: income.platformFees?.toString(),
            netAmount: income.netAmount.toString(),
            vatAmount: income.vatAmount?.toString(),
            discountAmount: income.discountAmount?.toString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.badRequest("Validation failed", error.errors);
    }
    return ApiError.handle(error, "Failed to record booking income");
  }
}
