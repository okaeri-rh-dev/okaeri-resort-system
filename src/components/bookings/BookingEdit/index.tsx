// src/components/bookings/BookingEdit/index.tsx

import { zodResolver } from "@hookform/resolvers/zod";
import { useLoaderData, useNavigate, useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarDays, Save, X } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";

import { DetailPageLayout } from "@/components/entity-detail";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEntityEdit } from "@/hooks/entity";
import { cn } from "@/lib/utils";
import { bookingEditSchema, type BookingEditInput } from "@/lib/validation/entity-schemas";
import type { Booking, Unit } from "@/types/entity-detail.types";

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
      check_in: new Date(booking.check_in),
      check_out: new Date(booking.check_out),
      unit_id: booking.booking_units?.[0]?.unit_id ?? "",
      num_guests: booking.num_guests,
      payment_method:
        (booking.payment_method as "Cash" | "GCash" | "BankTransfer" | "Card") || "Cash",
      payment_amount: undefined,
      special_requests: booking.special_requests || "",
    },
  });

  // Setup mutation with navigation on success
  const updateBooking = useEntityEdit("booking", bookingId, {
    onSuccess: () => {
      navigate({ to: "/admin/bookings/$bookingId", params: { bookingId } });
    },
  });

  // Form submission handler
  const onSubmit: SubmitHandler<BookingEditInput> = (data) => {
    updateBooking.mutate(data);
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
          to: `/bookings/${bookingId}`,
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
              <FormField
                control={form.control}
                name="guest_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guest Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter guest name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="guest@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+63 XXX XXX XXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Booking Dates Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Booking Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="check_in"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-in Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date)}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="check_out"
                  render={({ field }) => {
                    const checkIn = form.watch("check_in");
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Check-out Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date)}
                              disabled={(date) => {
                                const checkInDate = checkIn ? new Date(checkIn) : new Date();
                                return date <= checkInDate;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Unit & Capacity Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Unit & Capacity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="unit_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units?.map((unit) => (
                          <SelectItem key={unit.unit_id} value={unit.unit_id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{unit.unit_name}</span>
                              <span className="text-muted-foreground text-xs">
                                {unit.unit_type} • Max {unit.max_occupancy} guests
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="num_guests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Guests</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormDescription>Minimum 1 guest, maximum 20 guests</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Payment Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="GCash">GCash</SelectItem>
                          <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                          <SelectItem value="Card">Credit Card</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Amount (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormDescription>Leave empty if not yet paid</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requests (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any special requests or notes..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This field is automatically sanitized for security
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
