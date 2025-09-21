/**
 * Serverless API Route: Execute Workflow Transition
 *
 * Handles workflow state transitions with full validation, business rule enforcement,
 * and audit trail generation. Optimized for Vercel serverless deployment.
 *
 * Endpoint: POST /api/workflows/execute
 *
 * @module WorkflowExecuteAPI
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Booking, BookingStatus, WorkflowTransition } from "@/types";
import {
  createWorkflowEngine,
  createWorkflowContext,
  type WorkflowContext,
} from "@/workflow/engine";
import { validateStatusTransition } from "@/utils/booking-workflow";

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

interface ExecuteWorkflowRequest {
  bookingId: string;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  resortId: string;
  userId?: string;
  triggeredBy?: "user" | "system" | "automation";
  metadata?: Record<string, any>;
  dryRun?: boolean;
}

interface ExecuteWorkflowResponse {
  success: boolean;
  workflowResult: {
    updatedBooking?: Booking;
    workflowEvent?: any;
    executionTime: number;
    errors: any[];
    warnings: string[];
    nextSteps: any[];
    costUsage: any;
  };
  timestamp: string;
  executionId: string;
}

// ============================================
// SERVERLESS FUNCTION HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Set CORS headers for frontend integration
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
      bookingId,
      fromStatus,
      toStatus,
      resortId,
      userId,
      triggeredBy = "user",
      metadata = {},
      dryRun = false,
    }: ExecuteWorkflowRequest = req.body;

    if (!bookingId || !fromStatus || !toStatus || !resortId) {
      res.status(400).json({
        error: "Missing required fields: bookingId, fromStatus, toStatus, resortId",
      });
      return;
    }

    // Create workflow context
    const context: WorkflowContext = createWorkflowContext(resortId, userId);
    context.triggeredBy = triggeredBy;
    context.metadata = { ...metadata, apiEndpoint: "/api/workflows/execute" };
    context.dryRun = dryRun;
    executionId = context.executionId;

    // Mock booking retrieval (in production, this would fetch from database)
    const booking: Booking = await mockGetBooking(bookingId);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Validate the transition using existing workflow utilities
    const transition: WorkflowTransition = validateStatusTransition(booking, toStatus);

    // Create workflow engine and execute transition
    const workflowEngine = createWorkflowEngine();
    const workflowResult = await workflowEngine.executeTransition(booking, transition, context);

    // Prepare response
    const response: ExecuteWorkflowResponse = {
      success: workflowResult.success,
      workflowResult: {
        updatedBooking: workflowResult.updatedBooking,
        workflowEvent: workflowResult.workflowEvent,
        executionTime: workflowResult.executionTime,
        errors: workflowResult.errors,
        warnings: workflowResult.warnings,
        nextSteps: workflowResult.nextSteps,
        costUsage: workflowResult.costUsage,
      },
      timestamp: new Date().toISOString(),
      executionId: context.executionId,
    };

    // Log workflow execution for monitoring
    console.log(`Workflow execution ${executionId}:`, {
      bookingId,
      transition: `${fromStatus} -> ${toStatus}`,
      success: workflowResult.success,
      executionTime: workflowResult.executionTime,
      costUsage: workflowResult.costUsage,
    });

    // Return appropriate status code
    const statusCode = workflowResult.success ? 200 : 400;
    res.status(statusCode).json(response);
  } catch (error) {
    console.error(`Workflow execution error (${executionId}):`, error);

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
  // In production, this would be a database query
  // For now, return a mock booking for demonstration

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
    booking_status: "Pending",
    payment_status: "Unpaid",
    payment_method: null,
    payment_proof_url: null,
    special_requests: null,
    internal_notes: null,
    created_at: "2024-01-10T10:00:00Z",
    updated_at: "2024-01-10T10:00:00Z",
  };
}

/**
 * Helper function to validate request authentication
 */
function validateAuth(req: VercelRequest): { valid: boolean; userId?: string; resortId?: string } {
  // Extract authorization token from header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false };
  }

  // In production, validate JWT token and extract user/resort info
  // For now, mock validation
  return {
    valid: true,
    userId: "user-123",
    resortId: "resort-okaeri",
  };
}

/**
 * Helper function to log workflow metrics for monitoring
 */
function logWorkflowMetrics(
  executionId: string,
  bookingId: string,
  result: any,
  executionTime: number
): void {
  const metrics = {
    timestamp: new Date().toISOString(),
    executionId,
    bookingId,
    success: result.success,
    executionTime,
    errorCount: result.errors?.length || 0,
    warningCount: result.warnings?.length || 0,
    costUsage: result.costUsage,
  };

  // In production, send to monitoring service (e.g., Datadog, New Relic)
  console.log("Workflow Metrics:", JSON.stringify(metrics));
}
