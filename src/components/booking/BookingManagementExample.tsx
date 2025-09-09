/**
 * Booking Management Interface Usage Example
 *
 * Professional Enterprise Design System implementation example for Okaeri Resort staff.
 * Demonstrates proper data flow, error handling, and business logic integration.
 */

import * as React from "react";
import { BookingManagementInterface } from "./BookingManagementInterface";
import { addDays, format } from "date-fns";

// Mock data generator for demonstration
const generateMockData = () => {
  const today = new Date();

  // Sample rooms
  const rooms = [
    {
      id: "room-001",
      roomNumber: "101",
      roomType: "Standard Double",
      basePrice: 3500,
      capacity: 2,
      floor: 1,
      status: "available" as const,
      lastCleaned: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      id: "room-002",
      roomNumber: "102",
      roomType: "Standard Double",
      basePrice: 3500,
      capacity: 2,
      floor: 1,
      status: "occupied" as const,
      assignedStaff: "Maria Santos",
    },
    {
      id: "room-003",
      roomNumber: "201",
      roomType: "Deluxe Queen",
      basePrice: 4500,
      capacity: 2,
      floor: 2,
      status: "maintenance" as const,
      notes: "AC unit requires repair",
      estimatedReady: addDays(today, 2),
      assignedStaff: "Juan Rodriguez",
    },
    {
      id: "room-004",
      roomNumber: "202",
      roomType: "Deluxe Queen",
      basePrice: 4500,
      capacity: 2,
      floor: 2,
      status: "cleaning" as const,
      lastCleaned: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      assignedStaff: "Anna Cruz",
    },
  ];

  // Sample calendar availability
  const availability = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return {
      date,
      rooms: rooms.map((room) => ({
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        status:
          i === 0 && room.id === "room-002"
            ? ("booked" as const)
            : room.status === "occupied"
              ? ("booked" as const)
              : room.status === "maintenance"
                ? ("maintenance" as const)
                : ("available" as const),
        booking:
          i === 0 && room.id === "room-002"
            ? {
                id: "booking-001",
                guestName: "John Dela Cruz",
                status: "confirmed" as const,
                checkIn: date,
                checkOut: addDays(date, 2),
                amount: 7000,
              }
            : undefined,
      })),
    };
  });

  // Sample payment records
  const payments = [
    {
      id: "payment-001",
      bookingCode: "BK-2024-001",
      guestName: "John Dela Cruz",
      roomNumber: "102",
      checkInDate: today,
      checkOutDate: addDays(today, 2),
      totalAmount: 7000,
      paidAmount: 3500,
      paymentStatus: "partial" as const,
      paymentMethod: "GCash",
      lastPaymentDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      dueDate: addDays(today, 1),
    },
    {
      id: "payment-002",
      bookingCode: "BK-2024-002",
      guestName: "Maria Garcia",
      roomNumber: "201",
      checkInDate: addDays(today, 3),
      checkOutDate: addDays(today, 5),
      totalAmount: 9000,
      paidAmount: 9000,
      paymentStatus: "completed" as const,
      paymentMethod: "Bank Transfer",
      lastPaymentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      id: "payment-003",
      bookingCode: "BK-2024-003",
      guestName: "Robert Tan",
      roomNumber: "101",
      checkInDate: addDays(today, -2), // 2 days ago (overdue)
      checkOutDate: today,
      totalAmount: 3500,
      paidAmount: 0,
      paymentStatus: "overdue" as const,
      dueDate: addDays(today, -1), // Yesterday
      notes: "Guest checked out but payment not received",
    },
  ];

  return {
    calendar: {
      selectedDate: today,
      availability,
    },
    rooms,
    payments,
  };
};

export const BookingManagementExample: React.FC = () => {
  const [data, setData] = React.useState(generateMockData());
  const [loading, setLoading] = React.useState({
    calendar: false,
    rooms: false,
    payments: false,
  });

  // Simulate API calls with loading states
  const simulateApiCall = async (operation: string, duration = 1000) => {
    console.log(`Starting ${operation}...`);
    await new Promise((resolve) => setTimeout(resolve, duration));
    console.log(`Completed ${operation}`);
  };

  // Calendar callbacks
  const handleDateSelect = (date: Date) => {
    setData((prev) => ({
      ...prev,
      calendar: {
        ...prev.calendar,
        selectedDate: date,
      },
    }));
  };

  const handleRoomSelect = (roomId: string, date: Date) => {
    console.log(`Room ${roomId} selected for date ${format(date, "yyyy-MM-dd")}`);
  };

  // Booking form callbacks
  const handleBookingSubmit = async (formData: any) => {
    setLoading((prev) => ({ ...prev, calendar: true }));

    try {
      await simulateApiCall("Creating booking", 2000);

      // Update calendar availability
      const newBooking = {
        id: `booking-${Date.now()}`,
        guestName: formData.guestName,
        status: formData.bookingStatus,
        checkIn: new Date(formData.checkInDate),
        checkOut: new Date(formData.checkOutDate),
        amount: formData.totalAmount,
      };

      setData((prev) => ({
        ...prev,
        calendar: {
          ...prev.calendar,
          availability: prev.calendar.availability.map((day) => ({
            ...day,
            rooms: day.rooms.map((room) =>
              room.roomId === formData.roomId &&
              day.date >= new Date(formData.checkInDate) &&
              day.date < new Date(formData.checkOutDate)
                ? { ...room, status: "booked" as const, booking: newBooking }
                : room
            ),
          })),
        },
        // Add payment record
        payments: [
          ...prev.payments,
          {
            id: `payment-${Date.now()}`,
            bookingCode: `BK-2024-${String(prev.payments.length + 1).padStart(3, "0")}`,
            guestName: formData.guestName,
            roomNumber: prev.rooms.find((r) => r.id === formData.roomId)?.roomNumber || "",
            checkInDate: new Date(formData.checkInDate),
            checkOutDate: new Date(formData.checkOutDate),
            totalAmount: formData.totalAmount,
            paidAmount: formData.paidAmount,
            paymentStatus: formData.paymentStatus,
          },
        ],
      }));

      alert("Booking created successfully!");
    } catch (error) {
      console.error("Booking creation failed:", error);
      alert("Failed to create booking. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, calendar: false }));
    }
  };

  const handleBookingCancel = () => {
    console.log("Booking creation cancelled");
  };

  // Payment tracking callbacks
  const handlePaymentSelect = (paymentId: string) => {
    const payment = data.payments.find((p) => p.id === paymentId);
    if (payment) {
      alert(
        `Payment details for ${payment.bookingCode}:\nGuest: ${payment.guestName}\nTotal: ₱${payment.totalAmount.toLocaleString()}\nPaid: ₱${payment.paidAmount.toLocaleString()}\nStatus: ${payment.paymentStatus}`
      );
    }
  };

  const handlePaymentStatusUpdate = async (paymentId: string, newStatus: string) => {
    setLoading((prev) => ({ ...prev, payments: true }));

    try {
      await simulateApiCall("Updating payment status", 1000);

      setData((prev) => ({
        ...prev,
        payments: prev.payments.map((payment) =>
          payment.id === paymentId ? { ...payment, paymentStatus: newStatus as any } : payment
        ),
      }));

      alert(`Payment status updated to: ${newStatus}`);
    } catch (error) {
      console.error("Payment status update failed:", error);
      alert("Failed to update payment status. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, payments: false }));
    }
  };

  // Room management callbacks
  const handleRoomStatusUpdate = async (
    roomId: string,
    newStatus: string,
    notes?: string,
    estimatedReady?: Date
  ) => {
    setLoading((prev) => ({ ...prev, rooms: true }));

    try {
      await simulateApiCall("Updating room status", 1000);

      setData((prev) => ({
        ...prev,
        rooms: prev.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                status: newStatus as any,
                notes,
                estimatedReady,
                lastMaintenance: newStatus === "maintenance" ? new Date() : room.lastMaintenance,
              }
            : room
        ),
      }));

      alert(`Room status updated to: ${newStatus}`);
    } catch (error) {
      console.error("Room status update failed:", error);
      alert("Failed to update room status. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, rooms: false }));
    }
  };

  const handleMaintenanceSchedule = async (
    roomId: string,
    type: string,
    estimatedReady: Date,
    notes: string
  ) => {
    setLoading((prev) => ({ ...prev, rooms: true }));

    try {
      await simulateApiCall("Scheduling maintenance", 1500);

      setData((prev) => ({
        ...prev,
        rooms: prev.rooms.map((room) =>
          room.id === roomId
            ? {
                ...room,
                status: "maintenance" as const,
                notes: `${type}: ${notes}`,
                estimatedReady,
                lastMaintenance: new Date(),
              }
            : room
        ),
      }));

      alert(
        `Maintenance scheduled for room. Type: ${type}, Ready: ${format(estimatedReady, "MMM d, yyyy HH:mm")}`
      );
    } catch (error) {
      console.error("Maintenance scheduling failed:", error);
      alert("Failed to schedule maintenance. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, rooms: false }));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">
            Okaeri Resort - Staff Booking Management
          </h1>
          <p className="text-neutral-600">
            Professional booking management interface for internal staff operations. Dense,
            efficient design optimized for operational workflows.
          </p>
        </div>

        <BookingManagementInterface
          data={data}
          loading={loading}
          callbacks={{
            onDateSelect: handleDateSelect,
            onRoomSelect: handleRoomSelect,
            onBookingSubmit: handleBookingSubmit,
            onBookingCancel: handleBookingCancel,
            onPaymentSelect: handlePaymentSelect,
            onPaymentStatusUpdate: handlePaymentStatusUpdate,
            onRoomStatusUpdate: handleRoomStatusUpdate,
            onMaintenanceSchedule: handleMaintenanceSchedule,
          }}
          features={{
            allowPaymentStatusUpdates: true,
            allowMaintenanceScheduling: true,
            showPaymentTracker: true,
            showRoomManager: true,
          }}
          defaultTab="calendar"
        />
      </div>
    </div>
  );
};

export default BookingManagementExample;
