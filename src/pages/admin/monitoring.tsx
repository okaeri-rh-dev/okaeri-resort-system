/**
 * Internal Monitoring Dashboard
 * Phase 5.4: Monitoring Setup - Dashboard for internal resort operations monitoring
 */

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResortErrorBoundary } from "@/components/monitoring/ErrorBoundary";
import { ResortErrorTracker } from "@/lib/monitoring/error-tracker";

// Monitoring dashboard interface
interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  checks: Array<{
    service: string;
    status: "healthy" | "degraded" | "unhealthy";
    responseTime: number;
    details: Record<string, any>;
    timestamp: number;
  }>;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    usagePercent: number;
  };
  timestamp: string;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  coreWebVitals: {
    LCP: number;
    INP: number;
    CLS: number;
    FCP: number;
    TTFB: number;
  };
}

// API functions
const fetchHealthStatus = async (): Promise<SystemHealth> => {
  const response = await fetch("/api/monitoring/health-detailed");
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  const data = await response.json();
  return data.data;
};

const fetchPerformanceMetrics = async (): Promise<PerformanceMetrics> => {
  // Mock data for now - would come from Redis/analytics
  return {
    averageResponseTime: Math.round(Math.random() * 500 + 200),
    requestsPerMinute: Math.round(Math.random() * 100 + 20),
    errorRate: Math.round(Math.random() * 2 * 100) / 100,
    coreWebVitals: {
      LCP: Math.round(Math.random() * 1000 + 1500),
      INP: Math.round(Math.random() * 100 + 50),
      CLS: Math.round(Math.random() * 0.1 * 1000) / 1000,
      FCP: Math.round(Math.random() * 800 + 800),
      TTFB: Math.round(Math.random() * 200 + 100),
    },
  };
};

// Component for displaying health status
const HealthStatusCard: React.FC<{ health: SystemHealth }> = ({ health }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "degraded":
        return "bg-yellow-100 text-yellow-800";
      case "unhealthy":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return "✅";
      case "degraded":
        return "⚠️";
      case "unhealthy":
        return "❌";
      default:
        return "❓";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          System Health
          <Badge className={getStatusColor(health.overall)}>
            {getStatusIcon(health.overall)} {health.overall.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Uptime:</span> {Math.floor(health.uptime / 60)} minutes
            </div>
            <div>
              <span className="font-medium">Memory Usage:</span>{" "}
              {health.memory.usagePercent.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Service Checks</h4>
            {health.checks.map((check) => (
              <div
                key={check.service}
                className="flex items-center justify-between rounded border p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getStatusIcon(check.status)}</span>
                  <span className="font-medium capitalize">{check.service}</span>
                </div>
                <div className="text-right text-sm text-gray-600">
                  {check.responseTime > 0 && `${check.responseTime}ms`}
                  <Badge className={`ml-2 ${getStatusColor(check.status)}`} size="sm">
                    {check.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Component for displaying performance metrics
const PerformanceCard: React.FC<{ metrics: PerformanceMetrics }> = ({ metrics }) => {
  const getPerformanceRating = (metric: string, value: number) => {
    switch (metric) {
      case "LCP":
        return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
      case "INP":
        return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
      case "CLS":
        return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
      case "FCP":
        return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
      case "TTFB":
        return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
      default:
        return "good";
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "good":
        return "text-green-600";
      case "needs-improvement":
        return "text-yellow-600";
      case "poor":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded border p-3">
              <div className="text-sm text-gray-600">Average Response Time</div>
              <div className="text-lg font-bold">{metrics.averageResponseTime}ms</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-sm text-gray-600">Error Rate</div>
              <div className="text-lg font-bold">{metrics.errorRate}%</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Core Web Vitals</h4>
            {Object.entries(metrics.coreWebVitals).map(([metric, value]) => {
              const rating = getPerformanceRating(metric, value);
              return (
                <div key={metric} className="flex items-center justify-between rounded border p-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{metric}</span>
                    <span className="text-sm text-gray-600">
                      {metric === "CLS" ? value.toFixed(3) : `${value}ms`}
                    </span>
                  </div>
                  <Badge className={getRatingColor(rating)} variant="outline">
                    {rating === "needs-improvement" ? "Needs Work" : rating}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Component for internal operations tracking
const InternalOperationsCard: React.FC = () => {
  const [operations] = useState([
    { name: "Booking Operations", count: 24, errors: 0, avgTime: 342 },
    { name: "Expense Logging", count: 12, errors: 1, avgTime: 156 },
    { name: "Dashboard Loads", count: 86, errors: 2, avgTime: 1240 },
    { name: "Authentication", count: 45, errors: 0, avgTime: 89 },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Internal Operations (Last Hour)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {operations.map((op) => (
            <div key={op.name} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{op.name}</div>
                <div className="text-sm text-gray-600">
                  {op.count} operations • Avg: {op.avgTime}ms
                </div>
              </div>
              <div className="text-right">
                {op.errors > 0 ? (
                  <Badge variant="destructive">{op.errors} errors</Badge>
                ) : (
                  <Badge variant="success">✅ No errors</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Main monitoring dashboard component
const MonitoringDashboard: React.FC = () => {
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  // Health status query
  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["health-status"],
    queryFn: fetchHealthStatus,
    refetchInterval: isAutoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: true,
  });

  // Performance metrics query
  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
    refetch: refetchPerformance,
  } = useQuery({
    queryKey: ["performance-metrics"],
    queryFn: fetchPerformanceMetrics,
    refetchInterval: isAutoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: true,
  });

  // Handle manual refresh
  const handleManualRefresh = () => {
    refetchHealth();
    refetchPerformance();
    ResortErrorTracker.addBreadcrumb("Manual refresh triggered", "user_action");
  };

  // Track page view
  useEffect(() => {
    ResortErrorTracker.addBreadcrumb("Monitoring dashboard viewed", "navigation");
  }, []);

  if (healthError || performanceError) {
    ResortErrorTracker.captureError(new Error("Failed to load monitoring data"), {
      feature: "monitoring",
      action: "dashboard_load_error",
      additional: { healthError, performanceError },
    });
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring</h1>
          <p className="text-gray-600">Internal resort operations monitoring dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAutoRefresh(!isAutoRefresh)}>
            {isAutoRefresh ? "⏸️" : "▶️"} Auto Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualRefresh}>
            🔄 Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {healthLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse">Loading health status...</div>
                </CardContent>
              </Card>
            ) : healthData ? (
              <HealthStatusCard health={healthData} />
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-red-600">Failed to load health status</div>
                </CardContent>
              </Card>
            )}

            {performanceLoading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse">Loading performance metrics...</div>
                </CardContent>
              </Card>
            ) : performanceData ? (
              <PerformanceCard metrics={performanceData} />
            ) : (
              <Card>
                <CardContent className="p-6">
                  <div className="text-red-600">Failed to load performance metrics</div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {performanceData && <PerformanceCard metrics={performanceData} />}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <InternalOperationsCard />
        </TabsContent>
      </Tabs>

      <div className="text-center text-sm text-gray-500">
        <p>
          Last updated: {new Date().toLocaleTimeString()} • Auto refresh:{" "}
          {isAutoRefresh ? `${refreshInterval / 1000}s` : "Off"}
        </p>
      </div>
    </div>
  );
};

// Export wrapped with error boundary
export default function MonitoringDashboardPage() {
  return (
    <ResortErrorBoundary feature="monitoring_dashboard">
      <MonitoringDashboard />
    </ResortErrorBoundary>
  );
}
