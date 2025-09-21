/**
 * Serverless API Route: Get Workflow Status and State
 *
 * Retrieves comprehensive workflow state information for bookings,
 * including available transitions, automated triggers, and cost estimates.
 *
 * Endpoint: GET /api/workflows/status
 *
 * @module WorkflowStatusAPI
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Booking } from "@/types";
import { createWorkflowEngine, createWorkflowContext, type WorkflowState } from "@/workflow/engine";

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

interface WorkflowStatusRequest {
  bookingId?: string;
  resortId: string;
  includeHistory?: boolean;
  includePredictions?: boolean;
  includeCostEstimate?: boolean;
}

interface WorkflowStatusResponse {
  success: boolean;
  workflowState?: WorkflowState;
  multipleStates?: WorkflowState[];
  summary?: {
    totalBookings: number;
    activeAutomatedTriggers: number;
    pendingActions: number;
    estimatedMonthlyCost: number;
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const startTime = Date.now();
  let executionId = "";

  try {
    // Parse query parameters
    const {
      bookingId,
      resortId,
      includeHistory = false,
      includePredictions = false,
      includeCostEstimate = true,
    } = req.query as any;

    if (!resortId) {
      res.status(400).json({ error: "Missing required parameter: resortId" });
      return;
    }

    // Create workflow context
    const context = createWorkflowContext(resortId);
    context.triggeredBy = "system";
    context.metadata = {
      apiEndpoint: "/api/workflows/status",
      includeHistory,
      includePredictions,
      includeCostEstimate,
    };
    executionId = context.executionId;

    const workflowEngine = createWorkflowEngine();

    if (bookingId) {
      // Get workflow state for specific booking
      const booking = await mockGetBooking(bookingId);
      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      const workflowState = await workflowEngine.getWorkflowState(booking, context);

      // Filter out history and predictions if not requested
      if (!includeHistory) {
        workflowState.executionHistory = [];
      }
      if (!includePredictions) {
        workflowState.predictedActions = [];
      }
      if (!includeCostEstimate) {
        workflowState.costEstimate = {
          functionExecutions: 0,
          databaseOperations: 0,
          storageOperations: 0,
          notificationsSent: 0,
          estimatedCostUSD: 0,
        };
      }

      const response: WorkflowStatusResponse = {
        success: true,
        workflowState,
        timestamp: new Date().toISOString(),
        executionId,
      };

      res.status(200).json(response);
    } else {
      // Get workflow summary for all bookings in resort
      const bookings = await fetchResortBookings(resortId);
      const workflowStates = await Promise.all(
        bookings.map((booking) => workflowEngine.getWorkflowState(booking, context))
      );

      // Calculate summary statistics
      const summary = calculateWorkflowSummary(workflowStates);

      const response: WorkflowStatusResponse = {
        success: true,
        multipleStates: includePredictions || includeHistory ? workflowStates : undefined,
        summary,
        timestamp: new Date().toISOString(),
        executionId,
      };

      res.status(200).json(response);
    }

    console.log(`Workflow status retrieved (${executionId}):`, {
      resortId,
      bookingId: bookingId || "all",
      executionTime: Date.now() - startTime,
    });
  } catch (error) {
    console.error(`Workflow status error (${executionId}):`, error);

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
 * Mock function to retrieve booking (replace with actual database call)
 */
async function mockGetBooking(bookingId: string): Promise<Booking | null> {
  // Mock booking data - in production, this would be a database query
  if (!bookingId.startsWith("BK-")) {
    return null;
  }

  return {
    booking_id: bookingId,
    booking_reference: bookingId,
    unit_id: "unit-1",
    guest_id: "guest-1",
    guest_name: "John Doe",
    contact_number: "+639123456789",
    email: "john@example.com",
    num_guests: 2,
    check_in: "2024-01-15T14:00:00Z",
    check_out: "2024-01-17T11:00:00Z",
    total_amount: 5000,
    booking_status: "Confirmed",
    payment_status: "Paid",
    payment_method: "GCash",
    payment_proof_url: null,
    special_requests: null,
    internal_notes: null,
    created_at: "2024-01-10T10:00:00Z",
    updated_at: "2024-01-10T10:00:00Z",
  };
}

/**
 * Fetch all bookings for a resort
 */
async function fetchResortBookings(resortId: string): Promise<Booking[]> {
  // Mock multiple bookings - in production, this would be a database query
  return [
    {
      booking_id: "BK-001",
      booking_reference: "BK-001",
      unit_id: "unit-1",
      guest_id: "guest-1",
      guest_name: "John Doe",
      contact_number: "+639123456789",
      email: "john@example.com",
      num_guests: 2,
      check_in: "2024-01-15T14:00:00Z",
      check_out: "2024-01-17T11:00:00Z",
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
      check_in: "2024-01-20T14:00:00Z",
      check_out: "2024-01-22T11:00:00Z",
      total_amount: 8000,
      booking_status: "Pending",
      payment_status: "Unpaid",
      payment_method: null,
      payment_proof_url: null,
      special_requests: null,
      internal_notes: null,
      created_at: "2024-01-12T10:00:00Z",
      updated_at: "2024-01-12T10:00:00Z",
    },
    {
      booking_id: "BK-003",
      booking_reference: "BK-003",
      unit_id: "unit-1",
      guest_id: "guest-3",
      guest_name: "Bob Johnson",
      contact_number: "+639111222333",
      email: "bob@example.com",
      num_guests: 3,
      check_in: "2024-01-12T14:00:00Z",
      check_out: "2024-01-14T11:00:00Z",
      total_amount: 6000,
      booking_status: "CheckedIn",
      payment_status: "Paid",
      payment_method: "Cash",
      payment_proof_url: null,
      special_requests: null,
      internal_notes: null,
      created_at: "2024-01-08T10:00:00Z",
      updated_at: "2024-01-12T14:00:00Z",
    },
  ];
}

/**
 * Calculate workflow summary statistics
 */
function calculateWorkflowSummary(workflowStates: WorkflowState[]) {
  const summary = {
    totalBookings: workflowStates.length,
    activeAutomatedTriggers: 0,
    pendingActions: 0,
    estimatedMonthlyCost: 0,
  };

  workflowStates.forEach((state) => {
    // Count active automated triggers
    summary.activeAutomatedTriggers += state.automatedTriggers.filter(
      (trigger) => trigger.isActive
    ).length;

    // Count pending actions (actions with all requirements met)
    summary.pendingActions += state.nextActions.filter(
      (action) => !action.requirements || action.requirements.every((req) => req.isMet)
    ).length;

    // Sum cost estimates
    summary.estimatedMonthlyCost += state.costEstimate.estimatedCostUSD * 30; // Daily to monthly
  });

  return summary;
}

/**
 * Helper function to filter workflow state based on permissions
 */
function filterWorkflowStateByPermissions(
  state: WorkflowState,
  userPermissions: string[]
): WorkflowState {
  // Filter actions based on user permissions
  const filteredActions = state.nextActions.filter(
    (action) =>
      !action.permissions ||
      action.permissions.some((permission) => userPermissions.includes(permission))
  );

  return {
    ...state,
    nextActions: filteredActions,
  };
}

/**
 * Helper function to add caching headers for performance
 */
function setCacheHeaders(res: VercelResponse, maxAge: number = 30): void {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, s-maxage=${maxAge}`);
  res.setHeader("ETag", `"${Date.now()}"`);
}

/**
 * Helper function to validate API rate limits
 */
function checkRateLimit(req: VercelRequest): { allowed: boolean; remaining: number } {
  // In production, implement proper rate limiting
  // For now, mock rate limit check
  return { allowed: true, remaining: 100 };
}
