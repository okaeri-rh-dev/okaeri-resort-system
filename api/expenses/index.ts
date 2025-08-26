/**
 * List expenses API endpoint
 * GET /api/expenses
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
  type Expense,
} from "../_lib/types";
import { TenantQuery, queryHelpers } from "../_lib/database";

// Query validation schema
const listExpensesSchema = paginationSchema.extend({
  ...dateRangeSchema.shape,
  category: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  propertyId: z.string().uuid().optional(),
  vendor: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});

type ListExpensesQuery = z.infer<typeof listExpensesSchema>;

async function handler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  const query = req.query as unknown as ListExpensesQuery;
  const { page, limit, sortBy, sortOrder, minAmount, maxAmount, vendor, ...filters } = query;

  // Initialize tenant query
  const db = new TenantQuery(context!);

  // Build where conditions
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Date range
  if (filters.dateFrom) {
    conditions.push(`date >= $${paramIndex++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`date <= $${paramIndex++}`);
    params.push(filters.dateTo);
  }

  // Category filter
  if (filters.category && filters.category.length > 0) {
    const placeholders = filters.category.map(() => `$${paramIndex++}`).join(", ");
    conditions.push(`category IN (${placeholders})`);
    params.push(...filters.category);
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    const placeholders = filters.status.map(() => `$${paramIndex++}`).join(", ");
    conditions.push(`status IN (${placeholders})`);
    params.push(...filters.status);
  }

  // Property filter
  if (filters.propertyId) {
    conditions.push(`property_id = $${paramIndex++}`);
    params.push(filters.propertyId);
  }

  // Vendor search
  if (vendor) {
    conditions.push(`vendor ILIKE $${paramIndex++}`);
    params.push(`%${vendor}%`);
  }

  // Amount range
  if (minAmount !== undefined) {
    conditions.push(`amount >= $${paramIndex++}`);
    params.push(minAmount);
  }
  if (maxAmount !== undefined) {
    conditions.push(`amount <= $${paramIndex++}`);
    params.push(maxAmount);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderByClause = queryHelpers.buildOrderByClause(sortBy || "date", sortOrder);
  const { clause: paginationClause } = queryHelpers.buildPaginationClause(page, limit);

  // Get expenses with property details
  const expensesQuery = `
    SELECT 
      e.id,
      e.property_id,
      e.category,
      e.amount,
      e.description,
      e.vendor,
      e.date,
      e.payment_method,
      e.receipt_url,
      e.status,
      e.approved_by,
      e.approved_at,
      e.notes,
      e.tags,
      e.created_at,
      e.updated_at,
      p.name as property_name,
      u.name as approved_by_name
    FROM expenses e
    LEFT JOIN properties p ON p.id = e.property_id
    LEFT JOIN users u ON u.id = e.approved_by
    ${whereClause}
    ${orderByClause}
    ${paginationClause}
  `;

  const expenses = await db.query<any>(expensesQuery, params);

  // Get total count for pagination
  const total = await queryHelpers.countRows("expenses", whereClause, params, context!);

  // Calculate pagination meta
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  // Get summary statistics with Philippine Peso formatting
  const statsQuery = `
    SELECT 
      COUNT(*) as total_expenses,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_expenses,
      COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_expenses,
      COUNT(*) FILTER (WHERE status = 'PAID') as paid_expenses,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) as paid_amount,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0) as pending_amount,
      -- Category breakdown
      json_object_agg(
        COALESCE(category, 'UNCATEGORIZED'),
        category_totals
      ) FILTER (WHERE category IS NOT NULL) as category_breakdown
    FROM expenses e
    LEFT JOIN LATERAL (
      SELECT 
        e.category,
        json_build_object(
          'count', COUNT(*)::int,
          'total', COALESCE(SUM(e2.amount), 0)::float,
          'percentage', 
            CASE 
              WHEN SUM(e2.amount) > 0 THEN 
                ROUND((SUM(e2.amount) * 100.0 / (SELECT SUM(amount) FROM expenses ${whereClause}))::numeric, 2)
              ELSE 0
            END
        ) as category_totals
      FROM expenses e2
      WHERE e2.category = e.category
        ${whereClause ? whereClause.replace("WHERE", "AND") : ""}
      GROUP BY e2.category
    ) cat ON true
    ${whereClause}
    GROUP BY e.category, category_totals
  `;

  const statsResult = await db.query<any>(statsQuery, params);
  const stats = statsResult[0] || {};

  // Get monthly trend for current year
  const currentYear = new Date().getFullYear();
  const trendQuery = `
    SELECT 
      EXTRACT(MONTH FROM date) as month,
      COUNT(*) as count,
      SUM(amount) as total
    FROM expenses
    WHERE EXTRACT(YEAR FROM date) = $${paramIndex}
      ${whereClause ? whereClause.replace("WHERE", "AND") : ""}
    GROUP BY EXTRACT(MONTH FROM date)
    ORDER BY month
  `;
  params.push(currentYear);

  const trendResult = await db.query<any>(trendQuery, params);

  const response: PaginatedResponse<Expense> = {
    data: expenses.map((expense) => ({
      ...expense,
      amount: parseFloat(expense.amount),
      property: expense.property_name
        ? {
            id: expense.property_id,
            name: expense.property_name,
          }
        : undefined,
      tags: expense.tags || [],
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
        totalExpenses: parseInt(stats.total_expenses || "0"),
        pendingExpenses: parseInt(stats.pending_expenses || "0"),
        approvedExpenses: parseInt(stats.approved_expenses || "0"),
        paidExpenses: parseInt(stats.paid_expenses || "0"),
        totalAmount: parseFloat(stats.total_amount || "0"),
        paidAmount: parseFloat(stats.paid_amount || "0"),
        pendingAmount: parseFloat(stats.pending_amount || "0"),
        categoryBreakdown: stats.category_breakdown || {},
        monthlyTrend: trendResult.map((month) => ({
          month: parseInt(month.month),
          count: parseInt(month.count),
          total: parseFloat(month.total),
        })),
      },
    })
  );
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["GET"]),
  withProject,
  withValidation(listExpensesSchema, "query")
)(handler);
