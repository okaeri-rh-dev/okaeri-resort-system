import React, { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInDays, eachDayOfInterval, format } from "date-fns";
import { CheckCircle, CreditCard, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PricingStatusBadge } from "@/components/pricing/PricingStatusBadge";
import { BookingFormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RESORT_OPERATION_HOURS } from "@/config/settings";
import { usePricingCalculation } from "@/hooks/usePricingCalculation";
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
import { useCreateBooking, useUpdateBooking } from "@/stores/useBookingStore";
import { useUnits } from "@/stores/useUnitStore";
import type { Booking } from "@/types";
import { formDateToUTC } from "@/utils/date-helpers";

interface BookingFormProps {
  onSuccess?: (booking: Booking) => void;
  onCancel?: () => void;
  initialData?: Partial<CompleteBookingData> & {
    total_amount?: number; // Add total_amount for edit mode pricing
  };
  bookingId?: string; // If provided, form is in edit mode
  className?: string;
}

type FormStep = 1 | 2 | 3 | 4;

const STEP_DESCRIPTIONS = {
  1: "Choose your accommodation and preferred dates",
  2: "Provide contact details for the reservation",
  3: "Select payment method and add special requests",
  4: "Review your booking details before confirming",
};

export function BookingForm({
  onSuccess,
  onCancel,
  initialData,
  bookingId,
  className,
}: BookingFormProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [downpaymentAmount, setDownpaymentAmount] = useState<number>(0);
  const [pricingNotice, setPricingNotice] = useState<string | null>(null);
  const [recalculatePricing, setRecalculatePricing] = useState<boolean>(false);
  const originalTotal = initialData?.total_amount || 0;

  const isEditMode = !!bookingId;
  const createBookingMutation = useCreateBooking();
  const updateBookingMutation = useUpdateBooking();
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

  // Calculate pricing via API when relevant fields change
  useEffect(() => {
    // In edit mode, only calculate if recalculatePricing is enabled
    if (isEditMode && !recalculatePricing) {
      // Use original total when not recalculating
      setCalculatedTotal(originalTotal);
      setDownpaymentAmount(originalTotal * 0.5); // Default 50% downpayment
      setPricingNotice(null);
      return;
    }

    if (!selectedUnit || !checkIn || !checkOut) {
      setCalculatedTotal(0);
      setDownpaymentAmount(0);
      setPricingNotice(null);
      return;
    }

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
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
      guest_count: numGuests || 1,
      unit_id: selectedUnit.unit_id,
    });
  }, [selectedUnit?.unit_id, checkIn, checkOut, numGuests, recalculatePricing, isEditMode]);

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
      toast.success("Unit is available for your selected dates!");
    } catch (_error) {
      toast.error("Unit is not available for the selected dates");
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const onSubmit = async (data: CompleteBookingData) => {
    try {
      // Sanitize all form data to prevent XSS attacks
      const sanitizedData = sanitizeBookingFormData(data);

      const bookingData = {
        unit_id: data.unit_id,
        guest_name: sanitizedData.guest_name || data.guest_name,
        email: sanitizedData.email || data.email,
        contact_number: formatPhoneNumber(sanitizedData.contact_number || data.contact_number),
        num_guests: data.num_guests,
        check_in: formDateToUTC(data.check_in, RESORT_OPERATION_HOURS.checkInTime),
        check_out: formDateToUTC(data.check_out, RESORT_OPERATION_HOURS.checkOutTime),
        total_amount: calculatedTotal,
        special_requests: sanitizedData.special_requests || data.special_requests,
        payment_method: data.payment_method,
      };

      if (isEditMode) {
        await updateBookingMutation.mutateAsync({
          bookingId: bookingId!,
          updates: bookingData,
        });
        toast.success("Booking updated successfully!");
      } else {
        await createBookingMutation.mutateAsync(bookingData);
        toast.success("Booking created successfully!");
      }

      onSuccess?.(bookingData);
    } catch (error) {
      // Safe error handling without exposing sensitive information
      const errorMessage = isEditMode
        ? "Failed to update booking. Please try again."
        : "Failed to create booking. Please try again.";

      toast.error(errorMessage);

      if (process.env.NODE_ENV === "development") {
        console.error(`Booking ${isEditMode ? "update" : "creation"} error:`, error);
      }
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
                  disabled={(date) => date < new Date()}
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
              {isEditMode && (
                <>
                  <div className="bg-muted/50 flex items-center justify-between rounded-md p-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="recalculate-pricing"
                        checked={recalculatePricing}
                        onCheckedChange={setRecalculatePricing}
                      />
                      <label
                        htmlFor="recalculate-pricing"
                        className="cursor-pointer text-sm font-medium"
                      >
                        Recalculate with current rates
                      </label>
                    </div>
                  </div>
                  {recalculatePricing && originalTotal !== calculatedTotal && (
                    <div className="rounded-md bg-yellow-50 p-2 dark:bg-yellow-900/20">
                      <div className="space-y-1 text-xs text-yellow-800 dark:text-yellow-200">
                        <div className="flex justify-between">
                          <span>Original Price:</span>
                          <span className="font-medium line-through">
                            {formatCurrency(originalTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>New Price:</span>
                          <span className="font-medium text-green-700 dark:text-green-400">
                            {formatCurrency(calculatedTotal)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs italic">
                          {calculatedTotal > originalTotal
                            ? `Price increased by ${formatCurrency(calculatedTotal - originalTotal)}`
                            : `Price reduced by ${formatCurrency(originalTotal - calculatedTotal)}`}
                        </div>
                      </div>
                    </div>
                  )}
                  <Separator />
                </>
              )}
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
                <span>
                  {calculatePricing.isPending && recalculatePricing ? (
                    <span className="text-muted-foreground text-sm">Calculating...</span>
                  ) : (
                    formatCurrency(calculatedTotal)
                  )}
                </span>
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
            <FormLabel className="text-base font-medium sm:text-sm">Email Address</FormLabel>
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
              Booking confirmation will be sent to this email
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
            <FormLabel className="text-base font-medium sm:text-sm">Phone Number</FormLabel>
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
              <p className="text-muted-foreground">{email}</p>
              <p className="text-muted-foreground">{contactNumber}</p>
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

          {isEditMode && recalculatePricing && originalTotal !== calculatedTotal && (
            <>
              <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
                <div className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                  <div className="mb-2 font-medium">Pricing Updated</div>
                  <div className="flex justify-between">
                    <span>Original Booking Price:</span>
                    <span className="font-mono line-through">{formatCurrency(originalTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Price (Current Rates):</span>
                    <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                      {formatCurrency(calculatedTotal)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs italic">
                    {calculatedTotal > originalTotal
                      ? `Price increased by ${formatCurrency(calculatedTotal - originalTotal)} due to seasonal rate changes`
                      : `Price reduced by ${formatCurrency(originalTotal - calculatedTotal)} with current rates`}
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

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
          <PricingStatusBadge
            notice={pricingNotice}
            isLoading={calculatePricing.isPending && recalculatePricing}
            className="mt-3"
            size="md"
          />
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
            <CardTitle className="text-xl font-semibold sm:text-lg">
              {bookingId ? "Edit Booking" : "Create New Booking"}
            </CardTitle>
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
          <CardTitle className="text-xl sm:text-2xl">
            {bookingId ? "Edit Booking" : "Create New Booking"}
          </CardTitle>
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
                  disabled={createBookingMutation.isPending || updateBookingMutation.isPending}
                  className="h-12 max-w-[200px] flex-1 touch-manipulation px-6 text-base sm:h-10 sm:text-sm"
                >
                  {isEditMode
                    ? updateBookingMutation.isPending
                      ? "Updating..."
                      : "Update Booking"
                    : createBookingMutation.isPending
                      ? "Creating..."
                      : "Confirm Booking"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
