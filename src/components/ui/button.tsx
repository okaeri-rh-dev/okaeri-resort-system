import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-visible:ring-ring inline-flex touch-manipulation items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "border-input bg-background hover:bg-accent hover:text-accent-foreground border shadow-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Resort-themed variants
        ocean: "bg-ocean-500 hover:bg-ocean-600 focus-visible:ring-ocean-300 text-white shadow",
        coral: "bg-coral-500 hover:bg-coral-600 focus-visible:ring-coral-300 text-white shadow",
        sand: "bg-sand-500 text-sand-900 hover:bg-sand-600 focus-visible:ring-sand-300 shadow",
        palm: "bg-palm-500 hover:bg-palm-600 focus-visible:ring-palm-300 text-white shadow",
        sunset: "bg-sunset-500 hover:bg-sunset-600 focus-visible:ring-sunset-300 text-white shadow",
        gradient: "gradient-ocean focus-visible:ring-ocean-300 text-white shadow hover:opacity-90",
        "gradient-sunset":
          "gradient-sunset focus-visible:ring-sunset-300 text-white shadow hover:opacity-90",
        "gradient-tropical":
          "gradient-tropical focus-visible:ring-palm-300 text-white shadow hover:opacity-90",
        glass:
          "glass border border-white/20 text-white shadow-lg backdrop-blur-md hover:bg-white/20 focus-visible:ring-white/30",
      },
      size: {
        default: "h-10 min-h-[44px] px-4 py-2 sm:h-9 sm:min-h-[36px]",
        sm: "h-9 min-h-[36px] rounded-md px-3 text-xs",
        lg: "h-12 min-h-[48px] rounded-md px-8",
        xl: "h-14 min-h-[56px] rounded-lg px-10 text-base",
        icon: "h-11 min-h-[44px] w-11 min-w-[44px] sm:h-9 sm:min-h-[36px] sm:w-9 sm:min-w-[36px]",
        "icon-sm": "h-9 min-h-[36px] w-9 min-w-[36px]",
        "icon-lg": "h-12 min-h-[48px] w-12 min-w-[48px]",
        "icon-xl": "h-14 min-h-[56px] w-14 min-w-[56px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      loadingText,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 -ml-1 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {loading ? loadingText || "Loading..." : children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
