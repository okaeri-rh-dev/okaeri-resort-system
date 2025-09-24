import React from "react";
import { cn } from "@/lib/utils";

/**
 * CSS-Only Responsive Table Wrapper
 *
 * This component demonstrates the MOST performant approach:
 * rendering both views and using pure CSS to control visibility.
 *
 * Zero JavaScript for responsive behavior = Maximum performance
 *
 * Usage:
 * ```tsx
 * <ResponsiveTableWrapper
 *   mobileView={<BookingCards />}
 *   desktopView={<BookingTable />}
 * />
 * ```
 */
interface ResponsiveTableWrapperProps {
  mobileView: React.ReactNode;
  desktopView: React.ReactNode;
  className?: string;
  breakpoint?: "sm" | "md" | "lg" | "xl";
}

export const ResponsiveTableWrapper: React.FC<ResponsiveTableWrapperProps> = ({
  mobileView,
  desktopView,
  className,
  breakpoint = "md",
}) => {
  // Tailwind breakpoint classes
  const breakpointClasses = {
    sm: {
      mobile: "block sm:hidden",
      desktop: "hidden sm:block",
    },
    md: {
      mobile: "block md:hidden",
      desktop: "hidden md:block",
    },
    lg: {
      mobile: "block lg:hidden",
      desktop: "hidden lg:block",
    },
    xl: {
      mobile: "block xl:hidden",
      desktop: "hidden xl:block",
    },
  };

  const classes = breakpointClasses[breakpoint];

  return (
    <div className={cn("responsive-table-container", className)}>
      {/* Mobile View - Visible on small screens */}
      <div className={classes.mobile} aria-label="Mobile view">
        {mobileView}
      </div>

      {/* Desktop View - Visible on larger screens */}
      <div className={classes.desktop} aria-label="Desktop view">
        {desktopView}
      </div>
    </div>
  );
};

/**
 * Alternative: Single-structure responsive table
 *
 * This uses CSS Grid to transform from cards to table layout
 * One DOM structure = Even better performance
 */
export const ResponsiveDataGrid: React.FC<{
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  className?: string;
}> = ({ items, renderItem, className }) => {
  return (
    <div
      className={cn(
        // Mobile: Stack as cards
        "grid grid-cols-1 gap-4",
        // Desktop: Table-like grid
        "md:grid-cols-none md:gap-0",
        "md:[display:table] md:w-full",
        className
      )}
    >
      {/* Header - Hidden on mobile, shown on desktop */}
      <div className="hidden md:[display:table-header-group]">
        {/* Add your header cells here */}
      </div>

      {/* Body */}
      <div className="md:[display:table-row-group]">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              // Mobile: Card styling
              "bg-white rounded-lg border p-4",
              // Desktop: Table row styling
              "md:bg-transparent md:rounded-none md:border-0 md:border-b",
              "md:[display:table-row] md:p-0",
              "md:hover:bg-gray-50"
            )}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Performance comparison utilities
 */
export const ResponsivePerformanceComparison = () => {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-xs">
      <h3 className="font-bold mb-2">Responsive Performance Mode</h3>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Method:</span>
          <span className="font-mono">CSS-Only</span>
        </div>
        <div className="flex justify-between">
          <span>JS Listeners:</span>
          <span className="font-mono text-green-400">0</span>
        </div>
        <div className="flex justify-between">
          <span>Re-renders on resize:</span>
          <span className="font-mono text-green-400">0</span>
        </div>
        <div className="flex justify-between">
          <span>Performance:</span>
          <span className="font-mono text-green-400">Optimal</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/20 text-[10px] opacity-75">
        Pure CSS = Zero JavaScript overhead
      </div>
    </div>
  );
};
