/**
 * Example: Booking Page with Integrated Workflow Management
 *
 * Demonstrates how to integrate the comprehensive workflow system
 * into existing booking management pages. Shows both the booking
 * details and workflow management in a unified interface.
 *
 * This example serves as a template for implementing workflow
 * features in the Okaeri Resort System.
 *
 * @module BookingPageWithWorkflow
 */

import React, { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity,
  Calendar,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  User,
  Settings,
  BarChart3,
  Clock,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

// Workflow Components
import { BookingWorkflowPanel } from "@/components/bookings/BookingWorkflowPanel";
import { WorkflowStatusBadge } from "@/components/workflow/WorkflowStatusBadge";
import { WorkflowDashboard } from "@/components/workflow/WorkflowDashboard";

// Store Hooks
import {
  useBookingWithWorkflow,
  useBookingsNeedingAttention,
  useUpdateBookingStatusWithWorkflow,
} from "@/stores/useBookingStore";
import { useWorkflowStore, useWorkflowSummary } from "@/stores/useWorkflowStore";

// Types
import type { Booking, BookingStatus } from "@/types";

// ============================================
// MAIN COMPONENT
// ============================================

export const BookingPageWithWorkflow: React.FC = () => {
  const { bookingId } = useParams({ strict: false });
  const [activeTab, setActiveTab] = useState("details");
  const resortId = "resort-okaeri"; // In production, this would come from context/auth

  // Data fetching
  const { booking, workflowState, isLoading, error, refetch } = useBookingWithWorkflow(
    bookingId,
    resortId
  );

  const workflowSummary = useWorkflowSummary(resortId);
  const bookingsNeedingAttention = useBookingsNeedingAttention(resortId);
  const updateBookingStatus = useUpdateBookingStatusWithWorkflow();

  // State
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleBookingUpdate = (updatedBooking: Booking) => {
    // Handle booking updates from workflow panel
    console.log("Booking updated:", updatedBooking);
    refetch();
  };

  const handleQuickStatusUpdate = async (newStatus: BookingStatus) => {
    if (!booking) return;

    setUpdatingStatus(true);
    try {
      await updateBookingStatus.mutateAsync({
        bookingId: booking.booking_id,
        status: newStatus,
        resortId,
        triggeredBy: "user",
        metadata: {
          source: "quick_action",
          previousStatus: booking.booking_status,
        },
      });
      refetch();
    } catch (error) {
      console.error("Status update failed:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading booking details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error?.message || "Booking not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Booking Details</h1>
          <p className="text-muted-foreground">
            {booking.booking_reference} • {booking.guest_name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <WorkflowStatusBadge
            booking={booking}
            resortId={resortId}
            variant="detailed"
            showActions={true}
          />
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      {booking.booking_status !== "CheckedOut" && booking.booking_status !== "Cancelled" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getQuickActions(booking).map((action) => (
                <Button
                  key={action.status}
                  variant={action.variant}
                  size="sm"
                  onClick={() => handleQuickStatusUpdate(action.status)}
                  disabled={updatingStatus}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Booking Details */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <BookingDetailsCard booking={booking} />
              <GuestInformationCard booking={booking} />
              <PaymentInformationCard booking={booking} />
            </TabsContent>

            <TabsContent value="workflow" className="space-y-4">
              <WorkflowAnalyticsCard
                booking={booking}
                workflowState={workflowState}
                workflowSummary={workflowSummary.data}
              />
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <BookingHistoryCard booking={booking} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Workflow Panel */}
        <div className="space-y-4">
          <BookingWorkflowPanel
            booking={booking}
            resortId={resortId}
            onBookingUpdate={handleBookingUpdate}
          />

          {/* Related Bookings */}
          {bookingsNeedingAttention.data && bookingsNeedingAttention.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Other Bookings Needing Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bookingsNeedingAttention.data.slice(0, 3).map((relatedBooking: any) => (
                    <div
                      key={relatedBooking.booking_id}
                      className="flex items-center justify-between rounded border p-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{relatedBooking.guest_name}</p>
                        <p className="text-muted-foreground text-xs">
                          {relatedBooking.booking_reference}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{relatedBooking.booking_status}</Badge>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/bookings/${relatedBooking.booking_id}`}>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SUPPORTING COMPONENTS
// ============================================

const BookingDetailsCard: React.FC<{ booking: Booking }> = ({ booking }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        Booking Information
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground text-sm font-medium">Check-in</label>
          <p>{new Date(booking.check_in).toLocaleDateString()}</p>
        </div>
        <div>
          <label className="text-muted-foreground text-sm font-medium">Check-out</label>
          <p>{new Date(booking.check_out).toLocaleDateString()}</p>
        </div>
        <div>
          <label className="text-muted-foreground text-sm font-medium">Number of Guests</label>
          <p>{booking.num_guests}</p>
        </div>
        <div>
          <label className="text-muted-foreground text-sm font-medium">Total Amount</label>
          <p>₱{booking.total_amount.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-sm">
          Status: {booking.booking_status}
        </Badge>
        <Badge variant="outline" className="text-sm">
          Payment: {booking.payment_status}
        </Badge>
      </div>

      {booking.special_requests && (
        <div>
          <label className="text-muted-foreground text-sm font-medium">Special Requests</label>
          <p className="text-sm">{booking.special_requests}</p>
        </div>
      )}
    </CardContent>
  </Card>
);

const GuestInformationCard: React.FC<{ booking: Booking }> = ({ booking }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <User className="h-5 w-5" />
        Guest Information
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="text-muted-foreground h-4 w-4" />
        <span>{booking.guest_name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Mail className="text-muted-foreground h-4 w-4" />
        <span>{booking.email}</span>
      </div>
      <div className="flex items-center gap-2">
        <Phone className="text-muted-foreground h-4 w-4" />
        <span>{booking.contact_number}</span>
      </div>
    </CardContent>
  </Card>
);

const PaymentInformationCard: React.FC<{ booking: Booking }> = ({ booking }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Payment Information
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground text-sm font-medium">Status</label>
          <p>{booking.payment_status}</p>
        </div>
        <div>
          <label className="text-muted-foreground text-sm font-medium">Method</label>
          <p>{booking.payment_method || "Not specified"}</p>
        </div>
      </div>

      {booking.payment_proof_url && (
        <div>
          <label className="text-muted-foreground text-sm font-medium">Payment Proof</label>
          <Button variant="outline" size="sm" asChild className="mt-1">
            <a href={booking.payment_proof_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" />
              View Proof
            </a>
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
);

const WorkflowAnalyticsCard: React.FC<{
  booking: Booking;
  workflowState: any;
  workflowSummary: any;
}> = ({ booking, workflowState, workflowSummary }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        Workflow Analytics
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {workflowState && (
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">
              {workflowState.automatedTriggers?.filter((t: any) => t.isActive).length || 0}
            </p>
            <p className="text-muted-foreground text-sm">Active Triggers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{workflowState.nextActions?.length || 0}</p>
            <p className="text-muted-foreground text-sm">Available Actions</p>
          </div>
        </div>
      )}

      {workflowSummary && (
        <div className="border-t pt-4">
          <h4 className="mb-2 font-medium">Resort Summary</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Total Bookings: {workflowSummary.totalBookings}</div>
            <div>Pending Actions: {workflowSummary.pendingActions}</div>
            <div>Monthly Cost: ${workflowSummary.estimatedMonthlyCost?.toFixed(2)}</div>
            <div>Auto Triggers: {workflowSummary.activeAutomatedTriggers}</div>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);

const BookingHistoryCard: React.FC<{ booking: Booking }> = ({ booking }) => {
  // In production, fetch booking history/audit trail
  const mockHistory = [
    {
      id: 1,
      timestamp: booking.created_at,
      action: "Booking Created",
      user: "System",
      details: "Initial booking created",
    },
    {
      id: 2,
      timestamp: booking.updated_at,
      action: "Status Updated",
      user: "Admin",
      details: `Status changed to ${booking.booking_status}`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Booking History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockHistory.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 rounded border p-3">
              <div className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{entry.action}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
                <p className="text-muted-foreground text-sm">{entry.details}</p>
                <p className="text-muted-foreground text-xs">by {entry.user}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getQuickActions(booking: Booking) {
  const actions = [];

  switch (booking.booking_status) {
    case "Pending":
      actions.push({
        status: "Confirmed" as BookingStatus,
        label: "Confirm",
        variant: "default" as const,
        icon: <Activity className="mr-1 h-3 w-3" />,
      });
      actions.push({
        status: "Cancelled" as BookingStatus,
        label: "Cancel",
        variant: "destructive" as const,
        icon: <Activity className="mr-1 h-3 w-3" />,
      });
      break;

    case "Confirmed":
      if (booking.payment_status === "Completed") {
        actions.push({
          status: "CheckedIn" as BookingStatus,
          label: "Check In",
          variant: "default" as const,
          icon: <Activity className="mr-1 h-3 w-3" />,
        });
      }
      actions.push({
        status: "Cancelled" as BookingStatus,
        label: "Cancel",
        variant: "destructive" as const,
        icon: <Activity className="mr-1 h-3 w-3" />,
      });
      break;

    case "CheckedIn":
      actions.push({
        status: "CheckedOut" as BookingStatus,
        label: "Check Out",
        variant: "secondary" as const,
        icon: <Activity className="mr-1 h-3 w-3" />,
      });
      break;
  }

  return actions;
}

export default BookingPageWithWorkflow;
