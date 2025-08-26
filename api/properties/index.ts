/**
 * List properties API endpoint
 * GET /api/properties
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
  type TenantContext,
  type PaginatedResponse,
  type Property,
} from "../_lib/types";
import { TenantQuery, queryHelpers } from "../_lib/database";

// Query validation schema
const listPropertiesSchema = paginationSchema.extend({
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  search: z.string().optional(),
  minCapacity: z.coerce.number().optional(),
  maxRate: z.coerce.number().optional(),
});

type ListPropertiesQuery = z.infer<typeof listPropertiesSchema>;

async function handler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  const query = req.query as unknown as ListPropertiesQuery;
  const { page, limit, sortBy, sortOrder, minCapacity, maxRate, ...filters } = query;

  // Initialize tenant query
  const db = new TenantQuery(context!);

  // Build custom where conditions
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Handle standard filters
  if (filters.status && filters.status.length > 0) {
    const placeholders = filters.status.map(() => `$${paramIndex++}`).join(", ");
    conditions.push(`status IN (${placeholders})`);
    params.push(...filters.status);
  }

  if (filters.type && filters.type.length > 0) {
    const placeholders = filters.type.map(() => `$${paramIndex++}`).join(", ");
    conditions.push(`type IN (${placeholders})`);
    params.push(...filters.type);
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (minCapacity !== undefined) {
    conditions.push(`capacity >= $${paramIndex++}`);
    params.push(minCapacity);
  }

  if (maxRate !== undefined) {
    conditions.push(`base_rate <= $${paramIndex++}`);
    params.push(maxRate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderByClause = queryHelpers.buildOrderByClause(sortBy || "name", sortOrder);
  const { clause: paginationClause } = queryHelpers.buildPaginationClause(page, limit);

  // Get properties with occupancy status
  const propertiesQuery = `
    SELECT 
      p.id,
      p.name,
      p.type,
      p.status,
      p.description,
      p.capacity,
      p.bedrooms,
      p.bathrooms,
      p.amenities,
      p.base_rate,
      p.weekend_rate,
      p.images,
      p.created_at,
      p.updated_at,
      (
        SELECT json_build_object(
          'total_bookings', COUNT(*)::int,
          'upcoming_bookings', COUNT(*) FILTER (WHERE b.check_in > CURRENT_DATE)::int,
          'current_booking', (
            SELECT json_build_object(
              'id', b2.id,
              'guest_name', b2.guest_name,
              'check_in', b2.check_in,
              'check_out', b2.check_out
            )
            FROM bookings b2
            WHERE b2.property_id = p.id
              AND b2.status IN ('CONFIRMED', 'CHECKED_IN')
              AND CURRENT_DATE BETWEEN b2.check_in AND b2.check_out
            LIMIT 1
          ),
          'next_available', (
            SELECT MIN(b3.check_out)
            FROM bookings b3
            WHERE b3.property_id = p.id
              AND b3.status IN ('CONFIRMED', 'CHECKED_IN')
              AND b3.check_out > CURRENT_DATE
          ),
          'revenue_30d', COALESCE(SUM(b.total_amount) FILTER (WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0)::float,
          'occupancy_rate_30d', 
            CASE 
              WHEN COUNT(*) FILTER (WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 THEN
                ROUND(
                  (SUM(b.nights) FILTER (WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days' AND b.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')))::numeric 
                  * 100.0 / 30,
                  2
                )
              ELSE 0
            END
        )
        FROM bookings b
        WHERE b.property_id = p.id
      ) as stats
    FROM properties p
    ${whereClause}
    ${orderByClause}
    ${paginationClause}
  `;

  const properties = await db.query<any>(propertiesQuery, params);

  // Get total count for pagination
  const total = await queryHelpers.countRows("properties", whereClause, params, context!);

  // Calculate pagination meta
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  // Get summary statistics
  const summaryQuery = `
    SELECT 
      COUNT(*) as total_properties,
      COUNT(*) FILTER (WHERE status = 'AVAILABLE') as available_properties,
      COUNT(*) FILTER (WHERE status = 'OCCUPIED') as occupied_properties,
      COUNT(*) FILTER (WHERE status = 'MAINTENANCE') as maintenance_properties,
      AVG(capacity) as avg_capacity,
      AVG(base_rate) as avg_base_rate,
      MIN(base_rate) as min_base_rate,
      MAX(base_rate) as max_base_rate
    FROM properties
    ${whereClause}
  `;

  const summaryResult = await db.query<any>(summaryQuery, params);
  const summary = summaryResult[0];

  const response: PaginatedResponse<Property> = {
    data: properties.map((property) => ({
      ...property,
      rates: {
        baseRate: parseFloat(property.base_rate),
        weekendRate: property.weekend_rate ? parseFloat(property.weekend_rate) : undefined,
      },
      amenities: property.amenities || [],
      images: property.images || [],
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
      summary: {
        totalProperties: parseInt(summary.total_properties),
        availableProperties: parseInt(summary.available_properties),
        occupiedProperties: parseInt(summary.occupied_properties),
        maintenanceProperties: parseInt(summary.maintenance_properties),
        avgCapacity: parseFloat(summary.avg_capacity || "0"),
        avgBaseRate: parseFloat(summary.avg_base_rate || "0"),
        minBaseRate: parseFloat(summary.min_base_rate || "0"),
        maxBaseRate: parseFloat(summary.max_base_rate || "0"),
      },
    })
  );
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["GET"]),
  withProject,
  withValidation(listPropertiesSchema, "query")
)(handler);
