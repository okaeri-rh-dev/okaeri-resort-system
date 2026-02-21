/**
 * MultiUnitBookingForm Component
 *
 * 3-step wizard for creating multi-unit bookings:
 * 1. Date and Unit Selection
 * 2. Primary Guest Information
 * 3. Review and Payment
 *
 * Features:
 * - Real-time availability checking
 * - Optimistic UI updates
 * - Idempotency key generation
 * - Form validation with Zod
 * - Responsive design
 * - Guest count management in Step 1
 *
 * @module MultiUnitBookingForm
 */

import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAvailabilityRealtime } from "@/hooks/useAvailabilityRealtime";
import { useIdempotencyKey } from "@/hooks/useIdempotencyKey";
import {
  useCreateMultiUnitBooking,
  useMultiUnitAvailability,
} from "@/hooks/useMultiUnitBookingQueries";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { hasProperty, isObject } from "@/lib/type-guards";
import { cn } from "@/lib/utils";
import {
  multiUnitBookingSchema,
  type MultiUnitBookingFormData,
} from "@/lib/validation/multi-unit-booking";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import { useUnits } from "@/stores/useUnitStore";
import type { AdminMultiUnitBookingCreate, Unit } from "@/types";

import { MultiUnitPricingSummary } from "./MultiUnitPricingSummary";
import { MultiUnitSelector } from "./MultiUnitSelector";
import { UnitCardList } from "./UnitCardList";

// ============================================
// TYPES
// ============================================

interface MultiUnitBookingFormProps {
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

type FormStep = 1 | 2 | 3;

// ============================================
// MAIN COMPONENT
// ============================================

export function MultiUnitBookingForm({ onSuccess, onCancel }: MultiUnitBookingFormProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<FormStep>(1);

  // Zustand Store
  const {
    selectedUnits,
    addUnit,
    removeUnit,
    assignGuestsToUnit,
    getTotalAmount,
    setDraftBooking,
    recalculateTotalPricing,
    clearDraftBooking,
  } = useMultiUnitBookingStore();

  // Form setup
  const form = useForm<MultiUnitBookingFormData>({
    resolver: zodResolver(multiUnitBookingSchema),
    mode: "onBlur",
    reValidateMode: "onBlur",
    defaultValues: {
      check_in: new Date(),
      check_out: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      guest_name: "",
      email: "",
      contact_number: "",
      payment_method: "GCash",
      special_requests: "",
      internal_notes: "",
    },
  });

  // Hooks
  const idempotencyKey = useIdempotencyKey();
  const createBooking = useCreateMultiUnitBooking();
  const { data: pricingConfig, isLoading: isLoadingPricing } = usePricingConfig();

  // Watch form values for real-time availability
  const checkIn = form.watch("check_in");
  const checkOut = form.watch("check_out");

  // Extract form.setValue into useEffectEvent to remove form from dependencies
  const adjustCheckOutDate = useEffectEvent((checkInDate: Date, checkOutDate: Date) => {
    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      // Automatically set check_out to the day after check_in
      const newCheckOut = new Date(checkInDate);
      newCheckOut.setDate(newCheckOut.getDate() + 1);
      form.setValue("check_out", newCheckOut);
    }
  });

  // Auto-adjust check_out when check_in changes to prevent date inversion
  useEffect(() => {
    adjustCheckOutDate(checkIn, checkOut);
  }, [checkIn, checkOut]);

  // Convert dates to ISO strings for API calls
  const checkInStr = checkIn ? checkIn.toISOString() : "";
  const checkOutStr = checkOut ? checkOut.toISOString() : "";

  // Real-time availability monitoring
  useAvailabilityRealtime(checkInStr, checkOutStr);

  // Step 1: Fetch all units from database
  const { data: allUnits = [], isLoading: isLoadingAllUnits } = useUnits();

  // Step 2: Get unit IDs for availability check
  const unitIds = useMemo(() => allUnits.map((u) => u.unit_id), [allUnits]);

  // Step 3: Check which units are available for selected dates
  const { data: availabilityResults, isLoading: isCheckingAvailability } = useMultiUnitAvailability(
    unitIds,
    checkInStr,
    checkOutStr,
    {
      enabled: !!checkIn && !!checkOut && unitIds.length > 0,
    }
  );

  // Step 4: Filter to only show available units
  const units = useMemo(() => {
    if (!availabilityResults) return [];

    return allUnits.filter((unit) => {
      const availability = availabilityResults.find(
        (r: unknown) => isObject(r) && hasProperty(r, "unit_id") && r.unit_id === unit.unit_id
      );
      return isObject(availability) && hasProperty(availability, "is_available")
        ? Boolean(availability.is_available)
        : false;
    });
  }, [allUnits, availabilityResults]);

  const isLoadingUnits = isLoadingAllUnits || isCheckingAvailability || isLoadingPricing;

  // Debug logging removed - use React DevTools for debugging state

  // ============================================
  // HANDLERS
  // ============================================

  const handleAddUnit = (unit: Unit) => {
    if (selectedUnits.length >= 10) {
      toast.error("Maximum 10 units per booking");
      return;
    }

    // Convert Unit to BookingUnit using global pricing config
    const bookingUnit = {
      unit_id: unit.unit_id,
      unit_name: unit.unit_name,
      unit_code: unit.unit_code || "",
      unit_type: unit.unit_type,
      max_occupancy: unit.max_occupancy,
      base_occupancy: pricingConfig?.base_occupancy ?? unit.base_occupancy,
      base_rate: pricingConfig?.base_rate ?? unit.base_rate,
      weekend_rate:
        pricingConfig?.weekend_rate ??
        unit.weekend_rate ??
        pricingConfig?.base_rate ??
        unit.base_rate,
      extra_person_rate: pricingConfig?.extra_person_rate ?? unit.extra_person_rate ?? 0,
      pricing: {
        nights: 0,
        base_total: 0,
        weekend_surcharge: 0,
        extra_person_fee: 0,
        unit_total: 0,
      },
      availability: {
        is_available: true,
        checking: false,
      },
    };

    // Pass dates from form to ensure pricing is calculated immediately
    addUnit(bookingUnit, checkIn, checkOut);
    recalculateTotalPricing(checkIn, checkOut);
    toast.success(`${unit.unit_name} added to booking`);
  };

  const handleRemoveUnit = (unitId: string) => {
    removeUnit(unitId);
    recalculateTotalPricing(checkIn, checkOut);
    toast.info("Cabin removed from booking");
  };

  const handleNext = async () => {
    let isValid = false;

    // Validate current step
    switch (step) {
      case 1:
        isValid = await form.trigger(["check_in", "check_out"]);
        if (isValid && selectedUnits.length === 0) {
          toast.error("Please select at least one unit");
          return;
        }
        break;
      case 2:
        isValid = await form.trigger(["guest_name", "email", "contact_number"]);
        break;
      case 3:
        isValid = await form.trigger();
        break;
    }

    if (isValid && step < 3) {
      setStep((s) => (s + 1) as FormStep);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as FormStep);
    }
  };

  const handleSubmit = async (data: MultiUnitBookingFormData) => {
    try {
      // Set draft booking for optimistic updates
      setDraftBooking({
        booking_reference: `TEMP-${Date.now()}`,
        booking_units: selectedUnits,
        is_multi_unit: true,
        unit_count: selectedUnits.length,
        primary_guest: {
          guest_name: data.guest_name,
          email: data.email,
          contact_number: data.contact_number,
        },
        check_in: data.check_in.toISOString(),
        check_out: data.check_out.toISOString(),
        total_amount: getTotalAmount(),
        booking_status: "Pending",
        payment_status: "Unpaid",
      });

      // Create booking with idempotency key
      const bookingPayload: AdminMultiUnitBookingCreate = {
        primary_guest: {
          guest_name: data.guest_name,
          email: data.email,
          contact_number: data.contact_number,
        },
        check_in: data.check_in.toISOString(),
        check_out: data.check_out.toISOString(),
        booking_units: selectedUnits.map((unit) => ({
          unit_id: unit.unit_id,
          num_guests: unit.guest_assignment?.num_guests || unit.base_occupancy,
          guest_assignment: unit.guest_assignment,
          unit_notes: unit.guest_assignment?.special_requests,
        })),
        payment: {
          method: data.payment_method,
          amount: data.payment_amount || getTotalAmount(),
          proof_url: data.payment_proof_url,
        },
        special_requests: data.special_requests,
        internal_notes: data.internal_notes,
        source: "web",
        idempotency_key: idempotencyKey,
      };
      const result = await createBooking.mutateAsync(bookingPayload);

      toast.success("Booking created successfully!");
      clearDraftBooking();
      form.reset();

      // Navigate to booking detail page - use type guard for union type
      if (
        isObject(result) &&
        hasProperty(result, "booking_id") &&
        typeof result.booking_id === "string"
      ) {
        if (onSuccess) {
          onSuccess(result.booking_id);
        } else {
          navigate({ to: "/admin/bookings/$bookingId", params: { bookingId: result.booking_id } });
        }
      }
    } catch (error) {
      console.error("Booking creation failed:", error);
      toast.error("Failed to create booking. Please try again.");
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Multi-Unit Booking</CardTitle>
          <CardDescription>Book multiple units in a single reservation</CardDescription>

          {/* Progress Indicator */}
          <div className="mt-4 flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : step > s
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 3 && <div className="bg-muted h-0.5 w-12" />}
              </div>
            ))}
          </div>

          <div className="text-muted-foreground mt-2 text-sm">
            {step === 1 && "Select dates and units"}
            {step === 2 && "Enter primary guest information"}
            {step === 3 && "Review and complete payment"}
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Step 1: Date and Unit Selection */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="check_in"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-base font-medium sm:text-sm">
                            Check-in Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-12 w-full touch-manipulation pl-4 text-left text-base font-normal sm:h-10 sm:text-sm",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarDays className="ml-auto h-5 w-5 opacity-50 sm:h-4 sm:w-4" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[340px] p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                className="touch-manipulation"
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
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-base font-medium sm:text-sm">
                            Check-out Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-12 w-full touch-manipulation pl-4 text-left text-base font-normal sm:h-10 sm:text-sm",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarDays className="ml-auto h-5 w-5 opacity-50 sm:h-4 sm:w-4" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[340px] p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date <= checkIn}
                                initialFocus
                                className="touch-manipulation"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Unit Selection */}
                  {checkIn && checkOut && (
                    <>
                      <MultiUnitSelector
                        units={units}
                        selectedUnits={selectedUnits}
                        checkIn={checkIn}
                        checkOut={checkOut}
                        onAddUnit={handleAddUnit}
                        onRemoveUnit={handleRemoveUnit}
                        onViewDetails={(_unitId) => {
                          /* TODO: Implement unit details modal */
                        }}
                        isLoading={isLoadingUnits}
                        maxUnits={3}
                        enableFilters={false}
                        pricingConfig={pricingConfig}
                      />

                      {/* Selected Cabins Summary */}
                      {selectedUnits.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Selected Cabins</h3>
                          <UnitCardList
                            units={selectedUnits}
                            onRemove={handleRemoveUnit}
                            onUpdateGuestCount={(unitId: string, count: number) => {
                              assignGuestsToUnit(unitId, [], count);
                              recalculateTotalPricing(checkIn, checkOut);
                            }}
                            pricingConfig={pricingConfig}
                          />
                          <MultiUnitPricingSummary units={selectedUnits} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Guest Information */}
              {step === 2 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="guest_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Guest Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormDescription>
                          Name of the primary guest for this booking
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
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
                          <Input placeholder="+63 912 345 6789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 3: Review and Payment */}
              {step === 3 && (
                <div className="space-y-6">
                  {/* Booking Summary */}
                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-lg font-semibold">Booking Summary</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Guest:</span>
                      <span className="font-medium">{form.watch("guest_name")}</span>
                      <span className="text-muted-foreground">Email:</span>
                      <span>{form.watch("email")}</span>
                      <span className="text-muted-foreground">Check-in:</span>
                      <span>{format(form.watch("check_in"), "PPP")}</span>
                      <span className="text-muted-foreground">Check-out:</span>
                      <span>{format(form.watch("check_out"), "PPP")}</span>
                      <span className="text-muted-foreground">Cabins:</span>
                      <span>{selectedUnits.length}</span>
                    </div>
                  </div>

                  <MultiUnitPricingSummary units={selectedUnits} />

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
                            <SelectItem value="GCash">GCash</SelectItem>
                            <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="CreditCard">Credit Card</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="special_requests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Requests (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any special requests or notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <div className="flex gap-2">
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={handlePrevious}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                  )}
                  {onCancel && step === 1 && (
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {step < 3 && (
                    <Button type="button" onClick={handleNext}>
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  {step === 3 && (
                    <Button type="submit" disabled={createBooking.isPending}>
                      {createBooking.isPending ? "Creating..." : "Confirm Booking"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
