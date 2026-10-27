// src/components/bookings/BookingEdit/index.tsx

import { useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { parseISO } from "date-fns";
import { Save, X } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  DetailPageLayout,
  Form,
  FormField,
  Input,
  SelectControl,
  SelectItem,
  Textarea,
} from "@/components/patterns";
import { useMultiUnitAvailability } from "@/hooks/useMultiUnitBookingQueries";
import { manilaDayOf, pickedDay, unavailableReason, unitNotFreeMessage } from "@/lib/bookings";
import { bookingEditSchema, type BookingEditInput } from "@/lib/validation/entity-schemas";
import { useUpdateBooking } from "@/stores/useBookingStore";
import type { Booking, Unit } from "@/types/entity-detail.types";

import { WalkInField } from "../form-fields";
import { toBookingUpdate } from "./to-booking-update";

export interface BookingEditPageProps {
  booking?: Booking;
  units?: Unit[];
}

export function BookingEditPage() {
  const { bookingId } = useParams({ from: "/admin/bookings/$bookingId/edit" });
  const { booking, units } = useLoaderData({ from: "/admin/bookings/$bookingId/edit" });
  const navigate = useNavigate();

  // Initialize form with default values from booking
  // NOTE: Single-unit editing only - extracts first unit from booking_units array
  // Multi-unit editing UI is planned for a later phase
  const form = useForm<BookingEditInput>({
    resolver: zodResolver(bookingEditSchema),
    defaultValues: {
      guest_name: booking.guest_name || "",
      email: booking.email || "",
      contact_number: booking.contact_number || "",
      check_in: parseISO(manilaDayOf(booking.check_in)),
      check_out: parseISO(manilaDayOf(booking.check_out)),
      unit_id: booking.booking_units?.[0]?.unit_id ?? "",
      num_guests: booking.num_guests,
      payment_method:
        (booking.payment_method as "Cash" | "GCash" | "BankTransfer" | "Card") || "Cash",
      special_requests: booking.special_requests || "",
      is_walk_in: booking.is_walk_in ?? false,
    },
  });

  const checkIn = form.watch("check_in");
  const checkOut = form.watch("check_out");
  const checkInDay = checkIn ? pickedDay(checkIn) : "";
  const checkOutDay = checkOut && checkIn && checkOut > checkIn ? pickedDay(checkOut) : "";
  const unitIds = useMemo(() => units?.map((unit) => unit.unit_id) ?? [], [units]);
  const { data: availability, isFetching: isCheckingAvailability } = useMultiUnitAvailability(
    unitIds,
    checkInDay,
    checkOutDay,
    { excludeBookingId: bookingId }
  );

  // Setup mutation with navigation on success
  const updateBooking = useUpdateBooking();

  // Form submission handler
  const onSubmit: SubmitHandler<BookingEditInput> = (data) => {
    if (checkInDay && checkOutDay && isCheckingAvailability) {
      form.setError("unit_id", { message: "Still checking availability…" });
      return;
    }
    const reason = unavailableReason(availability, data.unit_id);
    if (reason) {
      form.setError("unit_id", { message: unitNotFreeMessage(reason) });
      return;
    }

    updateBooking.mutate(
      { bookingId, changes: toBookingUpdate(data) },
      {
        onSuccess: () => void navigate({ to: "/admin/bookings/$bookingId", params: { bookingId } }),
      }
    );
  };

  // Cancel handler
  const handleCancel = () => {
    navigate({ to: "/admin/bookings/$bookingId", params: { bookingId } });
  };

  return (
    <DetailPageLayout
      title="Edit Booking"
      subtitle={`Booking #${booking.booking_reference}`}
      breadcrumbs={[
        { label: "Bookings", to: "/admin/bookings" },
        {
          label: booking.booking_reference,
          to: "/admin/bookings/$bookingId",
          params: { bookingId },
        },
        { label: "Edit" },
      ]}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Guest Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guest Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <WalkInField
                control={form.control}
                description="Check this if the guest arrived on-site without a prior reservation. Reporting flag only."
              />

              <FormField control={form.control} name="guest_name" label="Guest Name">
                {(field) => <Input placeholder="Enter guest name" autoComplete="off" {...field} />}
              </FormField>

              <div className="@container">
                <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                  <FormField control={form.control} name="email" label="Email">
                    {(field) => (
                      <Input
                        type="email"
                        placeholder="guest@example.com"
                        spellCheck={false}
                        {...field}
                      />
                    )}
                  </FormField>

                  <FormField control={form.control} name="contact_number" label="Contact Number">
                    {(field) => <Input type="tel" placeholder="+63 XXX XXX XXXX" {...field} />}
                  </FormField>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Dates Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Booking Dates</CardTitle>
            </CardHeader>
            <CardContent className="@container">
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField control={form.control} name="check_in" label="Check-in Date">
                  {(field) => (
                    <DatePicker
                      value={field.value ? new Date(field.value) : undefined}
                      onChange={field.onChange}
                      placeholder="Pick a date"
                      aria-label="Check-in Date"
                    />
                  )}
                </FormField>

                <FormField control={form.control} name="check_out" label="Check-out Date">
                  {(field) => (
                    <DatePicker
                      value={field.value ? new Date(field.value) : undefined}
                      onChange={field.onChange}
                      isDateDisabled={(date) => {
                        const checkIn = form.getValues("check_in");
                        return date <= (checkIn ? new Date(checkIn) : new Date());
                      }}
                      placeholder="Pick a date"
                      aria-label="Check-out Date"
                    />
                  )}
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Unit & Capacity Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cabin & Capacity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="unit_id" label="Cabin">
                {(field) => (
                  <SelectControl
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select a cabin"
                  >
                    {units?.map((unit) => {
                      const reason = unavailableReason(availability, unit.unit_id);
                      return (
                        <SelectItem
                          key={unit.unit_id}
                          value={unit.unit_id}
                          disabled={reason !== null}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-medium">{unit.unit_name}</span>
                              <span className="text-muted-foreground text-xs">
                                {unit.unit_type} • Max {unit.max_occupancy} guests
                              </span>
                            </div>
                            {reason && (
                              <span className="text-muted-foreground ml-2 text-xs">{reason}</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectControl>
                )}
              </FormField>

              <FormField
                control={form.control}
                name="num_guests"
                label="Number of Guests"
                description="Minimum 1 guest, maximum 20 guests"
              >
                {(field) => (
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                  />
                )}
              </FormField>
            </CardContent>
          </Card>

          {/* Payment Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="@container">
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <FormField control={form.control} name="payment_method" label="Payment Method">
                  {(field) => (
                    <SelectControl
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Select payment method"
                    >
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="GCash">GCash</SelectItem>
                      <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                      <SelectItem value="Card">Credit Card</SelectItem>
                    </SelectControl>
                  )}
                </FormField>
              </div>
            </CardContent>
          </Card>

          {/* Special Requests Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Special Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="special_requests"
                label="Special Requests (Optional)"
                description="This field is automatically sanitized for security"
              >
                {(field) => (
                  <Textarea
                    placeholder="Enter any special requests or notes..."
                    className="min-h-24"
                    {...field}
                  />
                )}
              </FormField>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={updateBooking.isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={updateBooking.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateBooking.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </DetailPageLayout>
  );
}
