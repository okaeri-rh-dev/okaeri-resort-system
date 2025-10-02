export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      bookings: {
        Row: {
          booking_id: string;
          booking_reference: string;
          booking_status: string | null;
          check_in: string;
          check_out: string;
          contact_number: string;
          created_at: string | null;
          email: string;
          guest_id: string | null;
          guest_name: string;
          internal_notes: string | null;
          num_guests: number;
          payment_method: string | null;
          payment_proof_url: string | null;
          payment_status: string | null;
          special_requests: string | null;
          total_amount: number;
          unit_id: string;
          updated_at: string | null;
        };
        Insert: {
          booking_id?: string;
          booking_reference: string;
          booking_status?: string | null;
          check_in: string;
          check_out: string;
          contact_number: string;
          created_at?: string | null;
          email: string;
          guest_id?: string | null;
          guest_name: string;
          internal_notes?: string | null;
          num_guests: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          special_requests?: string | null;
          total_amount: number;
          unit_id: string;
          updated_at?: string | null;
        };
        Update: {
          booking_id?: string;
          booking_reference?: string;
          booking_status?: string | null;
          check_in?: string;
          check_out?: string;
          contact_number?: string;
          created_at?: string | null;
          email?: string;
          guest_id?: string | null;
          guest_name?: string;
          internal_notes?: string | null;
          num_guests?: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          special_requests?: string | null;
          total_amount?: number;
          unit_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["guest_id"];
          },
          {
            foreignKeyName: "bookings_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string | null;
          description: string;
          expense_date: string;
          expense_id: string;
          notes: string | null;
          receipt_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string | null;
          description: string;
          expense_date: string;
          expense_id?: string;
          notes?: string | null;
          receipt_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string | null;
          description?: string;
          expense_date?: string;
          expense_id?: string;
          notes?: string | null;
          receipt_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      guests: {
        Row: {
          created_at: string | null;
          email: string;
          guest_id: string;
          guest_name: string;
          phone_number: string;
          total_bookings: number | null;
          total_spent: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          guest_id?: string;
          guest_name: string;
          phone_number: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          guest_id?: string;
          guest_name?: string;
          phone_number?: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      maintenance_logs: {
        Row: {
          cost: number | null;
          created_at: string | null;
          issue_description: string;
          log_id: string;
          notes: string | null;
          priority: string | null;
          reported_date: string | null;
          resolved_date: string | null;
          status: string | null;
          unit_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          cost?: number | null;
          created_at?: string | null;
          issue_description: string;
          log_id?: string;
          notes?: string | null;
          priority?: string | null;
          reported_date?: string | null;
          resolved_date?: string | null;
          status?: string | null;
          unit_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          cost?: number | null;
          created_at?: string | null;
          issue_description?: string;
          log_id?: string;
          notes?: string | null;
          priority?: string | null;
          reported_date?: string | null;
          resolved_date?: string | null;
          status?: string | null;
          unit_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          booking_id: string | null;
          created_at: string | null;
          notes: string | null;
          payment_date: string | null;
          payment_id: string;
          payment_method: string | null;
          proof_url: string | null;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          created_at?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_id?: string;
          payment_method?: string | null;
          proof_url?: string | null;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          created_at?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_id?: string;
          payment_method?: string | null;
          proof_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["booking_id"];
          },
        ];
      };
      units: {
        Row: {
          amenities: Json | null;
          base_occupancy: number;
          base_rate: number;
          created_at: string | null;
          extra_person_rate: number;
          max_occupancy: number;
          unit_code: string;
          unit_id: string;
          unit_name: string;
          unit_status: string | null;
          unit_type: string;
          updated_at: string | null;
          weekend_rate: number;
        };
        Insert: {
          amenities?: Json | null;
          base_occupancy: number;
          base_rate: number;
          created_at?: string | null;
          extra_person_rate: number;
          max_occupancy: number;
          unit_code: string;
          unit_id?: string;
          unit_name: string;
          unit_status?: string | null;
          unit_type: string;
          updated_at?: string | null;
          weekend_rate: number;
        };
        Update: {
          amenities?: Json | null;
          base_occupancy?: number;
          base_rate?: number;
          created_at?: string | null;
          extra_person_rate?: number;
          max_occupancy?: number;
          unit_code?: string;
          unit_id?: string;
          unit_name?: string;
          unit_status?: string | null;
          unit_type?: string;
          updated_at?: string | null;
          weekend_rate?: number;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          audit_id: string;
          correlation_id: string | null;
          table_name: string;
          record_id: string | null;
          record_pk: Json | null;
          action: "INSERT" | "UPDATE" | "DELETE";
          event_type: string | null;
          source: "db" | "app";
          user_id: string | null;
          user_email: string | null;
          user_role: string | null;
          old_data: Json | null;
          new_data: Json | null;
          changed_fields: string[] | null;
          description: string | null;
          category: string | null;
          severity: "INFO" | "WARNING" | "CRITICAL" | "DEBUG" | null;
          metadata: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          audit_id?: string;
          correlation_id?: string | null;
          table_name: string;
          record_id?: string | null;
          record_pk?: Json | null;
          action: "INSERT" | "UPDATE" | "DELETE";
          event_type?: string | null;
          source?: "db" | "app";
          user_id?: string | null;
          user_email?: string | null;
          user_role?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          changed_fields?: string[] | null;
          description?: string | null;
          category?: string | null;
          severity?: "INFO" | "WARNING" | "CRITICAL" | "DEBUG" | null;
          metadata?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          audit_id?: string;
          correlation_id?: string | null;
          table_name?: string;
          record_id?: string | null;
          record_pk?: Json | null;
          action?: "INSERT" | "UPDATE" | "DELETE";
          event_type?: string | null;
          source?: "db" | "app";
          user_id?: string | null;
          user_email?: string | null;
          user_role?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          changed_fields?: string[] | null;
          description?: string | null;
          category?: string | null;
          severity?: "INFO" | "WARNING" | "CRITICAL" | "DEBUG" | null;
          metadata?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      app_roles: {
        Row: {
          user_id: string;
          email: string;
          role: "admin" | "owner" | "manager" | "staff";
          granted_by: string | null;
          granted_at: string;
          is_active: boolean;
          notes: string | null;
        };
        Insert: {
          user_id: string;
          email: string;
          role: "admin" | "owner" | "manager" | "staff";
          granted_by?: string | null;
          granted_at?: string;
          is_active?: boolean;
          notes?: string | null;
        };
        Update: {
          user_id?: string;
          email?: string;
          role?: "admin" | "owner" | "manager" | "staff";
          granted_by?: string | null;
          granted_at?: string;
          is_active?: boolean;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "app_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_booking_reference: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      archive_audit_logs: {
        Args: {
          cutoff_date: string;
        };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;

// ============================================
// AUDIT TRAIL TYPES (Phase 2)
// ============================================

/**
 * Audit log action types
 * Maps to PostgreSQL audit trigger actions
 */
export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

/**
 * Application-level audit categories
 * Used for higher-level business context (Layer 2)
 */
export enum AuditCategory {
  AUTHENTICATION = "authentication",
  BOOKING = "booking",
  PAYMENT = "payment",
  GUEST = "guest",
  UNIT = "unit",
  EXPENSE = "expense",
  MAINTENANCE = "maintenance",
  SYSTEM = "system",
}

/**
 * Severity levels for audit events
 * Helps prioritize which logs to review
 * NOTE: MUST be uppercase to match database CHECK constraint
 */
export enum AuditSeverity {
  INFO = "INFO", // Normal operations (booking created, unit updated)
  WARNING = "WARNING", // Unusual but valid (booking cancelled, payment refund)
  CRITICAL = "CRITICAL", // Requires attention (deletion, security event)
  DEBUG = "DEBUG", // Verbose debugging information
}

/**
 * Business event types for application-level audit logs
 * Used when source='app' to provide semantic meaning beyond CRUD operations
 * NULL for database trigger logs (source='db')
 */
export enum AuditEventType {
  // Authentication events
  LOGIN = "login",
  LOGOUT = "logout",
  LOGIN_FAILED = "login_failed",
  PASSWORD_RESET = "password_reset",

  // Booking events
  CANCEL_BOOKING = "cancel_booking",
  BOOKING_CHECKED_IN = "booking_checked_in",
  BOOKING_CHECKED_OUT = "booking_checked_out",
  BOOKING_STATUS_OVERRIDE = "booking_status_override",

  // Payment events
  REFUND_PAYMENT = "refund_payment",
  PAYMENT_FAILED = "payment_failed",
  PAYMENT_VERIFIED = "payment_verified",

  // System events
  SYSTEM_MIGRATION = "system_migration",
  SYSTEM_CONFIG_CHANGE = "system_config_change",
  SYSTEM_BACKUP = "system_backup",

  // Expense events
  EXPENSE_DELETED = "expense_deleted",
  EXPENSE_CATEGORY_CHANGED = "expense_category_changed",
}

/**
 * Display names for event types (for UI)
 */
export const EVENT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  // Authentication
  [AuditEventType.LOGIN]: "User Login",
  [AuditEventType.LOGOUT]: "User Logout",
  [AuditEventType.LOGIN_FAILED]: "Failed Login Attempt",
  [AuditEventType.PASSWORD_RESET]: "Password Reset",

  // Bookings
  [AuditEventType.CANCEL_BOOKING]: "Booking Cancelled",
  [AuditEventType.BOOKING_CHECKED_IN]: "Guest Checked In",
  [AuditEventType.BOOKING_CHECKED_OUT]: "Guest Checked Out",
  [AuditEventType.BOOKING_STATUS_OVERRIDE]: "Booking Status Override",

  // Payments
  [AuditEventType.REFUND_PAYMENT]: "Payment Refunded",
  [AuditEventType.PAYMENT_FAILED]: "Payment Failed",
  [AuditEventType.PAYMENT_VERIFIED]: "Payment Verified",

  // System
  [AuditEventType.SYSTEM_MIGRATION]: "System Migration",
  [AuditEventType.SYSTEM_CONFIG_CHANGE]: "Configuration Change",
  [AuditEventType.SYSTEM_BACKUP]: "System Backup",

  // Expenses
  [AuditEventType.EXPENSE_DELETED]: "Expense Deleted",
  [AuditEventType.EXPENSE_CATEGORY_CHANGED]: "Expense Category Changed",
};

/**
 * Audit log record (matches database schema exactly)
 * All fields align with audit_logs table columns
 */
export interface AuditLog {
  audit_id: string; // UUID primary key
  correlation_id: string | null; // UUID for linking related log entries across layers
  table_name: string; // Table affected (bookings, units, system, authentication, etc)
  record_id: string | null; // TEXT type identifier (supports UUID and non-UUID PKs)
  record_pk: Json | null; // Composite primary key as JSON
  action: AuditAction; // INSERT, UPDATE, DELETE
  event_type: string | null; // Business event type for app events (e.g., 'login', 'cancel_booking')
  source: "db" | "app"; // Layer 1 (db triggers) or Layer 2 (app logging)

  // User context (from Supabase Auth)
  user_id: string | null; // Supabase Auth user ID
  user_email: string | null; // User email for display
  user_role: string | null; // User role at time of action (owner/manager/staff)

  // Data capture (Layer 1: triggers)
  old_data: Json | null; // JSONB before state
  new_data: Json | null; // JSONB after state
  changed_fields: string[] | null; // Array of field names changed (UPDATE only)

  // Business context (Layer 2: app logging)
  description: string | null; // Human-readable description
  category: string | null; // Business category (authentication, booking, etc)
  severity: "INFO" | "WARNING" | "CRITICAL" | "DEBUG" | null; // Severity level (UPPERCASE)
  metadata: Json | null; // Additional structured context

  // Client context (Layer 2: optional)
  ip_address: string | null; // Client IP address (often NULL from browser)
  user_agent: string | null; // Browser user agent string

  // Timing
  created_at: string; // ISO 8601 timestamp (CRITICAL: use created_at, NOT timestamp)
}

/**
 * Filter options for querying audit logs
 */
export interface AuditLogFilters {
  // Date range
  startDate?: string; // ISO 8601 date
  endDate?: string; // ISO 8601 date

  // Entity filters
  userEmail?: string; // Filter by specific user
  userId?: string; // Filter by Supabase Auth ID
  tableName?: string; // Filter by table (bookings, units, etc)
  recordId?: string; // Filter by specific record UUID
  correlationId?: string; // Filter by correlation ID (find all related logs)
  action?: AuditAction; // Filter by operation type
  source?: "db" | "app"; // Filter by source (database triggers vs app logging)

  // Business context (Layer 2 logging)
  eventType?: string; // Filter by business event type (e.g., 'login', 'cancel_booking')
  category?: AuditCategory; // Filter by business category
  severity?: AuditSeverity; // Filter by severity level

  // Pagination
  limit?: number; // Records per page (default 50)
  offset?: number; // Skip N records (for pagination)
}

/**
 * Query result with pagination metadata
 */
export interface AuditLogQueryResult {
  data: AuditLog[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

/**
 * Statistics aggregation result
 */
export interface AuditLogStats {
  totalLogs: number;
  byTable: Record<string, number>; // { bookings: 150, units: 30, ... }
  byAction: Record<AuditAction, number>; // { INSERT: 100, UPDATE: 80, DELETE: 5 }
  byUser: Array<{ email: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>; // Last 7 days
}

/**
 * Context for creating audit logs from application
 * Used with logAuditEvent() function (Layer 2)
 *
 * IMPORTANT: Layer 2 logs always use action='INSERT' and source='app' internally.
 * Do NOT include an 'action' field in this context - it's set automatically.
 *
 * For semantic action meaning, use:
 * - eventType: Business event type (e.g., AuditEventType.CANCEL_BOOKING)
 * - description: Human-readable action (e.g., "Booking cancelled by guest")
 * - metadata.action: Additional action context if needed
 */
export interface AuditEventContext {
  tableName: string;
  recordId?: string;
  recordPk?: Json; // Composite primary key support (for future use)
  correlationId?: string; // UUID to link this log with related trigger logs
  eventType?: AuditEventType; // Optional: semantic business event type (e.g., AuditEventType.CANCEL_BOOKING)
  description: string; // Human-readable description (e.g., "Booking cancelled by guest")
  category: AuditCategory;
  severity?: AuditSeverity; // Default: INFO
  metadata?: Json; // Business-specific data
  oldData?: Json; // Optional: before state
  newData?: Json; // Optional: after state
}

/**
 * Export format options
 */
export type AuditExportFormat = "csv" | "json";

export interface AuditExportOptions {
  format: AuditExportFormat;
  filters?: AuditLogFilters;
  includeMetadata?: boolean; // Include JSONB fields in export
  filename?: string; // Custom filename (default: audit-logs-{date}.csv)
}
