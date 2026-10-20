import { useMemo } from "react";

import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface StrengthResult {
  score: number;
  level: "weak" | "fair" | "good" | "strong";
  label: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

/**
 * Calculate password strength based on multiple criteria
 */
function calculateStrength(password: string): StrengthResult {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const metCount = Object.values(requirements).filter(Boolean).length;
  const score = (metCount / 5) * 100;

  let level: StrengthResult["level"];
  let label: string;

  if (score <= 20) {
    level = "weak";
    label = "Weak";
  } else if (score <= 40) {
    level = "weak";
    label = "Weak";
  } else if (score <= 60) {
    level = "fair";
    label = "Fair";
  } else if (score <= 80) {
    level = "good";
    label = "Good";
  } else {
    level = "strong";
    label = "Strong";
  }

  return { score, level, label, requirements };
}

/**
 * Password strength indicator with color-coded progress bar
 *
 * Shows real-time feedback as users type their password.
 * Colors indicate strength level:
 * - Weak: Red
 * - Fair: Orange
 * - Good: Yellow
 * - Strong: Green
 */
export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculateStrength(password), [password]);

  // Don't show anything if password is empty
  if (!password) {
    return null;
  }

  const colorClasses = {
    weak: "bg-danger-foreground",
    fair: "bg-warning-foreground",
    good: "bg-warning-foreground",
    strong: "bg-success-foreground",
  };

  const textColorClasses = {
    weak: "text-danger-foreground",
    fair: "text-warning-foreground",
    good: "text-warning-foreground",
    strong: "text-success-foreground",
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress bar */}
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out",
            colorClasses[strength.level]
          )}
          style={{ width: `${strength.score}%` }}
        />
      </div>

      {/* Strength label */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Password strength:</span>
        <span className={cn("font-medium", textColorClasses[strength.level])}>
          {strength.label}
        </span>
      </div>
    </div>
  );
}
