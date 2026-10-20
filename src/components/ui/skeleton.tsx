import React from "react";

import { cn } from "src/lib/utils";

// ============================================
// BASE SKELETON COMPONENT
// ============================================

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "text" | "circle" | "rounded" | "sharp";
  animation?: "pulse" | "none";
}

function Skeleton({
  className,
  variant = "default",
  animation = "pulse",
  ...props
}: SkeletonProps) {
  const animationClass = {
    pulse: "animate-pulse",
    none: "",
  }[animation];

  const variantClass = {
    default: "rounded-md",
    text: "rounded-sm",
    circle: "rounded-full",
    rounded: "rounded-lg",
    sharp: "rounded-none",
  }[variant];

  return <div className={cn("bg-accent", variantClass, animationClass, className)} {...props} />;
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
    default: "bg-accent",
    outline: "bg-transparent border border-border",
    ghost: "bg-muted",
  }[variant];

  return <Skeleton className={cn("w-20 rounded-md", sizeClass, variantClass, className)} />;
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
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading content"
      className={cn("border-border bg-card space-y-4 rounded-lg border p-4", className)}
    >
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
    <div className={cn("border-border bg-card rounded-lg border p-4", className)}>
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
    <div className={cn("border-border bg-card space-y-3 rounded-lg border p-4", className)}>
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
        <div className="border-border flex space-x-2 border-t pt-3">
          <ButtonSkeleton size="sm" className="flex-1" />
          <ButtonSkeleton size="sm" variant="outline" className="flex-1" />
        </div>
      )}
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
        "border-border bg-card flex items-center justify-between border-b p-4",
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
  MobileCardSkeleton,
  NavigationSkeleton,
};
