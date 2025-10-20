/**
 * Workflow Dashboard Component
 *
 * Comprehensive dashboard for monitoring and managing serverless booking workflows.
 * Displays real-time metrics, cost monitoring, execution history, and automated trigger status.
 *
 * @module WorkflowDashboard
 */

import React, { useState } from "react";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  Play,
  RefreshCw,
  Settings,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useBookingsNeedingAttention,
  useBookingWorkflowMetrics,
  useProcessWorkflowBatch,
} from "@/stores/useBookingStore";
import {
  useProcessBatchWorkflows,
  useWorkflowCostMonitoring,
  useWorkflowExecutionHistory,
  useWorkflowStore,
  useWorkflowSummary,
} from "@/stores/useWorkflowStore";

// ============================================
// COMPONENT INTERFACES
// ============================================

interface WorkflowDashboardProps {
  resortId?: string;
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  status?: "success" | "warning" | "danger" | "info";
}

interface ExecutionRowProps {
  execution: any;
  onViewDetails: (executionId: string) => void;
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  resortId = "resort-okaeri",
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [processingBatch, setProcessingBatch] = useState(false);

  // Store hooks
  const { executionMetrics, costAlerts, activeExecutions, dismissCostAlert } = useWorkflowStore();

  // Query hooks
  const workflowSummary = useWorkflowSummary(resortId);
  const workflowMetrics = useBookingWorkflowMetrics(resortId);
  const bookingsNeedingAttention = useBookingsNeedingAttention(resortId);
  const costMonitoring = useWorkflowCostMonitoring(resortId);
  const executionHistory = useWorkflowExecutionHistory(resortId);

  // Mutation hooks
  const processBatch = useProcessWorkflowBatch();

  const handleProcessBatch = async () => {
    setProcessingBatch(true);
    try {
      await processBatch.mutateAsync({
        resortId,
        triggerTypes: ["date", "payment", "time"],
        batchSize: 10,
        dryRun: false,
      });
    } catch (error) {
      console.error("Batch processing failed:", error);
    } finally {
      setProcessingBatch(false);
    }
  };

  const activeExecutionsList = Array.from(activeExecutions.values());
  const unreadCostAlerts = costAlerts.filter((alert) => !alert.dismissed);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage automated booking workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleProcessBatch} disabled={processingBatch}>
            {processingBatch ? (
              <Timer className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Process Batch
          </Button>
        </div>
      </div>

      {/* Cost Alerts */}
      {unreadCostAlerts.length > 0 && (
        <div className="space-y-2">
          {unreadCostAlerts.map((alert) => (
            <Alert
              key={alert.alertId}
              variant={alert.severity === "critical" ? "destructive" : "default"}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{alert.message}</span>
                <Button variant="ghost" size="sm" onClick={() => dismissCostAlert(alert.alertId)}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Active Executions */}
      {activeExecutionsList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeExecutionsList.map((execution) => (
                <div
                  key={execution.executionId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    <div>
                      <p className="font-medium">Booking {execution.bookingId}</p>
                      <p className="text-muted-foreground text-sm">{execution.currentStep}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={execution.progress} className="w-24" />
                    <Badge variant="outline">{execution.progress}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab
            workflowSummary={workflowSummary.data}
            workflowMetrics={workflowMetrics.data}
            bookingsNeedingAttention={bookingsNeedingAttention.data}
            costMonitoring={costMonitoring}
            executionMetrics={executionMetrics}
          />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <MetricsTab executionMetrics={executionMetrics} costMonitoring={costMonitoring} />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <HistoryTab
            executionHistory={executionHistory.data || []}
            isLoading={executionHistory.isLoading}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SettingsTab resortId={resortId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============================================
// TAB COMPONENTS
// ============================================

const OverviewTab: React.FC<{
  workflowSummary: any;
  workflowMetrics: any;
  bookingsNeedingAttention: any;
  costMonitoring: any;
  executionMetrics: any;
}> = ({
  workflowSummary,
  workflowMetrics,
  bookingsNeedingAttention,
  costMonitoring,
  executionMetrics,
}) => {
  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Bookings"
          value={workflowSummary?.totalBookings || 0}
          description="Active bookings in system"
          icon={<Activity className="h-4 w-4" />}
          status="info"
        />
        <MetricCard
          title="Automated Triggers"
          value={workflowSummary?.activeAutomatedTriggers || 0}
          description="Active automation rules"
          icon={<Zap className="h-4 w-4" />}
          status="success"
        />
        <MetricCard
          title="Pending Actions"
          value={workflowSummary?.pendingActions || 0}
          description="Actions waiting for execution"
          icon={<Clock className="h-4 w-4" />}
          status={workflowSummary?.pendingActions > 5 ? "warning" : "info"}
        />
        <MetricCard
          title="Monthly Cost"
          value={`$${(workflowSummary?.estimatedMonthlyCost || 0).toFixed(4)}`}
          description="Estimated workflow costs"
          icon={<DollarSign className="h-4 w-4" />}
          status="info"
        />
      </div>

      {/* Bookings Needing Attention */}
      {bookingsNeedingAttention && bookingsNeedingAttention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Bookings Needing Attention
            </CardTitle>
            <CardDescription>
              {bookingsNeedingAttention.length} bookings require immediate action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bookingsNeedingAttention.slice(0, 5).map((booking: any) => (
                <BookingAttentionRow key={booking.booking_id} booking={booking} />
              ))}
              {bookingsNeedingAttention.length > 5 && (
                <p className="text-muted-foreground text-center text-sm">
                  ... and {bookingsNeedingAttention.length - 5} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Monitoring */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Cost Usage</CardTitle>
            <CardDescription>
              ${costMonitoring.dailyCostUsage.toFixed(4)} / ${costMonitoring.dailyLimit.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress
              value={(costMonitoring.dailyCostUsage / costMonitoring.dailyLimit) * 100}
              className="w-full"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Statistics</CardTitle>
            <CardDescription>Workflow execution metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Success Rate</span>
                <span className="text-sm font-medium">
                  {executionMetrics.totalExecutions > 0
                    ? (
                        (executionMetrics.successfulExecutions / executionMetrics.totalExecutions) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Avg. Execution Time</span>
                <span className="text-sm font-medium">
                  {executionMetrics.averageExecutionTime}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total Cost</span>
                <span className="text-sm font-medium">
                  ${executionMetrics.totalCostSpent.toFixed(4)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MetricsTab: React.FC<{
  executionMetrics: any;
  costMonitoring: any;
}> = ({ executionMetrics, costMonitoring }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Executions"
          value={executionMetrics.totalExecutions}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Successful Executions"
          value={executionMetrics.successfulExecutions}
          icon={<CheckCircle className="h-4 w-4" />}
          status="success"
        />
        <MetricCard
          title="Failed Executions"
          value={executionMetrics.failedExecutions}
          icon={<AlertCircle className="h-4 w-4" />}
          status={executionMetrics.failedExecutions > 0 ? "warning" : "success"}
        />
        <MetricCard
          title="Automated Transitions"
          value={executionMetrics.automatedTransitions}
          icon={<Zap className="h-4 w-4" />}
        />
        <MetricCard
          title="Manual Transitions"
          value={executionMetrics.manualTransitions}
          icon={<Settings className="h-4 w-4" />}
        />
        <MetricCard
          title="Total Cost Spent"
          value={`$${executionMetrics.totalCostSpent.toFixed(4)}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Cost Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>Daily and monthly cost analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between">
                <span>Daily Usage</span>
                <span>${costMonitoring.dailyCostUsage.toFixed(4)}</span>
              </div>
              <Progress value={(costMonitoring.dailyCostUsage / costMonitoring.dailyLimit) * 100} />
            </div>
            <div>
              <div className="mb-2 flex justify-between">
                <span>Monthly Usage</span>
                <span>${costMonitoring.monthlyCostUsage.toFixed(4)}</span>
              </div>
              <Progress
                value={(costMonitoring.monthlyCostUsage / costMonitoring.monthlyLimit) * 100}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const HistoryTab: React.FC<{
  executionHistory: any[];
  isLoading: boolean;
}> = ({ executionHistory, isLoading }) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading execution history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution History</CardTitle>
        <CardDescription>Recent workflow executions and their results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {executionHistory.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No execution history available</p>
          ) : (
            executionHistory
              .slice(0, 10)
              .map((event, index) => (
                <ExecutionHistoryRow key={event.eventId || index} event={event} />
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const SettingsTab: React.FC<{ resortId: string }> = ({ resortId }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Configuration</CardTitle>
          <CardDescription>Configure automation settings and business rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                Workflow configuration interface coming soon. Contact system administrator for
                custom workflow setup.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================
// UTILITY COMPONENTS
// ============================================

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  status = "info",
}) => {
  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "text-green-600";
      case "warning":
        return "text-orange-600";
      case "danger":
        return "text-red-600";
      default:
        return "text-blue-600";
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={getStatusColor()}>{icon}</div>
          {trend && (
            <div
              className={`flex items-center text-xs ${
                trend.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              <TrendingUp className="mr-1 h-3 w-3" />
              {trend.value}%
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-muted-foreground text-xs">{title}</p>
          {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const BookingAttentionRow: React.FC<{ booking: any }> = ({ booking }) => {
  const getAttentionReason = () => {
    const now = new Date();
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);

    if (
      booking.booking_status === "Pending" &&
      checkIn <= new Date(Date.now() + 24 * 60 * 60 * 1000)
    ) {
      return "Check-in within 24 hours";
    }
    if (
      booking.booking_status === "Confirmed" &&
      booking.payment_status === "Pending" &&
      checkIn <= now
    ) {
      return "Payment overdue";
    }
    if (booking.booking_status === "Confirmed" && checkIn < now) {
      return "Overdue check-in";
    }
    if (booking.booking_status === "CheckedIn" && checkOut < now) {
      return "Overdue check-out";
    }
    return "Needs attention";
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <div>
          <p className="font-medium">{booking.guest_name}</p>
          <p className="text-muted-foreground text-sm">
            {booking.booking_reference} • {getAttentionReason()}
          </p>
        </div>
      </div>
      <Badge variant="outline" className="border-orange-600 text-orange-600">
        {booking.booking_status}
      </Badge>
    </div>
  );
};

const ExecutionHistoryRow: React.FC<{ event: any }> = ({ event }) => {
  const getEventIcon = () => {
    switch (event.eventType) {
      case "status_change":
        return <Activity className="h-4 w-4" />;
      case "payment_update":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventBadge = () => {
    switch (event.triggeredBy) {
      case "automation":
        return <Badge variant="secondary">Auto</Badge>;
      case "system":
        return <Badge variant="outline">System</Badge>;
      default:
        return <Badge variant="default">Manual</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        {getEventIcon()}
        <div>
          <p className="font-medium">
            {event.fromStatus} → {event.toStatus}
          </p>
          <p className="text-muted-foreground text-sm">
            Booking {event.bookingId} • {new Date(event.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
      {getEventBadge()}
    </div>
  );
};

export default WorkflowDashboard;
