/**
 * MultiUnitBookingForm Component
 *
 * 4-step wizard for creating multi-unit bookings:
 * 1. Date and Unit Selection
 * 2. Primary Guest Information
 * 3. Guest Assignment (optional)
 * 4. Review and Payment
 *
 * Features:
 * - Real-time availability checking
 * - Optimistic UI updates
 * - Idempotency key generation
 * - Form validation with Zod
 * - Responsive design
 *
 * @module MultiUnitBookingForm
 */

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Check, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MultiUnitSelector } from "./MultiUnitSelector";
import { UnitCardList } from "./UnitCardList";
import { MultiUnitPricingSummary } from "./MultiUnitPricingSummary";
import { GuestAssignment } from "./GuestAssignment";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import {
  useCreateMultiUnitBooking,
  useMultiUnitAvailability,
} from "@/hooks/useMultiUnitBookingQueries";
import { useIdempotencyKey } from "@/hooks/useIdempotencyKey";
import { useAvailabilityRealtime } from "@/hooks/useAvailabilityRealtime";
import { useUnits } from "@/stores/useUnitStore";
import {
  multiUnitBookingSchema,
  type MultiUnitBookingFormData,
} from "@/lib/validation/multi-unit-booking";
import type { Unit } from "@/types";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface MultiUnitBookingFormProps {
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

type FormStep = 1 | 2 | 3 | 4;

// ============================================
// MAIN COMPONENT
// ============================================

export function MultiUnitBookingForm({ onSuccess, onCancel }: MultiUnitBookingFormProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<FormStep>(1);
  const [guestAssignmentOpen, setGuestAssignmentOpen] = useState(false);
  const [selectedUnitForAssignment, setSelectedUnitForAssignment] = useState<string | null>(null);

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

  // Watch form values for real-time availability
  const checkIn = form.watch("check_in");
  const checkOut = form.watch("check_out");

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
  const {
    data: availabilityResults,
    isLoading: isCheckingAvailability,
    error: availabilityError,
  } = useMultiUnitAvailability(unitIds, checkInStr, checkOutStr, {
    enabled: !!checkIn && !!checkOut && unitIds.length > 0,
  });

  // Step 4: Filter to only show available units
  const units = useMemo(() => {
    if (!availabilityResults) return [];

    return allUnits.filter((unit) => {
      const availability = availabilityResults.find((r) => r.unit_id === unit.unit_id);
      return availability?.is_available === true;
    });
  }, [allUnits, availabilityResults]);

  const isLoadingUnits = isLoadingAllUnits || isCheckingAvailability;
  const unitsError = availabilityError;

  // Debug logging
  console.log("=== UNITS AVAILABILITY DEBUG ===");
  console.log("Query State:", {
    checkIn,
    checkOut,
    checkInStr,
    checkOutStr,
    allUnitsCount: allUnits.length,
    isLoadingAllUnits,
    isCheckingAvailability,
    availabilityResultsCount: availabilityResults?.length ?? 0,
    filteredUnitsCount: units.length,
    error: unitsError,
    enabled: !!checkIn && !!checkOut && unitIds.length > 0,
  });
  console.log("All Units:", allUnits);
  console.log("Availability Results:", availabilityResults);
  console.log("Filtered Available Units:", units);
  console.log("==================================");

  // ============================================
  // HANDLERS
  // ============================================

  const handleAddUnit = (unit: Unit) => {
    if (selectedUnits.length >= 10) {
      toast.error("Maximum 10 units per booking");
      return;
    }

    // Convert Unit to BookingUnit
    const bookingUnit = {
      unit_id: unit.unit_id,
      unit_name: unit.unit_name,
      unit_code: unit.unit_code || "",
      unit_type: unit.unit_type,
      max_occupancy: unit.max_occupancy,
      base_occupancy: unit.base_occupancy,
      base_rate: unit.base_rate,
      weekend_rate: unit.weekend_rate || unit.base_rate,
      extra_person_rate: unit.extra_person_rate || 0,
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

    addUnit(bookingUnit);
    recalculateTotalPricing();
    toast.success(`${unit.unit_name} added to booking`);
  };

  const handleRemoveUnit = (unitId: string) => {
    removeUnit(unitId);
    recalculateTotalPricing();
    toast.info("Unit removed from booking");
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
        isValid = true; // Guest assignment is optional
        break;
      case 4:
        isValid = await form.trigger();
        break;
    }

    if (isValid && step < 4) {
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
      const result = await createBooking.mutateAsync({
        primary_guest: {
          guest_name: data.guest_name,
          email: data.email,
          contact_number: data.contact_number,
        },
        check_in: data.check_in.toISOString(),
        check_out: data.check_out.toISOString(),
        units: selectedUnits.map((unit) => ({
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
      });

      toast.success("Booking created successfully!");
      clearDraftBooking();
      form.reset();

      // Navigate to booking detail page
      if (onSuccess) {
        onSuccess(result.booking_id);
      } else {
        navigate({ to: "/bookings/$bookingId", params: { bookingId: result.booking_id } });
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
    <div className="container mx-auto py-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Multi-Unit Booking</CardTitle>
          <CardDescription>Book multiple units in a single reservation</CardDescription>

          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
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
                {s < 4 && <div className="h-0.5 w-12 bg-muted" />}
              </div>
            ))}
          </div>

          <div className="text-sm text-muted-foreground mt-2">
            {step === 1 && "Select dates and units"}
            {step === 2 && "Enter primary guest information"}
            {step === 3 && "Assign guests to units (optional)"}
            {step === 4 && "Review and complete payment"}
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Step 1: Date and Unit Selection */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Date Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="check_in"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-base sm:text-sm font-medium">
                            Check-in Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full h-12 sm:h-10 pl-4 text-left font-normal text-base sm:text-sm touch-manipulation",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarDays className="ml-auto h-5 w-5 sm:h-4 sm:w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[340px] p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
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
                          <FormLabel className="text-base sm:text-sm font-medium">
                            Check-out Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full h-12 sm:h-10 pl-4 text-left font-normal text-base sm:text-sm touch-manipulation",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarDays className="ml-auto h-5 w-5 sm:h-4 sm:w-4 opacity-50" />
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

                  {/* Debug Info */}
                  <div className="border-2 border-yellow-500 bg-yellow-50 p-4 rounded-lg space-y-2">
                    <h3 className="font-bold text-yellow-900">🐛 Availability Check Debug</h3>
                    <div className="text-sm text-yellow-900 space-y-1">
                      <p>
                        <strong>Dates Selected:</strong> {checkIn ? "✅" : "❌"} Check-in,{" "}
                        {checkOut ? "✅" : "❌"} Check-out
                      </p>
                      <p>
                        <strong>All Units from DB:</strong> {allUnits.length} units{" "}
                        {isLoadingAllUnits && "(⏳ loading...)"}
                      </p>
                      <p>
                        <strong>Availability Check:</strong>{" "}
                        {isCheckingAvailability
                          ? "⏳ Checking..."
                          : availabilityResults
                            ? `✅ ${availabilityResults.length} checked`
                            : "❌ Not started"}
                      </p>
                      <p>
                        <strong>Available for Dates:</strong> {units.length} units
                      </p>
                      {unitsError && (
                        <p className="text-red-700">
                          <strong>Error:</strong> {(unitsError as Error).message}
                        </p>
                      )}
                      <p>
                        <strong>Selected Units:</strong> {selectedUnits.length}
                      </p>
                      <details className="mt-2">
                        <summary className="cursor-pointer font-semibold">
                          View Availability Results
                        </summary>
                        <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-40">
                          {JSON.stringify(
                            {
                              allUnits: allUnits.map((u) => ({
                                id: u.unit_id,
                                name: u.unit_name,
                                status: u.unit_status,
                              })),
                              availability: availabilityResults,
                              filtered: units.map((u) => ({ id: u.unit_id, name: u.unit_name })),
                            },
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    </div>
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
                        onViewDetails={(unitId) => console.log("View details:", unitId)}
                        isLoading={isLoadingUnits}
                        maxUnits={10}
                        enableFilters={false}
                      />

                      {/* Selected Units Summary */}
                      {selectedUnits.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Selected Units</h3>
                          <UnitCardList
                            units={selectedUnits}
                            onRemove={handleRemoveUnit}
                            onUpdateGuestCount={(unitId: string, count: number) => {
                              assignGuestsToUnit(unitId, [], count);
                              recalculateTotalPricing();
                            }}
                            onAssignGuests={(unitId: string) => {
                              setSelectedUnitForAssignment(unitId);
                              setGuestAssignmentOpen(true);
                            }}
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

              {/* Step 3: Guest Assignment */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <h3 className="text-lg font-semibold mb-2">Guest Assignment</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Optionally assign specific guests to each unit
                    </p>

                    <UnitCardList
                      units={selectedUnits}
                      onRemove={handleRemoveUnit}
                      onUpdateGuestCount={(unitId: string, count: number) => {
                        assignGuestsToUnit(unitId, [], count);
                        recalculateTotalPricing();
                      }}
                      onAssignGuests={(unitId: string) => {
                        setSelectedUnitForAssignment(unitId);
                        setGuestAssignmentOpen(true);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Review and Payment */}
              {step === 4 && (
                <div className="space-y-6">
                  {/* Booking Summary */}
                  <div className="border rounded-lg p-4 space-y-4">
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
                      <span className="text-muted-foreground">Units:</span>
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
                  {step < 4 && (
                    <Button type="button" onClick={handleNext}>
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  {step === 4 && (
                    <Button type="submit" disabled={createBooking.isPending}>
                      {createBooking.isPending ? "Creating..." : "Confirm Booking"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>

          {/* Guest Assignment Modal */}
          <GuestAssignment
            unit={selectedUnits.find((u) => u.unit_id === selectedUnitForAssignment)!}
            open={guestAssignmentOpen}
            onOpenChange={setGuestAssignmentOpen}
            onSave={(unitId, numGuests) => {
              assignGuestsToUnit(unitId, [], numGuests);
              setGuestAssignmentOpen(false);
              toast.success("Guest assignment saved");
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
