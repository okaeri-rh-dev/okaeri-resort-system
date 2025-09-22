/**
 * Health monitoring type definitions for Okaeri Resort System
 * Used by /api/health endpoint and monitoring systems
 */

// Health status enums
export type HealthStatus = "healthy" | "unhealthy";
export type ServiceStatus = "connected" | "disconnected" | "error";

// Service check interfaces
export interface ServiceCheck {
  status: ServiceStatus;
  responseTime: number;
  error?: string;
}

export interface DatabaseService extends ServiceCheck {
  // Database-specific properties can be added here
  connectionPool?: {
    total: number;
    active: number;
    idle: number;
  };
}

export interface StorageService extends ServiceCheck {
  // Storage-specific properties can be added here
  buckets?: number;
}

export interface SystemInfo {
  memory: {
    used: number; // MB
    total: number; // MB
  };
  nodejs: string;
  platform: string;
}

// Main health check response
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: DatabaseService;
    storage?: StorageService;
  };
  uptime: number; // milliseconds
  system: SystemInfo;
}

// Error response for unhealthy status
export interface HealthErrorResponse {
  status: "unhealthy";
  timestamp: string;
  version: string;
  environment: string;
  error: string;
  uptime: number;
  system: SystemInfo;
}

// Monitoring configuration
export interface MonitoringConfig {
  timeout: number; // Request timeout in ms
  interval: number; // Check interval in ms
  retries: number; // Number of retries on failure
  healthyThreshold: number; // Consecutive successes to mark healthy
  unhealthyThreshold: number; // Consecutive failures to mark unhealthy
}

// UptimeRobot configuration
export interface UptimeRobotConfig extends MonitoringConfig {
  monitors: {
    name: string;
    url: string;
    type: "http" | "keyword";
    keyword?: string;
    regions: string[];
  }[];
}

// Vercel Analytics integration
export interface VercelAnalyticsEvent {
  name: "health_check";
  status: HealthStatus;
  responseTime: number;
  environment: string;
  timestamp: string;
}

// Health check metrics for monitoring dashboards
export interface HealthMetrics {
  availability: {
    uptime: number; // Percentage
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    slowestResponseTime: number;
  };
  services: {
    database: {
      averageResponseTime: number;
      successRate: number;
      lastError?: string;
    };
    storage?: {
      averageResponseTime: number;
      successRate: number;
      lastError?: string;
    };
  };
  alerts: {
    level: "info" | "warning" | "error" | "critical";
    message: string;
    timestamp: string;
  }[];
}

// Health check configuration for different environments
export interface EnvironmentHealthConfig {
  production: MonitoringConfig;
  staging: MonitoringConfig;
  development: MonitoringConfig;
}

export const defaultHealthConfig: EnvironmentHealthConfig = {
  production: {
    timeout: 5000, // 5 seconds
    interval: 60000, // 1 minute
    retries: 3,
    healthyThreshold: 2,
    unhealthyThreshold: 3,
  },
  staging: {
    timeout: 5000,
    interval: 300000, // 5 minutes
    retries: 2,
    healthyThreshold: 1,
    unhealthyThreshold: 2,
  },
  development: {
    timeout: 10000, // 10 seconds
    interval: 600000, // 10 minutes
    retries: 1,
    healthyThreshold: 1,
    unhealthyThreshold: 1,
  },
};

// Philippines-specific monitoring considerations
export interface PhilippinesMonitoringConfig {
  regions: {
    primary: "sin1"; // Singapore (closest to Philippines)
    secondary: "hkg1"; // Hong Kong (backup)
  };
  timezone: "Asia/Manila";
  businessHours: {
    start: 8; // 8 AM
    end: 22; // 10 PM
  };
  peakSeasons: {
    summer: { start: "03-01"; end: "05-31" };
    christmas: { start: "12-15"; end: "01-15" };
    holyWeek: { start: "03-25"; end: "04-02" }; // Approximate
  };
}

export const philippinesConfig: PhilippinesMonitoringConfig = {
  regions: {
    primary: "sin1",
    secondary: "hkg1",
  },
  timezone: "Asia/Manila",
  businessHours: {
    start: 8,
    end: 22,
  },
  peakSeasons: {
    summer: { start: "03-01", end: "05-31" },
    christmas: { start: "12-15", end: "01-15" },
    holyWeek: { start: "03-25", end: "04-02" },
  },
};
