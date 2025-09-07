/**
 * Expense CRUD API Endpoints
 * GET /api/expenses/[id] - Get expense by ID
 * PUT /api/expenses/[id] - Update expense
 * DELETE /api/expenses/[id] - Delete expense
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

const updateExpenseSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  amount: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
    .transform((val) => new Money(val))
    .optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().optional(),
  vendorTin: z
    .string()
    .regex(/^\d{9,12}$/)
    .optional(),
  isVatable: z.boolean().optional(),
  receiptNumber: z.string().optional(),
  receiptDate: z.string().datetime().optional(),
  receiptUrl: z.string().url().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paymentReference: z.string().optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const { projectId } = authContext;
    const expenseService = new ExpenseService();

    const expense = await expenseService.getExpenseById(params.id, projectId);

    if (!expense) {
      return ApiError.notFound("Expense not found");
    }

    return NextResponse.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    return ApiError.handle(error, "Failed to retrieve expense");
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const { userId, projectId } = authContext;
    const body = await req.json();
    const validatedData = updateExpenseSchema.parse(body);

    const expenseService = new ExpenseService();
    const expense = await expenseService.updateExpense(params.id, {
      ...validatedData,
      projectId,
      updatedBy: userId,
    });

    return NextResponse.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.badRequest("Validation failed", error.errors);
    }
    return ApiError.handle(error, "Failed to update expense");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const { userId, projectId } = authContext;
    const expenseService = new ExpenseService();

    await expenseService.deleteExpense(params.id, projectId, userId);

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    return ApiError.handle(error, "Failed to delete expense");
  }
}
