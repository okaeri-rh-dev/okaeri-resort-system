/**
 * List Expenses API Endpoint
 * GET /api/expenses/list
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ExpenseService } from "@/features/financial/services/expense.service";
import { withAuth } from "@/api/_lib/middleware";
import { ApiError } from "@/lib/api-error";
import { ExpenseCategory, ExpenseStatus } from "@/features/financial/types/financial.types";

// Zod schema for query parameters
const listExpensesSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  vendorId: z.string().uuid().optional(),
  minAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  maxAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).default("1").transform(Number),
  limit: z.string().regex(/^\d+$/).default("20").transform(Number),
  sortBy: z.enum(["date", "amount", "category", "status"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(req: NextRequest) {
  try {
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const { projectId } = authContext;

    // Parse query parameters
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const validatedParams = listExpensesSchema.parse(searchParams);

    const expenseService = new ExpenseService();
    const result = await expenseService.listExpenses({
      projectId,
      ...validatedParams,
      offset: (validatedParams.page - 1) * validatedParams.limit,
    });

    return NextResponse.json({
      success: true,
      data: result.expenses,
      pagination: {
        page: validatedParams.page,
        limit: validatedParams.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / validatedParams.limit),
      },
      summary: {
        totalAmount: result.totalAmount,
        totalVat: result.totalVat,
        totalEwt: result.totalEwt,
        byCategory: result.byCategory,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.badRequest("Invalid query parameters", error.errors);
    }
    return ApiError.handle(error, "Failed to list expenses");
  }
}
