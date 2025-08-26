/**
 * Get current user API endpoint
 * GET /api/auth/me
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, withAuth, compose } from "../_lib/middleware";
import { successResponse, NotFoundError, type TenantContext } from "../_lib/types";
import { getPool } from "../_lib/database";

async function handler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  if (!context?.userId) {
    throw new NotFoundError("User");
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Get user details
    const userResult = await client.query(
      `SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.avatar,
        u.phone,
        u.created_at,
        u.updated_at,
        u.last_login,
        u.preferences
      FROM users u
      WHERE u.id = $1`,
      [context.userId]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError("User");
    }

    const user = userResult.rows[0];

    // Get user's projects with detailed information
    const projectsResult = await client.query(
      `SELECT 
        p.id,
        p.name,
        p.slug,
        p.description,
        p.type,
        p.status,
        p.config,
        pm.role as project_role,
        pm.permissions,
        pm.joined_at,
        (
          SELECT json_build_object(
            'total_bookings', COUNT(*)::int,
            'total_revenue', COALESCE(SUM(b.total_amount), 0)::float,
            'occupancy_rate', 
              CASE 
                WHEN COUNT(*) > 0 THEN 
                  ROUND((COUNT(*) FILTER (WHERE b.status = 'CONFIRMED'))::numeric * 100.0 / COUNT(*)::numeric, 2)
                ELSE 0 
              END
          )
          FROM project_${p.id.replace(/-/g, "_")}.bookings b
          WHERE b.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ) as stats
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1
      ORDER BY 
        CASE WHEN p.id = $2 THEN 0 ELSE 1 END,
        pm.joined_at DESC`,
      [context.userId, context.projectId]
    );

    const projects = projectsResult.rows;

    // Get current project details if set
    let currentProject = null;
    if (context.projectId) {
      currentProject = projects.find((p) => p.id === context.projectId);
    }

    // Get user notifications count
    const notificationsResult = await client.query(
      `SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = $1 AND is_read = false`,
      [context.userId]
    );

    // Return user data with projects
    return res.status(200).json(
      successResponse({
        user: {
          ...user,
          preferences: user.preferences || {},
        },
        projects,
        currentProject,
        notifications: {
          unreadCount: parseInt(notificationsResult.rows[0]?.unread_count || "0", 10),
        },
      })
    );
  } finally {
    client.release();
  }
}

// Export handler with middleware
export default compose(withErrorHandler, withMethod(["GET"]), withAuth)(handler);
