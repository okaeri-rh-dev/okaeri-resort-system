/**
 * Professional Enterprise Design System
 *
 * Design principles:
 * - Information density over decoration
 * - Operational efficiency over visual appeal
 * - Professional reliability over trendy aesthetics
 * - Accessibility without compromising density
 */

/**
 * DESIGN SYSTEM USAGE POLICY:
 *
 * 🚫 PROHIBITED:
 * - Using raw Tailwind utilities for design system properties (colors, spacing, etc.)
 * - Accessing designSystem.colors/spacing/etc. directly in components
 * - Adding inline styles for design system concerns
 * - Creating component-specific styling outside of this system
 *
 * ✅ REQUIRED:
 * - All component styling MUST use helper functions (getInputClasses, getButtonClasses, etc.)
 * - All colors MUST come from design system tokens
 * - All repeated patterns MUST be abstracted into helper functions
 * - Changes to visual properties MUST be made in this file only
 *
 * Benefits: Single source of truth, consistent theming, maintainable codebase
 */

export const designSystem = {
  colors: {
    // Corporate Blue Primary Palette (oklch color space for consistency)
    primary: {
      50: "oklch(97% 0.02 240)", // Lightest blue tint
      100: "oklch(94% 0.04 240)", // Very light blue
      200: "oklch(88% 0.08 240)", // Light blue
      300: "oklch(78% 0.10 240)", // Medium-light blue
      400: "oklch(65% 0.11 240)", // Medium blue
      500: "oklch(52% 0.12 240)", // Primary corporate blue
      600: "oklch(45% 0.12 240)", // Dark blue
      700: "oklch(38% 0.11 240)", // Darker blue
      800: "oklch(30% 0.10 240)", // Very dark blue
      900: "oklch(22% 0.08 240)", // Darkest blue
    },

    // Professional Neutral Gray Scale
    gray: {
      50: "oklch(98% 0 0)", // Very light gray
      100: "oklch(96% 0 0)", // Light gray
      200: "oklch(91% 0 0)", // Light border gray
      300: "oklch(83% 0 0)", // Medium border gray
      400: "oklch(65% 0 0)", // Input border gray
      500: "oklch(55% 0 0)", // Text gray
      600: "oklch(45% 0 0)", // Dark text gray
      700: "oklch(35% 0 0)", // Very dark text
      800: "oklch(25% 0 0)", // Near black
      900: "oklch(15% 0 0)", // Almost black
    },

    // Functional Status Colors (minimal use)
    success: {
      50: "oklch(97% 0.02 142)",
      500: "oklch(60% 0.15 142)", // Green for success
      600: "oklch(50% 0.15 142)",
      700: "oklch(40% 0.14 142)",
    },

    error: {
      50: "oklch(97% 0.02 29)",
      500: "oklch(60% 0.18 29)", // Red for errors
      600: "oklch(50% 0.18 29)",
      700: "oklch(40% 0.16 29)",
    },

    warning: {
      50: "oklch(97% 0.02 90)",
      500: "oklch(49% 0.15 90)", // Amber for warnings - WCAG AA 4.5:1 contrast
      600: "oklch(44% 0.15 90)", // Darker amber - WCAG AAA 6.5:1 contrast
      700: "oklch(39% 0.14 90)", // Darkest amber - WCAG AAA 8.1:1 contrast
    },

    // Background colors
    background: {
      primary: "oklch(100% 0 0)", // Pure white
      secondary: "oklch(98% 0 0)", // Off-white
      tertiary: "oklch(96% 0 0)", // Light gray background
      input: "oklch(100% 0 0)", // White input background
      hover: "oklch(97% 0.01 240)", // Subtle blue tint on hover
    },
  },

  typography: {
    fontFamily: {
      sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      mono: ["Fira Mono", "SF Mono", "Consolas", "monospace"], // For IDs, codes, numbers
    },

    fontSize: {
      xs: "0.75rem", // 12px - Dense captions
      sm: "0.875rem", // 14px - Base UI text
      base: "0.875rem", // 14px - Default size (dense)
      md: "1rem", // 16px - Headings
      lg: "1.125rem", // 18px - Large headings
      xl: "1.25rem", // 20px - Page titles
    },

    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },

    lineHeight: {
      tight: "1.2", // Dense text
      normal: "1.4", // Standard density
      relaxed: "1.6", // Readable body text
    },
  },

  spacing: {
    // Compact spacing for information density
    px: "1px",
    0.5: "0.125rem", // 2px
    1: "0.25rem", // 4px
    1.5: "0.375rem", // 6px
    2: "0.5rem", // 8px
    2.5: "0.625rem", // 10px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    8: "2rem", // 32px
    10: "2.5rem", // 40px
  },

  sizing: {
    // Compact component sizes
    input: {
      height: "36px", // Compact input height
      heightSm: "32px", // Small variant
      heightLg: "40px", // Large variant (rarely used)
      minWidth: "200px", // Minimum input width
    },

    button: {
      height: "36px", // Standard button
      heightSm: "28px", // Small button
      heightLg: "40px", // Large button
      minWidth: "80px", // Minimum button width
      paddingX: "16px", // Horizontal padding
    },

    label: {
      width: "120px", // Fixed label width for alignment
      minWidth: "100px", // Minimum label width
    },
  },

  borders: {
    radius: {
      none: "0",
      sm: "2px", // Subtle rounding
      md: "4px", // Maximum border radius
      input: "4px", // Input fields
      button: "4px", // Buttons
      card: "4px", // Card containers
    },

    width: {
      thin: "1px", // Standard borders
      medium: "2px", // Focus borders
      thick: "3px", // Emphasis borders
    },

    // Professional border colors
    color: {
      default: "oklch(88% 0 0)", // Light gray
      hover: "oklch(70% 0 0)", // Medium gray on hover
      focus: "oklch(52% 0.12 240)", // Corporate blue on focus
      error: "oklch(60% 0.18 29)", // Error red
      success: "oklch(60% 0.15 142)", // Success green
    },

    // Complete border token classes for enterprise components
    card: "border border-gray-200", // Page card borders
    input: "border border-gray-300", // Input borders (already in helpers)
    focus: "border border-primary-500", // Focus borders (already in helpers)
  },

  shadows: {
    // Minimal, professional shadows
    none: "none",
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 2px 4px 0 rgb(0 0 0 / 0.06)",
    lg: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
    focus: "0 0 0 2px oklch(52% 0.12 240 / 0.2)", // Focus ring

    // Complete shadow token classes for enterprise components
    card: "shadow-sm", // Page card shadows
    focusRing: "shadow-lg shadow-primary-500/10", // Focus shadows if needed
  },

  animation: {
    // Minimal animations for professional feel
    duration: {
      instant: "0ms", // No animation
      fast: "100ms", // Very quick transitions
      normal: "150ms", // Standard transitions (optimized for responsiveness)
      slow: "200ms", // Slower transitions (reduced for enterprise feel)
    },

    easing: {
      linear: "linear",
      out: "cubic-bezier(0, 0, 0.2, 1)", // Ease-out for natural feel
      in: "cubic-bezier(0.4, 0, 1, 1)", // Ease-in for interactions
      inOut: "cubic-bezier(0.4, 0, 0.2, 1)", // Smooth both ways
    },

    // Professional micro-interaction patterns
    transitions: {
      colors: "transition-colors duration-150 ease-out",
      transform: "transition-transform duration-100 ease-out",
      opacity: "transition-opacity duration-150 ease-out",
      all: "transition-all duration-150 ease-out",
      focus: "transition-colors duration-100 ease-out", // Faster for focus states
    },
  },

  layout: {
    // Grid layouts for forms
    formGrid: {
      columns: "grid-template-columns: 120px 1fr", // Label | Input
      gap: "16px", // Horizontal gap
      rowGap: "12px", // Vertical gap (compact)
    },

    // Container widths
    container: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      form: "480px", // Standard form width
    },

    // Z-index layers
    zIndex: {
      base: 0,
      dropdown: 10,
      modal: 100,
      popover: 200,
      tooltip: 300,
      notification: 400,
    },
  },

  // Business-specific formatting
  formatting: {
    // Philippine peso formatting
    currency: {
      symbol: "₱",
      position: "prefix",
      decimals: 2,
      thousandsSeparator: ",",
      decimalSeparator: ".",
    },

    // Phone number format
    phone: {
      pattern: "+63 XXX XXX XXXX",
      countryCode: "+63",
    },

    // Date/time formatting
    dateTime: {
      date: "MM/DD/YYYY", // US-style for business
      time: "HH:mm", // 24-hour format
      dateTime: "MM/DD/YYYY HH:mm",
    },
  },
} as const;

// Type export for TypeScript support
export type DesignSystem = typeof designSystem;

// CSS custom properties generator for runtime theming
export const generateCSSVariables = () => {
  const variables: Record<string, string> = {};

  // Generate color variables
  Object.entries(designSystem.colors).forEach(([colorGroup, colors]) => {
    Object.entries(colors).forEach(([shade, value]) => {
      variables[`--color-${colorGroup}-${shade}`] = value;
    });
  });

  // Generate spacing variables
  Object.entries(designSystem.spacing).forEach(([key, value]) => {
    variables[`--spacing-${key}`] = value;
  });

  return variables;
};

/**
 * FOCUS MANAGEMENT STRATEGY:
 *
 * All focus styles are centralized in helper functions to prevent:
 * - Double focus rings from global Tailwind + component styles
 * - Inconsistent focus behavior across components
 * - Focus style conflicts and accessibility issues
 *
 * Implementation:
 * - focus:outline-none removes default browser focus
 * - focus:ring-2 adds consistent design system focus ring
 * - All focus colors match the component's semantic meaning
 * - Focus styles include proper contrast for accessibility
 */

// =============================================================================
// INPUT & FORM HELPERS
// =============================================================================

// Utility function to apply design system classes
export const getInputClasses = (variant: "default" | "error" | "success" = "default") => {
  const base =
    "h-9 px-3 py-2 text-sm border rounded transition-colors duration-150 ease-out hover:border-gray-400 motion-reduce:transition-none";

  const variants = {
    default:
      "border-gray-300 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-primary-50/30",
    error:
      "border-error-500 bg-error-50 focus:border-error-600 focus:outline-none focus:ring-2 focus:ring-error-500/20 hover:border-error-600",
    success:
      "border-success-500 bg-success-50 focus:border-success-600 focus:outline-none focus:ring-2 focus:ring-success-500/20 hover:border-success-600",
  };

  return `${base} ${variants[variant]}`;
};

export const getButtonClasses = (variant: "primary" | "secondary" | "ghost" = "primary") => {
  const base =
    "h-9 px-4 text-sm font-medium rounded transition-all duration-150 ease-out min-w-[80px] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100";

  const variants = {
    primary:
      "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 hover:shadow-sm",
    secondary:
      "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500/20 hover:shadow-sm",
    ghost:
      "text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500/20",
  };

  return `${base} ${variants[variant]}`;
};

export const getLabelClasses = () => {
  return "text-sm font-medium text-gray-700 min-w-[100px]";
};

// =============================================================================
// LAYOUT & TYPOGRAPHY HELPERS
// =============================================================================

// Typography helper functions for consistent text styling
export const getTypographyClasses = (
  variant: "heading" | "subheading" | "body" | "caption" | "helper" = "body"
) => {
  const variants = {
    heading: "text-xl font-semibold text-gray-900", // Page headings
    subheading: "text-sm font-medium text-gray-700", // Section headings
    body: "text-sm text-gray-700", // Regular body text
    caption: "text-sm text-gray-600", // Descriptions, captions
    helper: "text-xs text-gray-600", // Helper text, labels
  };

  return variants[variant];
};

// Standardized checkbox styling matching input focus patterns
export const getCheckboxClasses = (hasError: boolean = false) => {
  const base = "rounded border shadow-sm transition-colors duration-200";
  const normal =
    "border-gray-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";
  const error =
    "border-error-500 focus:border-error-600 focus:outline-none focus:ring-2 focus:ring-error-500/20";

  return `${base} ${hasError ? error : normal}`;
};

// Error message styling helper
export const getErrorMessageClasses = () => {
  return "mt-1 text-xs text-error-600";
};

// Standardized link styling with interaction states for Professional Enterprise Design
export const getLinkClasses = (variant: "primary" | "secondary" = "primary") => {
  const base =
    "font-medium transition-colors duration-150 ease-out hover:underline underline-offset-2 motion-reduce:transition-none";

  const variants = {
    primary:
      "text-primary-600 hover:text-primary-700 active:text-primary-800 focus:outline-none focus:ring-1 focus:ring-primary-500/40 rounded-sm px-1 -mx-1",
    secondary:
      "text-gray-600 hover:text-gray-700 active:text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-500/40 rounded-sm px-1 -mx-1",
  };

  return `${base} ${variants[variant]}`;
};

// =============================================================================
// ALERT & NOTIFICATION HELPERS
// =============================================================================

// Alert box styling helper for consistent alert design
export const getAlertClasses = (variant: "error" | "success" | "info" = "info") => {
  const base = "rounded border p-3 text-sm";

  const variants = {
    error: "bg-error-50 border-error-500 text-error-700",
    success: "bg-success-50 border-success-500 text-gray-700",
    info: "bg-gray-50 border-gray-300 text-gray-700",
  };

  return `${base} ${variants[variant]}`;
};

// Alert styles helper for CSS-in-JS when class-based approach isn't sufficient
export const getAlertStyles = (variant: "error" | "success" | "info" = "info") => {
  const variants = {
    error: {
      backgroundColor: designSystem.colors.error[50],
      borderColor: designSystem.colors.error[500],
      color: designSystem.colors.error[700],
    },
    success: {
      backgroundColor: designSystem.colors.success[50],
      borderColor: designSystem.colors.success[500],
      color: designSystem.colors.gray[700],
    },
    info: {
      backgroundColor: designSystem.colors.gray[50],
      borderColor: designSystem.colors.gray[300],
      color: designSystem.colors.gray[700],
    },
  };

  return variants[variant];
};

// Checkbox styles helper for consistent checkbox accent colors
export const getCheckboxStyles = () => ({
  accentColor: designSystem.colors.primary[500],
});

// Password strength color helper for consistent strength indicators
export const getPasswordStrengthColor = (strength: "weak" | "good" | "strong") => {
  const colors = {
    weak: designSystem.colors.error[600],
    good: designSystem.colors.warning[600],
    strong: designSystem.colors.success[600],
  };

  return colors[strength];
};

// Password visibility toggle button helper for consistent styling
export const getPasswordToggleClasses = () => {
  return "absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-gray-600 transition-all duration-150 ease-out hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 active:scale-95 min-w-[44px] min-h-[44px] sm:min-w-auto sm:min-h-auto flex items-center justify-center rounded focus:outline-none focus:ring-1 focus:ring-primary-500/40 motion-reduce:transition-none motion-reduce:active:scale-100";
};

// Enhanced error message classes with animation for form validation feedback
export const getErrorMessageClassesAnimated = () => {
  return "mt-1 text-xs text-error-600 animate-in slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none motion-reduce:duration-0";
};
