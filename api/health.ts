import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Health check response interface
interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: {
      status: "connected" | "disconnected" | "error";
      responseTime: number;
      error?: string;
    };
    storage?: {
      status: "connected" | "disconnected" | "error";
      responseTime: number;
      error?: string;
    };
  };
  uptime: number;
  system: {
    memory: {
      used: number;
      total: number;
    };
    nodejs: string;
    platform: string;
  };
}

// Service check result interface
interface ServiceCheck {
  status: "connected" | "disconnected" | "error";
  responseTime: number;
  error?: string;
}

// Environment variables with fallbacks for serverless
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const appVersion = process.env.npm_package_version || "0.0.1";
const nodeEnv = process.env.NODE_ENV || "development";

// Track service start time for uptime calculation
const startTime = Date.now();

/**
 * Test database connectivity with optimized query
 * Uses a lightweight query that doesn't require specific tables
 */
async function checkDatabaseHealth(): Promise<ServiceCheck> {
  const checkStart = Date.now();

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        status: "error",
        responseTime: Date.now() - checkStart,
        error: "Missing Supabase configuration",
      };
    }

    // Create temporary client for health check
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      // Optimize for health checks
      db: {
        schema: "public",
      },
    });

    // Simple connectivity test using PostgreSQL built-in function
    // This doesn't require any specific tables to exist
    const { data, error } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .limit(1)
      .single();

    const responseTime = Date.now() - checkStart;

    if (error) {
      return {
        status: "error",
        responseTime,
        error: error.message,
      };
    }

    return {
      status: "connected",
      responseTime,
    };
  } catch (error) {
    return {
      status: "error",
      responseTime: Date.now() - checkStart,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

/**
 * Test storage connectivity (optional service)
 * Only runs if storage bucket is configured
 */
async function checkStorageHealth(): Promise<ServiceCheck | null> {
  const checkStart = Date.now();

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null; // Skip storage check if Supabase not configured
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Test storage by listing buckets (lightweight operation)
    const { data, error } = await supabase.storage.listBuckets();

    const responseTime = Date.now() - checkStart;

    if (error) {
      return {
        status: "error",
        responseTime,
        error: error.message,
      };
    }

    return {
      status: "connected",
      responseTime,
    };
  } catch (error) {
    return {
      status: "error",
      responseTime: Date.now() - checkStart,
      error: error instanceof Error ? error.message : "Unknown storage error",
    };
  }
}

/**
 * Get system information optimized for serverless
 */
function getSystemInfo() {
  const memUsage = process.memoryUsage();

  return {
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    },
    nodejs: process.version,
    platform: process.platform,
  };
}

/**
 * Health check endpoint handler
 * Optimized for Vercel serverless with <500ms target response time
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestStart = Date.now();

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Health check only supports GET requests",
    });
  }

  try {
    // Set response headers for health monitoring
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Health-Check", "okaeri-resort-system");

    // Run health checks in parallel for optimal performance
    const [databaseCheck, storageCheck] = await Promise.all([
      checkDatabaseHealth(),
      checkStorageHealth(),
    ]);

    // Calculate uptime since serverless function initialization
    const uptime = Date.now() - startTime;

    // Get system information
    const systemInfo = getSystemInfo();

    // Build response object
    const healthResponse: HealthCheckResponse = {
      status: databaseCheck.status === "connected" ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: appVersion,
      environment: nodeEnv,
      services: {
        database: databaseCheck,
        ...(storageCheck && { storage: storageCheck }),
      },
      uptime,
      system: systemInfo,
    };

    // Calculate total response time
    const totalResponseTime = Date.now() - requestStart;

    // Add performance headers for monitoring
    res.setHeader("X-Response-Time", `${totalResponseTime}ms`);
    res.setHeader("X-Database-Time", `${databaseCheck.responseTime}ms`);

    if (storageCheck) {
      res.setHeader("X-Storage-Time", `${storageCheck.responseTime}ms`);
    }

    // Return appropriate HTTP status code
    const statusCode = healthResponse.status === "healthy" ? 200 : 503;

    return res.status(statusCode).json(healthResponse);
  } catch (error) {
    // Handle unexpected errors
    const errorResponse = {
      status: "unhealthy" as const,
      timestamp: new Date().toISOString(),
      version: appVersion,
      environment: nodeEnv,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      uptime: Date.now() - startTime,
      system: getSystemInfo(),
    };

    // Log error for debugging (will appear in Vercel logs)
    console.error("Health check error:", error);

    return res.status(503).json(errorResponse);
  }
}

// Export configuration for Vercel
export const config = {
  runtime: "nodejs20.x",
  maxDuration: 10, // 10 seconds max (well under Vercel's 30s limit)
  memory: 512, // 512MB (sufficient for health checks)
  regions: ["sin1", "hkg1"], // Match your Vercel config regions
};
