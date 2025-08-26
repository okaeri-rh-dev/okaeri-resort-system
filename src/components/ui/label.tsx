import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  {
    variants: {
      variant: {
        default: "text-foreground",
        muted: "text-muted-foreground",
        // Resort-themed variants
        ocean: "text-ocean-700 dark:text-ocean-300",
        coral: "text-coral-700 dark:text-coral-300",
        sand: "text-sand-700 dark:text-sand-300",
        palm: "text-palm-700 dark:text-palm-300",
        sunset: "text-sunset-700 dark:text-sunset-300",
        error: "text-destructive",
        success: "text-palm-600 dark:text-palm-400",
      },
      size: {
        default: "text-sm",
        sm: "text-xs",
        lg: "text-base",
        xl: "text-lg",
      },
      weight: {
        normal: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
        bold: "font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      weight: "medium",
    },
  }
);

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
  optional?: boolean;
}

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, variant, size, weight, required, optional, children, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(labelVariants({ variant, size, weight }), className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-destructive ml-1" aria-label="required">
          *
        </span>
      )}
      {optional && <span className="text-muted-foreground ml-1 font-normal">(optional)</span>}
    </LabelPrimitive.Root>
  )
);
Label.displayName = LabelPrimitive.Root.displayName;

// Field Label Component for form fields with enhanced styling
const FieldLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps & {
    description?: string;
    error?: string;
    success?: string;
  }
>(
  (
    {
      className,
      variant,
      size,
      weight,
      required,
      optional,
      children,
      description,
      error,
      success,
      ...props
    },
    ref
  ) => {
    const finalVariant = error ? "error" : success ? "success" : variant;

    return (
      <div className="space-y-1">
        <Label
          ref={ref}
          variant={finalVariant}
          size={size}
          weight={weight}
          required={required}
          optional={optional}
          className={className}
          {...props}
        >
          {children}
        </Label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
    );
  }
);
FieldLabel.displayName = "FieldLabel";

// Section Label Component for grouping form sections
const SectionLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps & {
    subtitle?: string;
  }
>(
  (
    {
      className,
      variant = "default",
      size = "lg",
      weight = "semibold",
      children,
      subtitle,
      ...props
    },
    ref
  ) => (
    <div className="space-y-1">
      <Label
        ref={ref}
        variant={variant}
        size={size}
        weight={weight}
        className={cn("tracking-tight", className)}
        {...props}
      >
        {children}
      </Label>
      {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
    </div>
  )
);
SectionLabel.displayName = "SectionLabel";

// Form Group Component that combines label with content
const FormGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    label: string;
    required?: boolean;
    optional?: boolean;
    description?: string;
    error?: string;
    success?: string;
    variant?: VariantProps<typeof labelVariants>["variant"];
  }
>(
  (
    {
      className,
      label,
      required,
      optional,
      description,
      error,
      success,
      variant,
      children,
      ...props
    },
    ref
  ) => (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      <FieldLabel
        variant={variant}
        required={required}
        optional={optional}
        description={description}
        error={error}
        success={success}
      >
        {label}
      </FieldLabel>
      {children}
      {(error || success) && (
        <p
          className={cn("text-sm", error ? "text-destructive" : "text-palm-600 dark:text-palm-400")}
        >
          {error || success}
        </p>
      )}
    </div>
  )
);
FormGroup.displayName = "FormGroup";

export { Label, FieldLabel, SectionLabel, FormGroup, labelVariants };
