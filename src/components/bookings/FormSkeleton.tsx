import { Fragment } from "react";

import { Skeleton } from "@/components/patterns";
import { cn } from "@/lib/utils";

function StepsSkeleton({ steps, currentStep }: { steps: number; currentStep: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {Array.from({ length: steps }, (_, index) => (
          <Fragment key={index}>
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2",
                index < currentStep ? "border-primary bg-primary" : "border-input"
              )}
            />
            {index < steps - 1 && (
              <div
                className={cn("h-0.5 flex-1", index < currentStep - 1 ? "bg-primary" : "bg-input")}
              />
            )}
          </Fragment>
        ))}
      </div>
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
}

export interface FormSkeletonProps {
  fields?: number;
  /** Adds a step indicator above the fields, for multi-step forms. */
  steps?: number;
  /** The 1-based step the indicator shows as reached. */
  currentStep?: number;
  /** Shows the back and submit button placeholders. */
  actions?: boolean;
  /** What screen readers hear while it shows. */
  label?: string;
  /** Placement only. */
  className?: string;
}

/**
 * The loading state of a form: label and control placeholders, an optional step indicator and
 * the action row. It is a polite `status` region named by `label`.
 *
 * @example
 * ```tsx
 * if (isLoading) return <FormSkeleton steps={4} currentStep={step} label="Loading booking form" />;
 * ```
 */
export function FormSkeleton({
  fields = 4,
  steps,
  currentStep = 1,
  actions = true,
  label = "Loading",
  className,
}: FormSkeletonProps) {
  return (
    <div role="status" aria-label={label} className={className}>
      <div aria-hidden="true" className="space-y-6">
        {steps && <StepsSkeleton steps={steps} currentStep={currentStep} />}
        <div className="space-y-4">
          {Array.from({ length: fields }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={cn("w-full", index === fields - 1 ? "h-20" : "h-9")} />
            </div>
          ))}
        </div>
        {actions && (
          <div className="flex justify-between pt-4">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        )}
      </div>
    </div>
  );
}
