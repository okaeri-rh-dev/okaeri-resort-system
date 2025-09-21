/**
 * Vercel Cron Job: Automated Workflow Processor
 *
 * Processes automated workflow triggers on a scheduled basis.
 * Optimized for serverless execution with cost monitoring and batch processing.
 *
 * Schedule: Runs every 15 minutes
 * Endpoint: /api/cron/workflow-processor
 *
 * @module WorkflowCronProcessor
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Booking } from "@/types";
import {
  createWorkflowEngine,
  createWorkflowContext,
  type WorkflowBatchResult,
  type ScheduledTask,
} from "@/workflow/engine";

// ============================================
// CRON JOB CONFIGURATION
// ============================================

interface CronJobConfig {
  maxExecutionTimeMs: number;
  maxBatchSize: number;
  maxCostPerExecution: number;
  enabledResorts: string[];
  processingPriorities: ProcessingPriority[];
}

interface ProcessingPriority {
  triggerType: "date" | "payment" | "time" | "external";
  priority: number; // 1 = highest, 5 = lowest
  maxBatchSize: number;
}

const CRON_CONFIG: CronJobConfig = {
  maxExecutionTimeMs: 50000, // 50 seconds (within Vercel's 60s limit)
  maxBatchSize: 25, // Process max 25 bookings per execution
  maxCostPerExecution: 0.05, // $0.05 per execution limit
  enabledResorts: ["resort-okaeri"], // Add more resorts as needed
  processingPriorities: [
    { triggerType: "date", priority: 1, maxBatchSize: 15 }, // Check-ins/check-outs first
    { triggerType: "payment", priority: 2, maxBatchSize: 10 }, // Payment reminders
    { triggerType: "time", priority: 3, maxBatchSize: 5 }, // Time-based triggers
    { triggerType: "external", priority: 4, maxBatchSize: 5 }, // External integrations
  ],
};

// ============================================
// SERVERLESS CRON HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const startTime = Date.now();
  const executionId = `cron_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  // Validate cron secret to ensure only Vercel can trigger this
  if (!validateCronSecret(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  console.log(`Starting workflow cron processor: ${executionId}`);

  try {
    const results: WorkflowBatchResult[] = [];
    let totalCostUsed = 0;
    let totalBookingsProcessed = 0;

    // Process each enabled resort
    for (const resortId of CRON_CONFIG.enabledResorts) {
      if (Date.now() - startTime > CRON_CONFIG.maxExecutionTimeMs - 10000) {
        console.log(`Time limit approaching, stopping processing for ${resortId}`);
        break;
      }

      if (totalCostUsed >= CRON_CONFIG.maxCostPerExecution) {
        console.log(`Cost limit reached ($${totalCostUsed}), stopping processing`);
        break;
      }

      try {
        const resortResult = await processResortWorkflows(resortId, executionId);
        results.push(resortResult);
        totalCostUsed += resortResult.totalCostUsage.actualCostUSD;
        totalBookingsProcessed += resortResult.processedCount;
      } catch (error) {
        console.error(`Error processing resort ${resortId}:`, error);
      }
    }

    // Process scheduled tasks
    const scheduledTasksResult = await processScheduledTasks(executionId);

    // Generate execution summary
    const summary = {
      executionId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      resortsProcessed: CRON_CONFIG.enabledResorts.length,
      totalBookingsProcessed,
      totalCostUsed,
      scheduledTasksProcessed: scheduledTasksResult.processedCount,
      results,
    };

    console.log(`Workflow cron processor completed: ${executionId}`, summary);

    // Store execution metrics for monitoring
    await storeExecutionMetrics(summary);

    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error(`Workflow cron processor error: ${executionId}`, error);

    res.status(500).json({
      error: "Cron job execution failed",
      executionId,
      message: error instanceof Error ? error.message : "Unknown error",
      executionTime: Date.now() - startTime,
    });
  }
}

// ============================================
// WORKFLOW PROCESSING FUNCTIONS
// ============================================

/**
 * Process workflows for a specific resort
 */
async function processResortWorkflows(
  resortId: string,
  executionId: string
): Promise<WorkflowBatchResult> {
  console.log(`Processing workflows for resort: ${resortId}`);

  // Create workflow context
  const context = createWorkflowContext(resortId);
  context.triggeredBy = "automation";
  context.metadata = {
    cronJob: true,
    executionId,
    resortId,
  };

  // Fetch bookings that need processing
  const bookings = await fetchBookingsForAutomatedProcessing(resortId);

  if (bookings.length === 0) {
    console.log(`No bookings need processing for resort: ${resortId}`);
    return {
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
      totalExecutionTime: 0,
      totalCostUsage: {
        executionTimeMs: 0,
        memoryUsedMB: 0,
        databaseQueries: 0,
        apiCalls: 0,
        actualCostUSD: 0,
      },
      nextScheduledTasks: [],
    };
  }

  // Prioritize bookings based on urgency
  const prioritizedBookings = prioritizeBookings(bookings);

  // Limit batch size based on configuration
  const limitedBookings = prioritizedBookings.slice(0, CRON_CONFIG.maxBatchSize);

  console.log(`Processing ${limitedBookings.length} bookings for resort ${resortId}`);

  // Create workflow engine and process batch
  const workflowEngine = createWorkflowEngine();
  const batchResult = await workflowEngine.processAutomatedTriggers(limitedBookings, context);

  return batchResult;
}

/**
 * Process scheduled tasks that are due for execution
 */
async function processScheduledTasks(executionId: string): Promise<{ processedCount: number }> {
  console.log(`Processing scheduled tasks for execution: ${executionId}`);

  // Fetch tasks due for execution
  const dueTasks = await fetchDueScheduledTasks();

  let processedCount = 0;

  for (const task of dueTasks) {
    try {
      await executeScheduledTask(task);
      processedCount++;
    } catch (error) {
      console.error(`Failed to execute scheduled task ${task.taskId}:`, error);
      await handleTaskExecutionFailure(task, error);
    }
  }

  console.log(`Processed ${processedCount} scheduled tasks`);
  return { processedCount };
}

/**
 * Execute a single scheduled task
 */
async function executeScheduledTask(task: ScheduledTask): Promise<void> {
  console.log(`Executing scheduled task: ${task.taskId}`);

  // Update task status to running
  await updateTaskStatus(task.taskId, "running");

  switch (task.taskType) {
    case "status_transition":
      await executeStatusTransitionTask(task);
      break;
    case "notification":
      await executeNotificationTask(task);
      break;
    case "reminder":
      await executeReminderTask(task);
      break;
    case "validation":
      await executeValidationTask(task);
      break;
    default:
      throw new Error(`Unknown task type: ${task.taskType}`);
  }

  // Mark task as completed
  await updateTaskStatus(task.taskId, "completed");
}

/**
 * Execute status transition task
 */
async function executeStatusTransitionTask(task: ScheduledTask): Promise<void> {
  const { targetStatus, resortId } = task.payload;

  // Fetch booking
  const booking = await fetchBooking(task.bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${task.bookingId}`);
  }

  // Skip if booking is already in target status
  if (booking.booking_status === targetStatus) {
    console.log(`Booking ${task.bookingId} already in status ${targetStatus}, skipping`);
    return;
  }

  // Create workflow context and execute transition
  const context = createWorkflowContext(resortId);
  context.triggeredBy = "automation";
  context.metadata = {
    scheduledTaskId: task.taskId,
    triggerId: task.triggerId,
  };

  // Import workflow validation
  const { validateStatusTransition } = await import("@/utils/booking-workflow");
  const transition = validateStatusTransition(booking, targetStatus);

  if (!transition.canProceed) {
    throw new Error(
      `Cannot transition booking ${task.bookingId} from ${booking.booking_status} to ${targetStatus}`
    );
  }

  // Execute transition using workflow engine
  const workflowEngine = createWorkflowEngine();
  const result = await workflowEngine.executeTransition(booking, transition, context);

  if (!result.success) {
    throw new Error(`Transition failed: ${result.errors.map((e) => e.message).join(", ")}`);
  }

  console.log(`Successfully transitioned booking ${task.bookingId} to ${targetStatus}`);
}

/**
 * Execute notification task
 */
async function executeNotificationTask(task: ScheduledTask): Promise<void> {
  const { notificationType, templateId, recipientEmail } = task.payload;

  // Mock notification sending - in production, integrate with email service
  console.log(
    `Sending ${notificationType} notification to ${recipientEmail} using template ${templateId}`
  );

  // Simulate email sending delay
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Execute reminder task
 */
async function executeReminderTask(task: ScheduledTask): Promise<void> {
  const { reminderType, bookingId } = task.payload;

  console.log(`Sending ${reminderType} reminder for booking ${bookingId}`);

  // In production, this would:
  // 1. Fetch booking details
  // 2. Generate personalized reminder content
  // 3. Send via configured channels (email, SMS, push)
  // 4. Track delivery status
}

/**
 * Execute validation task
 */
async function executeValidationTask(task: ScheduledTask): Promise<void> {
  const { validationType, bookingId } = task.payload;

  console.log(`Running ${validationType} validation for booking ${bookingId}`);

  // In production, this might validate:
  // - Payment status consistency
  // - Booking date conflicts
  // - Business rule compliance
  // - External system synchronization
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate cron secret for security
 */
function validateCronSecret(req: VercelRequest): boolean {
  const cronSecret = req.headers["x-vercel-cron-secret"] as string;
  const expectedSecret = process.env.VERCEL_CRON_SECRET;

  if (!expectedSecret) {
    console.warn("VERCEL_CRON_SECRET environment variable not set");
    // In development, allow execution without secret
    return process.env.NODE_ENV === "development";
  }

  return cronSecret === expectedSecret;
}

/**
 * Fetch bookings that need automated processing
 */
async function fetchBookingsForAutomatedProcessing(resortId: string): Promise<Booking[]> {
  // In production, this would query the database for bookings with pending automated triggers
  // For now, return mock data based on current time

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Mock bookings that might need processing
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
      check_in: today + "T14:00:00Z", // Check-in today
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
      check_out: today + "T11:00:00Z", // Check-out today
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

  return mockBookings;
}

/**
 * Fetch scheduled tasks that are due for execution
 */
async function fetchDueScheduledTasks(): Promise<ScheduledTask[]> {
  // In production, query database for tasks where scheduledTime <= now AND status = 'scheduled'
  // For now, return mock tasks

  const now = new Date();

  return [
    {
      taskId: "task_001",
      bookingId: "BK-003",
      triggerId: "reminder_payment_BK-003",
      scheduledTime: new Date(now.getTime() - 60000), // 1 minute ago
      taskType: "reminder",
      payload: {
        reminderType: "payment",
        bookingId: "BK-003",
        recipientEmail: "guest@example.com",
      },
      retryConfig: {
        maxRetries: 3,
        retryIntervalMs: 300000, // 5 minutes
        backoffMultiplier: 2,
        maxRetryIntervalMs: 1800000, // 30 minutes
      },
      status: "scheduled",
    },
  ];
}

/**
 * Prioritize bookings based on urgency and business rules
 */
function prioritizeBookings(bookings: Booking[]): Booking[] {
  return bookings.sort((a, b) => {
    const now = new Date();

    // Priority 1: Check-ins happening today (highest priority)
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

    // Priority 3: Overdue check-ins (past scheduled time)
    const aCheckinTime = new Date(a.check_in);
    const bCheckinTime = new Date(b.check_in);
    const aOverdue = aCheckinTime < now && a.booking_status === "Confirmed";
    const bOverdue = bCheckinTime < now && b.booking_status === "Confirmed";
    if (aOverdue !== bOverdue) {
      return aOverdue ? -1 : 1;
    }

    // Priority 4: Overdue check-outs
    const aCheckoutTime = new Date(a.check_out);
    const bCheckoutTime = new Date(b.check_out);
    const aCheckoutOverdue = aCheckoutTime < now && a.booking_status === "CheckedIn";
    const bCheckoutOverdue = bCheckoutTime < now && b.booking_status === "CheckedIn";
    if (aCheckoutOverdue !== bCheckoutOverdue) {
      return aCheckoutOverdue ? -1 : 1;
    }

    // Priority 5: Earlier dates first
    return aCheckinTime.getTime() - bCheckinTime.getTime();
  });
}

/**
 * Check if a date is today
 */
function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Fetch booking by ID
 */
async function fetchBooking(bookingId: string): Promise<Booking | null> {
  // Mock booking retrieval - in production, query database
  if (bookingId === "BK-003") {
    return {
      booking_id: "BK-003",
      booking_reference: "BK-003",
      unit_id: "unit-1",
      guest_id: "guest-3",
      guest_name: "Bob Johnson",
      contact_number: "+639111222333",
      email: "bob@example.com",
      num_guests: 3,
      check_in: "2024-01-15T14:00:00Z",
      check_out: "2024-01-17T11:00:00Z",
      total_amount: 6000,
      booking_status: "Pending",
      payment_status: "Unpaid",
      payment_method: null,
      payment_proof_url: null,
      special_requests: null,
      internal_notes: null,
      created_at: "2024-01-12T10:00:00Z",
      updated_at: "2024-01-12T10:00:00Z",
    };
  }
  return null;
}

/**
 * Update task status in storage
 */
async function updateTaskStatus(taskId: string, status: ScheduledTask["status"]): Promise<void> {
  // In production: await db.scheduledTasks.updateStatus(taskId, status);
  console.log(`Task ${taskId} status updated to: ${status}`);
}

/**
 * Handle task execution failure
 */
async function handleTaskExecutionFailure(task: ScheduledTask, error: any): Promise<void> {
  console.error(`Task execution failed: ${task.taskId}`, error);

  // Update task status to failed
  await updateTaskStatus(task.taskId, "failed");

  // Schedule retry if retries remaining
  // In production, implement retry logic with exponential backoff
  console.log(`Scheduling retry for task: ${task.taskId}`);
}

/**
 * Store execution metrics for monitoring
 */
async function storeExecutionMetrics(summary: any): Promise<void> {
  // In production, store metrics in database or send to monitoring service
  console.log("Storing execution metrics:", {
    executionId: summary.executionId,
    executionTime: summary.executionTimeMs,
    bookingsProcessed: summary.totalBookingsProcessed,
    costUsed: summary.totalCostUsed,
  });

  // Could integrate with:
  // - Database metrics table
  // - Vercel Analytics
  // - External monitoring (Datadog, New Relic)
  // - Cost tracking service
}
