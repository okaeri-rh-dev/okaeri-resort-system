/**
 * Alert Management API
 * Phase 5.4: Monitoring Setup - Handle alert evaluation and management
 *
 * POST /api/monitoring/alerts - Evaluate metrics and trigger alerts
 * GET /api/monitoring/alerts - Get alert history
 * POST /api/monitoring/alerts/resolve - Resolve an alert
 */

import type { VercelRequest as _VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, compose, type ExtendedRequest } from "../_lib/middleware";
import { successResponse, errorResponse } from "../_lib/types";
import { ErrorHandler } from "../../src/lib/error-handler";
import { z } from "zod";

// Import alert manager (server-side)
const { ResortAlertManager } = (() => {
  try {
    // Dynamic import for server-side only
    return require("../../src/lib/monitoring/alert-manager");
  } catch (error) {
    console.warn("Alert manager not available on server side");
    return { ResortAlertManager: null };
  }
})();

// Schemas
const MetricEvaluationSchema = z.object({
  performance: z
    .object({
      errorRate: z.number().min(0).max(100),
      averageResponseTime: z.number().min(0),
      requestsPerMinute: z.number().min(0),
    })
    .optional(),
  health: z
    .object({
      overall: z.enum(["healthy", "degraded", "unhealthy"]),
      checks: z.array(
        z.object({
          service: z.string(),
          status: z.enum(["healthy", "degraded", "unhealthy"]),
          responseTime: z.number().min(0),
        })
      ),
    })
    .optional(),
  infrastructure: z
    .object({
      memoryUsage: z.number().min(0).max(100),
      cpuUsage: z.number().min(0).max(100).optional(),
      diskUsage: z.number().min(0).max(100).optional(),
    })
    .optional(),
  business: z
    .object({
      failedOperations: z.number().min(0),
      activeUsers: z.number().min(0).optional(),
    })
    .optional(),
});

const ResolveAlertSchema = z.object({
  alertId: z.string(),
  resolvedBy: z.string().optional(),
  resolution: z.string().optional(),
});

async function handler(req: ExtendedRequest, res: VercelResponse) {
  const requestLogger = req.requestLogger!;
  const method = req.method;

  try {
    switch (method) {
      case "POST":
        return await handleAlertEvaluation(req, res, requestLogger);
      case "GET":
        return await handleGetAlerts(req, res, requestLogger);
      default:
        return res.status(405).json(errorResponse("Method not allowed"));
    }
  } catch (error) {
    const appError = ErrorHandler.handle(error, { context: "alert_api" });
    requestLogger.error("Alert API error", appError);
    return res.status(500).json(errorResponse("Alert processing failed"));
  }
}

/**
 * Handle alert evaluation (POST)
 */
async function handleAlertEvaluation(
  req: ExtendedRequest,
  res: VercelResponse,
  requestLogger: any
) {
  requestLogger.debug("Processing alert evaluation request");

  if (!ResortAlertManager) {
    return res.status(503).json(errorResponse("Alert manager not available"));
  }

  // Check for alert resolution in POST body
  if (req.body.action === "resolve") {
    return await handleResolveAlert(req, res, requestLogger);
  }

  // Validate metrics data
  const validationResult = MetricEvaluationSchema.safeParse(req.body);
  if (!validationResult.success) {
    requestLogger.warn("Invalid metrics data for alert evaluation", {
      errors: validationResult.error.errors,
    });
    return res.status(400).json(errorResponse("Invalid metrics data format"));
  }

  const metrics = validationResult.data;
  requestLogger.debug("Evaluating alerts against metrics", {
    hasPerformance: !!metrics.performance,
    hasHealth: !!metrics.health,
    hasInfrastructure: !!metrics.infrastructure,
    hasBusiness: !!metrics.business,
  });

  try {
    const alertManager = ResortAlertManager.getInstance();
    const triggeredAlerts = await alertManager.evaluateAlerts(metrics);

    const response = {
      evaluated: true,
      triggeredAlerts: triggeredAlerts.length,
      alerts: triggeredAlerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.timestamp,
      })),
      metrics: {
        performance: metrics.performance,
        health: metrics.health
          ? {
              overall: metrics.health.overall,
              unhealthyServices: metrics.health.checks.filter((c) => c.status === "unhealthy")
                .length,
            }
          : null,
        infrastructure: metrics.infrastructure,
      },
      timestamp: new Date().toISOString(),
    };

    if (triggeredAlerts.length > 0) {
      requestLogger.info("Alerts triggered", {
        count: triggeredAlerts.length,
        alerts: triggeredAlerts.map((a) => ({ id: a.id, severity: a.severity })),
      });
    } else {
      requestLogger.debug("No alerts triggered");
    }

    return res.status(200).json(successResponse(response));
  } catch (error) {
    const appError = ErrorHandler.handle(error, { context: "alert_evaluation" });
    requestLogger.error("Alert evaluation failed", appError);
    return res.status(500).json(errorResponse("Alert evaluation failed"));
  }
}

/**
 * Handle get alerts (GET)
 */
async function handleGetAlerts(req: ExtendedRequest, res: VercelResponse, requestLogger: any) {
  requestLogger.debug("Fetching alert history");

  if (!ResortAlertManager) {
    return res.status(503).json(errorResponse("Alert manager not available"));
  }

  try {
    const alertManager = ResortAlertManager.getInstance();
    const alertHistory = alertManager.getAlertHistory();
    const alertRules = alertManager.getAlertRules();

    // Parse query parameters
    const { limit = "50", resolved, severity } = req.query;
    const limitNum = parseInt(limit as string, 10);

    let filteredAlerts = [...alertHistory];

    // Filter by resolution status
    if (resolved !== undefined) {
      const isResolved = resolved === "true";
      filteredAlerts = filteredAlerts.filter((alert) => alert.resolved === isResolved);
    }

    // Filter by severity
    if (severity !== undefined) {
      const severityNum = parseInt(severity as string, 10);
      if (!isNaN(severityNum)) {
        filteredAlerts = filteredAlerts.filter((alert) => alert.severity === severityNum);
      }
    }

    // Apply limit
    filteredAlerts = filteredAlerts.slice(0, limitNum);

    const response = {
      alerts: filteredAlerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.timestamp,
        resolved: alert.resolved,
        resolvedAt: alert.resolvedAt,
        tags: alert.tags,
      })),
      rules: alertRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        severity: rule.severity,
        threshold: rule.threshold,
        channels: rule.channels,
      })),
      summary: {
        total: alertHistory.length,
        unresolved: alertHistory.filter((a) => !a.resolved).length,
        critical: alertHistory.filter((a) => a.severity >= 5).length,
        last24Hours: alertHistory.filter((a) => Date.now() - a.timestamp < 86400000).length,
      },
      timestamp: new Date().toISOString(),
    };

    requestLogger.debug("Alert history retrieved", {
      totalAlerts: alertHistory.length,
      filteredAlerts: filteredAlerts.length,
      activeRules: alertRules.filter((r) => r.enabled).length,
    });

    // Cache for 1 minute
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json(successResponse(response));
  } catch (error) {
    const appError = ErrorHandler.handle(error, { context: "get_alerts" });
    requestLogger.error("Failed to retrieve alerts", appError);
    return res.status(500).json(errorResponse("Failed to retrieve alerts"));
  }
}

/**
 * Handle resolve alert (POST with action=resolve)
 */
async function handleResolveAlert(req: ExtendedRequest, res: VercelResponse, requestLogger: any) {
  requestLogger.debug("Processing alert resolution request");

  if (!ResortAlertManager) {
    return res.status(503).json(errorResponse("Alert manager not available"));
  }

  const validationResult = ResolveAlertSchema.safeParse(req.body);
  if (!validationResult.success) {
    requestLogger.warn("Invalid alert resolution data", {
      errors: validationResult.error.errors,
    });
    return res.status(400).json(errorResponse("Invalid resolution data format"));
  }

  const { alertId, resolvedBy, resolution } = validationResult.data;

  try {
    const alertManager = ResortAlertManager.getInstance();
    await alertManager.resolveAlert(alertId);

    requestLogger.info("Alert resolved", {
      alertId,
      resolvedBy: resolvedBy || "anonymous",
      resolution,
    });

    const response = {
      resolved: true,
      alertId,
      resolvedAt: new Date().toISOString(),
      resolvedBy: resolvedBy || "anonymous",
      resolution,
    };

    return res.status(200).json(successResponse(response));
  } catch (error) {
    const appError = ErrorHandler.handle(error, { context: "resolve_alert", alertId });
    requestLogger.error("Failed to resolve alert", appError);
    return res.status(500).json(errorResponse("Failed to resolve alert"));
  }
}

// Export handler with middleware
export default compose(withErrorHandler, withMethod(["GET", "POST"]))(handler);
