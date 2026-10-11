import React, { useEffect, useEffectEvent, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInDays, format } from "date-fns";
import { CheckCircle, CreditCard, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PricingStatusBadge } from "@/components/pricing/PricingStatusBadge";
import { BookingFormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, NumberInput } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ResponsiveDatePicker } from "@/components/ui/responsive-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { usePricingCalculation } from "@/hooks/usePricingCalculation";
import { pickedDay } from "@/lib/bookings";
import { sanitizeBookingFormData } from "@/lib/security/sanitize";
import { hasProperty, isObject } from "@/lib/type-guards";
import { cn } from "@/lib/utils";
import {
  bookingStep1Schema,
  bookingStep2Schema,
  bookingStep3Schema,
  completeBookingSchema,
  formatCurrency,
  formatPhoneNumber,
  type CompleteBookingData,
} from "@/lib/validations";
import { useCreateBooking } from "@/stores/useBookingStore";
import { useUnits } from "@/stores/useUnitStore";
import type { MultiUnitBooking } from "@/types";

interface BookingFormProps {
  onSuccess?: (booking: MultiUnitBooking) => void;
  onCancel?: () => void;
  initialData?: Partial<CompleteBookingData>;
  className?: string;
}

type FormStep = 1 | 2 | 3 | 4;

const STEP_DESCRIPTIONS = {
  1: "Choose your accommodation and preferred dates",
  2: "Provide contact details for the reservation",
  3: "Select payment method and add special requests",
  4: "Review your booking details before confirming",
};

export function BookingForm({ onSuccess, onCancel, initialData, className }: BookingFormProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [downpaymentAmount, setDownpaymentAmount] = useState<number>(0);
  const [pricingNotice, setPricingNotice] = useState<string | null>(null);

  const createBookingMutation = useCreateBooking();
  const { data: units, isLoading: unitsLoading } = useUnits();

  // Initialize pricing calculation hook
  const calculatePricing = usePricingCalculation({
    onSuccess: (data) => {
      setCalculatedTotal(data.pricing.total);
      setDownpaymentAmount(data.pricing.downpayment);
      setPricingNotice(data.notice);
    },
    onError: (error) => {
      toast.error("Failed to calculate pricing", {
        description: error.message,
      });
      // Fallback to zero if pricing calculation fails
      setCalculatedTotal(0);
      setDownpaymentAmount(0);
      setPricingNotice(null);
    },
  });

  const form = useForm<CompleteBookingData>({
    resolver: zodResolver(completeBookingSchema),
    defaultValues: {
      unit_id: "",
      check_in: new Date(),
      check_out: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      num_guests: 1,
      guest_name: "",
      email: "",
      contact_number: "",
      special_requests: "",
      payment_method: undefined,
      is_walk_in: false,
      ...initialData,
    },
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  // Watch only specific fields to prevent excessive re-renders
  const unitId = form.watch("unit_id");
  const checkIn = form.watch("check_in");
  const checkOut = form.watch("check_out");
  const numGuests = form.watch("num_guests");
  const guestName = form.watch("guest_name");
  const email = form.watch("email");
  const contactNumber = form.watch("contact_number");
  const paymentMethod = form.watch("payment_method");
  const specialRequests = form.watch("special_requests");

  const selectedUnit = units?.find((unit) => unit.unit_id === unitId);

  // Extract pricing calculation into useEffectEvent to prevent dependency issues
  const handlePricingCalculation = useEffectEvent(
    (params: { unit: typeof selectedUnit; checkIn: Date; checkOut: Date; numGuests: number }) => {
      if (!params.unit || !params.checkIn || !params.checkOut) {
        setCalculatedTotal(0);
        setDownpaymentAmount(0);
        setPricingNotice(null);
        return;
      }

      // Validate dates
      const checkInDate = new Date(params.checkIn);
      const checkOutDate = new Date(params.checkOut);
      const nights = differenceInDays(checkOutDate, checkInDate);

      if (nights <= 0) {
        setCalculatedTotal(0);
        setDownpaymentAmount(0);
        setPricingNotice(null);
        return;
      }

      // Format dates for API
      const checkInStr = format(checkInDate, "yyyy-MM-dd");
      const checkOutStr = format(checkOutDate, "yyyy-MM-dd");

      // Call pricing API
      calculatePricing.mutate({
        check_in: checkInStr,
        check_out: checkOutStr,
        guest_count: params.numGuests || 1,
        unit_id: params.unit.unit_id,
      });
    }
  );

  // Calculate pricing via API when relevant fields change
  useEffect(() => {
    handlePricingCalculation({
      unit: selectedUnit,
      checkIn,
      checkOut,
      numGuests,
    });
  }, [selectedUnit?.unit_id, checkIn, checkOut, numGuests]);

  const validateStep = async (step: FormStep): Promise<boolean> => {
    const values = form.getValues();

    try {
      switch (step) {
        case 1:
          await bookingStep1Schema.parseAsync({
            unit_id: values.unit_id,
            check_in: values.check_in,
            check_out: values.check_out,
            num_guests: values.num_guests,
          });
          return true;

        case 2:
          await bookingStep2Schema.parseAsync({
            guest_name: values.guest_name,
            email: values.email,
            phone_number: values.contact_number,
          });
          return true;

        case 3:
          await bookingStep3Schema.parseAsync({
            special_requests: values.special_requests,
            payment_method: values.payment_method,
          });
          return true;

        default:
          return true;
      }
    } catch (error) {
      // Set form errors based on validation
      if (error instanceof Error && "errors" in error) {
        const zodError = error as unknown;
        if (
          isObject(zodError) &&
          hasProperty(zodError, "errors") &&
          Array.isArray(zodError.errors)
        ) {
          zodError.errors.forEach((err: unknown) => {
            if (
              isObject(err) &&
              hasProperty(err, "path") &&
              hasProperty(err, "message") &&
              Array.isArray(err.path)
            ) {
              const errorMsg = err instanceof Error ? err.message : String(err.message);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              form.setError(String(err.path[0]) as any, { message: errorMsg });
            }
          });
        }
      }
      return false;
    }
  };

  const handleNextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as FormStep);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as FormStep);
    }
  };

  const checkAvailability = async () => {
    if (!selectedUnit || !checkIn || !checkOut) return;

    setIsCheckingAvailability(true);
    try {
      // Simulate availability check - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Cabin is available for your selected dates!");
    } catch (_error) {
      toast.error("Cabin is not available for the selected dates");
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const onSubmit = async (data: CompleteBookingData) => {
    const sanitizedData = sanitizeBookingFormData(data);
    const contactNumber = sanitizedData.contact_number || data.contact_number;

    try {
      const booking = await createBookingMutation.mutateAsync({
        primary_guest: {
          guest_name: sanitizedData.guest_name || data.guest_name,
          email: sanitizedData.email || data.email || "",
          contact_number: contactNumber ? formatPhoneNumber(contactNumber) : "",
        },
        check_in: pickedDay(data.check_in),
        check_out: pickedDay(data.check_out),
        units: [{ unit_id: data.unit_id, num_guests: data.num_guests }],
        payment: { method: data.payment_method, amount: calculatedTotal },
        special_requests: sanitizedData.special_requests || data.special_requests || undefined,
        is_walk_in: data.is_walk_in ?? false,
        source: "admin",
      });
      toast.success(`Booking ${booking.booking_reference} created`);
      onSuccess?.(booking);
    } catch (error) {
      toast.error("Failed to create booking", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const renderStepIndicator = () => (
    <div className="mb-6 flex items-center justify-center space-x-2 px-4">
      {[1, 2, 3, 4].map((step) => (
        <React.Fragment key={step}>
          <div
            className={cn(
              "flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border-2 text-sm font-medium",
              "sm:h-8 sm:w-8",
              step < currentStep
                ? "bg-primary border-primary text-primary-foreground"
                : step === currentStep
                  ? "border-primary text-primary bg-background"
                  : "border-muted-foreground/30 text-muted-foreground"
            )}
          >
            {step < currentStep ? <CheckCircle className="h-5 w-5 sm:h-4 sm:w-4" /> : step}
          </div>
          {step < 4 && (
            <div
              className={cn(
                "h-0.5 w-8 sm:w-12",
                step < currentStep ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="unit_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">Select Unit</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm">
                  <SelectValue placeholder="Choose a unit" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {units?.map((unit) => (
                  <SelectItem key={unit.unit_id} value={unit.unit_id}>
                    <div className="flex w-full items-center justify-between">
                      <span>
                        {unit.unit_name} ({unit.unit_type}) • {unit.base_occupancy}/
                        {unit.max_occupancy} guests
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {formatCurrency(unit.base_rate)}/night
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
        <FormField
          control={form.control}
          name="check_in"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-base font-medium sm:text-sm">Check-in Date</FormLabel>
              <FormControl>
                <ResponsiveDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Pick a date"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="check_out"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-base font-medium sm:text-sm">Check-out Date</FormLabel>
              <FormControl>
                <ResponsiveDatePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={(date) => date <= checkIn}
                  placeholder="Pick a date"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="num_guests"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">Number of Guests</FormLabel>
            <FormControl>
              <NumberInput
                min={1}
                max={selectedUnit?.max_occupancy || 20}
                allowDecimals={false}
                className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm"
                startIcon={<Users className="h-5 w-5 sm:h-4 sm:w-4" />}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                onBlur={(value) => {
                  field.onChange(value || 1); // Set minimum on blur
                  field.onBlur();
                }}
              />
            </FormControl>
            {selectedUnit && (
              <FormDescription>
                Base occupancy: {selectedUnit.base_occupancy} guests (included) • Max:{" "}
                {selectedUnit.max_occupancy} guests
                {selectedUnit.max_occupancy > selectedUnit.base_occupancy && (
                  <span className="mt-1 block text-xs">
                    Extra person rate: {formatCurrency(selectedUnit.extra_person_rate)} per person
                    per night
                  </span>
                )}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {selectedUnit && calculatedTotal > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Unit:</span>
                <span className="font-medium">{selectedUnit.unit_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Nights:</span>
                <span>
                  {Math.ceil(
                    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>{formatCurrency(calculatedTotal)}</span>
              </div>
              {downpaymentAmount > 0 && (
                <div className="text-muted-foreground flex justify-between text-sm">
                  <span>Downpayment Required:</span>
                  <span>{formatCurrency(downpaymentAmount)}</span>
                </div>
              )}
              <PricingStatusBadge
                notice={pricingNotice}
                isLoading={calculatePricing.isPending}
                className="mt-2"
                size="sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={checkAvailability}
              disabled={isCheckingAvailability}
            >
              {isCheckingAvailability ? "Checking..." : "Check Availability"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="is_walk_in"
        render={({ field }) => (
          <FormItem className="bg-muted/40 flex flex-row items-start gap-3 rounded-md border p-4">
            <FormControl>
              <Checkbox
                checked={field.value ?? false}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-1"
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel className="text-base font-medium sm:text-sm">Walk-in booking</FormLabel>
              <FormDescription className="text-sm">
                Check this if the guest arrived on-site without a prior reservation. Reporting flag
                only — does not change pricing, payment, or confirmation behavior.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="guest_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">Full Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Enter guest's full name"
                className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">
              Email Address (Optional)
            </FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="guest@example.com"
                className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm"
                autoComplete="email"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-sm">
              If provided, booking confirmation will be sent to this email
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contact_number"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">
              Phone Number (Optional)
            </FormLabel>
            <FormControl>
              <Input
                type="tel"
                placeholder="+639123456789 or 09123456789"
                className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm"
                autoComplete="tel"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-sm">Philippine mobile numbers only</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="payment_method"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base font-medium sm:text-sm">Payment Method</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12 touch-manipulation text-base sm:h-10 sm:text-sm">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="GCash">
                  <div className="flex items-center">
                    <CreditCard className="mr-2 h-4 w-4" />
                    GCash
                  </div>
                </SelectItem>
                <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Credit/Debit Card</SelectItem>
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
            <FormLabel className="text-base font-medium sm:text-sm">
              Special Requests (Optional)
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Any special requests or notes for your stay..."
                className="min-h-[120px] touch-manipulation resize-none text-base sm:min-h-[100px] sm:text-sm"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-sm">
              Let us know if you have any specific requirements
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium">Unit</h4>
              <p className="text-muted-foreground">{selectedUnit?.unit_name}</p>
            </div>
            <div>
              <h4 className="font-medium">Type</h4>
              <p className="text-muted-foreground">{selectedUnit?.unit_type}</p>
            </div>
            <div>
              <h4 className="font-medium">Check-in</h4>
              <p className="text-muted-foreground">{format(checkIn, "PPP")}</p>
            </div>
            <div>
              <h4 className="font-medium">Check-out</h4>
              <p className="text-muted-foreground">{format(checkOut, "PPP")}</p>
            </div>
            <div>
              <h4 className="font-medium">Guests</h4>
              <p className="text-muted-foreground">{numGuests}</p>
            </div>
            <div>
              <h4 className="font-medium">Payment</h4>
              <p className="text-muted-foreground">{paymentMethod}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium">Guest Information</h4>
            <div className="mt-2 space-y-1">
              <p className="text-muted-foreground">{guestName}</p>
              {email && <p className="text-muted-foreground">{email}</p>}
              {contactNumber && <p className="text-muted-foreground">{contactNumber}</p>}
            </div>
          </div>

          {specialRequests && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium">Special Requests</h4>
                <p className="text-muted-foreground mt-2">{specialRequests}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium">Pricing Breakdown</h4>
            {selectedUnit && checkIn && checkOut && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Room rate (
                    {Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))}{" "}
                    nights)
                  </span>
                  <span>
                    {formatCurrency(
                      (() => {
                        const nights = Math.ceil(
                          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
                        );
                        let weekdayNights = 0;
                        let weekendNights = 0;
                        for (let i = 0; i < nights; i++) {
                          const currentDate = new Date(checkIn);
                          currentDate.setDate(currentDate.getDate() + i);
                          const dayOfWeek = currentDate.getDay();
                          if (dayOfWeek === 5 || dayOfWeek === 6) {
                            weekendNights++;
                          } else {
                            weekdayNights++;
                          }
                        }
                        return (
                          weekdayNights * selectedUnit.base_rate +
                          weekendNights * selectedUnit.weekend_rate
                        );
                      })()
                    )}
                  </span>
                </div>
                {numGuests > selectedUnit.base_occupancy && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Extra person ({numGuests - selectedUnit.base_occupancy} ×{" "}
                      {formatCurrency(selectedUnit.extra_person_rate)})
                    </span>
                    <span>
                      {formatCurrency(
                        (numGuests - selectedUnit.base_occupancy) *
                          selectedUnit.extra_person_rate *
                          Math.ceil(
                            (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
                          )
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Total Amount:</span>
            <span>{formatCurrency(calculatedTotal)}</span>
          </div>
          {downpaymentAmount > 0 && (
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span>Downpayment Required:</span>
              <span>{formatCurrency(downpaymentAmount)}</span>
            </div>
          )}
          <PricingStatusBadge notice={pricingNotice} className="mt-3" size="md" />
        </CardContent>
      </Card>
    </div>
  );

  const getStepProgress = () => ((currentStep - 1) / 3) * 100;

  // Show loading skeleton while units are loading
  if (unitsLoading) {
    return (
      <Card className={cn("mx-auto w-full max-w-2xl", className)}>
        <CardHeader className="px-4 sm:px-6">
          <div className="text-center">
            <CardTitle className="text-xl font-semibold sm:text-lg">Create New Booking</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <BookingFormSkeleton currentStep={currentStep} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("mx-auto w-full max-w-2xl", className)}>
      <CardHeader className="px-4 sm:px-6">
        <div className="text-center">
          <CardTitle className="text-xl sm:text-2xl">Create New Booking</CardTitle>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            {STEP_DESCRIPTIONS[currentStep]}
          </p>
        </div>
        {renderStepIndicator()}
        <Progress value={getStepProgress()} className="h-2 w-full" />
      </CardHeader>

      <CardContent className="px-4 sm:px-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}

            <div className="flex justify-between gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep === 1 ? onCancel : handlePreviousStep}
                className="h-12 max-w-[140px] flex-1 touch-manipulation px-6 text-base sm:h-10 sm:text-sm"
              >
                {currentStep === 1 ? "Cancel" : "Previous"}
              </Button>

              {currentStep < 4 ? (
                <Button
                  key="next-button"
                  type="button"
                  onClick={handleNextStep}
                  className="h-12 max-w-[140px] flex-1 touch-manipulation px-6 text-base sm:h-10 sm:text-sm"
                >
                  Next
                </Button>
              ) : (
                <Button
                  key="submit-button"
                  type="submit"
                  disabled={createBookingMutation.isPending}
                  className="h-12 max-w-[200px] flex-1 touch-manipulation px-6 text-base sm:h-10 sm:text-sm"
                >
                  {createBookingMutation.isPending ? "Creating..." : "Confirm Booking"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
