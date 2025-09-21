/**
 * Serverless API Route: Schedule Workflow Tasks
 *
 * Handles scheduling of automated workflow tasks using Vercel Cron Jobs.
 * Manages task queuing, retry logic, and background processing.
 *
 * Endpoint: POST /api/workflows/schedule
 *
 * @module WorkflowScheduleAPI
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { AutomatedTrigger } from "@/types";
import {
  createWorkflowEngine,
  createWorkflowContext,
  type ScheduledTask,
  type TaskRetryConfig,
} from "@/workflow/engine";

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

interface ScheduleTaskRequest {
  bookingId: string;
  resortId: string;
  trigger: AutomatedTrigger;
  taskType: "status_transition" | "notification" | "reminder" | "validation";
  scheduledTime?: string;
  retryConfig?: Partial<TaskRetryConfig>;
  metadata?: Record<string, any>;
}

interface ScheduleTaskResponse {
  success: boolean;
  task?: ScheduledTask;
  error?: string;
  timestamp: string;
  executionId: string;
}

interface TaskStatusRequest {
  taskId: string;
  resortId: string;
}

interface TaskStatusResponse {
  success: boolean;
  task?: ScheduledTask;
  history?: TaskExecutionHistory[];
  error?: string;
  timestamp: string;
}

interface TaskExecutionHistory {
  executionId: string;
  timestamp: string;
  status: "started" | "completed" | "failed" | "retried";
  result?: any;
  errorMessage?: string;
  executionTime: number;
}

// ============================================
// SERVERLESS FUNCTION HANDLERS
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const startTime = Date.now();

  try {
    switch (req.method) {
      case "POST":
        await handleScheduleTask(req, res);
        break;
      case "GET":
        await handleGetTaskStatus(req, res);
        break;
      case "DELETE":
        await handleCancelTask(req, res);
        break;
      default:
        res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Schedule API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
      executionTime: Date.now() - startTime,
    });
  }
}

/**
 * Handle task scheduling
 */
async function handleScheduleTask(req: VercelRequest, res: VercelResponse): Promise<void> {
  const startTime = Date.now();
  let executionId = "";

  try {
    const {
      bookingId,
      resortId,
      trigger,
      taskType,
      scheduledTime,
      retryConfig = {},
      metadata = {},
    }: ScheduleTaskRequest = req.body;

    if (!bookingId || !resortId || !trigger || !taskType) {
      res.status(400).json({
        error: "Missing required fields: bookingId, resortId, trigger, taskType",
      });
      return;
    }

    // Create workflow context
    const context = createWorkflowContext(resortId);
    context.triggeredBy = "system";
    context.metadata = { ...metadata, apiEndpoint: "/api/workflows/schedule" };
    executionId = context.executionId;

    // Create workflow engine
    const workflowEngine = createWorkflowEngine();

    // Create enhanced trigger with scheduling information
    const enhancedTrigger: AutomatedTrigger = {
      ...trigger,
      nextExecutionTime: scheduledTime ? new Date(scheduledTime) : trigger.nextExecutionTime,
    };

    // Schedule the task
    const scheduledTask = await workflowEngine.scheduleAutomatedTask(enhancedTrigger, context);

    // Apply custom retry configuration
    if (Object.keys(retryConfig).length > 0) {
      scheduledTask.retryConfig = {
        ...scheduledTask.retryConfig,
        ...retryConfig,
      };
    }

    // Store task in persistent storage (in production, this would use a database)
    await storeScheduledTask(scheduledTask);

    // Set up Vercel cron job if needed
    await scheduleVercelCronJob(scheduledTask);

    const response: ScheduleTaskResponse = {
      success: true,
      task: scheduledTask,
      timestamp: new Date().toISOString(),
      executionId,
    };

    console.log(`Task scheduled (${executionId}):`, {
      taskId: scheduledTask.taskId,
      bookingId,
      scheduledTime: scheduledTask.scheduledTime,
      taskType: scheduledTask.taskType,
    });

    res.status(200).json(response);
  } catch (error) {
    console.error(`Task scheduling error (${executionId}):`, error);

    res.status(500).json({
      error: "Failed to schedule task",
      message: error instanceof Error ? error.message : "Unknown error",
      executionId,
      executionTime: Date.now() - startTime,
    });
  }
}

/**
 * Handle task status retrieval
 */
async function handleGetTaskStatus(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const { taskId, resortId } = req.query as TaskStatusRequest;

    if (!taskId || !resortId) {
      res.status(400).json({
        error: "Missing required parameters: taskId, resortId",
      });
      return;
    }

    // Retrieve task from storage
    const task = await getScheduledTask(taskId, resortId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Get task execution history
    const history = await getTaskExecutionHistory(taskId);

    const response: TaskStatusResponse = {
      success: true,
      task,
      history,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Task status retrieval error:", error);

    res.status(500).json({
      error: "Failed to retrieve task status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handle task cancellation
 */
async function handleCancelTask(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const { taskId, resortId } = req.query as TaskStatusRequest;

    if (!taskId || !resortId) {
      res.status(400).json({
        error: "Missing required parameters: taskId, resortId",
      });
      return;
    }

    // Cancel the task
    const success = await cancelScheduledTask(taskId, resortId);

    if (!success) {
      res.status(404).json({ error: "Task not found or already completed" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Task cancelled successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Task cancellation error:", error);

    res.status(500).json({
      error: "Failed to cancel task",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Store scheduled task in persistent storage
 */
async function storeScheduledTask(task: ScheduledTask): Promise<void> {
  // In production, this would store in a database (PostgreSQL, Redis, etc.)
  // For now, use in-memory storage with logging
  console.log("Storing scheduled task:", {
    taskId: task.taskId,
    bookingId: task.bookingId,
    scheduledTime: task.scheduledTime,
    status: task.status,
  });

  // Mock storage - in production, use:
  // await db.scheduledTasks.create(task);
}

/**
 * Retrieve scheduled task from storage
 */
async function getScheduledTask(taskId: string, resortId: string): Promise<ScheduledTask | null> {
  // Mock retrieval - in production, use:
  // return await db.scheduledTasks.findByIdAndResort(taskId, resortId);

  // Return mock task for demonstration
  return {
    taskId,
    bookingId: "BK-001",
    triggerId: "auto_checkin_BK-001",
    scheduledTime: new Date(),
    taskType: "status_transition",
    payload: {
      targetStatus: "CheckedIn",
      triggerType: "date",
      resortId,
    },
    retryConfig: {
      maxRetries: 3,
      retryIntervalMs: 60000,
      backoffMultiplier: 2,
      maxRetryIntervalMs: 600000,
    },
    status: "scheduled",
  };
}

/**
 * Get task execution history
 */
async function getTaskExecutionHistory(taskId: string): Promise<TaskExecutionHistory[]> {
  // Mock history - in production, query from audit/log table
  return [
    {
      executionId: "exec_123",
      timestamp: new Date().toISOString(),
      status: "started",
      executionTime: 0,
    },
  ];
}

/**
 * Cancel scheduled task
 */
async function cancelScheduledTask(taskId: string, resortId: string): Promise<boolean> {
  // In production, update task status to 'cancelled'
  // return await db.scheduledTasks.updateStatus(taskId, 'cancelled', { resortId });

  console.log(`Cancelling task ${taskId} for resort ${resortId}`);
  return true;
}

/**
 * Schedule Vercel cron job for task execution
 */
async function scheduleVercelCronJob(task: ScheduledTask): Promise<void> {
  // In production, this would integrate with Vercel's cron job system
  // For immediate tasks, consider using a job queue like Bull or Agenda

  const scheduledTime = task.scheduledTime;
  const now = new Date();

  if (scheduledTime <= now) {
    // Execute immediately for past/current time
    console.log(`Executing task immediately: ${task.taskId}`);
    await executeTaskImmediately(task);
  } else {
    // Schedule for future execution
    console.log(`Task ${task.taskId} scheduled for ${scheduledTime}`);

    // In production, you might use:
    // - Vercel Cron Jobs (for regular intervals)
    // - External job queue (for specific times)
    // - Database-based scheduling with polling
  }
}

/**
 * Execute task immediately
 */
async function executeTaskImmediately(task: ScheduledTask): Promise<void> {
  try {
    console.log(`Executing task: ${task.taskId}`);

    // Update task status
    await updateTaskStatus(task.taskId, "running");

    // Execute the actual workflow logic
    switch (task.taskType) {
      case "status_transition":
        await executeStatusTransition(task);
        break;
      case "notification":
        await executeNotification(task);
        break;
      case "reminder":
        await executeReminder(task);
        break;
      case "validation":
        await executeValidation(task);
        break;
    }

    // Mark task as completed
    await updateTaskStatus(task.taskId, "completed");
  } catch (error) {
    console.error(`Task execution failed: ${task.taskId}`, error);
    await updateTaskStatus(task.taskId, "failed");

    // Schedule retry if configured
    if (task.retryConfig.maxRetries > 0) {
      await scheduleTaskRetry(task);
    }
  }
}

/**
 * Update task status
 */
async function updateTaskStatus(taskId: string, status: ScheduledTask["status"]): Promise<void> {
  // In production: await db.scheduledTasks.updateStatus(taskId, status);
  console.log(`Task ${taskId} status updated to: ${status}`);
}

/**
 * Execute status transition task
 */
async function executeStatusTransition(task: ScheduledTask): Promise<void> {
  // Import and execute workflow transition
  const { targetStatus } = task.payload;
  console.log(`Executing status transition to ${targetStatus} for booking ${task.bookingId}`);

  // In production, this would call the workflow engine
  // const result = await workflowEngine.executeTransition(booking, transition, context);
}

/**
 * Execute notification task
 */
async function executeNotification(task: ScheduledTask): Promise<void> {
  console.log(`Sending notification for booking ${task.bookingId}`);
  // Implement notification sending logic
}

/**
 * Execute reminder task
 */
async function executeReminder(task: ScheduledTask): Promise<void> {
  console.log(`Sending reminder for booking ${task.bookingId}`);
  // Implement reminder sending logic
}

/**
 * Execute validation task
 */
async function executeValidation(task: ScheduledTask): Promise<void> {
  console.log(`Running validation for booking ${task.bookingId}`);
  // Implement validation logic
}

/**
 * Schedule task retry with exponential backoff
 */
async function scheduleTaskRetry(task: ScheduledTask): Promise<void> {
  const retryCount = 1; // In production, track actual retry count
  const delay = Math.min(
    task.retryConfig.retryIntervalMs * Math.pow(task.retryConfig.backoffMultiplier, retryCount - 1),
    task.retryConfig.maxRetryIntervalMs
  );

  const retryTime = new Date(Date.now() + delay);
  console.log(`Scheduling retry for task ${task.taskId} at ${retryTime}`);

  // Create new scheduled task for retry
  const retryTask: ScheduledTask = {
    ...task,
    taskId: `${task.taskId}_retry_${retryCount}`,
    scheduledTime: retryTime,
    status: "scheduled",
  };

  await storeScheduledTask(retryTask);
}
