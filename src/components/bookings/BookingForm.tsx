import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Users, CreditCard, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

import {
  completeBookingSchema,
  bookingStep1Schema,
  bookingStep2Schema,
  bookingStep3Schema,
  formatCurrency,
  formatPhoneNumber,
  type CompleteBookingData,
} from "@/lib/validations";

import { useCreateBooking, useUpdateBooking } from "@/stores/useBookingStore";
import { useUnits } from "@/stores/useUnitStore";
import { cn } from "@/lib/utils";
import { BookingFormSkeleton } from "@/components/skeletons";

interface BookingFormProps {
  onSuccess?: (booking: any) => void;
  onCancel?: () => void;
  initialData?: Partial<CompleteBookingData>;
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

  const isEditMode = !!bookingId;
  const createBookingMutation = useCreateBooking();
  const updateBookingMutation = useUpdateBooking();
  const { data: units, isLoading: unitsLoading } = useUnits();

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
    mode: "onChange",
  });

  const watchedValues = form.watch();
  const selectedUnit = units?.find((unit) => unit.unit_id === watchedValues.unit_id);

  // Calculate total amount when unit or dates change
  useEffect(() => {
    if (selectedUnit && watchedValues.check_in && watchedValues.check_out) {
      const checkIn = new Date(watchedValues.check_in);
      const checkOut = new Date(watchedValues.check_out);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      if (nights > 0) {
        // Calculate weekend and weekday nights
        let weekendNights = 0;
        let weekdayNights = 0;

        for (let i = 0; i < nights; i++) {
          const currentDate = new Date(checkIn);
          currentDate.setDate(currentDate.getDate() + i);
          const dayOfWeek = currentDate.getDay();

          if (dayOfWeek === 5 || dayOfWeek === 6) {
            // Friday or Saturday
            weekendNights++;
          } else {
            weekdayNights++;
          }
        }

        const total =
          weekdayNights * selectedUnit.base_rate + weekendNights * selectedUnit.weekend_rate;
        setCalculatedTotal(total);
      }
    }
  }, [selectedUnit, watchedValues.check_in, watchedValues.check_out]);

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
            contact_number: values.contact_number,
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
        const zodError = error as any;
        zodError.errors?.forEach((err: any) => {
          form.setError(err.path[0], { message: err.message });
        });
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
    if (!selectedUnit || !watchedValues.check_in || !watchedValues.check_out) return;

    setIsCheckingAvailability(true);
    try {
      // Simulate availability check - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Unit is available for your selected dates!");
    } catch (error) {
      toast.error("Unit is not available for the selected dates");
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const onSubmit = async (data: CompleteBookingData) => {
    try {
      const bookingData = {
        ...data,
        total_amount: calculatedTotal,
        contact_number: formatPhoneNumber(data.contact_number),
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
      toast.error(`Failed to ${isEditMode ? "update" : "create"} booking. Please try again.`);
      console.error(`Booking ${isEditMode ? "update" : "creation"} error:`, error);
    }
  };

  const renderStepIndicator = () => (
    <div className="mb-6 flex items-center justify-center space-x-2 px-4">
      {[1, 2, 3, 4].map((step) => (
        <React.Fragment key={step}>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium touch-manipulation",
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
            <FormLabel className="text-base sm:text-sm font-medium">Select Unit</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation">
                  <SelectValue placeholder="Choose a unit" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {units?.map((unit) => (
                  <SelectItem key={unit.unit_id} value={unit.unit_id}>
                    <div className="flex w-full items-center justify-between">
                      <span>
                        {unit.unit_name} ({unit.unit_type})
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
              <FormLabel className="text-base sm:text-sm font-medium">Check-in Date</FormLabel>
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
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarDays className="ml-auto h-5 w-5 sm:h-4 sm:w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
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
              <FormLabel className="text-base sm:text-sm font-medium">Check-out Date</FormLabel>
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
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarDays className="ml-auto h-5 w-5 sm:h-4 sm:w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date <= watchedValues.check_in}
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

      <FormField
        control={form.control}
        name="num_guests"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base sm:text-sm font-medium">Number of Guests</FormLabel>
            <FormControl>
              <div className="relative">
                <Users className="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 sm:h-4 sm:w-4 -translate-y-1/2 transform" />
                <Input
                  type="number"
                  min="1"
                  max={selectedUnit?.max_occupancy || 20}
                  className="pl-12 sm:pl-10 h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                />
              </div>
            </FormControl>
            {selectedUnit && (
              <FormDescription>
                Maximum occupancy: {selectedUnit.max_occupancy} guests
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
                    (new Date(watchedValues.check_out).getTime() -
                      new Date(watchedValues.check_in).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>{formatCurrency(calculatedTotal)}</span>
              </div>
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
            <FormLabel className="text-base sm:text-sm font-medium">Full Name</FormLabel>
            <FormControl>
              <Input
                placeholder="Enter guest's full name"
                className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
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
            <FormLabel className="text-base sm:text-sm font-medium">Email Address</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="guest@example.com"
                className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
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
            <FormLabel className="text-base sm:text-sm font-medium">Phone Number</FormLabel>
            <FormControl>
              <Input
                type="tel"
                placeholder="+639123456789 or 09123456789"
                className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                autoComplete="tel"
                {...field}
              />
            </FormControl>
            <FormDescription className="text-sm">Philippine mobile numbers only</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Privacy Consent - Phase 2 Security Requirement */}
      <div className="flex items-start space-x-3 rounded-md border p-4">
        <input type="checkbox" id="privacy-consent" className="mt-1" required />
        <div className="space-y-1 leading-none">
          <label
            htmlFor="privacy-consent"
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Privacy Consent *
          </label>
          <p className="text-muted-foreground text-sm">
            I consent to the collection and processing of my personal information for booking
            purposes. The resort will handle my data in accordance with the Philippine Data Privacy
            Act of 2012.
          </p>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="payment_method"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base sm:text-sm font-medium">Payment Method</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12 sm:h-10 text-base sm:text-sm touch-manipulation">
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
            <FormLabel className="text-base sm:text-sm font-medium">
              Special Requests (Optional)
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Any special requests or notes for your stay..."
                className="min-h-[120px] sm:min-h-[100px] text-base sm:text-sm touch-manipulation resize-none"
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
              <p className="text-muted-foreground">{format(watchedValues.check_in, "PPP")}</p>
            </div>
            <div>
              <h4 className="font-medium">Check-out</h4>
              <p className="text-muted-foreground">{format(watchedValues.check_out, "PPP")}</p>
            </div>
            <div>
              <h4 className="font-medium">Guests</h4>
              <p className="text-muted-foreground">{watchedValues.num_guests}</p>
            </div>
            <div>
              <h4 className="font-medium">Payment</h4>
              <p className="text-muted-foreground">{watchedValues.payment_method}</p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-medium">Guest Information</h4>
            <div className="mt-2 space-y-1">
              <p className="text-muted-foreground">{watchedValues.guest_name}</p>
              <p className="text-muted-foreground">{watchedValues.email}</p>
              <p className="text-muted-foreground">{watchedValues.contact_number}</p>
            </div>
          </div>

          {watchedValues.special_requests && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium">Special Requests</h4>
                <p className="text-muted-foreground mt-2">{watchedValues.special_requests}</p>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Total Amount:</span>
            <span>{formatCurrency(calculatedTotal)}</span>
          </div>
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
            <CardTitle className="text-xl sm:text-lg font-semibold">Create New Booking</CardTitle>
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
        <Progress value={getStepProgress()} className="w-full h-2" />
      </CardHeader>

      <CardContent className="px-4 sm:px-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}

            <div className="flex justify-between pt-6 gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep === 1 ? onCancel : handlePreviousStep}
                className="h-12 sm:h-10 px-6 text-base sm:text-sm touch-manipulation flex-1 max-w-[140px]"
              >
                {currentStep === 1 ? "Cancel" : "Previous"}
              </Button>

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="h-12 sm:h-10 px-6 text-base sm:text-sm touch-manipulation flex-1 max-w-[140px]"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createBookingMutation.isPending || updateBookingMutation.isPending}
                  className="h-12 sm:h-10 px-6 text-base sm:text-sm touch-manipulation flex-1 max-w-[200px]"
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
