/**
 * Example protected API endpoint demonstrating enhanced middleware
 * GET /api/example/protected
 *
 * This endpoint shows how to use the new error handling and logging system
 */

import type { VercelResponse } from "@vercel/node";
import {
  withStandardMiddleware,
  withAuth,
  withPermission,
  compose,
  type ExtendedRequest,
} from "../_lib/middleware";
import { successResponse } from "../_lib/types";
import { TenantQuery } from "../_lib/database";

async function handler(req: ExtendedRequest, res: VercelResponse, context?: any) {
  const requestLogger = req.requestLogger!;

  requestLogger.info("Protected endpoint accessed", {
    userId: context?.userId,
    projectId: context?.projectId,
    permissions: context?.permissions,
  });

  try {
    // Example of using tenant-scoped database query
    if (context?.projectId) {
      const tenantQuery = new TenantQuery(context);

      // Example query - get recent activity
      const recentActivity = await requestLogger.time("fetchRecentActivity", async () => {
        return await tenantQuery.query(
          `SELECT * FROM activity_logs 
           WHERE user_id = $1 
           ORDER BY created_at DESC 
           LIMIT 10`,
          [context.userId]
        );
      });

      requestLogger.debug("Recent activity fetched", {
        activityCount: recentActivity.length,
      });

      return res.status(200).json(
        successResponse({
          message: "Protected resource accessed successfully",
          user: {
            id: context.userId,
            role: context.userRole,
            permissions: context.permissions,
          },
          project: {
            id: context.projectId,
          },
          recentActivity,
          requestId: req.requestId,
        })
      );
    }

    // No project context - return basic user info
    return res.status(200).json(
      successResponse({
        message: "Protected resource accessed successfully",
        user: {
          id: context?.userId,
          role: context?.userRole,
          permissions: context?.permissions || [],
        },
        requestId: req.requestId,
      })
    );
  } catch (error) {
    // Errors are automatically handled by withErrorHandler
    // But we can add additional context here if needed
    requestLogger.error("Failed to access protected resource", error as Error);
    throw error;
  }
}

// Export handler with comprehensive middleware stack
// This demonstrates different middleware composition patterns:

// Option 1: Use pre-composed middleware for authenticated routes
export default compose(
  withStandardMiddleware, // Includes error handling and rate limiting
  withAuth, // Requires authentication
  withPermission("read") // Requires 'read' permission
)(handler);

// Option 2: Custom composition for specific needs
// export default compose(
//   withErrorHandler,
//   withRateLimit,
//   withAuth,
//   withProject,
//   withAuditLog('access', 'protected_resource')
// )(handler);
