/**
 * DEFERRED TO PHASE 3-4: Workflow Configuration System
 *
 * This module provides centralized configuration management for business rules,
 * automation settings, and workflow customization for multi-tenant resort operations.
 *
 * For Phase 2, we're using simple status updates without complex configuration.
 * This advanced system will be re-enabled when the business needs justify
 * the additional complexity.
 *
 * @module WorkflowConfig
 * @phase 3-4
 */

/* TODO: Phase 3-4 - Re-enable workflow configuration when needed

import type {
  BusinessRule,
  AutomationSettings,
  NotificationSettings,
  CostLimits,
  CustomWorkflow,
  ResortWorkflowConfig
} from '@/workflow/engine';
import type { BookingStatus, Booking } from '@/types';

// Original workflow configuration code has been preserved here
// for Phase 3-4 implementation. For now, using simple status
// management in useBookingStore.ts

*/ // End of Phase 3-4 deferred code

// Phase 2: Simple exports to avoid breaking imports
export const DEFAULT_WORKFLOW_CONFIG = {};
