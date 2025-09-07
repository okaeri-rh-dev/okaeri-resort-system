/**
 * Process Payment API Endpoint
 * POST /api/payments/process
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaymentService } from "@/features/financial/services/payment.service";
import { Money } from "@/lib/money";
import { withAuth } from "@/api/_lib/middleware";
import { ApiError } from "@/lib/api-error";
import { PaymentMethod, PaymentStatus } from "@/features/financial/types/financial.types";

// Base payment schema
const basePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
    .transform((val) => new Money(val)),
  currency: z.enum(["PHP", "USD"]).default("PHP"),
  description: z.string().min(1).max(500),
  metadata: z.record(z.any()).optional(),
});

// GCash payment schema
const gcashPaymentSchema = basePaymentSchema.extend({
  method: z.literal(PaymentMethod.GCASH),
  referenceNumber: z.string().regex(/^\d{13}$/, "GCash reference must be 13 digits"),
  accountNumber: z.string().regex(/^09\d{9}$/, "Invalid GCash mobile number"),
  accountName: z.string().min(1).max(100),
});

// Bank transfer schema
const bankTransferSchema = basePaymentSchema.extend({
  method: z.literal(PaymentMethod.BANK_TRANSFER),
  bankName: z.string().min(1).max(100),
  referenceNumber: z.string().min(1).max(50),
  depositSlipUrl: z.string().url().optional(),
  transferDate: z.string().datetime(),
});

// Cash payment schema
const cashPaymentSchema = basePaymentSchema.extend({
  method: z.literal(PaymentMethod.CASH),
  receiptNumber: z.string().min(1).max(50),
  cashierId: z.string().uuid().optional(),
  changeAmount: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().min(0)])
    .transform((val) => new Money(val))
    .optional(),
});

// PayMongo payment schema
const paymongoPaymentSchema = basePaymentSchema.extend({
  method: z.literal(PaymentMethod.PAYMONGO),
  paymentIntentId: z.string(),
  paymentMethodId: z.string(),
  clientKey: z.string(),
});

// Union of all payment schemas
const processPaymentSchema = z.discriminatedUnion("method", [
  gcashPaymentSchema,
  bankTransferSchema,
  cashPaymentSchema,
  paymongoPaymentSchema,
]);

export async function POST(req: NextRequest) {
  try {
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const { userId, projectId } = authContext;
    const body = await req.json();
    const validatedData = processPaymentSchema.parse(body);

    const paymentService = new PaymentService();
    let payment;

    // Process payment based on method
    switch (validatedData.method) {
      case PaymentMethod.GCASH:
        payment = await paymentService.processGCashPayment({
          ...validatedData,
          projectId,
          processedBy: userId,
        });
        break;

      case PaymentMethod.BANK_TRANSFER:
        payment = await paymentService.processBankTransfer({
          ...validatedData,
          projectId,
          processedBy: userId,
        });
        break;

      case PaymentMethod.CASH:
        payment = await paymentService.processCashPayment({
          ...validatedData,
          projectId,
          processedBy: userId,
        });
        break;

      case PaymentMethod.PAYMONGO:
        payment = await paymentService.processPayMongoPayment({
          ...validatedData,
          projectId,
          processedBy: userId,
        });
        break;

      default:
        throw new Error(`Unsupported payment method: ${validatedData.method}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          payment,
          status: payment.status,
          transactionId: payment.transactionId,
          processingFee: payment.processingFee?.toString(),
          netAmount: payment.netAmount?.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.badRequest("Validation failed", error.errors);
    }
    return ApiError.handle(error, "Failed to process payment");
  }
}
