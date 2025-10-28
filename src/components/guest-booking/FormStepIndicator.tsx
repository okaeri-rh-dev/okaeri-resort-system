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
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="space-y-4 md:flex md:space-y-0 md:space-x-8">
        {steps.map((step) => {
          const isCompleted = completedSteps.has(step.number);
          const isCurrent = currentStep === step.number;
          const isClickable = step.number < currentStep || isCompleted;

          return (
            <li key={step.number} className="md:flex-1">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.number)}
                disabled={!isClickable}
                className={cn(
                  "group flex w-full flex-col border-l-4 py-2 pl-4 md:border-t-4 md:border-l-0 md:pt-4 md:pb-0 md:pl-0",
                  {
                    "border-primary hover:border-primary/80": isCurrent,
                    "border-primary": isCompleted,
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
                  <span className="text-muted-foreground mt-1 ml-14 text-sm md:mt-2 md:ml-0">
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
