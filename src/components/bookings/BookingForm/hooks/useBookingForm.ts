import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInDays, isWeekend, eachDayOfInterval } from "date-fns";
import { toast } from "sonner";

import {
  completeBookingSchema,
  bookingStep1Schema,
  bookingStep2Schema,
  bookingStep3Schema,
  type CompleteBookingData,
} from "@/lib/validations";

import { useCreateBooking, useUpdateBooking } from "@/stores/useBookingStore";
import { useUnits } from "@/stores/useUnitStore";
import { sanitizeBookingFormData } from "@/lib/security/sanitize";
import { checkUnitAvailability } from "@/lib/availability";

import type { FormStep } from "../types";

interface UseBookingFormProps {
  initialData?: Partial<CompleteBookingData>;
  bookingId?: string;
  onSuccess?: (booking: any) => void;
}

export function useBookingForm({ initialData, bookingId, onSuccess }: UseBookingFormProps) {
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
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const watchedFields = form.watch();
  const { unit_id, check_in, check_out, num_guests } = watchedFields;

  const selectedUnit = useMemo(
    () => units?.find((u) => u.id === unit_id) || null,
    [units, unit_id]
  );

  // Calculate total price based on selected unit and dates
  useEffect(() => {
    if (!selectedUnit || !check_in || !check_out) {
      setCalculatedTotal(0);
      return;
    }

    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);
    const nights = differenceInDays(checkOutDate, checkInDate);

    if (nights <= 0) {
      setCalculatedTotal(0);
      return;
    }

    // Calculate base rate for all nights
    let total = 0;
    const dateRange = eachDayOfInterval({ start: checkInDate, end: checkOutDate });

    dateRange.forEach((date) => {
      const isWeekendDay = isWeekend(date);
      const rate =
        isWeekendDay && selectedUnit.weekend_rate
          ? selectedUnit.weekend_rate
          : selectedUnit.base_rate;
      total += rate;
    });

    // Add extra person charges if applicable
    if (num_guests > selectedUnit.base_occupancy) {
      const extraPersons = num_guests - selectedUnit.base_occupancy;
      const extraPersonRate = selectedUnit.extra_person_rate || 0;
      total += extraPersons * extraPersonRate * nights;
    }

    setCalculatedTotal(total);
  }, [selectedUnit, check_in, check_out, num_guests]);

  // Step validation
  const validateCurrentStep = useCallback(async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await form.trigger(["unit_id", "check_in", "check_out", "num_guests"]);
        break;
      case 2:
        isValid = await form.trigger(["guest_name", "email", "contact_number"]);
        break;
      case 3:
        isValid = await form.trigger(["payment_method"]);
        break;
      case 4:
        isValid = await form.trigger();
        break;
    }

    return isValid;
  }, [currentStep, form]);

  // Navigation handlers
  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as FormStep);
    }
  }, [currentStep, validateCurrentStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as FormStep);
    }
  }, [currentStep]);

  // Check availability
  const checkAvailability = useCallback(async () => {
    if (!selectedUnit || !check_in || !check_out) {
      toast.error("Please select a unit and dates");
      return;
    }

    setIsCheckingAvailability(true);

    try {
      const isAvailable = await checkUnitAvailability({
        unitId: selectedUnit.id,
        checkIn: new Date(check_in).toISOString(),
        checkOut: new Date(check_out).toISOString(),
        excludeBookingId: bookingId,
      });

      if (isAvailable) {
        toast.success("Unit is available for the selected dates!");
      } else {
        toast.error("Unit is not available for the selected dates. Please choose different dates.");
      }
    } catch (error) {
      toast.error("Failed to check availability. Please try again.");
      console.error("Availability check error:", error);
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [selectedUnit, check_in, check_out, bookingId]);

  // Submit handler
  const handleSubmit = useCallback(
    async (data: CompleteBookingData) => {
      try {
        const sanitizedData = sanitizeBookingFormData({
          ...data,
          total_amount: calculatedTotal,
        });

        if (isEditMode) {
          await updateBookingMutation.mutateAsync({
            bookingId,
            updates: sanitizedData,
          });
          toast.success("Booking updated successfully!");
        } else {
          const result = await createBookingMutation.mutateAsync(sanitizedData);
          toast.success("Booking created successfully!");
          onSuccess?.(result);
        }
      } catch (error) {
        toast.error(
          isEditMode
            ? "Failed to update booking. Please try again."
            : "Failed to create booking. Please try again."
        );
        console.error("Booking submission error:", error);
      }
    },
    [
      calculatedTotal,
      isEditMode,
      bookingId,
      createBookingMutation,
      updateBookingMutation,
      onSuccess,
    ]
  );

  return {
    // Form state
    form,
    currentStep,
    calculatedTotal,
    selectedUnit,
    isEditMode,

    // Loading states
    unitsLoading,
    isCheckingAvailability,
    isSubmitting: createBookingMutation.isPending || updateBookingMutation.isPending,

    // Data
    units,

    // Actions
    handleNext,
    handlePrevious,
    checkAvailability,
    handleSubmit,
    validateCurrentStep,
    setCurrentStep,
  };
}
