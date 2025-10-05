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
      app_roles: {
        Row: {
          email: string;
          granted_at: string;
          granted_by: string | null;
          is_active: boolean;
          notes: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          email: string;
          granted_at?: string;
          granted_by?: string | null;
          is_active?: boolean;
          notes?: string | null;
          role: string;
          user_id: string;
        };
        Update: {
          email?: string;
          granted_at?: string;
          granted_by?: string | null;
          is_active?: boolean;
          notes?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          audit_id: string;
          category: string | null;
          changed_fields: string[] | null;
          correlation_id: string | null;
          created_at: string | null;
          description: string | null;
          event_type: string | null;
          ip_address: unknown | null;
          metadata: Json | null;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string | null;
          record_pk: Json | null;
          severity: string | null;
          source: string;
          table_name: string;
          user_agent: string | null;
          user_email: string | null;
          user_id: string | null;
          user_role: string | null;
        };
        Insert: {
          action: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown | null;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Update: {
          action?: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown | null;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name?: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Relationships: [];
      };
      audit_logs_archive: {
        Row: {
          action: string;
          audit_id: string;
          category: string | null;
          changed_fields: string[] | null;
          correlation_id: string | null;
          created_at: string | null;
          description: string | null;
          event_type: string | null;
          ip_address: unknown | null;
          metadata: Json | null;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string | null;
          record_pk: Json | null;
          severity: string | null;
          source: string;
          table_name: string;
          user_agent: string | null;
          user_email: string | null;
          user_id: string | null;
          user_role: string | null;
        };
        Insert: {
          action: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown | null;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Update: {
          action?: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown | null;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name?: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Relationships: [];
      };
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
    };
    Views: {
      audit_archive_stats: {
        Row: {
          log_count: number | null;
          newest_log: string | null;
          oldest_log: string | null;
          status: string | null;
          total_size: string | null;
        };
        Relationships: [];
      };
      audit_index_stats: {
        Row: {
          index_size: string | null;
          indexname: unknown | null;
          rows_fetched: number | null;
          rows_read: number | null;
          schemaname: unknown | null;
          tablename: unknown | null;
          times_used: number | null;
        };
        Relationships: [];
      };
      audit_system_status: {
        Row: {
          component: string | null;
          count: number | null;
          details: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      archive_audit_logs: {
        Args: { cutoff_date: string; dry_run?: boolean };
        Returns: {
          archived_count: number;
          newest_archived: string;
          oldest_archived: string;
          tables_affected: string[];
        }[];
      };
      archive_logs_older_than_months: {
        Args: { dry_run?: boolean; months_old: number };
        Returns: {
          archived_count: number;
          newest_archived: string;
          oldest_archived: string;
          tables_affected: string[];
        }[];
      };
      attach_audit_trigger: {
        Args: { target_table: string };
        Returns: undefined;
      };
      can_view_all_audit_logs: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      detach_audit_trigger: {
        Args: { target_table: string };
        Returns: undefined;
      };
      generate_booking_reference: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_current_audit_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      grant_audit_role: {
        Args: {
          grant_notes?: string;
          target_email: string;
          target_role: string;
          target_user_id: string;
        };
        Returns: undefined;
      };
      is_admin: {
        Args: { check_user_id: string };
        Returns: boolean;
      };
      is_admin_or_owner: {
        Args: { check_user_id: string };
        Returns: boolean;
      };
      is_audit_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_audit_manager: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_audit_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_manager: {
        Args: { check_user_id: string };
        Returns: boolean;
      };
      monthly_archive_until: {
        Args: { dry_run?: boolean; final_cutoff_date: string };
        Returns: {
          logs_archived: number;
          month_archived: string;
        }[];
      };
      restore_logs_from_archive: {
        Args: { end_date: string; start_date: string };
        Returns: number;
      };
      revoke_audit_role: {
        Args: { target_user_id: string };
        Returns: undefined;
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

// ============================================
// AUDIT TRAIL TYPE EXPORTS
// ============================================

// Type aliases for audit trail system
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];
export type AuditLogUpdate = Database["public"]["Tables"]["audit_logs"]["Update"];

// Audit action type - based on database CHECK constraint
export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

// Audit categories enum
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

// Audit severity levels
export enum AuditSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
  DEBUG = "DEBUG",
}

// Audit event types for application-level logging
export enum AuditEventType {
  // Authentication events
  LOGIN = "login",
  LOGOUT = "logout",
  LOGIN_FAILED = "login_failed",
  PASSWORD_RESET = "password_reset",

  // Booking events
  BOOKING_CREATED = "booking_created",
  BOOKING_UPDATED = "booking_updated",
  BOOKING_CANCELLED = "booking_cancelled",
  CANCEL_BOOKING = "cancel_booking", // Alias for BOOKING_CANCELLED
  CHECK_IN = "check_in",
  CHECK_OUT = "check_out",
  BOOKING_CHECKED_IN = "booking_checked_in", // Alias for CHECK_IN
  BOOKING_CHECKED_OUT = "booking_checked_out", // Alias for CHECK_OUT
  BOOKING_STATUS_OVERRIDE = "booking_status_override",

  // Payment events
  PAYMENT_RECORDED = "payment_recorded",
  PAYMENT_VERIFIED = "payment_verified",
  PAYMENT_REFUNDED = "payment_refunded",
  REFUND_PAYMENT = "refund_payment", // Alias for PAYMENT_REFUNDED
  PAYMENT_FAILED = "payment_failed",

  // Expense events
  EXPENSE_CREATED = "expense_created",
  EXPENSE_UPDATED = "expense_updated",
  EXPENSE_DELETED = "expense_deleted",
  EXPENSE_CATEGORY_CHANGED = "expense_category_changed",

  // System events
  MIGRATION_RUN = "migration_run",
  SYSTEM_MIGRATION = "system_migration", // Alias for MIGRATION_RUN
  BACKUP_CREATED = "backup_created",
  SYSTEM_BACKUP = "system_backup", // Alias for BACKUP_CREATED
  SYSTEM_CONFIG_CHANGE = "system_config_change",
  ROLE_ASSIGNED = "role_assigned",
  ROLE_REVOKED = "role_revoked",
}

// Display names for event types
export const EVENT_TYPE_DISPLAY_NAMES: Record<AuditEventType, string> = {
  [AuditEventType.LOGIN]: "User Login",
  [AuditEventType.LOGOUT]: "User Logout",
  [AuditEventType.LOGIN_FAILED]: "Failed Login",
  [AuditEventType.PASSWORD_RESET]: "Password Reset",
  [AuditEventType.BOOKING_CREATED]: "Booking Created",
  [AuditEventType.BOOKING_UPDATED]: "Booking Updated",
  [AuditEventType.BOOKING_CANCELLED]: "Booking Cancelled",
  [AuditEventType.CANCEL_BOOKING]: "Cancel Booking",
  [AuditEventType.CHECK_IN]: "Guest Check-in",
  [AuditEventType.CHECK_OUT]: "Guest Check-out",
  [AuditEventType.BOOKING_CHECKED_IN]: "Booking Checked In",
  [AuditEventType.BOOKING_CHECKED_OUT]: "Booking Checked Out",
  [AuditEventType.BOOKING_STATUS_OVERRIDE]: "Booking Status Override",
  [AuditEventType.PAYMENT_RECORDED]: "Payment Recorded",
  [AuditEventType.PAYMENT_VERIFIED]: "Payment Verified",
  [AuditEventType.PAYMENT_REFUNDED]: "Payment Refunded",
  [AuditEventType.REFUND_PAYMENT]: "Refund Payment",
  [AuditEventType.PAYMENT_FAILED]: "Payment Failed",
  [AuditEventType.EXPENSE_CREATED]: "Expense Created",
  [AuditEventType.EXPENSE_UPDATED]: "Expense Updated",
  [AuditEventType.EXPENSE_DELETED]: "Expense Deleted",
  [AuditEventType.EXPENSE_CATEGORY_CHANGED]: "Expense Category Changed",
  [AuditEventType.MIGRATION_RUN]: "Database Migration",
  [AuditEventType.SYSTEM_MIGRATION]: "System Migration",
  [AuditEventType.BACKUP_CREATED]: "Backup Created",
  [AuditEventType.SYSTEM_BACKUP]: "System Backup",
  [AuditEventType.SYSTEM_CONFIG_CHANGE]: "System Configuration Change",
  [AuditEventType.ROLE_ASSIGNED]: "Role Assigned",
  [AuditEventType.ROLE_REVOKED]: "Role Revoked",
};

// Filter types for audit queries
export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  userEmail?: string;
  userId?: string;
  tableName?: string;
  recordId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  severity?: AuditSeverity;
  eventType?: AuditEventType;
  source?: "db" | "app"; // Layer 1 (db) or Layer 2 (app) logs
  limit?: number;
  offset?: number;
}

// Query result types
export interface AuditLogQueryResult {
  data: AuditLog[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

// Statistics types
export interface AuditLogStats {
  totalLogs: number;
  byTable: Record<string, number>;
  byAction: Record<AuditAction, number>;
  byUser: Array<{ email: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
}

// Event context for creating audit logs
export interface AuditEventContext {
  tableName: string;
  recordId?: string;
  action?: AuditAction;
  eventType?: AuditEventType;
  description?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
