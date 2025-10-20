/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
/**
 * Advanced Filter Builder System - PHASE 3-4
 *
 * Provides composable filter builders for complex queries:
 * - Date range filters with business logic
 * Note: Advanced features deferred to Phase 3-4
 * - Workflow state filters
 * - Financial and payment filters
 * - Guest segmentation filters
 * - Unit availability filters
 */

import { addDays, endOfDay, isAfter, isBefore, isWithinInterval, startOfDay } from "date-fns";

import type { AdvancedFilter, WorkflowFilter } from "@/stores/useSearchStore";
import type { Booking, BookingStatus, Guest, PaymentStatus, Unit } from "@/types";

// ============================================
// FILTER BUILDER TYPES
// ============================================

export interface FilterBuilder<T = any> {
  build(): AdvancedFilter;
  and(other: FilterBuilder): CompositeFilterBuilder;
  or(other: FilterBuilder): CompositeFilterBuilder;
  not(): FilterBuilder;
  test(item: T): boolean;
}

export class BaseFilterBuilder<T = any> implements FilterBuilder<T> {
  protected filter: AdvancedFilter;

  constructor(filter: Partial<AdvancedFilter>) {
    this.filter = {
      id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: filter.name || "custom",
      type: filter.type || "custom",
      operator: filter.operator || "equals",
      value: filter.value,
      isActive: filter.isActive ?? true,
      ...filter,
    };
  }

  build(): AdvancedFilter {
    return { ...this.filter };
  }

  and(other: FilterBuilder): CompositeFilterBuilder {
    return new CompositeFilterBuilder("AND", [this, other]);
  }

  or(other: FilterBuilder): CompositeFilterBuilder {
    return new CompositeFilterBuilder("OR", [this, other]);
  }

  not(): FilterBuilder {
    return new NotFilterBuilder(this);
  }

  test(item: T): boolean {
    // Override in subclasses
    return true;
  }
}

export class CompositeFilterBuilder implements FilterBuilder {
  constructor(
    private operator: "AND" | "OR",
    private filters: FilterBuilder[]
  ) {}

  build(): AdvancedFilter {
    return {
      id: `composite-${Date.now()}`,
      name: "composite",
      type: "custom",
      operator: "custom" as any,
      value: {
        operator: this.operator,
        filters: this.filters.map((f) => f.build()),
      },
      isActive: true,
    };
  }

  and(other: FilterBuilder): CompositeFilterBuilder {
    if (this.operator === "AND") {
      this.filters.push(other);
      return this;
    }
    return new CompositeFilterBuilder("AND", [this, other]);
  }

  or(other: FilterBuilder): CompositeFilterBuilder {
    if (this.operator === "OR") {
      this.filters.push(other);
      return this;
    }
    return new CompositeFilterBuilder("OR", [this, other]);
  }

  not(): FilterBuilder {
    return new NotFilterBuilder(this);
  }

  test(item: any): boolean {
    if (this.operator === "AND") {
      return this.filters.every((f) => f.test(item));
    } else {
      return this.filters.some((f) => f.test(item));
    }
  }
}

export class NotFilterBuilder implements FilterBuilder {
  constructor(private filter: FilterBuilder) {}

  build(): AdvancedFilter {
    const original = this.filter.build();
    return {
      ...original,
      id: `not-${original.id}`,
      name: `not-${original.name}`,
      operator: "not_in" as any,
    };
  }

  and(other: FilterBuilder): CompositeFilterBuilder {
    return new CompositeFilterBuilder("AND", [this, other]);
  }

  or(other: FilterBuilder): CompositeFilterBuilder {
    return new CompositeFilterBuilder("OR", [this, other]);
  }

  not(): FilterBuilder {
    return this.filter; // Double negation
  }

  test(item: any): boolean {
    return !this.filter.test(item);
  }
}

// ============================================
// DATE RANGE FILTERS
// ============================================

export class DateRangeFilterBuilder extends BaseFilterBuilder<Booking> {
  constructor(
    field: "check_in" | "check_out" | "created_at" | "updated_at",
    from?: Date | null,
    to?: Date | null,
    options: {
      includeTime?: boolean;
      timezone?: string;
    } = {}
  ) {
    const fromDate = from ? (options.includeTime ? from : startOfDay(from)) : null;
    const toDate = to ? (options.includeTime ? to : endOfDay(to)) : null;

    super({
      name: field,
      type: "date_range",
      operator: "between",
      value: { from: fromDate, to: toDate },
    });
  }

  test(booking: Booking): boolean {
    const fieldName = this.filter.name as keyof Booking;
    const dateValue = booking[fieldName];
    if (!dateValue) return false;

    const date = new Date(dateValue as string);
    const { from, to } = this.filter.value;

    if (from && to) {
      return isWithinInterval(date, { start: from, end: to });
    } else if (from) {
      return isAfter(date, from);
    } else if (to) {
      return isBefore(date, to);
    }

    return true;
  }

  static today(field: "check_in" | "check_out" = "check_in"): DateRangeFilterBuilder {
    const today = new Date();
    return new DateRangeFilterBuilder(field, startOfDay(today), endOfDay(today));
  }

  static thisWeek(field: "check_in" | "check_out" = "check_in"): DateRangeFilterBuilder {
    const today = new Date();
    const weekEnd = addDays(today, 7);
    return new DateRangeFilterBuilder(field, startOfDay(today), endOfDay(weekEnd));
  }

  static thisMonth(field: "check_in" | "check_out" = "check_in"): DateRangeFilterBuilder {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return new DateRangeFilterBuilder(field, startOfDay(monthStart), endOfDay(monthEnd));
  }

  static upcomingDays(
    days: number,
    field: "check_in" | "check_out" = "check_in"
  ): DateRangeFilterBuilder {
    const today = new Date();
    const future = addDays(today, days);
    return new DateRangeFilterBuilder(field, startOfDay(today), endOfDay(future));
  }

  static pastDays(
    days: number,
    field: "check_in" | "check_out" = "check_out"
  ): DateRangeFilterBuilder {
    const today = new Date();
    const past = addDays(today, -days);
    return new DateRangeFilterBuilder(field, startOfDay(past), endOfDay(today));
  }
}

// ============================================
// WORKFLOW STATE FILTERS
// ============================================

export class WorkflowStateFilterBuilder extends BaseFilterBuilder<Booking> {
  private workflowFilter: WorkflowFilter;

  constructor(filter: Partial<WorkflowFilter>) {
    super({
      name: "workflow",
      type: "workflow",
      operator: "custom" as any,
      value: filter,
    });

    this.workflowFilter = {
      hasWorkflowState: filter.hasWorkflowState ?? false,
      workflowStatus: filter.workflowStatus,
      hasPendingActions: filter.hasPendingActions ?? false,
      overdueActions: filter.overdueActions ?? false,
      automatedTriggers: filter.automatedTriggers,
    };
  }

  test(booking: Booking): boolean {
    // Check for overdue actions
    if (this.workflowFilter.overdueActions) {
      const now = new Date();
      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);

      if (booking.booking_status === "Confirmed" && checkIn < now) {
        return true; // Overdue check-in
      }
      if (booking.booking_status === "CheckedIn" && checkOut < now) {
        return true; // Overdue check-out
      }
    }

    // Check for pending actions
    if (this.workflowFilter.hasPendingActions) {
      if (booking.booking_status === "Pending") {
        return true;
      }
      if (booking.booking_status === "Confirmed" && booking.payment_status !== "Completed") {
        return true; // Pending payment
      }
    }

    return true; // Would need actual workflow state to test properly
  }

  static needsAttention(): WorkflowStateFilterBuilder {
    return new WorkflowStateFilterBuilder({
      hasPendingActions: true,
      overdueActions: true,
    });
  }

  static automated(): WorkflowStateFilterBuilder {
    return new WorkflowStateFilterBuilder({
      automatedTriggers: ["date", "payment"],
    });
  }

  static byStatus(
    status: "active" | "completed" | "failed" | "pending"
  ): WorkflowStateFilterBuilder {
    return new WorkflowStateFilterBuilder({
      hasWorkflowState: true,
      workflowStatus: status,
    });
  }
}

// ============================================
// FINANCIAL FILTERS
// ============================================

export class FinancialFilterBuilder extends BaseFilterBuilder<Booking> {
  constructor(
    private config: {
      minAmount?: number;
      maxAmount?: number;
      paymentStatus?: PaymentStatus[];
      paymentMethods?: string[];
      hasOverdue?: boolean;
    }
  ) {
    super({
      name: "financial",
      type: "custom",
      operator: "custom" as any,
      value: config,
    });
  }

  test(booking: Booking): boolean {
    // Amount range
    if (this.config.minAmount != null && booking.total_amount < this.config.minAmount) {
      return false;
    }
    if (this.config.maxAmount != null && booking.total_amount > this.config.maxAmount) {
      return false;
    }

    // Payment status
    if (
      this.config.paymentStatus?.length &&
      !this.config.paymentStatus.includes(booking.payment_status)
    ) {
      return false;
    }

    // Payment methods
    if (
      this.config.paymentMethods?.length &&
      (!booking.payment_method || !this.config.paymentMethods.includes(booking.payment_method))
    ) {
      return false;
    }

    // Overdue payments
    if (this.config.hasOverdue) {
      const checkIn = new Date(booking.check_in);
      const now = new Date();
      if (booking.payment_status === "Completed" || checkIn > now) {
        return false; // Not overdue
      }
    }

    return true;
  }

  static unpaid(): FinancialFilterBuilder {
    return new FinancialFilterBuilder({
      paymentStatus: ["Pending"],
    });
  }

  static overdue(): FinancialFilterBuilder {
    return new FinancialFilterBuilder({
      paymentStatus: ["Pending", "Partial"],
      hasOverdue: true,
    });
  }

  static highValue(threshold: number = 5000): FinancialFilterBuilder {
    return new FinancialFilterBuilder({
      minAmount: threshold,
    });
  }

  static byPaymentMethod(...methods: string[]): FinancialFilterBuilder {
    return new FinancialFilterBuilder({
      paymentMethods: methods,
    });
  }

  static inRange(min: number, max: number): FinancialFilterBuilder {
    return new FinancialFilterBuilder({
      minAmount: min,
      maxAmount: max,
    });
  }
}

// ============================================
// GUEST FILTERS
// ============================================

export class GuestFilterBuilder extends BaseFilterBuilder<Booking> {
  constructor(
    private guestFilter: {
      isRepeatGuest?: boolean;
      isVIP?: boolean;
      minBookings?: number;
      minSpent?: number;
      contactPreference?: "email" | "phone" | "both";
      guestIds?: string[];
    }
  ) {
    super({
      name: "guest",
      type: "guest",
      operator: "custom" as any,
      value: guestFilter,
    });
  }

  test(booking: Booking): boolean {
    // Check specific guest IDs
    if (this.guestFilter.guestIds?.length) {
      if (!booking.guest_id || !this.guestFilter.guestIds.includes(booking.guest_id)) {
        return false;
      }
    }

    // Other guest filters would require guest data
    // This is a simplified test
    return true;
  }

  static repeatGuests(minBookings: number = 2): GuestFilterBuilder {
    return new GuestFilterBuilder({
      isRepeatGuest: true,
      minBookings,
    });
  }

  static vipGuests(minSpent: number = 10000): GuestFilterBuilder {
    return new GuestFilterBuilder({
      isVIP: true,
      minSpent,
    });
  }

  static byIds(...guestIds: string[]): GuestFilterBuilder {
    return new GuestFilterBuilder({
      guestIds,
    });
  }
}

// ============================================
// UNIT FILTERS
// ============================================

export class UnitFilterBuilder extends BaseFilterBuilder<Booking> {
  constructor(
    private unitFilter: {
      unitIds?: string[];
      types?: string[];
      minOccupancy?: number;
      maxRate?: number;
      availableOnly?: boolean;
    }
  ) {
    super({
      name: "unit",
      type: "unit",
      operator: "custom" as any,
      value: unitFilter,
    });
  }

  test(booking: Booking): boolean {
    // Check specific unit IDs
    if (this.unitFilter.unitIds?.length) {
      if (!this.unitFilter.unitIds.includes(booking.unit_id)) {
        return false;
      }
    }

    // Other unit filters would require unit data
    return true;
  }

  static byIds(...unitIds: string[]): UnitFilterBuilder {
    return new UnitFilterBuilder({
      unitIds,
    });
  }

  static byTypes(...types: string[]): UnitFilterBuilder {
    return new UnitFilterBuilder({
      types,
    });
  }

  static availableOnly(): UnitFilterBuilder {
    return new UnitFilterBuilder({
      availableOnly: true,
    });
  }
}

// ============================================
// STATUS FILTERS
// ============================================

export class StatusFilterBuilder extends BaseFilterBuilder<Booking> {
  constructor(
    private statusConfig: {
      bookingStatus?: BookingStatus[];
      paymentStatus?: PaymentStatus[];
    }
  ) {
    super({
      name: "status",
      type: "status",
      operator: "in",
      value: statusConfig,
    });
  }

  test(booking: Booking): boolean {
    if (
      this.statusConfig.bookingStatus?.length &&
      !this.statusConfig.bookingStatus.includes(booking.booking_status)
    ) {
      return false;
    }

    if (
      this.statusConfig.paymentStatus?.length &&
      !this.statusConfig.paymentStatus.includes(booking.payment_status)
    ) {
      return false;
    }

    return true;
  }

  static active(): StatusFilterBuilder {
    return new StatusFilterBuilder({
      bookingStatus: ["Pending", "Confirmed", "CheckedIn"],
    });
  }

  static completed(): StatusFilterBuilder {
    return new StatusFilterBuilder({
      bookingStatus: ["CheckedOut"],
      paymentStatus: ["Completed"],
    });
  }

  static cancelled(): StatusFilterBuilder {
    return new StatusFilterBuilder({
      bookingStatus: ["Cancelled"],
    });
  }

  static needsPayment(): StatusFilterBuilder {
    return new StatusFilterBuilder({
      bookingStatus: ["Confirmed", "CheckedIn"],
      paymentStatus: ["Pending", "Partial"],
    });
  }
}

// ============================================
// PRESET FILTER COLLECTIONS
// ============================================

export class FilterPresets {
  static todayCheckIns() {
    return DateRangeFilterBuilder.today("check_in").and(
      new StatusFilterBuilder({ bookingStatus: ["Confirmed"] })
    );
  }

  static todayCheckOuts() {
    return DateRangeFilterBuilder.today("check_out").and(
      new StatusFilterBuilder({ bookingStatus: ["CheckedIn"] })
    );
  }

  static upcomingArrivals(days: number = 7) {
    return DateRangeFilterBuilder.upcomingDays(days, "check_in").and(StatusFilterBuilder.active());
  }

  static overduePayments() {
    return FinancialFilterBuilder.overdue().and(StatusFilterBuilder.active());
  }

  static highValueBookings(threshold: number = 5000) {
    return FinancialFilterBuilder.highValue(threshold).and(StatusFilterBuilder.active());
  }

  static vipGuestsThisMonth() {
    return GuestFilterBuilder.vipGuests().and(DateRangeFilterBuilder.thisMonth());
  }

  static needsAttention() {
    return WorkflowStateFilterBuilder.needsAttention()
      .or(FinancialFilterBuilder.overdue())
      .or(
        DateRangeFilterBuilder.today("check_in").and(
          new StatusFilterBuilder({ bookingStatus: ["Pending"] })
        )
      );
  }

  static recentCancellations(days: number = 7) {
    return StatusFilterBuilder.cancelled().and(DateRangeFilterBuilder.pastDays(days, "updated_at"));
  }
}

// ============================================
// FILTER EXECUTION
// ============================================

/**
 * Execute filters on a collection of items
 */
export function executeFilters<T>(items: T[], filters: FilterBuilder<T>[]): T[] {
  return items.filter((item) => {
    return filters.every((filter) => filter.test(item));
  });
}

/**
 * Build Supabase query from filters
 */
export function buildSupabaseQuery(
  query: any, // Supabase query builder
  filters: AdvancedFilter[]
): any {
  let result = query;

  for (const filter of filters) {
    if (!filter.isActive) continue;

    switch (filter.type) {
      case "date_range":
        if (filter.value.from) {
          result = result.gte(filter.name, filter.value.from.toISOString());
        }
        if (filter.value.to) {
          result = result.lte(filter.name, filter.value.to.toISOString());
        }
        break;

      case "status":
        if (filter.value.bookingStatus?.length) {
          result = result.in("booking_status", filter.value.bookingStatus);
        }
        if (filter.value.paymentStatus?.length) {
          result = result.in("payment_status", filter.value.paymentStatus);
        }
        break;

      default:
        // Apply operator-based filtering
        switch (filter.operator) {
          case "equals":
            result = result.eq(filter.name, filter.value);
            break;
          case "contains":
            result = result.ilike(filter.name, `%${filter.value}%`);
            break;
          case "in":
            result = result.in(filter.name, filter.value);
            break;
          case "not_in":
            result = result.not(filter.name, "in", filter.value);
            break;
          case "greater_than":
            result = result.gt(filter.name, filter.value);
            break;
          case "less_than":
            result = result.lt(filter.name, filter.value);
            break;
        }
    }
  }

  return result;
}

/**
 * Validate filter configuration
 */
export function validateFilter(filter: AdvancedFilter): string[] {
  const errors: string[] = [];

  if (!filter.id) {
    errors.push("Filter must have an ID");
  }

  if (!filter.name) {
    errors.push("Filter must have a name");
  }

  if (!filter.type) {
    errors.push("Filter must have a type");
  }

  if (!filter.operator) {
    errors.push("Filter must have an operator");
  }

  // Type-specific validation
  switch (filter.type) {
    case "date_range":
      if (!filter.value || typeof filter.value !== "object") {
        errors.push("Date range filter must have from/to values");
      }
      break;

    case "status":
      if (!filter.value || typeof filter.value !== "object") {
        errors.push("Status filter must have status values");
      }
      break;
  }

  return errors;
}

/**
 * Merge multiple filter sets
 */
export function mergeFilters(...filterSets: AdvancedFilter[][]): AdvancedFilter[] {
  const merged = new Map<string, AdvancedFilter>();

  for (const filters of filterSets) {
    for (const filter of filters) {
      merged.set(filter.id, filter);
    }
  }

  return Array.from(merged.values());
}
