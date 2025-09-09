/**
 * Room Status Manager Component
 *
 * Professional Enterprise Design System component for managing room statuses.
 * Dense grid layout optimized for staff to quickly update room availability.
 * Mobile-responsive design for maintenance staff using tablets/phones.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, SearchInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Enterprise room status definitions
const ROOM_STATUSES = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  MAINTENANCE: "maintenance",
  CLEANING: "cleaning",
  OUT_OF_ORDER: "out_of_order",
  BLOCKED: "blocked",
} as const;

const MAINTENANCE_TYPES = {
  ROUTINE: "routine",
  REPAIR: "repair",
  DEEP_CLEAN: "deep_clean",
  UPGRADE: "upgrade",
  INSPECTION: "inspection",
} as const;

type RoomStatus = (typeof ROOM_STATUSES)[keyof typeof ROOM_STATUSES];
type MaintenanceType = (typeof MAINTENANCE_TYPES)[keyof typeof MAINTENANCE_TYPES];

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  capacity: number;
  status: RoomStatus;
  lastCleaned?: Date;
  lastMaintenance?: Date;
  notes?: string;
  maintenanceType?: MaintenanceType;
  estimatedReady?: Date;
  assignedStaff?: string;
}

interface RoomStatusManagerProps {
  /** Room data to display */
  rooms: Room[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when room status is updated */
  onStatusUpdate: (
    roomId: string,
    newStatus: RoomStatus,
    notes?: string,
    estimatedReady?: Date
  ) => Promise<void>;
  /** Callback when maintenance is scheduled */
  onMaintenanceSchedule?: (
    roomId: string,
    type: MaintenanceType,
    estimatedReady: Date,
    notes: string
  ) => Promise<void>;
  /** Show maintenance scheduling */
  allowMaintenanceScheduling?: boolean;
}

// Enterprise status styling with operational focus
const getRoomStatusConfig = (status: RoomStatus) => {
  switch (status) {
    case ROOM_STATUSES.AVAILABLE:
      return {
        variant: "default" as const,
        className: "border-green-300 text-green-800 bg-green-50",
        label: "Available",
        color: "green",
      };
    case ROOM_STATUSES.OCCUPIED:
      return {
        variant: "secondary" as const,
        className: "border-blue-300 text-blue-800 bg-blue-50",
        label: "Occupied",
        color: "blue",
      };
    case ROOM_STATUSES.MAINTENANCE:
      return {
        variant: "destructive" as const,
        className: "border-orange-300 text-orange-800 bg-orange-50",
        label: "Maintenance",
        color: "orange",
      };
    case ROOM_STATUSES.CLEANING:
      return {
        variant: "outline" as const,
        className: "border-yellow-300 text-yellow-800 bg-yellow-50",
        label: "Cleaning",
        color: "yellow",
      };
    case ROOM_STATUSES.OUT_OF_ORDER:
      return {
        variant: "destructive" as const,
        className: "border-red-300 text-red-800 bg-red-50",
        label: "Out of Order",
        color: "red",
      };
    case ROOM_STATUSES.BLOCKED:
      return {
        variant: "outline" as const,
        className: "border-neutral-400 text-neutral-700 bg-neutral-100",
        label: "Blocked",
        color: "neutral",
      };
    default:
      return {
        variant: "outline" as const,
        className: "border-neutral-300 text-neutral-700 bg-neutral-50",
        label: "Unknown",
        color: "neutral",
      };
  }
};

const MaintenanceScheduleDialog: React.FC<{
  room: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (type: MaintenanceType, estimatedReady: Date, notes: string) => Promise<void>;
}> = ({ room, open, onOpenChange, onSchedule }) => {
  const [type, setType] = React.useState<MaintenanceType>(MAINTENANCE_TYPES.ROUTINE);
  const [estimatedReady, setEstimatedReady] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimatedReady) return;

    setIsSubmitting(true);
    try {
      await onSchedule(type, new Date(estimatedReady), notes);
      onOpenChange(false);
      setNotes("");
      setEstimatedReady("");
    } catch (error) {
      console.error("Failed to schedule maintenance:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Schedule Maintenance - {room.roomNumber}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maintenanceType" className="text-sm font-medium">
              Maintenance Type *
            </Label>
            <Select value={type} onValueChange={(value) => setType(value as MaintenanceType)}>
              <SelectTrigger className="h-9 border-neutral-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine Maintenance</SelectItem>
                <SelectItem value="repair">Repair Work</SelectItem>
                <SelectItem value="deep_clean">Deep Cleaning</SelectItem>
                <SelectItem value="upgrade">Room Upgrade</SelectItem>
                <SelectItem value="inspection">Safety Inspection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedReady" className="text-sm font-medium">
              Estimated Ready Date *
            </Label>
            <Input
              id="estimatedReady"
              type="datetime-local"
              value={estimatedReady}
              onChange={(e) => setEstimatedReady(e.target.value)}
              className="h-9 border-neutral-200"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenanceNotes" className="text-sm font-medium">
              Maintenance Notes
            </Label>
            <Textarea
              id="maintenanceNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] border-neutral-200"
              placeholder="Describe the maintenance work needed..."
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="border-neutral-200 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !estimatedReady}
              loading={isSubmitting}
              className="bg-orange-600 px-4 hover:bg-orange-700"
            >
              Schedule Maintenance
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const RoomStatusManager: React.FC<RoomStatusManagerProps> = ({
  rooms,
  isLoading = false,
  onStatusUpdate,
  onMaintenanceSchedule,
  allowMaintenanceScheduling = false,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<RoomStatus | "all">("all");
  const [floorFilter, setFloorFilter] = React.useState<number | "all">("all");
  const [selectedRoomForMaintenance, setSelectedRoomForMaintenance] = React.useState<Room | null>(
    null
  );

  // Filter rooms based on search and filters
  const filteredRooms = React.useMemo(() => {
    return rooms
      .filter((room) => {
        const matchesSearch =
          room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          room.roomType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          room.assignedStaff?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "all" || room.status === statusFilter;
        const matchesFloor = floorFilter === "all" || room.floor === floorFilter;

        return matchesSearch && matchesStatus && matchesFloor;
      })
      .sort((a, b) => {
        // Sort by room number naturally
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      });
  }, [rooms, searchTerm, statusFilter, floorFilter]);

  // Get unique floors for filter
  const floors = React.useMemo(() => {
    const uniqueFloors = Array.from(new Set(rooms.map((room) => room.floor))).sort((a, b) => a - b);
    return uniqueFloors;
  }, [rooms]);

  // Calculate status summary
  const statusSummary = React.useMemo(() => {
    return {
      available: rooms.filter((r) => r.status === ROOM_STATUSES.AVAILABLE).length,
      occupied: rooms.filter((r) => r.status === ROOM_STATUSES.OCCUPIED).length,
      maintenance: rooms.filter((r) => r.status === ROOM_STATUSES.MAINTENANCE).length,
      cleaning: rooms.filter((r) => r.status === ROOM_STATUSES.CLEANING).length,
      outOfOrder: rooms.filter((r) => r.status === ROOM_STATUSES.OUT_OF_ORDER).length,
      total: rooms.length,
    };
  }, [rooms]);

  const handleStatusChange = async (roomId: string, newStatus: RoomStatus) => {
    try {
      await onStatusUpdate(roomId, newStatus);
    } catch (error) {
      console.error("Failed to update room status:", error);
    }
  };

  const handleMaintenanceSchedule = async (
    type: MaintenanceType,
    estimatedReady: Date,
    notes: string
  ) => {
    if (!selectedRoomForMaintenance || !onMaintenanceSchedule) return;

    try {
      await onMaintenanceSchedule(selectedRoomForMaintenance.id, type, estimatedReady, notes);
      setSelectedRoomForMaintenance(null);
    } catch (error) {
      console.error("Failed to schedule maintenance:", error);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-neutral-200">
        <CardContent className="p-6">
          <div className="flex h-48 items-center justify-center">
            <div className="text-sm text-neutral-500">Loading room status...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-neutral-200 bg-white">
        {/* Enterprise Header with Status Summary */}
        <CardHeader className="border-b border-neutral-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-neutral-900">
              Room Status Manager
            </CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default" className="border-green-300 bg-green-50 text-green-800">
                {statusSummary.available} Available
              </Badge>
              <Badge variant="secondary" className="border-blue-300 bg-blue-50 text-blue-800">
                {statusSummary.occupied} Occupied
              </Badge>
              {statusSummary.maintenance > 0 && (
                <Badge
                  variant="destructive"
                  className="border-orange-300 bg-orange-50 text-orange-800"
                >
                  {statusSummary.maintenance} Maintenance
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-1 text-sm text-neutral-600">
            {statusSummary.total} total rooms • {statusSummary.available + statusSummary.cleaning}{" "}
            ready for guests
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Enterprise Filters */}
          <div className="bg-neutral-25 border-b border-neutral-100 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <SearchInput
                  placeholder="Search by room number, type, or staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 border-neutral-200"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as any)}
                >
                  <SelectTrigger className="h-9 w-36 border-neutral-200">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="out_of_order">Out of Order</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={floorFilter}
                  onValueChange={(value) => setFloorFilter(value === "all" ? "all" : Number(value))}
                >
                  <SelectTrigger className="h-9 w-24 border-neutral-200">
                    <SelectValue placeholder="Floor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {floors.map((floor) => (
                      <SelectItem key={floor} value={floor.toString()}>
                        Floor {floor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Enterprise Room Grid */}
          <div className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRooms.map((room) => {
                const statusConfig = getRoomStatusConfig(room.status);

                return (
                  <Card
                    key={room.id}
                    className={cn(
                      "cursor-pointer border-2 transition-shadow hover:shadow-md",
                      `border-${statusConfig.color}-200 bg-${statusConfig.color}-25`
                    )}
                  >
                    <CardContent className="p-4">
                      {/* Room Header */}
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="text-lg font-bold text-neutral-900">
                            {room.roomNumber}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {room.roomType} • Floor {room.floor}
                          </div>
                        </div>
                        <Badge
                          variant={statusConfig.variant}
                          className={cn("px-2 py-1 text-xs", statusConfig.className)}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>

                      {/* Room Details */}
                      <div className="mb-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Capacity:</span>
                          <span className="font-medium">{room.capacity} guests</span>
                        </div>

                        {room.lastCleaned && (
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Last Cleaned:</span>
                            <span className="text-neutral-900">
                              {format(room.lastCleaned, "MMM d, HH:mm")}
                            </span>
                          </div>
                        )}

                        {room.estimatedReady && (
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Ready By:</span>
                            <span className="font-medium text-neutral-900">
                              {format(room.estimatedReady, "MMM d, HH:mm")}
                            </span>
                          </div>
                        )}

                        {room.assignedStaff && (
                          <div className="flex justify-between">
                            <span className="text-neutral-600">Assigned:</span>
                            <span className="text-neutral-900">{room.assignedStaff}</span>
                          </div>
                        )}
                      </div>

                      {/* Status Controls */}
                      <div className="space-y-2">
                        <Select
                          value={room.status}
                          onValueChange={(newStatus) =>
                            handleStatusChange(room.id, newStatus as RoomStatus)
                          }
                        >
                          <SelectTrigger className="h-8 w-full border-neutral-200 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="occupied">Occupied</SelectItem>
                            <SelectItem value="cleaning">Cleaning</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="out_of_order">Out of Order</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>

                        {allowMaintenanceScheduling && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-full border-neutral-200 text-xs hover:bg-neutral-50"
                            onClick={() => setSelectedRoomForMaintenance(room)}
                          >
                            Schedule Maintenance
                          </Button>
                        )}
                      </div>

                      {/* Notes */}
                      {room.notes && (
                        <div className="mt-3 rounded border bg-neutral-50 p-2 text-xs">
                          <div className="mb-1 text-neutral-600">Notes:</div>
                          <div className="text-neutral-900">{room.notes}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Empty State */}
            {filteredRooms.length === 0 && (
              <div className="py-12 text-center">
                <div className="text-sm text-neutral-500">
                  {searchTerm || statusFilter !== "all" || floorFilter !== "all"
                    ? "No rooms match the current filters"
                    : "No rooms found"}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Scheduling Dialog */}
      {selectedRoomForMaintenance && allowMaintenanceScheduling && onMaintenanceSchedule && (
        <MaintenanceScheduleDialog
          room={selectedRoomForMaintenance}
          open={!!selectedRoomForMaintenance}
          onOpenChange={(open) => !open && setSelectedRoomForMaintenance(null)}
          onSchedule={handleMaintenanceSchedule}
        />
      )}
    </>
  );
};

export default RoomStatusManager;
