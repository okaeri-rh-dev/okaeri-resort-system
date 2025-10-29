// src/components/entity-detail/RelatedEntityLink.tsx

import { Link } from "@tanstack/react-router";
import { CreditCard, FileText, Home, Receipt, User } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EntityType } from "@/types/entity-detail.types";

/**
 * Props for RelatedEntityLink component
 */
export interface RelatedEntityLinkProps {
  type: EntityType;
  id: string;
  label: string;
  badge?: string; // Optional secondary info (e.g., unit code)
  className?: string;
}

/**
 * Entity type to icon mapping
 */
const entityIcons = {
  booking: FileText,
  unit: Home,
  guest: User,
  payment: CreditCard,
  expense: Receipt,
};

/**
 * Entity type to route mapping
 */
const entityRoutes = {
  booking: "/bookings/$bookingId",
  unit: "/units/$unitId",
  guest: "/guests/$guestId",
  payment: "/payments/$paymentId",
  expense: "/expenses/$expenseId",
} as const;

/**
 * Type-safe clickable links to related entities with consistent styling
 *
 * Automatically maps entity types to:
 * - Correct route pattern
 * - Appropriate icon
 * - Consistent hover states
 *
 * @example
 * ```typescript
 * // Link to guest
 * <RelatedEntityLink
 *   type="guest"
 *   id={booking.guest_id}
 *   label={booking.guest_name}
 * />
 *
 * // Link to unit with code badge
 * <RelatedEntityLink
 *   type="unit"
 *   id={booking.unit_id}
 *   label={unit.unit_name}
 *   badge={unit.unit_code}
 * />
 *
 * // Link to booking reference
 * <RelatedEntityLink
 *   type="booking"
 *   id={payment.booking_id}
 *   label={payment.booking_reference}
 * />
 * ```
 */
export function RelatedEntityLink({ type, id, label, badge, className }: RelatedEntityLinkProps) {
  const Icon = entityIcons[type];
  const routeTo = entityRoutes[type];

  // Map entity type to param name
  const paramKey = `${type}Id` as const;

  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={routeTo as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params={{ [paramKey]: id } as any}
      className={cn(
        "inline-flex items-center gap-2 font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline",
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {badge && <span className="font-mono text-xs text-neutral-500">({badge})</span>}
    </Link>
  );
}
