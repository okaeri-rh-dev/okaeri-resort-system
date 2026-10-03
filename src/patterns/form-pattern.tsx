import { type ReactNode } from "react";

import { type FieldValues, type UseFormReturn } from "react-hook-form";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card } from "@/components/ui/card";
import { sanitizeFormData } from "@/lib/security/sanitize";
import { cn } from "@/lib/utils";

interface FormWrapperProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => Promise<void>;
  children: ReactNode;
  className?: string;
  sanitize?: boolean;
  errorFallback?: ReactNode;
}

/**
 * Reusable form wrapper with error boundary and security features
 * Automatically handles form submission, sanitization, and error boundaries
 */
export function FormWrapper<T extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  sanitize = true,
  errorFallback,
}: FormWrapperProps<T>) {
  const handleSubmit = async (data: T) => {
    try {
      // Sanitize form data if enabled
      const processedData = sanitize ? sanitizeFormData(data) : data;
      await onSubmit(processedData as T);
    } catch (error) {
      console.error("Form submission error:", error);
      // Re-throw to be caught by error boundary if needed
      throw error;
    }
  };

  return (
    <ErrorBoundary level="component" fallback={errorFallback}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-4", className)}
        noValidate
      >
        {children}
      </form>
    </ErrorBoundary>
  );
}

interface StepFormWrapperProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: (data: T) => Promise<void>;
  children: ReactNode;
  className?: string;
  showProgress?: boolean;
}

/**
 * Multi-step form wrapper with progress indicator
 * Handles step navigation and validation
 */
export function StepFormWrapper<T extends FieldValues>({
  form,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSubmit,
  children,
  className,
  showProgress = true,
}: StepFormWrapperProps<T>) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <FormWrapper form={form} onSubmit={onSubmit} className={className}>
      {showProgress && (
        <div className="mb-6">
          <div className="mb-2 flex justify-between">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "mx-1 h-2 flex-1 rounded",
                  i + 1 <= currentStep ? "bg-primary" : "bg-gray-200"
                )}
              />
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            Step {currentStep} of {totalSteps}
          </p>
        </div>
      )}

      <Card className="p-6">{children}</Card>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isFirstStep}
          className={cn(
            "rounded px-4 py-2 transition-colors",
            isFirstStep
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          )}
        >
          Previous
        </button>

        {isLastStep ? (
          <button
            type="submit"
            className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-white transition-colors"
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-white transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </FormWrapper>
  );
}
