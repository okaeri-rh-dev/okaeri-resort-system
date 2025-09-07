/**
 * Create Expense API Endpoint
 * POST /api/expenses/create
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ExpenseService } from "@/features/financial/services/expense.service";
import { Money } from "@/lib/money";
import { withAuth } from "@/api/_lib/middleware";
import { ApiError } from "@/lib/api-error";
import {
  ExpenseCategory,
  ExpenseStatus,
  PaymentMethod,
} from "@/features/financial/types/financial.types";

// Zod schema for expense creation
const createExpenseSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
    .transform((val) => new Money(val)),
  category: z.nativeEnum(ExpenseCategory),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().optional(),
  vendorTin: z
    .string()
    .regex(/^\d{9,12}$/)
    .optional(),
  isVatable: z.boolean().default(true),
  receiptNumber: z.string().optional(),
  receiptDate: z.string().datetime().optional(),
  receiptUrl: z.string().url().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paymentReference: z.string().optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.string(),
        size: z.number(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Extract user and projectId from JWT
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const { userId, projectId } = authContext;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createExpenseSchema.parse(body);

    // Create expense using service
    const expenseService = new ExpenseService();
    const expense = await expenseService.createExpense({
      ...validatedData,
      projectId,
      createdBy: userId,
      status: ExpenseStatus.DRAFT,
    });

    return NextResponse.json(
      {
        success: true,
        data: expense,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.badRequest("Validation failed", error.errors);
    }
    return ApiError.handle(error, "Failed to create expense");
  }
}
