import React from "react";
import { cn } from "src/lib/utils";

// ============================================
// BASE SKELETON COMPONENT
// ============================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "text" | "circle" | "rounded" | "sharp";
  animation?: "pulse" | "wave" | "none";
  speed?: "slow" | "normal" | "fast";
}

function Skeleton({
  className,
  variant = "default",
  animation = "pulse",
  speed = "normal",
  ...props
}: SkeletonProps) {
  const animationClass = {
    pulse: "animate-pulse",
    wave: "animate-wave",
    none: "",
  }[animation];

  const speedClass = {
    slow: "animation-duration-[2s]",
    normal: "animation-duration-[1.5s]",
    fast: "animation-duration-[1s]",
  }[speed];

  const variantClass = {
    default: "rounded-md",
    text: "rounded-sm",
    circle: "rounded-full",
    rounded: "rounded-lg",
    sharp: "rounded-none",
  }[variant];

  return (
    <div
      className={cn(
        "bg-neutral-200/70 dark:bg-neutral-700/50",
        variantClass,
        animationClass,
        speedClass,
        className
      )}
      {...props}
    />
  );
}

// ============================================
// SPECIALIZED SKELETON VARIANTS
// ============================================

interface TextSkeletonProps {
  lines?: number;
  className?: string;
  lastLineWidth?: "full" | "3/4" | "1/2" | "1/3";
}

const TextSkeleton: React.FC<TextSkeletonProps> = ({
  lines = 1,
  className,
  lastLineWidth = "3/4",
}) => {
  const lastLineWidthClass = {
    full: "w-full",
    "3/4": "w-3/4",
    "1/2": "w-1/2",
    "1/3": "w-1/3",
  }[lastLineWidth];

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn("h-4", i === lines - 1 && lines > 1 ? lastLineWidthClass : "w-full")}
        />
      ))}
    </div>
  );
};

interface AvatarSkeletonProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const AvatarSkeleton: React.FC<AvatarSkeletonProps> = ({ size = "md", className }) => {
  const sizeClass = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  }[size];

  return <Skeleton variant="circle" className={cn(sizeClass, className)} />;
};

interface ButtonSkeletonProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

const ButtonSkeleton: React.FC<ButtonSkeletonProps> = ({
  size = "md",
  variant = "default",
  className,
}) => {
  const sizeClass = {
    sm: "h-8 px-3",
    md: "h-9 px-4",
    lg: "h-10 px-6",
  }[size];

  const variantClass = {
    default: "bg-neutral-200/70",
    outline: "bg-transparent border border-neutral-200",
    ghost: "bg-neutral-100/50",
  }[variant];

  return <Skeleton className={cn("rounded-md w-20", sizeClass, variantClass, className)} />;
};

// ============================================
// CARD SKELETON COMPONENTS
// ============================================

interface CardSkeletonProps {
  hasHeader?: boolean;
  hasFooter?: boolean;
  contentLines?: number;
  className?: string;
}

const CardSkeleton: React.FC<CardSkeletonProps> = ({
  hasHeader = true,
  hasFooter = false,
  contentLines = 3,
  className,
}) => {
  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white p-4 space-y-4", className)}>
      {hasHeader && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}

      <div className="space-y-2">
        <TextSkeleton lines={contentLines} lastLineWidth="1/2" />
      </div>

      {hasFooter && (
        <div className="flex space-x-2 pt-2">
          <ButtonSkeleton size="sm" />
          <ButtonSkeleton size="sm" variant="outline" />
        </div>
      )}
    </div>
  );
};

// ============================================
// KPI CARD SKELETON
// ============================================

interface KPICardSkeletonProps {
  hasIcon?: boolean;
  className?: string;
}

const KPICardSkeleton: React.FC<KPICardSkeletonProps> = ({ hasIcon = true, className }) => {
  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white p-4", className)}>
      <div className="flex items-center justify-between pb-3">
        <Skeleton className="h-4 w-24" />
        {hasIcon && <Skeleton variant="circle" className="h-5 w-5" />}
      </div>

      <div className="space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
};

// ============================================
// TABLE SKELETON COMPONENTS
// ============================================

interface TableRowSkeletonProps {
  columns: number[];
  showCheckbox?: boolean;
  showActions?: boolean;
  className?: string;
}

const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({
  columns,
  showCheckbox = false,
  showActions = false,
  className,
}) => {
  return (
    <div
      className={cn("flex items-center space-x-4 px-4 py-3 border-b border-neutral-100", className)}
    >
      {showCheckbox && <Skeleton variant="sharp" className="h-4 w-4" />}

      {columns.map((width, index) => (
        <Skeleton key={index} className="h-4" style={{ width: `${width}px` }} />
      ))}

      {showActions && <Skeleton variant="circle" className="h-6 w-6 ml-auto" />}
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number[];
  hasHeader?: boolean;
  showCheckbox?: boolean;
  showActions?: boolean;
  className?: string;
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = [120, 200, 100, 120, 80],
  hasHeader = true,
  showCheckbox = false,
  showActions = true,
  className,
}) => {
  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white overflow-hidden", className)}>
      {hasHeader && (
        <div className="bg-neutral-50 border-b border-neutral-200">
          <TableRowSkeleton
            columns={columns}
            showCheckbox={showCheckbox}
            showActions={showActions}
            className="border-none py-3"
          />
        </div>
      )}

      <div>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRowSkeleton
            key={index}
            columns={columns}
            showCheckbox={showCheckbox}
            showActions={showActions}
            className={cn(
              index % 2 === 0 && "bg-neutral-50/30",
              index === rows - 1 && "border-none"
            )}
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================
// MOBILE CARD SKELETON
// ============================================

interface MobileCardSkeletonProps {
  hasAvatar?: boolean;
  hasActions?: boolean;
  rowCount?: number;
  className?: string;
}

const MobileCardSkeleton: React.FC<MobileCardSkeletonProps> = ({
  hasAvatar = false,
  hasActions = true,
  rowCount = 4,
  className,
}) => {
  return (
    <div className={cn("rounded-lg border border-neutral-200 bg-white p-4 space-y-3", className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {hasAvatar && <AvatarSkeleton size="md" />}
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <div className="flex space-x-1">
          <Skeleton variant="rounded" className="h-6 w-16" />
          <Skeleton variant="rounded" className="h-6 w-16" />
        </div>
      </div>

      {/* Content rows */}
      <div className="space-y-2">
        {Array.from({ length: rowCount }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Actions */}
      {hasActions && (
        <div className="flex space-x-2 border-t border-neutral-100 pt-3">
          <ButtonSkeleton size="sm" className="flex-1" />
          <ButtonSkeleton size="sm" variant="outline" className="flex-1" />
        </div>
      )}
    </div>
  );
};

// ============================================
// FORM SKELETON COMPONENTS
// ============================================

interface FormFieldSkeletonProps {
  hasLabel?: boolean;
  hasDescription?: boolean;
  fieldType?: "input" | "textarea" | "select" | "date";
  className?: string;
}

const FormFieldSkeleton: React.FC<FormFieldSkeletonProps> = ({
  hasLabel = true,
  hasDescription = false,
  fieldType = "input",
  className,
}) => {
  const fieldClass = {
    input: "h-9",
    textarea: "h-20",
    select: "h-9",
    date: "h-9",
  }[fieldType];

  return (
    <div className={cn("space-y-2", className)}>
      {hasLabel && <Skeleton className="h-4 w-20" />}
      <Skeleton className={cn("w-full rounded-md", fieldClass)} />
      {hasDescription && <Skeleton className="h-3 w-48" />}
    </div>
  );
};

interface FormSkeletonProps {
  fields?: number;
  hasSubmit?: boolean;
  className?: string;
}

const FormSkeleton: React.FC<FormSkeletonProps> = ({ fields = 4, hasSubmit = true, className }) => {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, index) => (
        <FormFieldSkeleton
          key={index}
          hasDescription={index === 0}
          fieldType={index === fields - 1 ? "textarea" : "input"}
        />
      ))}

      {hasSubmit && (
        <div className="flex space-x-3 pt-4">
          <ButtonSkeleton size="md" className="w-24" />
          <ButtonSkeleton size="md" variant="outline" className="w-20" />
        </div>
      )}
    </div>
  );
};

// ============================================
// STEP FORM SKELETON
// ============================================

interface StepFormSkeletonProps {
  steps?: number;
  currentStep?: number;
  className?: string;
}

const StepFormSkeleton: React.FC<StepFormSkeletonProps> = ({
  steps = 4,
  currentStep = 1,
  className,
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Progress indicator */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {Array.from({ length: steps }).map((_, index) => (
            <React.Fragment key={index}>
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2",
                  index < currentStep ? "bg-blue-600 border-blue-600" : "border-neutral-300"
                )}
              >
                {index < currentStep ? (
                  <div className="w-2 h-2 bg-white rounded-full" />
                ) : (
                  <Skeleton variant="circle" className="w-2 h-2" />
                )}
              </div>
              {index < steps - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    index < currentStep - 1 ? "bg-blue-600" : "bg-neutral-300"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Form content */}
      <FormSkeleton fields={3} />
    </div>
  );
};

// ============================================
// NAVIGATION SKELETON
// ============================================

interface NavigationSkeletonProps {
  items?: number;
  showLogo?: boolean;
  showUser?: boolean;
  className?: string;
}

const NavigationSkeleton: React.FC<NavigationSkeletonProps> = ({
  items = 5,
  showLogo = true,
  showUser = true,
  className,
}) => {
  return (
    <nav
      className={cn(
        "flex items-center justify-between p-4 border-b border-neutral-200 bg-white",
        className
      )}
    >
      {/* Logo */}
      {showLogo && (
        <div className="flex items-center space-x-2">
          <Skeleton variant="circle" className="h-8 w-8" />
          <Skeleton className="h-5 w-24" />
        </div>
      )}

      {/* Navigation items */}
      <div className="flex items-center space-x-6">
        {Array.from({ length: items }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-16" />
        ))}
      </div>

      {/* User section */}
      {showUser && (
        <div className="flex items-center space-x-3">
          <Skeleton className="h-4 w-20" />
          <AvatarSkeleton size="sm" />
        </div>
      )}
    </nav>
  );
};

// ============================================
// EXPORTS
// ============================================

export {
  Skeleton,
  TextSkeleton,
  AvatarSkeleton,
  ButtonSkeleton,
  CardSkeleton,
  KPICardSkeleton,
  TableSkeleton,
  TableRowSkeleton,
  MobileCardSkeleton,
  FormSkeleton,
  FormFieldSkeleton,
  StepFormSkeleton,
  NavigationSkeleton,
};
