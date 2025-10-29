// src/types/entity-navigation.types.ts

import type { EntityType } from "./entity-detail.types";

// ============================================
// NAVIGATION TARGET TYPES
// ============================================

/**
 * Type-safe navigation targets for each entity
 * Maps entity types to their route patterns and required parameters
 */
export type NavigationTarget = {
  booking: {
    to: "/bookings/$bookingId";
    params: { bookingId: string };
  };
  unit: {
    to: "/units/$unitId";
    params: { unitId: string };
  };
  guest: {
    to: "/guests/$guestId";
    params: { guestId: string };
  };
  payment: {
    to: "/payments/$paymentId";
    params: { paymentId: string };
  };
  expense: {
    to: "/expenses/$expenseId";
    params: { expenseId: string };
  };
};

/**
 * Props for type-safe entity navigation
 */
export type EntityNavigationProps<T extends EntityType> = {
  type: T;
  id: string;
  search?: Record<string, unknown>;
};

// ============================================
// ENTITY RELATIONSHIPS
// ============================================

/**
 * Defines which entities can link to other entities
 * Used for validation and autocomplete in cross-entity navigation
 */
export type EntityRelations = {
  booking: ["guest", "unit", "payment"];
  unit: ["booking"];
  guest: ["booking"];
  payment: ["booking"];
  expense: ["unit"];
};
