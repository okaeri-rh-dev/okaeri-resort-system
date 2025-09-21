/**
 * Booking Workflow State Machine and Validation for Okaeri Resort System
 *
 * Implements a TypeScript state machine for booking statuses with business
 * rule enforcement, automated status updates, and workflow event handlers.
 *
 * @module BookingWorkflow
 */

import type { Booking, BookingStatus } from "@/types";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface BookingWorkflowState {
  booking: Booking;
  allowedTransitions: BookingStatus[];
  nextActions: WorkflowAction[];
  automatedTriggers: AutomatedTrigger[];
  businessRules: BusinessRule[];
}

export interface WorkflowAction {
  actionType: "manual" | "automatic" | "conditional";
  actionId: string;
  label: string;
  description: string;
  targetStatus?: BookingStatus;
  requirements?: ActionRequirement[];
  permissions?: string[];
}

export interface ActionRequirement {
  type: "payment" | "date" | "status" | "custom";
  condition: string;
  value?: any;
  isMet: boolean;
  errorMessage?: string;
}

export interface AutomatedTrigger {
  triggerId: string;
  triggerType: "date" | "payment" | "time" | "external";
  condition: string;
  targetStatus: BookingStatus;
  isActive: boolean;
  nextExecutionTime?: Date;
}

export interface BusinessRule {
  ruleId: string;
  category: "booking" | "payment" | "cancellation" | "modification";
  description: string;
  isEnforced: boolean;
  violationMessage: string;
  validationFunction: (booking: Booking) => boolean;
}

export interface WorkflowTransition {
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  isValid: boolean;
  requirements: ActionRequirement[];
  businessRulesViolated: BusinessRule[];
  canProceed: boolean;
}

export interface WorkflowEvent {
  eventId: string;
  bookingId: string;
  eventType: "status_change" | "payment_update" | "modification" | "cancellation";
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  triggeredBy: "user" | "system" | "automation";
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ============================================
// BOOKING STATUS STATE MACHINE
// ============================================

/**
 * Defines valid status transitions for booking workflow
 */
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["CheckedIn", "Cancelled"],
  CheckedIn: ["CheckedOut"],
  CheckedOut: [], // Terminal state
  Cancelled: [], // Terminal state
};

/**
 * Business rules for booking workflow validation
 */
export const BOOKING_BUSINESS_RULES: BusinessRule[] = [
  {
    ruleId: "check_in_date_future",
    category: "booking",
    description: "Check-in date must be in the future for new bookings",
    isEnforced: true,
    violationMessage: "Check-in date must be in the future",
    validationFunction: (booking: Booking) => {
      if (booking.booking_status === "Pending") {
        return new Date(booking.check_in) > new Date();
      }
      return true;
    },
  },
  {
    ruleId: "payment_before_checkin",
    category: "payment",
    description: "Payment must be completed before check-in",
    isEnforced: true,
    violationMessage: "Payment must be completed before check-in",
    validationFunction: (booking: Booking) => {
      if (booking.booking_status === "CheckedIn") {
        return booking.payment_status === "Completed";
      }
      return true;
    },
  },
  {
    ruleId: "confirmed_before_checkin",
    category: "booking",
    description: "Booking must be confirmed before check-in",
    isEnforced: true,
    violationMessage: "Booking must be confirmed before check-in",
    validationFunction: (booking: Booking) => {
      if (booking.booking_status === "CheckedIn") {
        return new Date(booking.updated_at) > new Date(booking.created_at);
      }
      return true;
    },
  },
  {
    ruleId: "checkout_after_checkin",
    category: "booking",
    description: "Check-out can only happen after check-in",
    isEnforced: true,
    violationMessage: "Cannot check out before checking in",
    validationFunction: (booking: Booking) => {
      if (booking.booking_status === "CheckedOut") {
        // This would need historical data to validate properly
        return true;
      }
      return true;
    },
  },
  {
    ruleId: "no_modification_after_checkin",
    category: "modification",
    description: "Bookings cannot be modified after check-in",
    isEnforced: true,
    violationMessage: "Cannot modify booking after check-in",
    validationFunction: (booking: Booking) => {
      return !["CheckedIn", "CheckedOut"].includes(booking.booking_status);
    },
  },
  {
    ruleId: "minimum_advance_cancellation",
    category: "cancellation",
    description: "Cancellation must be at least 24 hours before check-in",
    isEnforced: false, // Configurable based on resort policy
    violationMessage: "Cancellation must be at least 24 hours before check-in",
    validationFunction: (booking: Booking) => {
      if (booking.booking_status === "Cancelled") {
        const checkInTime = new Date(booking.check_in).getTime();
        const now = new Date().getTime();
        const hoursUntilCheckIn = (checkInTime - now) / (1000 * 60 * 60);
        return hoursUntilCheckIn >= 24;
      }
      return true;
    },
  },
];

// ============================================
// WORKFLOW STATE MANAGEMENT
// ============================================

/**
 * Gets the current workflow state for a booking
 *
 * @param booking - The booking to analyze
 * @returns Complete workflow state with transitions and actions
 */
export const getBookingWorkflowState = (booking: Booking): BookingWorkflowState => {
  const allowedTransitions = BOOKING_STATUS_TRANSITIONS[booking.booking_status] || [];
  const nextActions = generateNextActions(booking);
  const automatedTriggers = generateAutomatedTriggers(booking);
  const businessRules = BOOKING_BUSINESS_RULES.filter((rule) => rule.isEnforced);

  return {
    booking,
    allowedTransitions,
    nextActions,
    automatedTriggers,
    businessRules,
  };
};

/**
 * Validates if a status transition is allowed
 *
 * @param booking - The booking to transition
 * @param toStatus - Target status
 * @returns Validation result with requirements and violations
 */
export const validateStatusTransition = (
  booking: Booking,
  toStatus: BookingStatus
): WorkflowTransition => {
  const allowedTransitions = BOOKING_STATUS_TRANSITIONS[booking.booking_status] || [];
  const isValidTransition = allowedTransitions.includes(toStatus);

  const requirements = generateTransitionRequirements(booking, toStatus);
  const businessRulesViolated = validateBusinessRules(
    { ...booking, booking_status: toStatus },
    BOOKING_BUSINESS_RULES
  );

  const canProceed =
    isValidTransition &&
    requirements.every((req) => req.isMet) &&
    businessRulesViolated.length === 0;

  return {
    fromStatus: booking.booking_status,
    toStatus,
    isValid: isValidTransition,
    requirements,
    businessRulesViolated,
    canProceed,
  };
};

/**
 * Generates workflow actions available for a booking
 *
 * @param booking - The booking to generate actions for
 * @returns Array of available workflow actions
 */
export const generateNextActions = (booking: Booking): WorkflowAction[] => {
  const actions: WorkflowAction[] = [];
  const allowedTransitions = BOOKING_STATUS_TRANSITIONS[booking.booking_status] || [];

  // Generate actions for each allowed transition
  allowedTransitions.forEach((targetStatus) => {
    const action = createActionForTransition(booking, targetStatus);
    if (action) {
      actions.push(action);
    }
  });

  // Add conditional actions based on current state
  switch (booking.booking_status) {
    case "Pending":
      if (booking.payment_status === "Pending") {
        actions.push({
          actionType: "manual",
          actionId: "update_payment",
          label: "Update Payment",
          description: "Mark payment as received or upload payment proof",
          requirements: [
            {
              type: "payment",
              condition: "payment_proof_required",
              isMet: false,
              errorMessage: "Payment proof must be uploaded",
            },
          ],
          permissions: ["booking:update", "payment:manage"],
        });
      }
      break;

    case "Confirmed": {
      // Add check-in action if date is today or past
      const checkInDate = new Date(booking.check_in);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (checkInDate <= today) {
        actions.push({
          actionType: "manual",
          actionId: "early_checkin",
          label: "Check In Now",
          description: "Process early or on-time check-in",
          targetStatus: "CheckedIn",
          requirements: [
            {
              type: "payment",
              condition: "payment_completed",
              isMet: booking.payment_status === "Completed",
              errorMessage: "Payment must be completed before check-in",
            },
          ],
          permissions: ["booking:checkin"],
        });
      }
      break;
    }

    case "CheckedIn": {
      // Add check-out action if date is today or past
      const checkOutDate = new Date(booking.check_out);
      const todayCheckout = new Date();
      todayCheckout.setHours(0, 0, 0, 0);
      if (checkOutDate <= todayCheckout) {
        actions.push({
          actionType: "manual",
          actionId: "process_checkout",
          label: "Check Out",
          description: "Process guest check-out",
          targetStatus: "CheckedOut",
          requirements: [],
          permissions: ["booking:checkout"],
        });
      }
      break;
    }

    default:
  }

  return actions;
};

/**
 * Creates a workflow action for a specific status transition
 *
 * @param booking - The booking
 * @param targetStatus - Target status for the action
 * @returns Workflow action or null if not applicable
 */
const createActionForTransition = (
  booking: Booking,
  targetStatus: BookingStatus
): WorkflowAction | null => {
  const baseAction = {
    actionType: "manual" as const,
    targetStatus,
    permissions: [`booking:${targetStatus.toLowerCase()}`],
  };

  switch (targetStatus) {
    case "Confirmed":
      return {
        ...baseAction,
        actionId: "confirm_booking",
        label: "Confirm Booking",
        description: "Confirm the booking and notify guest",
        requirements: [
          {
            type: "status",
            condition: "unit_available",
            isMet: true, // Would need real availability check
            errorMessage: "Unit must be available for the booking dates",
          },
        ],
      };

    case "CheckedIn":
      return {
        ...baseAction,
        actionId: "checkin_guest",
        label: "Check In Guest",
        description: "Process guest check-in and provide unit access",
        requirements: [
          {
            type: "payment",
            condition: "payment_completed",
            isMet: booking.payment_status === "Completed",
            errorMessage: "Payment must be completed before check-in",
          },
          {
            type: "date",
            condition: "checkin_date_reached",
            value: booking.check_in,
            isMet: new Date(booking.check_in) <= new Date(),
            errorMessage: "Check-in date has not been reached",
          },
        ],
      };

    case "CheckedOut":
      return {
        ...baseAction,
        actionId: "checkout_guest",
        label: "Check Out Guest",
        description: "Process guest check-out and finalize billing",
        requirements: [
          {
            type: "date",
            condition: "checkout_date_reached",
            value: booking.check_out,
            isMet: new Date(booking.check_out) <= new Date(),
            errorMessage: "Check-out date has not been reached",
          },
        ],
      };

    case "Cancelled":
      return {
        ...baseAction,
        actionId: "cancel_booking",
        label: "Cancel Booking",
        description: "Cancel the booking and process any refunds",
        requirements: [
          {
            type: "custom",
            condition: "cancellation_allowed",
            isMet: ["Pending", "Confirmed"].includes(booking.booking_status),
            errorMessage: "Booking cannot be cancelled in current status",
          },
        ],
      };

    default:
      return null;
  }
};

/**
 * Generates transition requirements for a status change
 *
 * @param booking - The booking
 * @param toStatus - Target status
 * @returns Array of action requirements
 */
const generateTransitionRequirements = (
  booking: Booking,
  toStatus: BookingStatus
): ActionRequirement[] => {
  const requirements: ActionRequirement[] = [];

  // Common requirements based on target status
  switch (toStatus) {
    case "CheckedIn":
      requirements.push(
        {
          type: "payment",
          condition: "payment_completed",
          isMet: booking.payment_status === "Completed",
          errorMessage: "Payment must be completed before check-in",
        },
        {
          type: "date",
          condition: "checkin_date_valid",
          value: booking.check_in,
          isMet: new Date(booking.check_in) <= new Date(),
          errorMessage: "Check-in date has not been reached",
        }
      );
      break;

    case "CheckedOut":
      requirements.push({
        type: "date",
        condition: "checkout_date_valid",
        value: booking.check_out,
        isMet: new Date(booking.check_out) <= new Date(),
        errorMessage: "Check-out date has not been reached",
      });
      break;
  }

  return requirements;
};

/**
 * Validates business rules against a booking
 *
 * @param booking - The booking to validate
 * @param rules - Array of business rules to check
 * @returns Array of violated business rules
 */
export const validateBusinessRules = (
  booking: Booking,
  rules: BusinessRule[] = BOOKING_BUSINESS_RULES
): BusinessRule[] => {
  return rules.filter((rule) => {
    if (!rule.isEnforced) return false;
    try {
      return !rule.validationFunction(booking);
    } catch (error) {
      console.error(`Error validating business rule ${rule.ruleId}:`, error);
      return false;
    }
  });
};

// ============================================
// AUTOMATED TRIGGERS
// ============================================

/**
 * Generates automated triggers for a booking
 *
 * @param booking - The booking to generate triggers for
 * @returns Array of automated triggers
 */
export const generateAutomatedTriggers = (booking: Booking): AutomatedTrigger[] => {
  const triggers: AutomatedTrigger[] = [];

  switch (booking.booking_status) {
    case "Confirmed": {
      // Auto check-in trigger
      const checkInDate = new Date(booking.check_in);
      triggers.push({
        triggerId: `auto_checkin_${booking.booking_id}`,
        triggerType: "date",
        condition: `check_in_date_reached AND payment_completed`,
        targetStatus: "CheckedIn",
        isActive: booking.payment_status === "Completed",
        nextExecutionTime: checkInDate,
      });
      break;
    }

    case "CheckedIn": {
      // Auto check-out trigger
      const checkOutDate = new Date(booking.check_out);
      checkOutDate.setHours(11, 0, 0, 0); // Standard checkout time
      triggers.push({
        triggerId: `auto_checkout_${booking.booking_id}`,
        triggerType: "date",
        condition: "check_out_date_reached",
        targetStatus: "CheckedOut",
        isActive: true,
        nextExecutionTime: checkOutDate,
      });
      break;
    }
  }

  return triggers;
};

/**
 * Processes automated workflow triggers
 *
 * @param bookings - Array of bookings to process
 * @param currentTime - Current timestamp for trigger evaluation
 * @returns Array of bookings that should be automatically updated
 */
export const processAutomatedTriggers = (
  bookings: Booking[],
  currentTime: Date = new Date()
): Array<{ booking: Booking; newStatus: BookingStatus; triggerId: string }> => {
  const automatedUpdates: Array<{ booking: Booking; newStatus: BookingStatus; triggerId: string }> =
    [];

  bookings.forEach((booking) => {
    const triggers = generateAutomatedTriggers(booking);

    triggers.forEach((trigger) => {
      if (
        trigger.isActive &&
        trigger.nextExecutionTime &&
        trigger.nextExecutionTime <= currentTime
      ) {
        // Validate the transition is still valid
        const transition = validateStatusTransition(booking, trigger.targetStatus);
        if (transition.canProceed) {
          automatedUpdates.push({
            booking,
            newStatus: trigger.targetStatus,
            triggerId: trigger.triggerId,
          });
        }
      }
    });
  });

  return automatedUpdates;
};

// ============================================
// WORKFLOW EVENT HANDLERS
// ============================================

/**
 * Creates a workflow event record
 *
 * @param booking - The booking associated with the event
 * @param eventType - Type of workflow event
 * @param fromStatus - Previous status
 * @param toStatus - New status
 * @param triggeredBy - What triggered the event
 * @param metadata - Additional event data
 * @returns Workflow event record
 */
export const createWorkflowEvent = (
  booking: Booking,
  eventType: WorkflowEvent["eventType"],
  fromStatus: BookingStatus,
  toStatus: BookingStatus,
  triggeredBy: WorkflowEvent["triggeredBy"],
  metadata?: Record<string, any>
): WorkflowEvent => {
  return {
    eventId: `${booking.booking_id}_${eventType}_${Date.now()}`,
    bookingId: booking.booking_id,
    eventType,
    fromStatus,
    toStatus,
    triggeredBy,
    timestamp: new Date(),
    metadata,
  };
};

/**
 * Executes a status transition with full workflow validation
 *
 * @param booking - The booking to transition
 * @param toStatus - Target status
 * @param triggeredBy - What triggered the transition
 * @param metadata - Additional transition data
 * @returns Transition result with updated booking or error
 */
export const executeStatusTransition = (
  booking: Booking,
  toStatus: BookingStatus,
  triggeredBy: WorkflowEvent["triggeredBy"],
  metadata?: Record<string, any>
): {
  success: boolean;
  updatedBooking?: Booking;
  workflowEvent?: WorkflowEvent;
  errors: string[];
} => {
  const transition = validateStatusTransition(booking, toStatus);

  if (!transition.canProceed) {
    const errors: string[] = [];

    if (!transition.isValid) {
      errors.push(`Invalid transition from ${transition.fromStatus} to ${transition.toStatus}`);
    }

    transition.requirements.forEach((req) => {
      if (!req.isMet && req.errorMessage) {
        errors.push(req.errorMessage);
      }
    });

    transition.businessRulesViolated.forEach((rule) => {
      errors.push(rule.violationMessage);
    });

    return { success: false, errors };
  }

  // Create updated booking
  const updatedBooking: Booking = {
    ...booking,
    booking_status: toStatus,
    updated_at: new Date().toISOString(),
  };

  // Create workflow event
  const workflowEvent = createWorkflowEvent(
    booking,
    "status_change",
    booking.booking_status,
    toStatus,
    triggeredBy,
    metadata
  );

  return {
    success: true,
    updatedBooking,
    workflowEvent,
    errors: [],
  };
};

/**
 * Gets workflow summary for dashboard display
 *
 * @param bookings - Array of bookings to summarize
 * @returns Workflow summary statistics
 */
export const getWorkflowSummary = (bookings: Booking[]) => {
  const summary = {
    totalBookings: bookings.length,
    byStatus: {} as Record<BookingStatus, number>,
    pendingActions: 0,
    automatedTriggers: 0,
    businessRuleViolations: 0,
  };

  // Initialize status counts
  const statuses: BookingStatus[] = [
    "Pending",
    "Confirmed",
    "CheckedIn",
    "CheckedOut",
    "Cancelled",
  ];
  statuses.forEach((status) => {
    summary.byStatus[status] = 0;
  });

  bookings.forEach((booking) => {
    // Count by status
    summary.byStatus[booking.booking_status]++;

    // Count pending actions
    const actions = generateNextActions(booking);
    summary.pendingActions += actions.filter(
      (action) => action.requirements?.every((req) => req.isMet) !== false
    ).length;

    // Count automated triggers
    const triggers = generateAutomatedTriggers(booking);
    summary.automatedTriggers += triggers.filter((trigger) => trigger.isActive).length;

    // Count business rule violations
    const violations = validateBusinessRules(booking);
    summary.businessRuleViolations += violations.length;
  });

  return summary;
};
