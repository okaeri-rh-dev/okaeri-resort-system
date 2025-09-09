/**
 * Staff Booking Calendar Component
 *
 * Professional Enterprise Design System calendar for internal staff use.
 * Dense layout optimized for operational efficiency with high information density.
 * Mobile-responsive design for staff tablets/phones.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isToday } from "date-fns";

// Enterprise status definitions with professional color scheme
const ROOM_STATUS = {
  AVAILABLE: "available",
  BOOKED: "booked",
  MAINTENANCE: "maintenance",
  BLOCKED: "blocked",
} as const;

const BOOKING_STATUS = {
  CONFIRMED: "confirmed",
  PENDING: "pending",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
} as const;

type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];
type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

interface RoomAvailability {
  roomId: string;
  roomNumber: string;
  roomType: string;
  status: RoomStatus;
  booking?: {
    id: string;
    guestName: string;
    status: BookingStatus;
    checkIn: Date;
    checkOut: Date;
    amount: number;
  };
}

interface CalendarDay {
  date: Date;
  rooms: RoomAvailability[];
}

interface StaffBookingCalendarProps {
  /** Current selected date */
  selectedDate: Date;
  /** Callback when date is selected */
  onDateSelect: (date: Date) => void;
  /** Callback when room cell is clicked */
  onRoomSelect: (roomId: string, date: Date) => void;
  /** Room availability data */
  availability: CalendarDay[];
  /** Show week view (default) or month view */
  viewMode?: "week" | "month";
  /** Loading state */
  isLoading?: boolean;
}

// Enterprise status styling - minimal, professional, high contrast
const getStatusBadgeVariant = (status: RoomStatus | BookingStatus) => {
  switch (status) {
    case ROOM_STATUS.AVAILABLE:
      return "default"; // Neutral gray
    case ROOM_STATUS.BOOKED:
    case BOOKING_STATUS.CONFIRMED:
      return "secondary"; // Blue primary
    case ROOM_STATUS.MAINTENANCE:
      return "destructive"; // Red for attention
    case BOOKING_STATUS.PENDING:
      return "outline"; // Outlined for pending states
    case BOOKING_STATUS.CHECKED_IN:
      return "secondary"; // Active blue
    case BOOKING_STATUS.CHECKED_OUT:
      return "default"; // Neutral completed
    default:
      return "default";
  }
};

const getStatusText = (room: RoomAvailability): string => {
  if (room.status === ROOM_STATUS.AVAILABLE) return "Available";
  if (room.status === ROOM_STATUS.MAINTENANCE) return "Maintenance";
  if (room.status === ROOM_STATUS.BLOCKED) return "Blocked";
  if (room.booking) {
    const status = room.booking.status;
    if (status === BOOKING_STATUS.CONFIRMED) return "Confirmed";
    if (status === BOOKING_STATUS.PENDING) return "Pending";
    if (status === BOOKING_STATUS.CHECKED_IN) return "Checked In";
    if (status === BOOKING_STATUS.CHECKED_OUT) return "Checked Out";
  }
  return "Booked";
};

export const StaffBookingCalendar: React.FC<StaffBookingCalendarProps> = ({
  selectedDate,
  onDateSelect,
  onRoomSelect,
  availability,
  viewMode = "week",
  isLoading = false,
}) => {
  // Calculate week range for current selected date
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get unique rooms from availability data
  const allRooms = React.useMemo(() => {
    const roomMap = new Map<string, { roomNumber: string; roomType: string }>();
    availability.forEach((day) => {
      day.rooms.forEach((room) => {
        if (!roomMap.has(room.roomId)) {
          roomMap.set(room.roomId, {
            roomNumber: room.roomNumber,
            roomType: room.roomType,
          });
        }
      });
    });
    return Array.from(roomMap.entries())
      .map(([id, info]) => ({
        id,
        ...info,
      }))
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  }, [availability]);

  // Get room availability for specific date
  const getRoomForDate = (roomId: string, date: Date): RoomAvailability | null => {
    const dayData = availability.find((day) => isSameDay(day.date, date));
    return dayData?.rooms.find((room) => room.roomId === roomId) || null;
  };

  // Navigation handlers
  const goToPreviousWeek = () => {
    onDateSelect(addDays(selectedDate, -7));
  };

  const goToNextWeek = () => {
    onDateSelect(addDays(selectedDate, 7));
  };

  const goToToday = () => {
    onDateSelect(new Date());
  };

  if (isLoading) {
    return (
      <Card className="border-neutral-200">
        <CardContent className="p-6">
          <div className="flex h-96 items-center justify-center">
            <div className="text-sm text-neutral-500">Loading calendar...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-neutral-200 bg-white">
      {/* Enterprise Calendar Header - Compact Navigation */}
      <CardHeader className="border-b border-neutral-100 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-900">
            Room Availability Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousWeek}
              className="h-8 border-neutral-200 px-3 text-xs hover:bg-neutral-50"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 border-neutral-200 px-3 text-xs hover:bg-neutral-50"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextWeek}
              className="h-8 border-neutral-200 px-3 text-xs hover:bg-neutral-50"
            >
              Next
            </Button>
          </div>
        </div>

        {/* Week Range Display */}
        <div className="mt-1 text-sm font-medium text-neutral-600">
          {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Enterprise Dense Calendar Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Calendar Header - Days of Week */}
            <div className="grid grid-cols-8 border-b border-neutral-200 bg-neutral-50">
              {/* Room column header */}
              <div className="border-r border-neutral-200 p-3">
                <div className="text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Room
                </div>
              </div>

              {/* Date column headers */}
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "cursor-pointer border-r border-neutral-200 p-3 text-center hover:bg-neutral-100",
                    isSameDay(day, selectedDate) && "border-blue-200 bg-blue-50",
                    isToday(day) && "bg-blue-50 font-medium"
                  )}
                  onClick={() => onDateSelect(day)}
                >
                  <div className="text-xs font-medium tracking-wide text-neutral-700 uppercase">
                    {format(day, "E")}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-sm font-medium",
                      isToday(day) ? "text-blue-600" : "text-neutral-900"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar Body - Room Rows */}
            <div className="divide-y divide-neutral-100">
              {allRooms.map((room) => (
                <div key={room.id} className="hover:bg-neutral-25 grid grid-cols-8">
                  {/* Room Info Column */}
                  <div className="bg-neutral-25 border-r border-neutral-200 p-3">
                    <div className="text-sm font-medium text-neutral-900">{room.roomNumber}</div>
                    <div className="mt-1 text-xs text-neutral-600">{room.roomType}</div>
                  </div>

                  {/* Day Cells */}
                  {weekDays.map((day) => {
                    const roomData = getRoomForDate(room.id, day);

                    return (
                      <div
                        key={`${room.id}-${day.toISOString()}`}
                        className={cn(
                          "min-h-[60px] cursor-pointer border-r border-neutral-200 p-2 hover:bg-neutral-50",
                          isSameDay(day, selectedDate) && "bg-blue-25"
                        )}
                        onClick={() => onRoomSelect(room.id, day)}
                      >
                        {roomData && (
                          <div className="space-y-1">
                            {/* Status Badge */}
                            <Badge
                              variant={getStatusBadgeVariant(roomData.status)}
                              className="h-5 px-2 py-0.5 text-xs"
                            >
                              {getStatusText(roomData)}
                            </Badge>

                            {/* Booking Details */}
                            {roomData.booking && (
                              <div className="space-y-0.5">
                                <div className="truncate text-xs font-medium text-neutral-900">
                                  {roomData.booking.guestName}
                                </div>
                                <div className="font-mono text-xs text-neutral-600">
                                  ₱{roomData.booking.amount.toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enterprise Status Legend */}
        <div className="bg-neutral-25 border-t border-neutral-200 p-4">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="h-5">
                Available
              </Badge>
              <span className="text-neutral-600">Ready for booking</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5">
                Confirmed
              </Badge>
              <span className="text-neutral-600">Reservation confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-5">
                Pending
              </Badge>
              <span className="text-neutral-600">Awaiting confirmation</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="h-5">
                Maintenance
              </Badge>
              <span className="text-neutral-600">Room unavailable</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StaffBookingCalendar;
