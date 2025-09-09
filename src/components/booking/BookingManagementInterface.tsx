/**
 * Booking Management Interface
 *
 * Professional Enterprise Design System unified interface for staff booking management.
 * Combines calendar view, booking entry, payment tracking, and room status management
 * in a dense, efficient layout optimized for operational workflows.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Import our booking components
import StaffBookingCalendar from "./StaffBookingCalendar";
import StaffBookingEntryForm from "./StaffBookingEntryForm";
import PaymentStatusTracker from "./PaymentStatusTracker";
import RoomStatusManager from "./RoomStatusManager";

// Types for the unified interface
interface BookingManagementData {
  calendar: {
    selectedDate: Date;
    availability: Array<{
      date: Date;
      rooms: Array<{
        roomId: string;
        roomNumber: string;
        roomType: string;
        status: "available" | "booked" | "maintenance" | "blocked";
        booking?: {
          id: string;
          guestName: string;
          status: "confirmed" | "pending" | "checked_in" | "checked_out";
          checkIn: Date;
          checkOut: Date;
          amount: number;
        };
      }>;
    }>;
  };
  rooms: Array<{
    id: string;
    roomNumber: string;
    roomType: string;
    basePrice: number;
    capacity: number;
    floor: number;
    status: "available" | "occupied" | "maintenance" | "cleaning" | "out_of_order" | "blocked";
    lastCleaned?: Date;
    lastMaintenance?: Date;
    notes?: string;
    estimatedReady?: Date;
    assignedStaff?: string;
  }>;
  payments: Array<{
    id: string;
    bookingCode: string;
    guestName: string;
    roomNumber: string;
    checkInDate: Date;
    checkOutDate: Date;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: "pending" | "partial" | "completed" | "overdue" | "refunded" | "cancelled";
    paymentMethod?: string;
    lastPaymentDate?: Date;
    dueDate?: Date;
    notes?: string;
  }>;
}

interface BookingManagementCallbacks {
  // Calendar callbacks
  onDateSelect: (date: Date) => void;
  onRoomSelect: (roomId: string, date: Date) => void;

  // Booking form callbacks
  onBookingSubmit: (data: any) => Promise<void>;
  onBookingCancel: () => void;

  // Payment tracking callbacks
  onPaymentSelect?: (paymentId: string) => void;
  onPaymentStatusUpdate?: (paymentId: string, newStatus: string) => void;

  // Room management callbacks
  onRoomStatusUpdate: (
    roomId: string,
    newStatus: string,
    notes?: string,
    estimatedReady?: Date
  ) => Promise<void>;
  onMaintenanceSchedule?: (
    roomId: string,
    type: string,
    estimatedReady: Date,
    notes: string
  ) => Promise<void>;
}

interface BookingManagementInterfaceProps {
  /** Data for all booking components */
  data: BookingManagementData;
  /** Callbacks for all actions */
  callbacks: BookingManagementCallbacks;
  /** Loading states */
  loading?: {
    calendar?: boolean;
    rooms?: boolean;
    payments?: boolean;
  };
  /** Feature toggles */
  features?: {
    allowPaymentStatusUpdates?: boolean;
    allowMaintenanceScheduling?: boolean;
    showPaymentTracker?: boolean;
    showRoomManager?: boolean;
  };
  /** Initial tab selection */
  defaultTab?: "calendar" | "rooms" | "payments";
}

export const BookingManagementInterface: React.FC<BookingManagementInterfaceProps> = ({
  data,
  callbacks,
  loading = {},
  features = {
    allowPaymentStatusUpdates: false,
    allowMaintenanceScheduling: true,
    showPaymentTracker: true,
    showRoomManager: true,
  },
  defaultTab = "calendar",
}) => {
  const [activeTab, setActiveTab] = React.useState(defaultTab);
  const [showBookingForm, setShowBookingForm] = React.useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = React.useState<string | null>(null);
  const [selectedDatesForBooking, setSelectedDatesForBooking] = React.useState<{
    checkIn: Date;
    checkOut: Date;
  } | null>(null);

  // Calculate dashboard summary statistics
  const dashboardStats = React.useMemo(() => {
    const totalRooms = data.rooms.length;
    const availableRooms = data.rooms.filter((r) => r.status === "available").length;
    const occupiedRooms = data.rooms.filter((r) => r.status === "occupied").length;
    const maintenanceRooms = data.rooms.filter(
      (r) => r.status === "maintenance" || r.status === "out_of_order"
    ).length;

    const pendingPayments = data.payments.filter(
      (p) => p.paymentStatus === "pending" || p.paymentStatus === "partial"
    ).length;
    const overduePayments = data.payments.filter((p) => p.paymentStatus === "overdue").length;
    const outstandingBalance = data.payments
      .filter((p) => ["pending", "partial", "overdue"].includes(p.paymentStatus))
      .reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0);

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      maintenanceRooms,
      occupancyRate,
      pendingPayments,
      overduePayments,
      outstandingBalance,
    };
  }, [data.rooms, data.payments]);

  // Handle room selection from calendar for booking
  const handleRoomSelectForBooking = (roomId: string, date: Date) => {
    setSelectedRoomForBooking(roomId);
    // Set check-in date to selected date, check-out to next day
    setSelectedDatesForBooking({
      checkIn: date,
      checkOut: new Date(date.getTime() + 24 * 60 * 60 * 1000),
    });
    setShowBookingForm(true);
  };

  // Handle booking form submission
  const handleBookingSubmit = async (formData: any) => {
    try {
      await callbacks.onBookingSubmit(formData);
      setShowBookingForm(false);
      setSelectedRoomForBooking(null);
      setSelectedDatesForBooking(null);
    } catch (error) {
      console.error("Booking submission failed:", error);
      // Error handling is done in the form component
    }
  };

  const handleBookingCancel = () => {
    setShowBookingForm(false);
    setSelectedRoomForBooking(null);
    setSelectedDatesForBooking(null);
    callbacks.onBookingCancel();
  };

  return (
    <div className="space-y-6">
      {/* Enterprise Dashboard Header */}
      <Card className="border-neutral-200 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-neutral-900">
              Booking Management Dashboard
            </CardTitle>
            <Button
              onClick={() => setShowBookingForm(true)}
              className="bg-blue-600 px-4 hover:bg-blue-700"
            >
              New Booking
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Enterprise KPI Cards - Horizontal Layout */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {/* Room Statistics */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="text-2xl font-bold text-green-800">
                {dashboardStats.availableRooms}
              </div>
              <div className="text-sm font-medium text-green-700">Available</div>
              <div className="text-xs text-green-600">of {dashboardStats.totalRooms} rooms</div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-2xl font-bold text-blue-800">{dashboardStats.occupiedRooms}</div>
              <div className="text-sm font-medium text-blue-700">Occupied</div>
              <div className="text-xs text-blue-600">{dashboardStats.occupancyRate}% occupancy</div>
            </div>

            {dashboardStats.maintenanceRooms > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <div className="text-2xl font-bold text-orange-800">
                  {dashboardStats.maintenanceRooms}
                </div>
                <div className="text-sm font-medium text-orange-700">Maintenance</div>
                <div className="text-xs text-orange-600">needs attention</div>
              </div>
            )}

            {/* Payment Statistics */}
            {features.showPaymentTracker && (
              <>
                {dashboardStats.pendingPayments > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                    <div className="text-2xl font-bold text-yellow-800">
                      {dashboardStats.pendingPayments}
                    </div>
                    <div className="text-sm font-medium text-yellow-700">Pending</div>
                    <div className="text-xs text-yellow-600">payments due</div>
                  </div>
                )}

                {dashboardStats.overduePayments > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="text-2xl font-bold text-red-800">
                      {dashboardStats.overduePayments}
                    </div>
                    <div className="text-sm font-medium text-red-700">Overdue</div>
                    <div className="text-xs text-red-600">requires action</div>
                  </div>
                )}

                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="font-mono text-lg font-bold text-neutral-800">
                    ₱{dashboardStats.outstandingBalance.toLocaleString()}
                  </div>
                  <div className="text-sm font-medium text-neutral-700">Outstanding</div>
                  <div className="text-xs text-neutral-600">balance due</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enterprise Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="rounded-t-lg border-b border-neutral-200 bg-white">
          <TabsList className="grid h-12 grid-cols-2 bg-transparent p-1 lg:grid-cols-4">
            <TabsTrigger
              value="calendar"
              className="text-sm font-medium data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
            >
              Calendar View
            </TabsTrigger>
            {features.showRoomManager && (
              <TabsTrigger
                value="rooms"
                className="text-sm font-medium data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
              >
                Room Status
              </TabsTrigger>
            )}
            {features.showPaymentTracker && (
              <TabsTrigger
                value="payments"
                className="text-sm font-medium data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
              >
                Payment Tracker
                {(dashboardStats.pendingPayments > 0 || dashboardStats.overduePayments > 0) && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                    {dashboardStats.pendingPayments + dashboardStats.overduePayments}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <StaffBookingCalendar
            selectedDate={data.calendar.selectedDate}
            onDateSelect={callbacks.onDateSelect}
            onRoomSelect={handleRoomSelectForBooking}
            availability={data.calendar.availability}
            isLoading={loading.calendar}
          />
        </TabsContent>

        {/* Room Status Tab */}
        {features.showRoomManager && (
          <TabsContent value="rooms" className="space-y-4">
            <RoomStatusManager
              rooms={data.rooms}
              isLoading={loading.rooms}
              onStatusUpdate={callbacks.onRoomStatusUpdate}
              onMaintenanceSchedule={callbacks.onMaintenanceSchedule}
              allowMaintenanceScheduling={features.allowMaintenanceScheduling}
            />
          </TabsContent>
        )}

        {/* Payment Tracker Tab */}
        {features.showPaymentTracker && (
          <TabsContent value="payments" className="space-y-4">
            <PaymentStatusTracker
              payments={data.payments}
              isLoading={loading.payments}
              onPaymentSelect={callbacks.onPaymentSelect}
              onStatusUpdate={callbacks.onPaymentStatusUpdate}
              allowStatusUpdates={features.allowPaymentStatusUpdates}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Booking Entry Form Dialog */}
      <Dialog open={showBookingForm} onOpenChange={(open) => !open && handleBookingCancel()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>New Booking Entry</DialogTitle>
          </DialogHeader>
          <StaffBookingEntryForm
            rooms={data.rooms.filter((room) => room.status === "available")}
            selectedRoomId={selectedRoomForBooking || undefined}
            selectedDates={selectedDatesForBooking || undefined}
            onSubmit={handleBookingSubmit}
            onCancel={handleBookingCancel}
            mode="create"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingManagementInterface;
