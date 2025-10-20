/**
 * Security Monitoring Dashboard
 * Real-time security event monitoring and threat analysis
 */

import { useMemo, useState } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Ban,
  Globe,
  RefreshCw,
  Search,
  Shield,
  UserX,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTopThreatSources } from "@/lib/security-monitoring";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AuditLog = {
  audit_id: string;
  action: string;
  severity: string;
  ip_address: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
};

// ThreatSource type is inferred from getTopThreatSources return type

/**
 * Main Security Monitoring Dashboard Component
 */
export function SecurityMonitoringDashboard() {
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  const [searchFilter, setSearchFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch security events
  const { data: securityLogs = [] } = useQuery({
    queryKey: ["security-logs", selectedTimeRange, severityFilter],
    queryFn: async () => {
      const hoursBack =
        selectedTimeRange === "1h"
          ? 1
          : selectedTimeRange === "24h"
            ? 24
            : selectedTimeRange === "7d"
              ? 168
              : 24;

      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", startTime)
        .order("created_at", { ascending: false })
        .limit(500);

      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      } else {
        query = query.in("severity", ["WARNING", "ERROR", "CRITICAL"]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
    refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30s if auto-refresh is on
  });

  // Fetch top threat sources
  const { data: threatSources = [] } = useQuery({
    queryKey: ["threat-sources", selectedTimeRange],
    queryFn: async () => {
      const hoursBack =
        selectedTimeRange === "1h"
          ? 1
          : selectedTimeRange === "24h"
            ? 24
            : selectedTimeRange === "7d"
              ? 168
              : 24;

      return await getTopThreatSources(hoursBack);
    },
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute
  });

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = securityLogs.length;
    const critical = securityLogs.filter((log) => log.severity === "CRITICAL").length;
    const errors = securityLogs.filter((log) => log.severity === "ERROR").length;
    const warnings = securityLogs.filter((log) => log.severity === "WARNING").length;

    const uniqueIPs = new Set(securityLogs.map((log) => log.ip_address || "unknown")).size;

    return {
      total,
      critical,
      errors,
      warnings,
      uniqueIPs,
    };
  }, [securityLogs]);

  // Filter logs based on search
  const filteredLogs = useMemo(() => {
    if (!searchFilter) return securityLogs;

    return securityLogs.filter((log) => {
      const searchLower = searchFilter.toLowerCase();
      return (
        log.ip_address?.toLowerCase().includes(searchLower) ||
        log.action?.toLowerCase().includes(searchLower) ||
        log.description?.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
      );
    });
  }, [securityLogs, searchFilter]);

  // Manual refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["security-logs"] });
    queryClient.invalidateQueries({ queryKey: ["threat-sources"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Security Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time security event monitoring and threat analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={cn("mr-2 h-4 w-4", autoRefresh && "animate-pulse")} />
            {autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Shield className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
            <p className="text-muted-foreground text-xs">Last {selectedTimeRange}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{statistics.critical}</div>
            <Progress value={(statistics.critical / statistics.total) * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{statistics.errors}</div>
            <Progress value={(statistics.errors / statistics.total) * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{statistics.warnings}</div>
            <Progress value={(statistics.warnings / statistics.total) * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique IPs</CardTitle>
            <Globe className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.uniqueIPs}</div>
            <p className="text-muted-foreground text-xs">Active sources</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="CRITICAL">Critical Only</SelectItem>
              <SelectItem value="ERROR">Errors Only</SelectItem>
              <SelectItem value="WARNING">Warnings Only</SelectItem>
            </SelectContent>
          </Select>

          <div className="max-w-md flex-1">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder="Search IP, action, or description..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="threats">Top Threats</TabsTrigger>
          <TabsTrigger value="blocked">Blocked IPs</TabsTrigger>
        </TabsList>

        {/* Security Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Showing {filteredLogs.length} events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.slice(0, 50).map((log) => (
                      <TableRow key={log.audit_id}>
                        <TableCell className="text-xs">
                          {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={log.severity} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ip_address || "unknown"}
                        </TableCell>
                        <TableCell className="text-xs">{log.action}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs">
                          {log.description}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <pre className="text-xs">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Threats Tab */}
        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Threat Sources</CardTitle>
              <CardDescription>IPs with highest threat scores</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Threat Score</TableHead>
                    <TableHead>Event Count</TableHead>
                    <TableHead>Threat Patterns</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {threatSources.map((threat) => (
                    <TableRow key={threat.ip}>
                      <TableCell className="font-mono">{threat.ip}</TableCell>
                      <TableCell>
                        <ThreatScoreBadge score={threat.threatScore} />
                      </TableCell>
                      <TableCell>{threat.eventCount}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {threat.patterns.map((pattern) => (
                            <Badge key={pattern} variant="outline" className="text-xs">
                              {pattern.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" disabled={threat.threatScore < 50}>
                          <Ban className="mr-1 h-3 w-3" />
                          Block IP
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blocked IPs Tab */}
        <TabsContent value="blocked" className="space-y-4">
          <BlockedIPsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Severity Badge Component
 */
function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, "default" | "destructive" | "secondary"> = {
    CRITICAL: "destructive",
    ERROR: "destructive",
    WARNING: "secondary",
    INFO: "default",
  };

  return <Badge variant={variants[severity] || "default"}>{severity}</Badge>;
}

/**
 * Threat Score Badge Component
 */
function ThreatScoreBadge({ score }: { score: number }) {
  let variant: "default" | "destructive" | "secondary" = "default";
  let label = "Low";

  if (score >= 75) {
    variant = "destructive";
    label = "Critical";
  } else if (score >= 50) {
    variant = "destructive";
    label = "High";
  } else if (score >= 25) {
    variant = "secondary";
    label = "Medium";
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant}>{label}</Badge>
      <span className="text-sm font-medium">{score}</span>
    </div>
  );
}

/**
 * Blocked IPs List Component
 */
function BlockedIPsList() {
  // This would fetch from KV store in production
  const blockedIPs = [
    {
      ip: "192.168.1.100",
      reason: "Multiple failed login attempts",
      blockedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currently Blocked IPs</CardTitle>
        <CardDescription>IPs that are temporarily blocked due to security threats</CardDescription>
      </CardHeader>
      <CardContent>
        {blockedIPs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Blocked At</TableHead>
                <TableHead>Expires At</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedIPs.map((blocked) => (
                <TableRow key={blocked.ip}>
                  <TableCell className="font-mono">{blocked.ip}</TableCell>
                  <TableCell>{blocked.reason}</TableCell>
                  <TableCell>{format(new Date(blocked.blockedAt), "MMM d, HH:mm")}</TableCell>
                  <TableCell>{format(new Date(blocked.expiresAt), "MMM d, HH:mm")}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      <UserX className="mr-1 h-3 w-3" />
                      Unblock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Alert>
            <AlertDescription>No IPs are currently blocked.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
