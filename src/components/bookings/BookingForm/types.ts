import type { CompleteBookingData } from "@/lib/validations";
import type { UseFormReturn } from "react-hook-form";
import type { Unit } from "@/types";

export interface BookingFormProps {
  onSuccess?: (booking: any) => void;
  onCancel?: () => void;
  initialData?: Partial<CompleteBookingData>;
  bookingId?: string; // If provided, form is in edit mode
  className?: string;
}

export type FormStep = 1 | 2 | 3 | 4;

export interface StepProps {
  form: UseFormReturn<CompleteBookingData>;
  onNext?: () => void;
  onPrevious?: () => void;
  onSubmit?: (data: CompleteBookingData) => void;
  calculatedTotal?: number;
  isSubmitting?: boolean;
  selectedUnit?: Unit | null;
  isCheckingAvailability?: boolean;
  onCheckAvailability?: () => Promise<void>;
}

export const STEP_DESCRIPTIONS = {
  1: "Choose your accommodation and preferred dates",
  2: "Provide contact details for the reservation",
  3: "Select payment method and add special requests",
  4: "Review your booking details before confirming",
} as const;
