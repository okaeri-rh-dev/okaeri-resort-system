import { ReactNode } from "react";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { sanitizeFormData } from "@/lib/security/sanitize";

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
          <div className="flex justify-between mb-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-2 mx-1 rounded",
                  i + 1 <= currentStep ? "bg-primary" : "bg-gray-200"
                )}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 text-center">
            Step {currentStep} of {totalSteps}
          </p>
        </div>
      )}

      <Card className="p-6">{children}</Card>

      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isFirstStep}
          className={cn(
            "px-4 py-2 rounded transition-colors",
            isFirstStep
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          )}
        >
          Previous
        </button>

        {isLastStep ? (
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </FormWrapper>
  );
}
