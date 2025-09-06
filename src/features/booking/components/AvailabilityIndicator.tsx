/**
 * AvailabilityIndicator Component
 *
 * Professional status indicator for displaying booking availability with:
 * - Status-based visual indicators (available, booked, maintenance, blocked)
 * - Configurable display options (room count, price, details)
 * - Interactive tooltips with detailed availability information
 * - Multiple size and variant options for different use cases
 * - Comprehensive accessibility support with ARIA labels
 * - Performance optimizations for large datasets
 * - Philippine peso currency formatting
 */

import React, { useMemo, useCallback, useState } from "react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Availability status types
export type AvailabilityStatus =
  | "available"
  | "partially-available"
  | "fully-booked"
  | "maintenance"
  | "blocked"
  | "checkout-only"
  | "checkin-only"
  | "loading"
  | "error";

// Availability data structure
export interface AvailabilityData {
  date: string;
  status: AvailabilityStatus;
  totalRooms: number;
  availableRooms: number;
  bookedRooms: number;
  maintenanceRooms: number;
  blockedRooms: number;
  basePrice?: number;
  discountedPrice?: number;
  currency: string;
  bookings: Array<{
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    roomType: string;
    status: string;
  }>;
  maintenanceBlocks?: Array<{
    id: string;
    reason: string;
    startDate: string;
    endDate: string;
    affectedRooms: number;
  }>;
  restrictions?: {
    minimumStay?: number;
    maximumStay?: number;
    checkInOnly?: boolean;
    checkOutOnly?: boolean;
  };
}

// Component prop types
export interface AvailabilityIndicatorProps {
  data: AvailabilityData;
  showTooltip?: boolean;
  showDetails?: boolean;
  showPrice?: boolean;
  showRoomCount?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "compact" | "detailed";
  onClick?: (data: AvailabilityData) => void;
  onHover?: (data: AvailabilityData | null) => void;
  className?: string;
  disabled?: boolean;
  locale?: string;
}

// Status color mappings for Professional Enterprise Design
const statusColors = {
  available: "bg-success/10 text-success-foreground border-success/20 hover:bg-success/20",
  "partially-available":
    "bg-warning/10 text-warning-foreground border-warning/20 hover:bg-warning/20",
  "fully-booked":
    "bg-destructive/10 text-destructive-foreground border-destructive/20 hover:bg-destructive/20",
  maintenance:
    "bg-purple-500/10 text-purple-700 border-purple-500/20 hover:bg-purple-500/20 dark:text-purple-300",
  blocked: "bg-muted text-muted-foreground border-muted hover:bg-muted/80",
  "checkout-only":
    "bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20 dark:text-blue-300",
  "checkin-only":
    "bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/20 dark:text-orange-300",
  loading: "bg-muted text-muted-foreground border-muted",
  error: "bg-destructive/10 text-destructive border-destructive/20",
};

// Size variants
const sizeVariants = {
  sm: "h-8 min-h-[32px] min-w-[32px] text-xs px-2",
  md: "h-10 min-h-[44px] min-w-[44px] text-sm px-3",
  lg: "h-12 min-h-[48px] min-w-[48px] text-base px-4",
};

export const AvailabilityIndicator: React.FC<AvailabilityIndicatorProps> = ({
  data,
  showTooltip = true,
  showDetails = false,
  showPrice = false,
  showRoomCount = true,
  size = "md",
  variant = "default",
  onClick,
  onHover,
  className,
  disabled = false,
  locale = "en-PH",
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Locale configuration
  const dateLocale = useMemo(() => {
    switch (locale) {
      case "fil-PH":
        return fil;
      default:
        return enUS;
    }
  }, [locale]);

  // Format currency
  const formatCurrency = useCallback((amount: number, currency: string) => {
    switch (currency) {
      case "PHP":
        return `₱${amount.toLocaleString()}`;
      case "USD":
        return `$${amount.toLocaleString()}`;
      default:
        return `${currency} ${amount.toLocaleString()}`;
    }
  }, []);

  // Generate ARIA label
  const ariaLabel = useMemo(() => {
    const dateFormatted = format(new Date(data.date), "MMMM d, yyyy", { locale: dateLocale });
    let label = `${dateFormatted}. `;

    switch (data.status) {
      case "available":
        label += `${data.availableRooms} rooms available out of ${data.totalRooms}.`;
        break;
      case "partially-available":
        label += `${data.availableRooms} rooms available out of ${data.totalRooms}. ${data.bookedRooms} already booked.`;
        break;
      case "fully-booked":
        label += "Fully booked. No rooms available.";
        break;
      case "maintenance":
        label += `${data.maintenanceRooms} rooms under maintenance.`;
        if (data.maintenanceBlocks?.length) {
          label += ` ${data.maintenanceBlocks[0].reason}.`;
        }
        break;
      case "blocked":
        label += "Blocked for booking.";
        break;
      case "checkout-only":
        label += "Check-out only allowed.";
        break;
      case "checkin-only":
        label += "Check-in only allowed.";
        break;
      case "loading":
        label += "Loading availability data.";
        break;
      case "error":
        label += "Error loading availability data.";
        break;
    }

    if (showPrice && data.basePrice) {
      const price = data.discountedPrice || data.basePrice;
      label += ` Starting from ${formatCurrency(price, data.currency)}.`;
    }

    label += " Click for details.";
    return label;
  }, [data, dateLocale, showPrice, formatCurrency]);

  // Handle click
  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick?.(data);
  }, [disabled, onClick, data]);

  // Handle hover
  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    setIsHovered(true);
    onHover?.(data);
  }, [disabled, onHover, data]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    onHover?.(null);
  }, [onHover]);

  // Generate room count display
  const roomCountDisplay = useMemo(() => {
    if (!showRoomCount) return null;

    if (variant === "compact") {
      return data.availableRooms.toString();
    }

    let display = `${data.availableRooms}/${data.totalRooms}`;

    if (data.maintenanceRooms > 0) {
      display += ` (${data.maintenanceRooms} maintenance)`;
    }

    return display;
  }, [showRoomCount, variant, data]);

  // Generate price display
  const priceDisplay = useMemo(() => {
    if (!showPrice || !data.basePrice) {
      if (data.status === "fully-booked" || data.status === "blocked") {
        return "Not available";
      }
      return null;
    }

    if (data.discountedPrice) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {formatCurrency(data.discountedPrice, data.currency)}
          </span>
          <span className="text-muted-foreground text-xs line-through">
            {formatCurrency(data.basePrice, data.currency)}
          </span>
        </div>
      );
    }

    return formatCurrency(data.basePrice, data.currency);
  }, [showPrice, data, formatCurrency]);

  // Status text display
  const statusText = useMemo(() => {
    switch (data.status) {
      case "available":
        return "Available";
      case "partially-available":
        return "Limited";
      case "fully-booked":
        return "Booked";
      case "maintenance":
        return "Maintenance";
      case "blocked":
        return "Blocked";
      case "checkout-only":
        return "Check-out Only";
      case "checkin-only":
        return "Check-in Only";
      case "loading":
        return "Loading...";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  }, [data.status]);

  // Loading state
  if (data.status === "loading") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-md border",
          sizeVariants[size],
          statusColors.loading,
          className
        )}
        role="status"
        aria-label="Loading availability data"
      >
        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
      </div>
    );
  }

  // Error state
  if (data.status === "error") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-md border",
          sizeVariants[size],
          statusColors.error,
          className
        )}
        role="alert"
      >
        <span className="text-xs font-medium">Error</span>
      </div>
    );
  }

  // Main indicator content
  const indicatorContent = (
    <button
      type="button"
      className={cn(
        "focus:ring-primary inline-flex items-center justify-center rounded-md border transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none",
        sizeVariants[size],
        statusColors[data.status] || statusColors.available,
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        variant === "detailed" && "flex-col gap-1 py-2",
        className
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      disabled={disabled || data.status === "blocked"}
      aria-label={ariaLabel}
    >
      {/* Main content based on variant */}
      {variant === "compact" ? (
        <span className="font-medium">{roomCountDisplay || statusText}</span>
      ) : variant === "detailed" ? (
        <>
          <span className="text-xs font-medium">{statusText}</span>
          {roomCountDisplay && <span className="text-xs opacity-80">{roomCountDisplay}</span>}
          {priceDisplay && <div className="text-xs">{priceDisplay}</div>}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-medium">{statusText}</span>
          {roomCountDisplay && size !== "sm" && (
            <Badge variant="secondary" className="text-xs">
              {roomCountDisplay}
            </Badge>
          )}
        </div>
      )}
    </button>
  );

  // Tooltip content
  const tooltipContent = showTooltip && (
    <div className="max-w-sm space-y-2">
      <div className="font-semibold">
        {format(new Date(data.date), "EEEE, MMMM d, yyyy", { locale: dateLocale })}
      </div>

      <div className="text-sm">
        <div>Status: {statusText}</div>
        <div>
          Available: {data.availableRooms} / {data.totalRooms} rooms
        </div>

        {data.bookedRooms > 0 && <div>Booked: {data.bookedRooms} rooms</div>}

        {data.maintenanceRooms > 0 && <div>Maintenance: {data.maintenanceRooms} rooms</div>}
      </div>

      {showDetails && data.bookings.length > 0 && (
        <div className="border-t pt-2">
          <div className="mb-1 text-sm font-medium">Current Bookings:</div>
          {data.bookings.slice(0, 3).map((booking) => (
            <div key={booking.id} className="text-muted-foreground text-xs">
              {booking.guestName} - {booking.roomType}
            </div>
          ))}
          {data.bookings.length > 3 && (
            <div className="text-muted-foreground text-xs">+{data.bookings.length - 3} more</div>
          )}
        </div>
      )}

      {data.maintenanceBlocks && data.maintenanceBlocks.length > 0 && (
        <div className="border-t pt-2">
          <div className="mb-1 text-sm font-medium">Maintenance:</div>
          {data.maintenanceBlocks.map((block) => (
            <div key={block.id} className="text-muted-foreground text-xs">
              {block.reason} ({block.affectedRooms} rooms)
            </div>
          ))}
        </div>
      )}

      {priceDisplay && (
        <div className="border-t pt-2">
          <div className="text-sm font-medium">Price: {priceDisplay}</div>
        </div>
      )}
    </div>
  );

  if (showTooltip && tooltipContent) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{indicatorContent}</TooltipTrigger>
          <TooltipContent side="top" className="z-50">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return indicatorContent;
};

AvailabilityIndicator.displayName = "AvailabilityIndicator";

export default AvailabilityIndicator;
