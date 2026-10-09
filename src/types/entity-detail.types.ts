// src/types/entity-detail.types.ts

import type { Database } from "@/types/database.types";

// ============================================
// CORE ENTITY TYPES
// ============================================

/**
 * Union type for all entity types in the system
 * Used for type-safe generic functions and components
 */
export type EntityType = "booking" | "unit" | "guest" | "payment" | "expense";

// ============================================
// DATABASE ROW TYPES
// ============================================

/**
 * Extract row types from Supabase schema for type safety
 */
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Unit = Database["public"]["Tables"]["units"]["Row"];
export type Guest = Database["public"]["Tables"]["guests"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

// ============================================
// AUDIT TRAIL TYPES
// ============================================

/**
 * Filters for audit log queries
 */
export type AuditFilters = {
  entity_type: EntityType;
  entity_id: string;
  action?: string;
  user_id?: string;
  date_from?: Date;
  date_to?: Date;
};
