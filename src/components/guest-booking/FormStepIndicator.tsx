import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface Step {
  number: number;
  label: string;
  description?: string;
}

interface FormStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (stepNumber: number) => void;
}

export function FormStepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: FormStepIndicatorProps) {
  const currentStepData = steps[currentStep - 1];
  const progressPercentage = (currentStep / steps.length) * 100;

  return (
    <nav aria-label="Progress">
      {/* Mobile: Compact Progress Bar */}
      <div className="mb-6 @2xl:hidden">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-foreground text-sm font-semibold">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-muted-foreground ml-2 max-w-[60%] truncate text-sm font-medium">
            {currentStepData?.label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="bg-border h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-[width] duration-200 ease-out"
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-label={`Step ${currentStep} of ${steps.length}: ${currentStepData?.label}`}
          />
        </div>

        {/* Optional: Show completion count */}
        {completedSteps.size > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <Check className="text-primary h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-muted-foreground text-xs">{completedSteps.size} completed</span>
          </div>
        )}
      </div>

      {/* Desktop: Full Stepper (Existing Design - Unchanged) */}
      <ol className="mb-8 hidden @2xl:flex @2xl:space-x-8">
        {steps.map((step) => {
          const isCompleted = completedSteps.has(step.number);
          const isCurrent = currentStep === step.number;
          const isClickable = step.number < currentStep || isCompleted;

          return (
            <li key={step.number} className="flex-1">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.number)}
                disabled={!isClickable}
                className={cn(
                  "group flex w-full flex-col border-t-4 pt-4 pb-0 pl-0 transition-colors",
                  {
                    "border-primary hover:border-primary/80": isCurrent,
                    "border-primary": isCompleted && !isCurrent,
                    "border-muted-foreground/30": !isCurrent && !isCompleted,
                    "cursor-pointer": isClickable,
                    "cursor-not-allowed": !isClickable,
                  }
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="flex items-center text-sm font-medium">
                  <span
                    className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2",
                      {
                        "border-primary bg-primary text-primary-foreground":
                          isCurrent || isCompleted,
                        "border-muted-foreground/30 text-muted-foreground":
                          !isCurrent && !isCompleted,
                      }
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </span>
                  <span className="ml-4 text-sm font-medium">{step.label}</span>
                </span>
                {step.description && (
                  <span className="text-muted-foreground mt-2 ml-0 text-sm">
                    {step.description}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
