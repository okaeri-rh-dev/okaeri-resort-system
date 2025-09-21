/**
 * Serverless API Route: Batch Process Automated Workflows
 *
 * Processes multiple automated workflow triggers in batch for efficiency.
 * Designed for Vercel cron jobs and background processing.
 *
 * Endpoint: POST /api/workflows/batch
 *
 * @module WorkflowBatchAPI
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Booking } from "@/types";
import {
  createWorkflowEngine,
  createWorkflowContext,
  type WorkflowBatchResult,
} from "@/workflow/engine";

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

interface BatchProcessRequest {
  resortId: string;
  triggerTypes?: ("date" | "payment" | "time" | "external")[];
  batchSize?: number;
  dryRun?: boolean;
  filters?: {
    statusFilter?: string[];
    dateFrom?: string;
    dateTo?: string;
  };
}

interface BatchProcessResponse {
  success: boolean;
  batchResult: WorkflowBatchResult;
  summary: {
    totalBookingsEvaluated: number;
    triggersProcessed: number;
    successfulTransitions: number;
    failedTransitions: number;
    totalCostUSD: number;
    executionTimeMs: number;
  };
  timestamp: string;
  executionId: string;
}

// ============================================
// SERVERLESS FUNCTION HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const startTime = Date.now();
  let executionId = "";

  try {
    // Parse and validate request
    const {
      resortId,
      triggerTypes = ["date", "payment", "time"],
      batchSize = 50,
      dryRun = false,
      filters = {},
    }: BatchProcessRequest = req.body;

    if (!resortId) {
      res.status(400).json({ error: "Missing required field: resortId" });
      return;
    }

    // Validate batch size limits for serverless constraints
    if (batchSize > 100) {
      res.status(400).json({
        error: "Batch size too large (max 100 for serverless execution)",
      });
      return;
    }

    // Create workflow context
    const context = createWorkflowContext(resortId);
    context.triggeredBy = "automation";
    context.metadata = {
      apiEndpoint: "/api/workflows/batch",
      triggerTypes,
      batchSize,
    };
    context.dryRun = dryRun;
    executionId = context.executionId;

    // Fetch bookings for processing
    const bookings = await fetchBookingsForProcessing(resortId, filters, batchSize);

    console.log(`Batch processing ${bookings.length} bookings for resort ${resortId}`);

    // Create workflow engine and process batch
    const workflowEngine = createWorkflowEngine();
    const batchResult = await workflowEngine.processAutomatedTriggers(bookings, context);

    // Calculate summary statistics
    const summary = {
      totalBookingsEvaluated: bookings.length,
      triggersProcessed: batchResult.results.length,
      successfulTransitions: batchResult.successCount,
      failedTransitions: batchResult.errorCount,
      totalCostUSD: batchResult.totalCostUsage.actualCostUSD,
      executionTimeMs: batchResult.totalExecutionTime,
    };

    // Prepare response
    const response: BatchProcessResponse = {
      success: batchResult.errorCount === 0,
      batchResult,
      summary,
      timestamp: new Date().toISOString(),
      executionId,
    };

    // Log batch processing results
    console.log(`Batch processing completed (${executionId}):`, summary);

    // Check for cost limit warnings
    if (summary.totalCostUSD > 1.0) {
      // $1 warning threshold
      console.warn(`High cost detected: $${summary.totalCostUSD} for execution ${executionId}`);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error(`Batch processing error (${executionId}):`, error);

    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
      executionId,
      executionTime: Date.now() - startTime,
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Fetch bookings that need automated processing
 */
async function fetchBookingsForProcessing(
  resortId: string,
  filters: any,
  batchSize: number
): Promise<Booking[]> {
  // In production, this would query the database for bookings that need processing
  // For now, return mock data

  const mockBookings: Booking[] = [
    {
      booking_id: "BK-001",
      booking_reference: "BK-001",
      unit_id: "unit-1",
      guest_id: "guest-1",
      guest_name: "John Doe",
      contact_number: "+639123456789",
      email: "john@example.com",
      num_guests: 2,
      check_in: new Date().toISOString(), // Today - ready for check-in
      check_out: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      total_amount: 5000,
      booking_status: "Confirmed",
      payment_status: "Paid",
      payment_method: "GCash",
      payment_proof_url: null,
      special_requests: null,
      internal_notes: null,
      created_at: "2024-01-10T10:00:00Z",
      updated_at: "2024-01-10T10:00:00Z",
    },
    {
      booking_id: "BK-002",
      booking_reference: "BK-002",
      unit_id: "unit-2",
      guest_id: "guest-2",
      guest_name: "Jane Smith",
      contact_number: "+639987654321",
      email: "jane@example.com",
      num_guests: 4,
      check_in: "2024-01-10T14:00:00Z",
      check_out: new Date().toISOString(), // Today - ready for check-out
      total_amount: 8000,
      booking_status: "CheckedIn",
      payment_status: "Paid",
      payment_method: "BankTransfer",
      payment_proof_url: null,
      special_requests: null,
      internal_notes: null,
      created_at: "2024-01-08T10:00:00Z",
      updated_at: "2024-01-10T14:00:00Z",
    },
  ];

  // Apply filters
  let filteredBookings = mockBookings;

  if (filters.statusFilter?.length) {
    filteredBookings = filteredBookings.filter((booking) =>
      filters.statusFilter.includes(booking.booking_status)
    );
  }

  if (filters.dateFrom) {
    filteredBookings = filteredBookings.filter((booking) => booking.check_in >= filters.dateFrom);
  }

  if (filters.dateTo) {
    filteredBookings = filteredBookings.filter((booking) => booking.check_out <= filters.dateTo);
  }

  return filteredBookings.slice(0, batchSize);
}

/**
 * Helper function to validate cron job authentication
 */
function validateCronAuth(req: VercelRequest): boolean {
  // Validate that the request is from Vercel cron or authorized system
  const cronSecret = req.headers["x-vercel-cron-secret"];
  const expectedSecret = process.env.VERCEL_CRON_SECRET;

  if (!expectedSecret) {
    console.warn("VERCEL_CRON_SECRET not configured");
    return false;
  }

  return cronSecret === expectedSecret;
}

/**
 * Helper function to determine if batch processing should continue
 */
function shouldContinueBatch(
  processedCount: number,
  errorCount: number,
  costUsed: number
): boolean {
  // Stop if error rate is too high
  if (processedCount > 10 && errorCount / processedCount > 0.5) {
    console.warn("High error rate detected, stopping batch processing");
    return false;
  }

  // Stop if cost is too high (daily limit)
  if (costUsed > 5.0) {
    // $5 daily limit for automated processing
    console.warn("Cost limit reached, stopping batch processing");
    return false;
  }

  return true;
}

/**
 * Helper function to prioritize bookings for processing
 */
function prioritizeBookings(bookings: Booking[]): Booking[] {
  return bookings.sort((a, b) => {
    // Priority 1: Check-ins happening today
    const aCheckinToday = isToday(new Date(a.check_in));
    const bCheckinToday = isToday(new Date(b.check_in));
    if (aCheckinToday !== bCheckinToday) {
      return aCheckinToday ? -1 : 1;
    }

    // Priority 2: Check-outs happening today
    const aCheckoutToday = isToday(new Date(a.check_out));
    const bCheckoutToday = isToday(new Date(b.check_out));
    if (aCheckoutToday !== bCheckoutToday) {
      return aCheckoutToday ? -1 : 1;
    }

    // Priority 3: Confirmed bookings before pending
    if (a.booking_status !== b.booking_status) {
      const statusPriority = { Confirmed: 1, Pending: 2, CheckedIn: 0 };
      return (statusPriority[a.booking_status] || 3) - (statusPriority[b.booking_status] || 3);
    }

    // Priority 4: Earlier dates first
    return new Date(a.check_in).getTime() - new Date(b.check_in).getTime();
  });
}

/**
 * Helper function to check if a date is today
 */
function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}
