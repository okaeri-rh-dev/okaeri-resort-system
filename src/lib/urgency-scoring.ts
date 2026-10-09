/**
 * Urgency Scoring System for Admin Booking Queue
 *
 * Calculates 0-100 urgency score based on 4 factors:
 * 1. Hours to check-in (max 50 points)
 * 2. Days pending (max 20 points)
 * 3. Booking value (max 15 points)
 * 4. Unit count (max 15 points)
 *
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 24-148
 */

// ============================================
// Types
// ============================================

export type UrgencyLevel = "critical" | "high" | "medium" | "low";

export interface UrgencyScoreParams {
  check_in_date: string;
  created_at: string | null;
  total_amount: number;
  requested_unit_count: number;
}

export interface UrgencyResult {
  score: number;
  level: UrgencyLevel;
  badge_variant: "destructive" | "warning" | "default" | "secondary";
}

// ============================================
// SLO Thresholds
// ============================================

export const URGENCY_THRESHOLDS = {
  CRITICAL: 75,
  HIGH: 50,
  MEDIUM: 25,
} as const;

// ============================================
// Core Scoring Function
// ============================================

/**
 * Calculates urgency score (0-100) for a booking
 *
 * @param params - Booking parameters for scoring
 * @returns Urgency score (0-100)
 *
 * @example
 * const score = calculateUrgencyScore({
 *   check_in_date: '2025-10-25T15:00:00Z',
 *   created_at: '2025-10-23T10:00:00Z',
 *   total_amount: 45000,
 *   requested_unit_count: 3
 * });
 * // Returns 75 (Critical - check-in in 24h, 2 days pending, mid-value, 3 units)
 */
export function calculateUrgencyScore(params: UrgencyScoreParams): number {
  const { check_in_date, created_at, total_amount, requested_unit_count } = params;

  let score = 0;
  const now = new Date();

  // ============================================
  // Factor 1: Hours to Check-In (max 50 points)
  // ============================================
  const checkIn = new Date(check_in_date);
  const hoursToCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursToCheckIn < 0) {
    // Already past check-in - CRITICAL!
    return 100;
  } else if (hoursToCheckIn < 24) {
    score += 50;
  } else if (hoursToCheckIn < 48) {
    score += 35;
  } else if (hoursToCheckIn < 72) {
    score += 20;
  } else {
    score += 10;
  }

  // ============================================
  // Factor 2: Days Pending (max 20 points)
  // ============================================
  const daysPending = created_at
    ? (now.getTime() - new Date(created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  if (daysPending > 3) {
    score += 20;
  } else if (daysPending > 2) {
    score += 15;
  } else if (daysPending > 1) {
    score += 10;
  } else {
    score += 5;
  }

  // ============================================
  // Factor 3: Booking Value (max 15 points)
  // ============================================
  if (total_amount > 50000) {
    score += 15;
  } else if (total_amount > 30000) {
    score += 10;
  } else if (total_amount > 15000) {
    score += 5;
  } else {
    score += 2;
  }

  // ============================================
  // Factor 4: Unit Count (max 15 points)
  // ============================================
  if (requested_unit_count > 5) {
    score += 15;
  } else if (requested_unit_count >= 3) {
    score += 10;
  } else if (requested_unit_count === 2) {
    score += 5;
  } else {
    score += 2;
  }

  return Math.min(100, score);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Determines urgency level from score
 *
 * @param score - Urgency score (0-100)
 * @returns Urgency level (critical/high/medium/low)
 */
export function getUrgencyLevel(score: number): UrgencyLevel {
  if (score >= URGENCY_THRESHOLDS.CRITICAL) return "critical";
  if (score >= URGENCY_THRESHOLDS.HIGH) return "high";
  if (score >= URGENCY_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

/**
 * Gets urgency result with level and badge variant
 *
 * @param params - Booking parameters for scoring
 * @returns Complete urgency result
 */
export function getUrgencyResult(params: UrgencyScoreParams): UrgencyResult {
  const score = calculateUrgencyScore(params);
  const level = getUrgencyLevel(score);

  const badgeVariantMap: Record<UrgencyLevel, UrgencyResult["badge_variant"]> = {
    critical: "destructive",
    high: "warning",
    medium: "default",
    low: "secondary",
  };

  return {
    score,
    level,
    badge_variant: badgeVariantMap[level],
  };
}

/**
 * Formats urgency level as display text
 *
 * @param level - Urgency level
 * @returns Display text (Critical/High/Medium/Low)
 */
export function formatUrgencyLevel(level: UrgencyLevel): string {
  const displayMap: Record<UrgencyLevel, string> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return displayMap[level];
}
