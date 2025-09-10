/**
 * Public Status Page
 * Phase 5.4: Monitoring Setup - Transparent system status for internal users
 */

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface StatusPageData {
  overall: "operational" | "degraded" | "major_outage";
  services: Array<{
    name: string;
    status: "operational" | "degraded" | "major_outage" | "under_maintenance";
    uptime: number;
    responseTime: number;
    lastCheck: string;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    status: "investigating" | "identified" | "monitoring" | "resolved";
    impact: "minor" | "major" | "critical";
    createdAt: string;
    updatedAt: string;
    updates: Array<{
      status: string;
      message: string;
      timestamp: string;
    }>;
  }>;
  uptime: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
  lastUpdated: string;
}

// Mock status data - in real implementation, this would come from monitoring APIs
const mockStatusData: StatusPageData = {
  overall: "operational",
  services: [
    {
      name: "Resort Management System",
      status: "operational",
      uptime: 99.9,
      responseTime: 245,
      lastCheck: new Date(Date.now() - 30000).toISOString(),
    },
    {
      name: "Booking System",
      status: "operational",
      uptime: 99.8,
      responseTime: 189,
      lastCheck: new Date(Date.now() - 45000).toISOString(),
    },
    {
      name: "Expense Tracking",
      status: "operational",
      uptime: 99.9,
      responseTime: 156,
      lastCheck: new Date(Date.now() - 25000).toISOString(),
    },
    {
      name: "Database",
      status: "operational",
      uptime: 99.95,
      responseTime: 23,
      lastCheck: new Date(Date.now() - 15000).toISOString(),
    },
    {
      name: "Authentication",
      status: "operational",
      uptime: 99.7,
      responseTime: 78,
      lastCheck: new Date(Date.now() - 20000).toISOString(),
    },
  ],
  incidents: [
    {
      id: "1",
      title: "Resolved: Brief slowdown in expense logging",
      status: "resolved",
      impact: "minor",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3000000).toISOString(),
      updates: [
        {
          status: "resolved",
          message:
            "All systems have returned to normal operation. The issue was caused by a temporary database connection pool exhaustion.",
          timestamp: new Date(Date.now() - 3000000).toISOString(),
        },
        {
          status: "monitoring",
          message: "We have implemented a fix and are monitoring the situation.",
          timestamp: new Date(Date.now() - 3300000).toISOString(),
        },
        {
          status: "investigating",
          message:
            "We are investigating reports of slower than usual response times in the expense logging feature.",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    },
  ],
  uptime: {
    last24Hours: 99.9,
    last7Days: 99.8,
    last30Days: 99.7,
  },
  lastUpdated: new Date().toISOString(),
};

// Status page component
const StatusPage: React.FC = () => {
  const [refreshCount, setRefreshCount] = useState(0);

  // Query for status data (mocked for now)
  const {
    data: statusData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["status-page", refreshCount],
    queryFn: async (): Promise<StatusPageData> => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // In real implementation, this would fetch from /api/monitoring/status
      return mockStatusData;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  const handleRefresh = () => {
    setRefreshCount((prev) => prev + 1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800";
      case "degraded":
        return "bg-yellow-100 text-yellow-800";
      case "major_outage":
        return "bg-red-100 text-red-800";
      case "under_maintenance":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return "✅";
      case "degraded":
        return "⚠️";
      case "major_outage":
        return "❌";
      case "under_maintenance":
        return "🔧";
      default:
        return "❓";
    }
  };

  const getIncidentColor = (impact: string) => {
    switch (impact) {
      case "minor":
        return "bg-yellow-100 text-yellow-800";
      case "major":
        return "bg-orange-100 text-orange-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diffMs = now - time;

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffMs / 86400000);
    return `${diffDays} days ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-pulse">Loading system status...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-2xl">
            <CardContent className="p-6 text-center">
              <h2 className="mb-2 text-xl font-bold text-red-600">
                Unable to Load Status Information
              </h2>
              <p className="mb-4 text-gray-600">
                We're having trouble retrieving the current system status.
              </p>
              <Button onClick={handleRefresh}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!statusData) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Okaeri Resort System Status</h1>
          <p className="text-gray-600">
            Real-time status and uptime information for internal resort operations
          </p>
        </div>

        {/* Overall Status */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(statusData.overall)}</span>
                <div>
                  <h2 className="text-xl font-semibold">
                    {statusData.overall === "operational"
                      ? "All Systems Operational"
                      : statusData.overall === "degraded"
                        ? "Some Systems Degraded"
                        : "Major Service Outage"}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Last updated: {formatRelativeTime(statusData.lastUpdated)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  🔄 Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusData.services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between rounded border p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getStatusIcon(service.status)}</span>
                    <div>
                      <h3 className="font-medium">{service.name}</h3>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>Uptime: {service.uptime}%</span>
                        <span>Response: {service.responseTime}ms</span>
                        <span>Last check: {formatRelativeTime(service.lastCheck)}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(service.status)}>
                    {service.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Uptime Statistics */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Uptime Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {statusData.uptime.last24Hours}%
                </div>
                <div className="text-sm text-gray-600">Last 24 Hours</div>
              </div>
              <div className="rounded border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {statusData.uptime.last7Days}%
                </div>
                <div className="text-sm text-gray-600">Last 7 Days</div>
              </div>
              <div className="rounded border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {statusData.uptime.last30Days}%
                </div>
                <div className="text-sm text-gray-600">Last 30 Days</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        {statusData.incidents.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {statusData.incidents.map((incident) => (
                  <div key={incident.id} className="rounded border p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{incident.title}</h3>
                        <p className="text-sm text-gray-600">
                          {formatRelativeTime(incident.createdAt)} •
                          <Badge className={`ml-2 ${getIncidentColor(incident.impact)}`} size="sm">
                            {incident.impact} impact
                          </Badge>
                        </p>
                      </div>
                      <Badge
                        className={
                          incident.status === "resolved"
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }
                      >
                        {incident.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {incident.updates.slice(0, 2).map((update, index) => (
                        <div key={index} className="text-sm">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant="outline" size="sm">
                              {update.status}
                            </Badge>
                            <span className="text-gray-500">
                              {formatRelativeTime(update.timestamp)}
                            </span>
                          </div>
                          <p className="border-l-2 border-gray-200 pl-2 text-gray-700">
                            {update.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This page shows the status of internal resort management systems. For technical support,
            contact the system administrator.
          </p>
          <p className="mt-2">
            Auto-refreshes every 30 seconds •
            <button onClick={handleRefresh} className="ml-1 text-blue-600 hover:underline">
              Refresh now
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
