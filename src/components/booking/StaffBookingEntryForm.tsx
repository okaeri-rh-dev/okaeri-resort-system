/**
 * Staff Booking Entry Form Component
 *
 * Professional Enterprise Design System form for manual booking entry.
 * Compact form design with right-aligned labels and inline validation.
 * Optimized for staff efficiency and data entry speed.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, CurrencyInput, PhoneInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Enterprise validation schema with Philippine business rules
const bookingEntrySchema = z
  .object({
    // Guest Information
    guestName: z
      .string()
      .min(2, "Guest name must be at least 2 characters")
      .max(255, "Guest name too long"),
    guestEmail: z.string().email("Invalid email format").optional().or(z.literal("")),
    guestPhone: z
      .string()
      .min(10, "Valid Philippine phone number required")
      .regex(/^\+63\s9\d{2}\s\d{3}\s\d{4}$/, "Format: +63 9XX XXX XXXX"),
    guestCount: z.number().min(1, "At least 1 guest required").max(20, "Maximum 20 guests allowed"),

    // Booking Details
    roomId: z.string().min(1, "Room selection required"),
    checkInDate: z.string().min(1, "Check-in date required"),
    checkOutDate: z.string().min(1, "Check-out date required"),

    // Financial Information
    totalAmount: z.number().min(0, "Amount must be positive").max(999999.99, "Amount too large"),
    paidAmount: z
      .number()
      .min(0, "Paid amount must be positive")
      .max(999999.99, "Amount too large"),

    // Status and Notes
    bookingStatus: z.enum(["pending", "confirmed", "checked_in"]),
    paymentStatus: z.enum(["pending", "partial", "completed"]),
    specialRequests: z.string().max(500, "Special requests too long").optional(),
  })
  .refine((data) => new Date(data.checkOutDate) > new Date(data.checkInDate), {
    message: "Check-out must be after check-in date",
    path: ["checkOutDate"],
  })
  .refine((data) => data.paidAmount <= data.totalAmount, {
    message: "Paid amount cannot exceed total amount",
    path: ["paidAmount"],
  });

type BookingEntryFormData = z.infer<typeof bookingEntrySchema>;

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  basePrice: number;
  capacity: number;
}

interface StaffBookingEntryFormProps {
  /** Available rooms for selection */
  rooms: Room[];
  /** Pre-selected room ID */
  selectedRoomId?: string;
  /** Pre-selected dates */
  selectedDates?: {
    checkIn: Date;
    checkOut: Date;
  };
  /** Form submission handler */
  onSubmit: (data: BookingEntryFormData) => Promise<void>;
  /** Form cancellation handler */
  onCancel: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Form mode */
  mode?: "create" | "edit";
  /** Initial form data for editing */
  initialData?: Partial<BookingEntryFormData>;
}

export const StaffBookingEntryForm: React.FC<StaffBookingEntryFormProps> = ({
  rooms,
  selectedRoomId,
  selectedDates,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = "create",
  initialData,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingEntryFormData>({
    resolver: zodResolver(bookingEntrySchema),
    defaultValues: {
      guestName: initialData?.guestName || "",
      guestEmail: initialData?.guestEmail || "",
      guestPhone: initialData?.guestPhone || "+63 ",
      guestCount: initialData?.guestCount || 2,
      roomId: selectedRoomId || initialData?.roomId || "",
      checkInDate: selectedDates?.checkIn
        ? format(selectedDates.checkIn, "yyyy-MM-dd")
        : initialData?.checkInDate || "",
      checkOutDate: selectedDates?.checkOut
        ? format(selectedDates.checkOut, "yyyy-MM-dd")
        : initialData?.checkOutDate || "",
      totalAmount: initialData?.totalAmount || 0,
      paidAmount: initialData?.paidAmount || 0,
      bookingStatus: initialData?.bookingStatus || "pending",
      paymentStatus: initialData?.paymentStatus || "pending",
      specialRequests: initialData?.specialRequests || "",
    },
  });

  // Watch form values for calculations
  const watchedValues = watch();
  const selectedRoom = rooms.find((room) => room.id === watchedValues.roomId);

  // Calculate nights and suggested total
  const calculateNights = React.useMemo(() => {
    if (!watchedValues.checkInDate || !watchedValues.checkOutDate) return 0;
    const checkIn = new Date(watchedValues.checkInDate);
    const checkOut = new Date(watchedValues.checkOutDate);
    const diffTime = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [watchedValues.checkInDate, watchedValues.checkOutDate]);

  const suggestedTotal = React.useMemo(() => {
    if (!selectedRoom || calculateNights <= 0) return 0;
    return selectedRoom.basePrice * calculateNights;
  }, [selectedRoom, calculateNights]);

  // Auto-fill total amount when room/dates change
  React.useEffect(() => {
    if (suggestedTotal > 0 && mode === "create") {
      setValue("totalAmount", suggestedTotal);
    }
  }, [suggestedTotal, setValue, mode]);

  const handleFormSubmit = async (data: BookingEntryFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("Booking submission error:", error);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-700 bg-green-50 border-green-200";
      case "partial":
        return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "pending":
        return "text-neutral-700 bg-neutral-50 border-neutral-200";
      default:
        return "text-neutral-700 bg-neutral-50 border-neutral-200";
    }
  };

  return (
    <Card className="max-w-2xl border-neutral-200 bg-white">
      <CardHeader className="border-b border-neutral-100 pb-4">
        <CardTitle className="text-lg font-semibold text-neutral-900">
          {mode === "create" ? "New Booking Entry" : "Edit Booking"}
        </CardTitle>
        <p className="mt-1 text-sm text-neutral-600">
          {mode === "create"
            ? "Manually record booking from phone/email/walk-in"
            : "Update existing booking information"}
        </p>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Guest Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium tracking-wide text-neutral-900 uppercase">
              Guest Information
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Guest Name */}
              <div className="space-y-2">
                <Label htmlFor="guestName" className="text-sm font-medium text-neutral-700">
                  Guest Name *
                </Label>
                <Input
                  id="guestName"
                  {...register("guestName")}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Full name"
                  error={errors.guestName?.message}
                />
              </div>

              {/* Guest Count */}
              <div className="space-y-2">
                <Label htmlFor="guestCount" className="text-sm font-medium text-neutral-700">
                  Number of Guests *
                </Label>
                <Input
                  id="guestCount"
                  type="number"
                  min="1"
                  max="20"
                  {...register("guestCount", { valueAsNumber: true })}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  error={errors.guestCount?.message}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Guest Phone */}
              <div className="space-y-2">
                <Label htmlFor="guestPhone" className="text-sm font-medium text-neutral-700">
                  Phone Number *
                </Label>
                <PhoneInput
                  id="guestPhone"
                  {...register("guestPhone")}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  error={errors.guestPhone?.message}
                />
              </div>

              {/* Guest Email */}
              <div className="space-y-2">
                <Label htmlFor="guestEmail" className="text-sm font-medium text-neutral-700">
                  Email Address
                </Label>
                <Input
                  id="guestEmail"
                  type="email"
                  {...register("guestEmail")}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="guest@example.com"
                  error={errors.guestEmail?.message}
                />
              </div>
            </div>
          </div>

          <Separator className="bg-neutral-200" />

          {/* Booking Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium tracking-wide text-neutral-900 uppercase">
              Booking Details
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Room Selection */}
              <div className="space-y-2">
                <Label htmlFor="roomId" className="text-sm font-medium text-neutral-700">
                  Room *
                </Label>
                <Select
                  value={watchedValues.roomId}
                  onValueChange={(value) => setValue("roomId", value)}
                >
                  <SelectTrigger className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">{room.roomNumber}</span>
                          <span className="ml-2 text-sm text-neutral-600">
                            {room.roomType} • ₱{room.basePrice.toLocaleString()}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.roomId && <p className="text-sm text-red-600">{errors.roomId.message}</p>}
              </div>

              {/* Check-in Date */}
              <div className="space-y-2">
                <Label htmlFor="checkInDate" className="text-sm font-medium text-neutral-700">
                  Check-in Date *
                </Label>
                <Input
                  id="checkInDate"
                  type="date"
                  {...register("checkInDate")}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  error={errors.checkInDate?.message}
                />
              </div>

              {/* Check-out Date */}
              <div className="space-y-2">
                <Label htmlFor="checkOutDate" className="text-sm font-medium text-neutral-700">
                  Check-out Date *
                </Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  {...register("checkOutDate")}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  error={errors.checkOutDate?.message}
                />
              </div>
            </div>

            {/* Booking Summary */}
            {selectedRoom && calculateNights > 0 && (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-sm text-neutral-600">
                  <span className="font-medium">{selectedRoom.roomNumber}</span> •
                  <span className="ml-1">
                    {calculateNights} night{calculateNights !== 1 ? "s" : ""}
                  </span>{" "}
                  •<span className="ml-1">₱{selectedRoom.basePrice.toLocaleString()}/night</span>
                </div>
                <div className="mt-1 text-sm font-medium text-neutral-900">
                  Suggested Total: ₱{suggestedTotal.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-neutral-200" />

          {/* Financial Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium tracking-wide text-neutral-900 uppercase">
              Payment Information
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Total Amount */}
              <div className="space-y-2">
                <Label htmlFor="totalAmount" className="text-sm font-medium text-neutral-700">
                  Total Amount *
                </Label>
                <CurrencyInput
                  id="totalAmount"
                  {...register("totalAmount", { valueAsNumber: true })}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  error={errors.totalAmount?.message}
                />
              </div>

              {/* Paid Amount */}
              <div className="space-y-2">
                <Label htmlFor="paidAmount" className="text-sm font-medium text-neutral-700">
                  Amount Paid
                </Label>
                <CurrencyInput
                  id="paidAmount"
                  {...register("paidAmount", { valueAsNumber: true })}
                  className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
                  error={errors.paidAmount?.message}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Booking Status */}
              <div className="space-y-2">
                <Label htmlFor="bookingStatus" className="text-sm font-medium text-neutral-700">
                  Booking Status
                </Label>
                <Select
                  value={watchedValues.bookingStatus}
                  onValueChange={(value) => setValue("bookingStatus", value as any)}
                >
                  <SelectTrigger className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending Confirmation</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked_in">Checked In</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Status */}
              <div className="space-y-2">
                <Label htmlFor="paymentStatus" className="text-sm font-medium text-neutral-700">
                  Payment Status
                </Label>
                <Select
                  value={watchedValues.paymentStatus}
                  onValueChange={(value) => setValue("paymentStatus", value as any)}
                >
                  <SelectTrigger className="h-9 border-neutral-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending Payment</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="completed">Fully Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Status Summary */}
            {watchedValues.totalAmount > 0 && (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Balance Due:</span>
                  <span className="font-mono font-medium text-neutral-900">
                    ₱{(watchedValues.totalAmount - watchedValues.paidAmount).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Payment Status:</span>
                  <Badge
                    className={cn("text-xs", getPaymentStatusColor(watchedValues.paymentStatus))}
                  >
                    {watchedValues.paymentStatus === "pending" && "Pending Payment"}
                    {watchedValues.paymentStatus === "partial" && "Partial Payment"}
                    {watchedValues.paymentStatus === "completed" && "Fully Paid"}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="specialRequests" className="text-sm font-medium text-neutral-700">
              Special Requests / Notes
            </Label>
            <Textarea
              id="specialRequests"
              {...register("specialRequests")}
              className="min-h-[80px] border-neutral-200 focus:border-blue-500 focus:ring-blue-500"
              placeholder="Any special requests or notes about this booking..."
              maxLength={500}
            />
            {errors.specialRequests && (
              <p className="text-sm text-red-600">{errors.specialRequests.message}</p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting || isLoading}
              className="border-neutral-200 px-6 hover:bg-neutral-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              loading={isSubmitting || isLoading}
              className="bg-blue-600 px-6 hover:bg-blue-700"
            >
              {mode === "create" ? "Create Booking" : "Update Booking"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default StaffBookingEntryForm;
