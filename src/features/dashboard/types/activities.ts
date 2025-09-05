// Dashboard Activity Feed Type Definitions
// Phase 2.1 - RED Phase: Activity stream and event types for Okaeri Resort

import { PhilippineCurrency, PaymentMethod } from "./metrics";

/**
 * Base activity event with common properties
 */
export interface BaseActivity {
  readonly id: string;
  readonly projectId: string; // Multi-tenant isolation
  readonly timestamp: Date;
  readonly actorId: string; // User or system that performed the action
  readonly actorName: string;
  readonly actorType: "user" | "guest" | "system" | "integration";
  readonly category: ActivityCategory;
  readonly priority: "low" | "medium" | "high" | "critical";
  readonly status: "completed" | "pending" | "failed" | "cancelled";
}

/**
 * Activity categories for filtering and organization
 */
export type ActivityCategory =
  | "booking"
  | "financial"
  | "operational"
  | "maintenance"
  | "guest_service"
  | "system"
  | "compliance"
  | "emergency";

/**
 * Booking-related activities
 */
export interface BookingActivity extends BaseActivity {
  category: "booking";
  type:
    | "booking_created"
    | "booking_modified"
    | "booking_cancelled"
    | "check_in"
    | "check_out"
    | "no_show"
    | "early_departure"
    | "room_change"
    | "guest_request";

  details: {
    bookingId: string; // Format: BK-2024-001
    guestName: string;
    roomNumber?: string;
    dateRange: {
      checkIn: Date;
      checkOut: Date;
    };
    totalAmount?: PhilippineCurrency;
    specialRequests?: string[];
    source: "direct" | "booking_com" | "agoda" | "airbnb" | "walk_in";
  };

  // Metadata for display
  displayText: string; // e.g., "Juan Dela Cruz checked into Room 203"
  icon: string; // Icon identifier for UI
  color: "blue" | "green" | "yellow" | "red"; // Status color
}

/**
 * Financial activities including payments and expenses
 */
export interface FinancialActivity extends BaseActivity {
  category: "financial";
  type:
    | "payment_received"
    | "refund_issued"
    | "expense_logged"
    | "invoice_generated"
    | "tax_calculated"
    | "budget_exceeded"
    | "revenue_milestone";

  details: {
    transactionId?: string;
    amount: PhilippineCurrency;
    paymentMethod?: PaymentMethod;
    relatedBookingId?: string;
    vatAmount?: PhilippineCurrency; // 12% VAT for Philippines
    description: string;
    receiptNumber?: string;
    birReference?: string; // BIR tax reference if applicable
  };

  displayText: string;
  icon: string;
  color: "green" | "yellow" | "red";
}

/**
 * Operational activities (housekeeping, maintenance, etc.)
 */
export interface OperationalActivity extends BaseActivity {
  category: "operational";
  type:
    | "room_cleaned"
    | "maintenance_completed"
    | "supply_restocked"
    | "staff_shift_change"
    | "security_check"
    | "inventory_update"
    | "vendor_delivery";

  details: {
    roomNumber?: string;
    taskDescription: string;
    assignedStaff: string[];
    estimatedDuration?: number; // Minutes
    actualDuration?: number; // Minutes
    completionNotes?: string;
    qualityCheck: {
      passed: boolean;
      inspector?: string;
      score?: number; // 1-5
      issues?: string[];
    };
  };

  displayText: string;
  icon: string;
  color: "blue" | "green" | "yellow";
}

/**
 * Guest service activities and interactions
 */
export interface GuestServiceActivity extends BaseActivity {
  category: "guest_service";
  type:
    | "complaint_logged"
    | "complaint_resolved"
    | "service_request"
    | "feedback_received"
    | "concierge_service"
    | "room_service"
    | "amenity_request";

  details: {
    guestId: string;
    guestName: string;
    roomNumber: string;
    requestType: string;
    description: string;
    urgency: "low" | "medium" | "high" | "urgent";
    resolution?: string;
    satisfactionRating?: 1 | 2 | 3 | 4 | 5;
    followUpRequired: boolean;
  };

  displayText: string;
  icon: string;
  color: "blue" | "yellow" | "red";
}

/**
 * System and automation activities
 */
export interface SystemActivity extends BaseActivity {
  category: "system";
  type:
    | "backup_completed"
    | "system_update"
    | "integration_sync"
    | "alert_triggered"
    | "performance_warning"
    | "security_event"
    | "data_export";

  details: {
    systemComponent?: string;
    alertType?: "info" | "warning" | "error" | "critical";
    affectedRecords?: number;
    automaticResolution?: boolean;
    userActionRequired?: boolean;
    technicalDetails?: string;
  };

  displayText: string;
  icon: string;
  color: "gray" | "yellow" | "red";
}

/**
 * Compliance and regulatory activities (Philippine context)
 */
export interface ComplianceActivity extends BaseActivity {
  category: "compliance";
  type:
    | "bir_filing_due"
    | "dti_renewal"
    | "doh_inspection"
    | "fire_safety_check"
    | "data_privacy_audit"
    | "occupancy_tax_payment"
    | "license_renewal";

  details: {
    regulatoryBody: "BIR" | "DTI" | "DOH" | "BFP" | "NPC" | "LGU";
    filingType?: string;
    dueDate: Date;
    status: "upcoming" | "due" | "overdue" | "completed";
    penaltyRisk?: PhilippineCurrency;
    documentsRequired?: string[];
    contactPerson?: string;
  };

  displayText: string;
  icon: string;
  color: "yellow" | "red";
}

/**
 * Emergency and critical activities
 */
export interface EmergencyActivity extends BaseActivity {
  category: "emergency";
  priority: "critical"; // Always critical
  type:
    | "medical_emergency"
    | "fire_alarm"
    | "security_breach"
    | "natural_disaster"
    | "power_outage"
    | "system_failure"
    | "guest_incident";

  details: {
    location: string;
    description: string;
    firstResponders: string[];
    guestsEvacuated?: number;
    authoritiesNotified: boolean;
    incidentReport?: string;
    followUpActions: string[];
    resolution: string;
    legalImplications?: string;
  };

  displayText: string;
  icon: string;
  color: "red";
}

/**
 * Union type for all activity types
 */
export type DashboardActivity =
  | BookingActivity
  | FinancialActivity
  | OperationalActivity
  | GuestServiceActivity
  | SystemActivity
  | ComplianceActivity
  | EmergencyActivity;

/**
 * Activity feed configuration and filtering
 */
export interface ActivityFeedConfig {
  // Filtering options
  categories: ActivityCategory[];
  priorities: ("low" | "medium" | "high" | "critical")[];
  dateRange: {
    start: Date;
    end: Date;
  };
  maxItems: number;
  autoRefresh: boolean;
  refreshInterval: number; // Seconds

  // Display options
  showTimestamps: boolean;
  groupByDate: boolean;
  showAvatars: boolean;
  compactMode: boolean;

  // Real-time options
  enableNotifications: boolean;
  soundEnabled: boolean;
  pushNotifications: boolean;
}

/**
 * Activity feed state for UI management
 */
export interface ActivityFeedState {
  activities: DashboardActivity[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  lastFetchTime: Date | null;
  unreadCount: number;
  filters: ActivityFeedConfig;
  selectedActivity: string | null; // For detail view
}

/**
 * Real-time activity event for WebSocket
 */
export interface ActivityEvent {
  type: "activity_created" | "activity_updated" | "activity_deleted";
  projectId: string;
  activity: DashboardActivity;
  timestamp: Date;
}

/**
 * Activity metrics for dashboard summary
 */
export interface ActivityMetrics {
  totalToday: number;
  byCategory: Record<ActivityCategory, number>;
  byPriority: Record<"low" | "medium" | "high" | "critical", number>;
  pendingActions: number;
  overdueTasks: number;
  averageResolutionTime: number; // Hours

  // Trend data
  trends: {
    period: "hour" | "day" | "week";
    data: {
      timestamp: Date;
      count: number;
      category: ActivityCategory;
    }[];
  };
}

/**
 * Activity search and filtering
 */
export interface ActivitySearchParams {
  query?: string; // Text search in descriptions
  categories?: ActivityCategory[];
  priorities?: ("low" | "medium" | "high" | "critical")[];
  actorId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: ("completed" | "pending" | "failed" | "cancelled")[];
  limit?: number;
  offset?: number;
  sortBy?: "timestamp" | "priority" | "category";
  sortOrder?: "asc" | "desc";
}

/**
 * Activity notification preferences
 */
export interface ActivityNotificationSettings {
  enabled: boolean;
  categories: ActivityCategory[];
  priorities: ("medium" | "high" | "critical")[];
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string; // HH:MM format
  };
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean; // For Philippine mobile numbers
    push: boolean;
  };
}
