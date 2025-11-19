import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "border-input bg-background ring-offset-background file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-input focus-visible:ring-ring",
        // Resort-themed variants
        ocean: "border-ocean-300 focus-visible:ring-ocean-500 focus-visible:border-ocean-500",
        coral: "border-coral-300 focus-visible:ring-coral-500 focus-visible:border-coral-500",
        sand: "border-sand-300 focus-visible:ring-sand-500 focus-visible:border-sand-500",
        palm: "border-palm-300 focus-visible:ring-palm-500 focus-visible:border-palm-500",
        sunset: "border-sunset-300 focus-visible:ring-sunset-500 focus-visible:border-sunset-500",
        error: "border-destructive focus-visible:ring-destructive focus-visible:border-destructive",
        success: "border-palm-500 focus-visible:ring-palm-500 focus-visible:border-palm-500",
      },
      size: {
        default: "h-10 px-3 py-2",
        sm: "h-9 px-3 py-2 text-sm",
        lg: "h-11 px-4 py-3",
        xl: "h-12 px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  label?: string;
  error?: string;
  success?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size,
      type,
      startIcon,
      endIcon,
      label,
      error,
      success,
      helperText,
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);
    const hasSuccess = Boolean(success);
    const finalVariant = hasError ? "error" : hasSuccess ? "success" : variant;

    const inputElement = (
      <div className="relative">
        {startIcon && (
          <div className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
            {startIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            inputVariants({ variant: finalVariant, size, className }),
            startIcon && "pl-10",
            endIcon && "pr-10"
          )}
          ref={ref}
          {...props}
        />
        {endIcon && (
          <div className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2">
            {endIcon}
          </div>
        )}
      </div>
    );

    if (!label && !error && !success && !helperText) {
      return inputElement;
    }

    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}
        {inputElement}
        {(error || success || helperText) && (
          <p
            className={cn(
              "text-sm",
              error ? "text-destructive" : success ? "text-palm-600" : "text-muted-foreground"
            )}
          >
            {error || success || helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// Currency Input Component for Philippine Peso
const CurrencyInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      let value = e.currentTarget.value.replace(/[^\d.]/g, "");

      // Ensure only one decimal point
      const parts = value.split(".");
      if (parts.length > 2) {
        value = `${parts[0]}.${parts.slice(1).join("")}`;
      }

      // Limit decimal places to 2
      if (parts[1] && parts[1].length > 2) {
        value = `${parts[0]}.${parts[1].slice(0, 2)}`;
      }

      e.currentTarget.value = value;
    };

    return (
      <Input
        ref={ref}
        startIcon={<span className="text-sm font-medium">₱</span>}
        onInput={handleInput}
        className={className}
        placeholder="0.00"
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

// Search Input Component
const SearchInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        startIcon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="21 21l-4.35-4.35" />
          </svg>
        }
        className={className}
        placeholder="Search..."
        {...props}
      />
    );
  }
);
SearchInput.displayName = "SearchInput";

// Phone Input Component for Philippine format
const PhoneInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      let value = e.currentTarget.value.replace(/\D/g, "");

      // Format for Philippine mobile numbers
      if (value.startsWith("63")) {
        // International format: +63
        value = value.slice(2);
      }

      // Add +63 prefix if not starting with 9
      if (value.startsWith("9") && value.length === 10) {
        // Format: +63 9XX XXX XXXX
        value = value.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
      } else if (value.startsWith("0") && value.length === 11) {
        // Convert 0 prefix to +63
        value = `9${value.slice(1)}`;
        value = value.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
      }

      e.currentTarget.value = value ? `+63 ${value}` : "";
    };

    return (
      <Input
        ref={ref}
        type="tel"
        onInput={handleInput}
        className={className}
        placeholder="+63 9XX XXX XXXX"
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

// Number Input Component with validation on blur
export interface NumberInputProps
  extends Omit<InputProps, "type" | "onChange" | "onBlur" | "value" | "defaultValue"> {
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  enforceMinMax?: boolean;
  onChange?: (value: number | null) => void;
  onBlur?: (value: number | null) => void;
  value?: number | null;
  defaultValue?: number | null;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      min,
      max,
      step: _step = 1,
      allowDecimals = false,
      enforceMinMax = true,
      onChange,
      onBlur,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState<string>("");
    const [isValid, setIsValid] = React.useState(true);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Sync external value with internal state
    // Only run when external value/defaultValue changes, not when internalValue changes
    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value === null ? "" : value.toString());
      }
    }, [value]);

    // Initialize with defaultValue only once
    React.useEffect(() => {
      if (defaultValue !== undefined && internalValue === "") {
        setInternalValue(defaultValue === null ? "" : defaultValue.toString());
      }
    }, []);

    const parseValue = (val: string): number | null => {
      if (val === "" || val === "-" || val === ".") return null;
      const parsed = allowDecimals ? parseFloat(val) : parseInt(val, 10);
      return isNaN(parsed) ? null : parsed;
    };

    const isValueValid = (val: number | null): boolean => {
      if (val === null) return true; // Allow empty during typing
      if (min !== undefined && val < min) return false;
      if (max !== undefined && val > max) return false;
      return true;
    };

    const clampValue = (val: number | null): number | null => {
      if (val === null) return null;
      if (min !== undefined && val < min) return min;
      if (max !== undefined && val > max) return max;
      return val;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      // Allow empty string and negative sign for negative numbers
      if (newValue === "" || newValue === "-") {
        setInternalValue(newValue);
        setIsValid(true);
        onChange?.(null);
        return;
      }

      // Validate decimal places if decimals are not allowed
      if (!allowDecimals && newValue.includes(".")) {
        return; // Prevent decimal input
      }

      // Basic number validation
      const numberRegex = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;

      if (!numberRegex.test(newValue)) {
        return; // Invalid character input
      }

      setInternalValue(newValue);
      const parsed = parseValue(newValue);
      const valid = isValueValid(parsed);
      setIsValid(valid);
      onChange?.(parsed);
    };

    const handleInputBlur = () => {
      const parsed = parseValue(internalValue);
      let finalValue = parsed;

      if (enforceMinMax && parsed !== null) {
        finalValue = clampValue(parsed);
        if (finalValue !== parsed) {
          setInternalValue(finalValue?.toString() || "");
        }
      }

      setIsValid(true);
      onBlur?.(finalValue);
    };

    // Merge refs properly
    React.useImperativeHandle(ref, () => inputRef.current!);

    return (
      <Input
        {...props}
        ref={inputRef}
        type="text" // Use text to avoid browser validation
        inputMode="numeric" // Mobile numeric keyboard
        value={internalValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        variant={!isValid ? "error" : props.variant}
        className={className}
        min={undefined} // Remove HTML validation
        max={undefined} // Remove HTML validation
        step={undefined} // Remove HTML validation
      />
    );
  }
);
NumberInput.displayName = "NumberInput";

export { Input, CurrencyInput, SearchInput, PhoneInput, NumberInput, inputVariants };
