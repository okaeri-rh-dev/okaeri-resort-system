import type * as React from "react";

import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import { toneClasses, type StatusTone } from "./status-tone-classes";

const toneIcons: Record<StatusTone, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: Info,
  neutral: Info,
};

export interface CalloutProps {
  tone: StatusTone;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Placement only (margin, width). */
  className?: string;
}

/**
 * An inline message box in a status tone, with an icon, an optional title and a message.
 *
 * `danger` and `warning` render as `role="alert"`, so screen readers announce them at once;
 * the other tones render as a polite `role="status"`.
 *
 * @example
 * ```tsx
 * <Callout tone="warning" title="Downpayment due">Pay within 24 hours to keep the dates.</Callout>
 * ```
 */
export function Callout({ tone, title, children, className }: CalloutProps) {
  const Icon = toneIcons[tone];
  const urgent = tone === "danger" || tone === "warning";

  return (
    <Alert
      role={urgent ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        toneClasses[tone].fill,
        toneClasses[tone].border,
        "[&>svg]:text-current",
        className
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
