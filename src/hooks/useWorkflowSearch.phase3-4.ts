/**
 * Workflow-Integrated Search Hooks
 *
 * Provides real-time search capabilities integrated with the workflow system:
 * - Search bookings by workflow state
 * - Find bookings needing attention
 * - Track automated trigger candidates
 * - Monitor workflow transitions
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useSearchStore } from "@/stores/useSearchStore";
import { useWorkflowStore } from "@/stores/useWorkflowStore";
import type { Booking, BookingStatus } from "@/types";
import { supabase, db, handleSupabaseError } from "@/lib/supabase";
import {
  WorkflowStateFilterBuilder,
  DateRangeFilterBuilder,
  StatusFilterBuilder,
  FilterPresets,
  executeFilters,
} from "@/utils/filter-builder";
import { processSearchResults } from "@/utils/search-filter";

// ============================================
// TYPES
// ============================================

interface WorkflowSearchResult {
  booking: Booking;
  workflowState?: {
    currentState: string;
    pendingActions: string[];
    overdueActions: string[];
    automatedTriggers: string[];
    lastTransition?: Date;
    nextScheduledAction?: Date;
    costEstimate?: number;
  };
  score: number;
  urgency: "high" | "medium" | "low";
  actionRequired: boolean;
}

interface WorkflowSearchOptions {
  includeWorkflowState?: boolean;
  includePredictions?: boolean;
  includeCostEstimate?: boolean;
  resortId?: string;
  enabled?: boolean;
}

// ============================================
// WORKFLOW SEARCH HOOK
// ============================================

export function useWorkflowSearch(searchTerm: string = "", options: WorkflowSearchOptions = {}) {
  const {
    includeWorkflowState = true,
    includePredictions = false,
    includeCostEstimate = false,
    resortId = "resort-okaeri",
    enabled = true,
  } = options;

  const { workflowFilter, activeFilters } = useSearchStore();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [
      "workflow-search",
      searchTerm,
      workflowFilter,
      activeFilters,
      includeWorkflowState,
      includePredictions,
      resortId,
    ],
    queryFn: async () => {
      // Fetch bookings with basic search
      let bookingQuery = supabase.from("bookings").select(`
        *,
        unit:units(*),
        guest:guests(*)
      `);

      // Apply search term
      if (searchTerm) {
        bookingQuery = bookingQuery.or(
          `guest_name.ilike.%${searchTerm}%,booking_reference.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      // Apply workflow filters
      if (workflowFilter?.overdueActions) {
        // Get bookings with overdue actions
        const now = new Date();
        bookingQuery = bookingQuery.or(
          `and(booking_status.eq.Confirmed,check_in.lt.${now.toISOString()}),and(booking_status.eq.CheckedIn,check_out.lt.${now.toISOString()})`
        );
      }

      if (workflowFilter?.hasPendingActions) {
        bookingQuery = bookingQuery.in("booking_status", ["Pending", "Confirmed"]);
      }

      const { data: bookings, error } = await bookingQuery;
      if (error) throw new Error(handleSupabaseError(error));

      // Fetch workflow states for bookings if requested
      const results: WorkflowSearchResult[] = [];

      for (const booking of bookings || []) {
        let workflowState = undefined;

        if (includeWorkflowState) {
          try {
            const response = await fetch(
              `/api/workflows/status?bookingId=${booking.booking_id}&resortId=${resortId}&includePredictions=${includePredictions}&includeCostEstimate=${includeCostEstimate}`
            );

            if (response.ok) {
              const data = await response.json();
              workflowState = data.workflowState;
            }
          } catch (error) {
            console.error("Failed to fetch workflow state:", error);
          }
        }

        // Calculate urgency and action required
        const urgency = calculateUrgency(booking, workflowState);
        const actionRequired = isActionRequired(booking, workflowState);

        results.push({
          booking,
          workflowState,
          score: calculateWorkflowScore(booking, workflowState, searchTerm),
          urgency,
          actionRequired,
        });
      }

      // Sort by urgency and score
      results.sort((a, b) => {
        // Prioritize action required
        if (a.actionRequired !== b.actionRequired) {
          return a.actionRequired ? -1 : 1;
        }

        // Then by urgency
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;

        // Finally by score
        return b.score - a.score;
      });

      return results;
    },
    enabled,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute for real-time updates
  });
}

// ============================================
// BOOKINGS NEEDING ATTENTION
// ============================================

export function useBookingsNeedingAttention(options: WorkflowSearchOptions = {}) {
  const { resortId = "resort-okaeri", enabled = true } = options;

  return useQuery({
    queryKey: ["bookings-needing-attention", resortId],
    queryFn: async () => {
      // Use filter presets to find bookings needing attention
      const needsAttentionFilter = FilterPresets.needsAttention();

      // Fetch bookings
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          unit:units(*),
          guest:guests(*)
        `
        )
        .in("booking_status", ["Pending", "Confirmed", "CheckedIn"]);

      if (error) throw new Error(handleSupabaseError(error));

      // Apply filters
      const filtered = executeFilters(bookings || [], [needsAttentionFilter]);

      // Get workflow states for filtered bookings
      const results: WorkflowSearchResult[] = [];

      for (const booking of filtered) {
        let workflowState = undefined;

        try {
          const response = await fetch(
            `/api/workflows/status?bookingId=${booking.booking_id}&resortId=${resortId}`
          );

          if (response.ok) {
            const data = await response.json();
            workflowState = data.workflowState;
          }
        } catch (error) {
          console.error("Failed to fetch workflow state:", error);
        }

        const urgency = calculateUrgency(booking, workflowState);

        results.push({
          booking,
          workflowState,
          score: 1.0, // All are important
          urgency,
          actionRequired: true,
        });
      }

      return results;
    },
    enabled,
    staleTime: 30000,
    refetchInterval: 60000, // Real-time monitoring
  });
}

// ============================================
// AUTOMATED TRIGGER CANDIDATES
// ============================================

export function useAutomatedTriggerCandidates(
  triggerTypes: string[] = ["date", "payment"],
  options: { enabled?: boolean; resortId?: string } = {}
) {
  const { enabled = true, resortId = "resort-okaeri" } = options;

  return useQuery({
    queryKey: ["automated-trigger-candidates", triggerTypes, resortId],
    queryFn: async () => {
      const candidates: WorkflowSearchResult[] = [];
      const now = new Date();

      // Date-based triggers
      if (triggerTypes.includes("date")) {
        // Find bookings for today's check-ins
        const todayCheckIns = await supabase
          .from("bookings")
          .select(
            `
            *,
            unit:units(*),
            guest:guests(*)
          `
          )
          .eq("booking_status", "Confirmed")
          .gte("check_in", startOfToday())
          .lt("check_in", endOfToday());

        if (todayCheckIns.data) {
          for (const booking of todayCheckIns.data) {
            candidates.push({
              booking,
              workflowState: {
                currentState: "ready_for_checkin",
                pendingActions: ["auto_checkin"],
                overdueActions: [],
                automatedTriggers: ["date"],
              },
              score: 1.0,
              urgency: "high",
              actionRequired: false, // Automated
            });
          }
        }

        // Find bookings for today's check-outs
        const todayCheckOuts = await supabase
          .from("bookings")
          .select(
            `
            *,
            unit:units(*),
            guest:guests(*)
          `
          )
          .eq("booking_status", "CheckedIn")
          .gte("check_out", startOfToday())
          .lt("check_out", endOfToday());

        if (todayCheckOuts.data) {
          for (const booking of todayCheckOuts.data) {
            candidates.push({
              booking,
              workflowState: {
                currentState: "ready_for_checkout",
                pendingActions: ["auto_checkout"],
                overdueActions: [],
                automatedTriggers: ["date"],
              },
              score: 1.0,
              urgency: "high",
              actionRequired: false,
            });
          }
        }
      }

      // Payment-based triggers
      if (triggerTypes.includes("payment")) {
        const unpaidBookings = await supabase
          .from("bookings")
          .select(
            `
            *,
            unit:units(*),
            guest:guests(*)
          `
          )
          .in("booking_status", ["Confirmed", "CheckedIn"])
          .eq("payment_status", "Pending")
          .lt("check_in", addDays(now, 1).toISOString()); // Check-in within 24 hours

        if (unpaidBookings.data) {
          for (const booking of unpaidBookings.data) {
            candidates.push({
              booking,
              workflowState: {
                currentState: "payment_pending",
                pendingActions: ["send_payment_reminder"],
                overdueActions: [],
                automatedTriggers: ["payment"],
              },
              score: 0.9,
              urgency: "high",
              actionRequired: true,
            });
          }
        }
      }

      return candidates;
    },
    enabled,
    staleTime: 60000,
    refetchInterval: 120000, // Check every 2 minutes
  });
}

// ============================================
// WORKFLOW TRANSITION SEARCH
// ============================================

export function useWorkflowTransitionSearch(
  fromStatus?: BookingStatus,
  toStatus?: BookingStatus,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["workflow-transition-search", fromStatus, toStatus],
    queryFn: async () => {
      let query = supabase.from("bookings").select(`
        *,
        unit:units(*),
        guest:guests(*)
      `);

      // Filter by current status if specified
      if (fromStatus) {
        query = query.eq("booking_status", fromStatus);
      }

      const { data, error } = await query;
      if (error) throw new Error(handleSupabaseError(error));

      // Filter bookings that can transition to target status
      const eligibleBookings = (data || []).filter((booking) => {
        if (!toStatus) return true;

        // Check if transition is valid
        return canTransition(booking.booking_status, toStatus);
      });

      return eligibleBookings.map((booking) => ({
        booking,
        currentStatus: booking.booking_status,
        targetStatus: toStatus,
        canTransition: !toStatus || canTransition(booking.booking_status, toStatus),
        blockers: getTransitionBlockers(booking, toStatus),
      }));
    },
    enabled,
    staleTime: 30000,
  });
}

// ============================================
// BULK WORKFLOW SEARCH
// ============================================

export function useBulkWorkflowSearch(bookingIds: string[], options: WorkflowSearchOptions = {}) {
  const { resortId = "resort-okaeri", enabled = true } = options;

  return useQuery({
    queryKey: ["bulk-workflow-search", bookingIds, resortId],
    queryFn: async () => {
      if (bookingIds.length === 0) return [];

      // Fetch bookings
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          unit:units(*),
          guest:guests(*)
        `
        )
        .in("booking_id", bookingIds);

      if (error) throw new Error(handleSupabaseError(error));

      // Fetch workflow states in parallel
      const workflowPromises = (bookings || []).map(async (booking) => {
        try {
          const response = await fetch(
            `/api/workflows/status?bookingId=${booking.booking_id}&resortId=${resortId}`
          );

          if (response.ok) {
            const data = await response.json();
            return {
              booking,
              workflowState: data.workflowState,
            };
          }
        } catch (error) {
          console.error("Failed to fetch workflow state:", error);
        }

        return { booking, workflowState: undefined };
      });

      const results = await Promise.all(workflowPromises);

      return results.map(({ booking, workflowState }) => ({
        booking,
        workflowState,
        score: 1.0,
        urgency: calculateUrgency(booking, workflowState),
        actionRequired: isActionRequired(booking, workflowState),
      }));
    },
    enabled: enabled && bookingIds.length > 0,
    staleTime: 30000,
  });
}

// ============================================
// WORKFLOW METRICS SEARCH
// ============================================

export function useWorkflowMetricsSearch(
  dateRange: { from: Date; to: Date },
  options: { resortId?: string; enabled?: boolean } = {}
) {
  const { resortId = "resort-okaeri", enabled = true } = options;

  return useQuery({
    queryKey: ["workflow-metrics-search", dateRange, resortId],
    queryFn: async () => {
      // Fetch bookings in date range
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (error) throw new Error(handleSupabaseError(error));

      // Categorize by workflow state
      const metrics = {
        total: bookings?.length || 0,
        byStatus: {} as Record<BookingStatus, number>,
        needingAttention: 0,
        automatedActions: 0,
        overdueActions: 0,
        completedWorkflows: 0,
      };

      for (const booking of bookings || []) {
        // Count by status
        metrics.byStatus[booking.booking_status] =
          (metrics.byStatus[booking.booking_status] || 0) + 1;

        // Check if needs attention
        const urgency = calculateUrgency(booking);
        if (urgency === "high") {
          metrics.needingAttention++;
        }

        // Count overdue
        const now = new Date();
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);

        if (
          (booking.booking_status === "Confirmed" && checkIn < now) ||
          (booking.booking_status === "CheckedIn" && checkOut < now)
        ) {
          metrics.overdueActions++;
        }

        // Count completed
        if (booking.booking_status === "CheckedOut") {
          metrics.completedWorkflows++;
        }
      }

      return metrics;
    },
    enabled,
    staleTime: 60000,
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateUrgency(booking: Booking, workflowState?: any): "high" | "medium" | "low" {
  const now = new Date();
  const checkIn = new Date(booking.check_in);
  const checkOut = new Date(booking.check_out);

  // High urgency conditions
  if (workflowState?.overdueActions?.length > 0) {
    return "high";
  }

  if (booking.booking_status === "Confirmed" && checkIn < now) {
    return "high"; // Overdue check-in
  }

  if (booking.booking_status === "CheckedIn" && checkOut < now) {
    return "high"; // Overdue check-out
  }

  if (booking.booking_status === "Pending" && checkIn <= addDays(now, 1)) {
    return "high"; // Pending booking close to check-in
  }

  // Medium urgency conditions
  if (workflowState?.pendingActions?.length > 0) {
    return "medium";
  }

  if (booking.payment_status !== "Completed" && checkIn <= addDays(now, 3)) {
    return "medium"; // Unpaid booking approaching
  }

  return "low";
}

function isActionRequired(booking: Booking, workflowState?: any): boolean {
  if (workflowState?.pendingActions?.length > 0) {
    return true;
  }

  if (workflowState?.overdueActions?.length > 0) {
    return true;
  }

  if (booking.booking_status === "Pending") {
    return true;
  }

  if (
    booking.payment_status !== "Completed" &&
    new Date(booking.check_in) <= addDays(new Date(), 1)
  ) {
    return true;
  }

  return false;
}

function calculateWorkflowScore(
  booking: Booking,
  workflowState?: any,
  searchTerm?: string
): number {
  let score = 0;

  // Base score from search term match
  if (searchTerm) {
    const fields = [booking.guest_name, booking.email, booking.booking_reference];

    for (const field of fields) {
      if (field?.toLowerCase().includes(searchTerm.toLowerCase())) {
        score += 0.5;
      }
    }
  }

  // Workflow state scoring
  if (workflowState) {
    if (workflowState.overdueActions?.length > 0) {
      score += 1.0;
    }

    if (workflowState.pendingActions?.length > 0) {
      score += 0.5;
    }

    if (workflowState.automatedTriggers?.length > 0) {
      score += 0.3;
    }
  }

  // Urgency scoring
  const urgency = calculateUrgency(booking, workflowState);
  switch (urgency) {
    case "high":
      score += 0.8;
      break;
    case "medium":
      score += 0.4;
      break;
    case "low":
      score += 0.1;
      break;
  }

  return Math.min(score, 1.0); // Cap at 1.0
}

function canTransition(fromStatus: BookingStatus, toStatus: BookingStatus): boolean {
  const validTransitions: Record<BookingStatus, BookingStatus[]> = {
    Pending: ["Confirmed", "Cancelled"],
    Confirmed: ["CheckedIn", "Cancelled"],
    CheckedIn: ["CheckedOut"],
    CheckedOut: [],
    Cancelled: [],
  };

  return validTransitions[fromStatus]?.includes(toStatus) || false;
}

function getTransitionBlockers(booking: Booking, targetStatus?: BookingStatus): string[] {
  const blockers: string[] = [];

  if (!targetStatus) return blockers;

  // Check payment requirements
  if (targetStatus === "CheckedIn" && booking.payment_status !== "Completed") {
    blockers.push("Payment not completed");
  }

  // Check date requirements
  const now = new Date();
  const checkIn = new Date(booking.check_in);
  const checkOut = new Date(booking.check_out);

  if (targetStatus === "CheckedIn" && checkIn > now) {
    blockers.push("Check-in date not reached");
  }

  if (targetStatus === "CheckedOut" && checkOut > now) {
    blockers.push("Check-out date not reached");
  }

  return blockers;
}

// Helper date functions
function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function endOfToday(): string {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
