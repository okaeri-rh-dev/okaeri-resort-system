import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("bg-card text-card-foreground rounded-xl border shadow", {
  variants: {
    variant: {
      default: "border-border bg-card",
      outline: "border-border bg-card border-2",
      elevated: "border-border bg-card shadow-lg",
      // Resort-themed variants
      ocean:
        "bg-ocean-50 border-ocean-200 text-ocean-900 dark:bg-ocean-950 dark:border-ocean-800 dark:text-ocean-100",
      coral:
        "bg-coral-50 border-coral-200 text-coral-900 dark:bg-coral-950 dark:border-coral-800 dark:text-coral-100",
      sand: "bg-sand-50 border-sand-200 text-sand-900 dark:bg-sand-950 dark:border-sand-800 dark:text-sand-100",
      palm: "bg-palm-50 border-palm-200 text-palm-900 dark:bg-palm-950 dark:border-palm-800 dark:text-palm-100",
      sunset:
        "bg-sunset-50 border-sunset-200 text-sunset-900 dark:bg-sunset-950 dark:border-sunset-800 dark:text-sunset-100",
      glass: "glass border-white/20 text-white backdrop-blur-md",
      gradient: "gradient-ocean border-transparent text-white shadow-lg",
      "gradient-sunset": "gradient-sunset border-transparent text-white shadow-lg",
      "gradient-tropical": "gradient-tropical border-transparent text-white shadow-lg",
    },
    padding: {
      none: "p-0",
      sm: "p-4",
      default: "p-6",
      lg: "p-8",
      xl: "p-10",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "default",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padding, className }))} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("leading-none font-semibold tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-muted-foreground text-sm", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

// Resort-specific card variants for common use cases

const StatsCard = React.forwardRef<
  HTMLDivElement,
  CardProps & {
    title: string;
    value: string | number;
    description?: string;
    icon?: React.ReactNode;
    trend?: {
      value: number;
      isPositive: boolean;
    };
  }
>(({ className, title, value, description, icon, trend, variant = "elevated", ...props }, ref) => (
  <Card
    ref={ref}
    variant={variant}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon && <div className="text-muted-foreground">{icon}</div>}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
      {trend && (
        <div
          className={cn(
            "mt-1 flex items-center text-xs",
            trend.isPositive ? "text-palm-600" : "text-coral-600"
          )}
        >
          <span>{trend.isPositive ? "↗" : "↘"}</span>
          <span className="ml-1">{Math.abs(trend.value)}%</span>
        </div>
      )}
    </CardContent>
  </Card>
));
StatsCard.displayName = "StatsCard";

const FeatureCard = React.forwardRef<
  HTMLDivElement,
  CardProps & {
    title: string;
    description: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
  }
>(({ className, title, description, icon, action, variant = "default", ...props }, ref) => (
  <Card ref={ref} variant={variant} className={cn("text-center", className)} {...props}>
    <CardHeader>
      {icon && (
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
          {icon}
        </div>
      )}
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    {action && <CardFooter className="justify-center">{action}</CardFooter>}
  </Card>
));
FeatureCard.displayName = "FeatureCard";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatsCard,
  FeatureCard,
  cardVariants,
};
