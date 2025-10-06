import { CalendarDays, Users, CreditCard, CheckCircle } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { BookingFormSkeleton } from "@/components/skeletons";
import { withErrorBoundary } from "@/components/ErrorBoundary";

import { useBookingForm } from "./hooks/useBookingForm";
import { UnitSelection } from "./steps/UnitSelection";
import { GuestInformation } from "./steps/GuestInformation";
import { PaymentDetails } from "./steps/PaymentDetails";
import { BookingReview } from "./steps/BookingReview";

import type { BookingFormProps } from "./types";
import { STEP_DESCRIPTIONS } from "./types";

const STEP_ICONS = {
  1: CalendarDays,
  2: Users,
  3: CreditCard,
  4: CheckCircle,
};

const STEP_TITLES = {
  1: "Select Unit & Dates",
  2: "Guest Information",
  3: "Payment Method",
  4: "Review & Confirm",
};

function BookingFormComponent({
  onSuccess,
  onCancel,
  initialData,
  bookingId,
  className,
}: BookingFormProps) {
  const {
    form,
    currentStep,
    calculatedTotal,
    selectedUnit,
    isEditMode,
    unitsLoading,
    isCheckingAvailability,
    isSubmitting,
    units,
    handleNext,
    handlePrevious,
    checkAvailability,
    handleSubmit,
  } = useBookingForm({
    initialData,
    bookingId,
    onSuccess,
  });

  const StepIcon = STEP_ICONS[currentStep];
  const progressValue = (currentStep / 4) * 100;

  if (unitsLoading) {
    return <BookingFormSkeleton />;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <UnitSelection
            form={form}
            units={units}
            calculatedTotal={calculatedTotal}
            selectedUnit={selectedUnit}
            isCheckingAvailability={isCheckingAvailability}
            onCheckAvailability={checkAvailability}
          />
        );
      case 2:
        return <GuestInformation form={form} />;
      case 3:
        return <PaymentDetails form={form} />;
      case 4:
        return <BookingReview form={form} units={units} calculatedTotal={calculatedTotal} />;
      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <StepIcon className="h-5 w-5 text-primary" />
            <CardTitle>{STEP_TITLES[currentStep]}</CardTitle>
            {isEditMode && (
              <span className="ml-auto text-sm text-muted-foreground">Editing Booking</span>
            )}
          </div>
          <CardDescription>{STEP_DESCRIPTIONS[currentStep]}</CardDescription>
          <Progress value={progressValue} className="h-2" />
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {renderStep()}

            <div className="flex gap-4 justify-between pt-6">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={isSubmitting}
                  className="min-w-[100px]"
                >
                  Previous
                </Button>
              )}

              {onCancel && currentStep === 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
              )}

              <div className="ml-auto flex gap-2">
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className="min-w-[100px]"
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                    {isSubmitting
                      ? "Processing..."
                      : isEditMode
                        ? "Update Booking"
                        : "Confirm Booking"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Export with error boundary
export const BookingForm = withErrorBoundary(BookingFormComponent, {
  level: "component",
  fallback: (
    <Card>
      <CardContent className="p-8 text-center">
        <p className="text-red-600">Failed to load booking form</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Reload Page
        </Button>
      </CardContent>
    </Card>
  ),
});

// Re-export types
export type { BookingFormProps } from "./types";
