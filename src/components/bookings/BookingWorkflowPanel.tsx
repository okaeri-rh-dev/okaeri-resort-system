/**
 * SIMPLIFIED FOR PHASE 2: Basic Booking Status Management
 *
 * Phase 3-4 will re-enable:
 * - Advanced workflow automation
 * - Business rule validation
 * - Automated triggers
 * - Cost monitoring
 * - Predictive analytics
 *
 * For now, this provides simple status update functionality.
 */

import { useState } from "react";

import { AlertCircle, CheckCircle, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Booking, BookingStatus } from "@/types";

interface BookingWorkflowPanelProps {
  booking: Booking;
  onBookingUpdate?: (booking: Booking) => void;
}

// Simple status transitions for Phase 2
const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["CheckedIn", "Cancelled"],
  CheckedIn: ["CheckedOut"],
  CheckedOut: [],
  Cancelled: [],
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Confirmed: "bg-blue-100 text-blue-800",
  CheckedIn: "bg-green-100 text-green-800",
  CheckedOut: "bg-gray-100 text-gray-800",
  Cancelled: "bg-red-100 text-red-800",
};

export function BookingWorkflowPanel({ booking, onBookingUpdate }: BookingWorkflowPanelProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const currentStatus = booking.booking_status as BookingStatus;
  const availableTransitions = STATUS_TRANSITIONS[currentStatus] || [];

  const handleStatusUpdate = async (newStatus: BookingStatus) => {
    setIsUpdating(true);
    try {
      // TODO: Phase 2 - Implement API call to update booking status
      const updatedBooking = {
        ...booking,
        booking_status: newStatus,
        updated_at: new Date().toISOString(),
      };

      onBookingUpdate?.(updatedBooking);
    } catch (error) {
      console.error("Failed to update booking status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Booking Status Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Current Status:</span>
          <Badge className={STATUS_COLORS[currentStatus]}>{currentStatus}</Badge>
        </div>

        {/* Available Transitions */}
        {availableTransitions.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Available Actions:</span>
            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusUpdate(status)}
                  disabled={isUpdating}
                >
                  <ChevronRight className="mr-1 h-3 w-3" />
                  Move to {status}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Status Info */}
        {currentStatus === "CheckedOut" && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Booking completed successfully
          </div>
        )}

        {currentStatus === "Cancelled" && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            This booking has been cancelled
          </div>
        )}

        {/* Phase 3-4 Preview */}
        <div className="mt-4 rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-600">
            <strong>Coming in Phase 3-4:</strong> Automated workflows, business rules, scheduled
            tasks, and cost monitoring.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
