import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import type { AuditLogFilters, AuditEventContext } from "@/types/audit.types";

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Please check your .env.local file.");
}

// Re-export Database type for backwards compatibility
export type { Database } from "@/types/database.types";

// Create Supabase client with proper typing
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Type for PostgrestError from Supabase
interface PostgrestError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: PostgrestError | Error | unknown): string => {
  // Type guard for PostgrestError
  if (error && typeof error === "object" && "message" in error) {
    const postgrestError = error as PostgrestError;

    // Handle specific Supabase error codes
    if (postgrestError.code === "23505") {
      return "This record already exists. Please check for duplicates.";
    }
    if (postgrestError.code === "23503") {
      return "Cannot perform this operation due to related records.";
    }
    if (postgrestError.code === "23514") {
      return "Invalid data provided. Please check your input.";
    }
    return postgrestError.message;
  }
  return "An unexpected error occurred. Please try again.";
};

// Export typed helper functions for common operations
export const db = {
  units: {
    all: () => supabase.from("units").select("*"),
    byId: (id: string) => supabase.from("units").select("*").eq("unit_id", id).single(),
    create: (data: Database["public"]["Tables"]["units"]["Insert"]) =>
      supabase.from("units").insert(data).select().single(),
    update: (id: string, data: Database["public"]["Tables"]["units"]["Update"]) =>
      supabase.from("units").update(data).eq("unit_id", id).select().single(),
    delete: (id: string) => supabase.from("units").delete().eq("unit_id", id),
    available: () => supabase.from("units").select("*").eq("unit_status", "Available"),
  },

  bookings: {
    all: () =>
      supabase.from("bookings").select(`
      *,
      unit:units(*),
      guest:guests(*)
    `),
    byId: (id: string) =>
      supabase
        .from("bookings")
        .select(
          `
      *,
      unit:units(*),
      guest:guests(*)
    `
        )
        .eq("booking_id", id)
        .single(),
    byUnit: (unitId: string) => supabase.from("bookings").select("*").eq("unit_id", unitId),
    byGuest: (guestId: string) => supabase.from("bookings").select("*").eq("guest_id", guestId),
    create: async (
      data: Omit<Database["public"]["Tables"]["bookings"]["Insert"], "booking_reference">
    ) => {
      // Generate booking reference
      const { data: reference } = await supabase.rpc("generate_booking_reference");
      return supabase
        .from("bookings")
        .insert({
          ...data,
          booking_reference: reference || `BK-${Date.now()}`,
        })
        .select()
        .single();
    },
    update: (id: string, data: Database["public"]["Tables"]["bookings"]["Update"]) =>
      supabase.from("bookings").update(data).eq("booking_id", id).select().single(),
    cancel: (id: string) =>
      supabase.from("bookings").update({ booking_status: "Cancelled" }).eq("booking_id", id),
    checkAvailability: (unitId: string, checkIn: string, checkOut: string) =>
      supabase
        .from("bookings")
        .select("booking_id")
        .eq("unit_id", unitId)
        .not("booking_status", "eq", "Cancelled")
        .or(`check_in.lte.${checkOut},check_out.gte.${checkIn}`),

    // Enhanced availability methods using optimized functions
    checkAvailabilityFast: (
      unitId: string,
      checkIn: string,
      checkOut: string,
      excludeBookingId?: string
    ) =>
      supabase.rpc("check_unit_availability_fast", {
        p_unit_id: unitId,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_exclude_booking_id: excludeBookingId ?? undefined,
      }),

    checkMultiUnitAvailability: (
      checkIn: string,
      checkOut: string,
      options: {
        unitTypes?: string[];
        minOccupancy?: number;
        maxRate?: number;
        limit?: number;
      } = {}
    ) =>
      supabase.rpc("check_multi_unit_availability", {
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_unit_types: options.unitTypes ?? undefined,
        p_min_occupancy: options.minOccupancy ?? undefined,
        p_max_rate: options.maxRate ?? undefined,
        p_limit: options.limit || 50,
      }),

    getAvailabilityCalendar: (unitId: string, startDate: string, endDate: string) =>
      supabase.rpc("get_unit_availability_calendar", {
        p_unit_id: unitId,
        p_start_date: startDate,
        p_end_date: endDate,
      }),
  },

  guests: {
    all: () => supabase.from("guests").select("*"),
    byId: (id: string) => supabase.from("guests").select("*").eq("guest_id", id).single(),
    byEmail: (email: string) => supabase.from("guests").select("*").eq("email", email).single(),
    create: (data: Database["public"]["Tables"]["guests"]["Insert"]) =>
      supabase
        .from("guests")
        .insert({ ...data, total_bookings: 0, total_spent: 0 })
        .select()
        .single(),
    update: (id: string, data: Database["public"]["Tables"]["guests"]["Update"]) =>
      supabase.from("guests").update(data).eq("guest_id", id).select().single(),
    withBookings: (id: string) =>
      supabase
        .from("guests")
        .select(
          `
      *,
      bookings(*)
    `
        )
        .eq("guest_id", id)
        .single(),
  },

  payments: {
    all: () => supabase.from("payments").select("*"),
    byBooking: (bookingId: string) =>
      supabase.from("payments").select("*").eq("booking_id", bookingId),
    create: (data: Database["public"]["Tables"]["payments"]["Insert"]) =>
      supabase.from("payments").insert(data).select().single(),
  },

  // Blackout period management
  blackouts: {
    all: () => supabase.from("availability_blackouts").select("*"),
    byUnit: (unitId: string) =>
      supabase.from("availability_blackouts").select("*").eq("unit_id", unitId),
    create: (data: Database["public"]["Tables"]["availability_blackouts"]["Insert"]) =>
      supabase.from("availability_blackouts").insert(data).select().single(),
    update: (id: string, data: Database["public"]["Tables"]["availability_blackouts"]["Update"]) =>
      supabase.from("availability_blackouts").update(data).eq("blackout_id", id).select().single(),
    delete: (id: string) => supabase.from("availability_blackouts").delete().eq("blackout_id", id),
    inDateRange: (startDate: string, endDate: string) =>
      supabase
        .from("availability_blackouts")
        .select("*")
        .gte("end_date", startDate)
        .lte("start_date", endDate),
  },

  // Cache management
  cache: {
    refresh: (unitId?: string, daysAhead?: number) =>
      supabase.rpc("refresh_availability_cache", {
        p_unit_id: unitId ?? undefined,
        p_days_ahead: daysAhead || 90,
      }),
    metrics: async () => {
      // Calculate metrics from existing availability_cache table
      const { data, error } = await supabase.from("availability_cache").select("*");
      if (error) throw error;

      const totalEntries = data?.length || 0;
      const validEntries =
        data?.filter((entry) => new Date(entry.cache_expires_at) > new Date()).length || 0;
      const hitRatio = totalEntries > 0 ? (validEntries / totalEntries) * 100 : 0;

      return {
        data: {
          total_cache_entries: totalEntries,
          valid_cache_entries: validEntries,
          cache_hit_ratio_percent: Math.round(hitRatio * 100) / 100,
        },
        error: null,
      };
    },
    clear: (unitId?: string) =>
      unitId
        ? supabase.from("availability_cache").delete().eq("unit_id", unitId)
        : supabase
            .from("availability_cache")
            .delete()
            .lt("cache_expires_at", new Date().toISOString()),
  },

  // App Roles - User role management for audit trail access control
  appRoles: {
    /**
     * Get all app roles
     * @returns Promise with all app roles
     */
    all: () => supabase.from("app_roles").select("*"),

    /**
     * Get a specific user's role
     * @param userId - UUID of user
     * @returns Promise with user's role or null
     */
    byUserId: (userId: string) =>
      supabase.from("app_roles").select("*").eq("user_id", userId).eq("is_active", true).single(),

    /**
     * Get all users with a specific role
     * @param role - Role to filter by
     * @returns Promise with users having the specified role
     */
    byRole: (role: "admin" | "owner" | "manager" | "staff") =>
      supabase.from("app_roles").select("*").eq("role", role).eq("is_active", true),

    /**
     * Get all active roles
     * @returns Promise with all active roles
     */
    active: () => supabase.from("app_roles").select("*").eq("is_active", true),

    /**
     * Grant a role to a user
     * @param data - Role assignment data
     * @returns Promise with created role assignment
     */
    create: (data: Database["public"]["Tables"]["app_roles"]["Insert"]) =>
      supabase.from("app_roles").insert(data).select().single(),

    /**
     * Update a user's role
     * @param userId - UUID of user whose role to update
     * @param data - Updated role data
     * @returns Promise with updated role
     */
    update: (userId: string, data: Database["public"]["Tables"]["app_roles"]["Update"]) =>
      supabase.from("app_roles").update(data).eq("user_id", userId).select().single(),

    /**
     * Revoke a user's role (hard delete)
     * @param userId - UUID of user whose role to revoke
     * @returns Promise with deletion result
     */
    delete: (userId: string) => supabase.from("app_roles").delete().eq("user_id", userId),

    /**
     * Deactivate a user's role (soft delete)
     * @param userId - UUID of user whose role to deactivate
     * @returns Promise with updated role
     */
    deactivate: (userId: string) =>
      supabase
        .from("app_roles")
        .update({ is_active: false })
        .eq("user_id", userId)
        .select()
        .single(),

    /**
     * Reactivate a user's role
     * @param userId - UUID of user whose role to reactivate
     * @returns Promise with updated role
     */
    reactivate: (userId: string) =>
      supabase
        .from("app_roles")
        .update({ is_active: true })
        .eq("user_id", userId)
        .select()
        .single(),

    /**
     * Count users by role
     * @returns Promise with role counts
     */
    countByRole: async () => {
      const { data, error } = await supabase.from("app_roles").select("role").eq("is_active", true);

      if (error) return { data: null, error };

      const counts = data?.reduce(
        (acc, { role }) => {
          acc[role] = (acc[role] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return { data: counts, error: null };
    },
  },

  // Audit Logs - Query and manage audit trail data
  auditLogs: {
    /**
     * Get all audit logs (with optional filters)
     * @param filters - Optional filter criteria
     * @returns Promise with audit logs and metadata
     */
    all: async (filters?: AuditLogFilters) => {
      let query = supabase.from("audit_logs").select("*", { count: "exact" });

      // Apply filters
      if (filters) {
        if (filters.startDate) {
          query = query.gte("created_at", filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte("created_at", filters.endDate);
        }
        if (filters.userEmail) {
          query = query.eq("user_email", filters.userEmail);
        }
        if (filters.userId) {
          query = query.eq("user_id", filters.userId);
        }
        if (filters.tableName) {
          query = query.eq("table_name", filters.tableName);
        }
        if (filters.recordId) {
          query = query.eq("record_id", filters.recordId);
        }
        if (filters.correlationId) {
          query = query.eq("correlation_id", filters.correlationId);
        }
        if (filters.action) {
          query = query.eq("action", filters.action);
        }
        if (filters.source) {
          query = query.eq("source", filters.source);
        }
        if (filters.eventType) {
          query = query.eq("event_type", filters.eventType);
        }
        if (filters.category) {
          query = query.eq("category", filters.category);
        }
        if (filters.severity) {
          query = query.eq("severity", filters.severity);
        }

        // Pagination
        const limit = filters.limit || 50;
        const offset = filters.offset || 0;
        query = query.range(offset, offset + limit - 1);
      }

      // Always order by created_at DESC (most recent first)
      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      const totalCount = count || 0;
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;
      const currentPage = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: data || [],
        totalCount,
        hasMore: offset + limit < totalCount,
        currentPage,
        pageSize: limit,
        totalPages,
      };
    },

    /**
     * Get audit log by ID
     * @param auditId - UUID of audit log
     * @returns Promise with single audit log
     */
    byId: (auditId: string) =>
      supabase.from("audit_logs").select("*").eq("audit_id", auditId).single(),

    /**
     * Get audit trail for a specific record
     * @param tableName - Table name (bookings, units, etc)
     * @param recordId - UUID of record
     * @returns Promise with audit logs for this record
     */
    byRecord: async (tableName: string, recordId: string) => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: true }); // Chronological order for history

      if (error) throw error;
      return data || [];
    },

    /**
     * Get audit logs by user
     * @param userEmail - User email to filter by
     * @param limit - Maximum logs to return (default 100)
     * @returns Promise with user's audit logs
     */
    byUser: async (userEmail: string, limit = 100) => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    /**
     * Get recent audit logs (last N logs)
     * @param limit - Number of logs to return (default 50)
     * @returns Promise with recent audit logs
     */
    recent: async (limit = 50) => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    /**
     * Get audit statistics
     * @param filters - Optional filters for stats calculation
     * @returns Promise with aggregated statistics
     */
    stats: async (filters?: { startDate?: string; endDate?: string }) => {
      // Build base query
      let baseQuery = supabase.from("audit_logs").select("*");

      // Apply date filters if provided
      if (filters?.startDate) {
        baseQuery = baseQuery.gte("created_at", filters.startDate);
      }
      if (filters?.endDate) {
        baseQuery = baseQuery.lte("created_at", filters.endDate);
      }

      const { data, error } = await baseQuery;
      if (error) throw error;

      const logs = data || [];

      // Calculate statistics
      const byTable: Record<string, number> = {};
      const byAction: Record<string, number> = { INSERT: 0, UPDATE: 0, DELETE: 0 };
      const userCounts: Record<string, number> = {};
      const dailyCounts: Record<string, number> = {};

      logs.forEach((log) => {
        // By table
        byTable[log.table_name] = (byTable[log.table_name] || 0) + 1;

        // By action
        byAction[log.action] = (byAction[log.action] || 0) + 1;

        // By user
        const email = log.user_email || "system";
        userCounts[email] = (userCounts[email] || 0) + 1;

        // By date (for recent activity)
        if (log.created_at) {
          const date = new Date(log.created_at).toISOString().split("T")[0];
          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        }
      });

      // Top users (sorted by count)
      const byUser = Object.entries(userCounts)
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent activity (last 7 days)
      const recentActivity = Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);

      return {
        totalLogs: logs.length,
        byTable,
        byAction,
        byUser,
        recentActivity,
      };
    },

    /**
     * Create manual audit log entry (Layer 2 logging)
     * Used for application-level context enrichment
     *
     * @param context - Audit event context
     * @returns Promise with created audit log
     */
    create: async (context: AuditEventContext) => {
      // Get current user from Supabase Auth
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Build audit log entry
      // IMPORTANT: Layer 2 always uses action='INSERT' and source='app'
      const auditLog: Database["public"]["Tables"]["audit_logs"]["Insert"] = {
        // Core fields
        table_name: context.tableName || "unknown",
        record_id: context.recordId || null,
        record_pk: (context.recordPk as Json) || null,
        correlation_id: context.correlation_id || null,
        action: "INSERT" as const, // Layer 2 convention: always INSERT
        event_type: context.event_type || null,
        source: "app" as const, // Mark as Layer 2 (application logging)

        // User context
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_role: (user?.user_metadata?.role as string) || null,

        // Data capture (optional for app events)
        old_data: (context.oldData as Json) || null,
        new_data: (context.newData as Json) || null,
        changed_fields: null, // Layer 2 logs don't track field-level changes

        // Business context (POPULATED IN DEDICATED COLUMNS, not metadata)
        description: context.description,
        category: context.category,
        severity: context.severity || "INFO",

        // Additional context (use metadata for extra fields only)
        metadata: (context.metadata as Json) || null,

        // Client context
        ip_address: null, // Client-side can't reliably get IP
        user_agent:
          typeof navigator !== "undefined" && navigator.userAgent ? navigator.userAgent : null,
      };

      return supabase.from("audit_logs").insert(auditLog).select().single();
    },

    /**
     * Search audit logs by text (searches in description and metadata)
     * @param searchTerm - Text to search for
     * @param filters - Optional additional filters
     * @returns Promise with matching audit logs
     */
    search: async (
      searchTerm: string,
      filters?: { startDate?: string; endDate?: string; tableName?: string; limit?: number }
    ) => {
      let query = supabase.from("audit_logs").select("*");

      // Apply additional filters
      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate);
      }
      if (filters?.tableName) {
        query = query.eq("table_name", filters.tableName);
      }

      // Fetch data and filter client-side (Supabase JSONB search is complex)
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(filters?.limit || 100);

      if (error) throw error;

      const logs = data || [];
      const searchLower = searchTerm.toLowerCase();

      // Client-side filtering for flexible search
      return logs.filter((log) => {
        // Search in user email
        if (log.user_email?.toLowerCase().includes(searchLower)) return true;

        // Search in table name
        if (log.table_name.toLowerCase().includes(searchLower)) return true;

        // Search in description column (Layer 2 logs)
        if (log.description?.toLowerCase().includes(searchLower)) return true;

        // Search in changed fields
        if (log.changed_fields?.some((field) => field.toLowerCase().includes(searchLower)))
          return true;

        // Search in metadata (for additional context)
        if (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchLower))
          return true;

        return false;
      });
    },

    /**
     * Archive old audit logs using archive-move pattern
     * @param beforeDate - ISO date string, archive logs before this date
     * @returns Promise with archive result (count of moved logs)
     */
    archiveOld: async (beforeDate: string): Promise<{ count: number; error?: string }> => {
      try {
        // Call the archive_audit_logs function (created in migration 008)
        const { data, error } = await supabase.rpc("archive_audit_logs", {
          cutoff_date: beforeDate,
        });

        if (error) throw error;

        // RPC returns an array of results, sum the archived_count
        const totalCount = Array.isArray(data)
          ? data.reduce((sum, item) => sum + (item.archived_count || 0), 0)
          : 0;

        return { count: totalCount };
      } catch (error) {
        console.error("[Audit] Archive failed:", error);
        return { count: 0, error: String(error) };
      }
    },

    /**
     * Keyset pagination (cursor-based) - Efficient for large datasets
     * @param cursor - Cursor object from previous page
     * @param limit - Number of logs per page
     * @param filters - Optional additional filters
     * @returns Promise with page data and next cursor
     */
    keysetPage: async (
      cursor?: { created_at: string; audit_id: string } | null,
      limit = 50,
      filters?: { tableName?: string; userEmail?: string; action?: string }
    ) => {
      let query = supabase.from("audit_logs").select("*");

      // Apply filters
      if (filters) {
        if (filters.tableName) query = query.eq("table_name", filters.tableName);
        if (filters.userEmail) query = query.eq("user_email", filters.userEmail);
        if (filters.action) query = query.eq("action", filters.action);
      }

      // Apply cursor (keyset pagination)
      if (cursor) {
        // Use composite key comparison
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},audit_id.lt.${cursor.audit_id})`
        );
      }

      // Order by created_at DESC, audit_id DESC
      query = query
        .order("created_at", { ascending: false })
        .order("audit_id", { ascending: false })
        .limit(limit);

      const { data, error } = await query;
      if (error) throw error;

      const logs = data || [];
      const hasMore = logs.length === limit;

      // Generate next cursor from last row
      const nextCursor =
        hasMore && logs.length > 0
          ? {
              created_at: logs[logs.length - 1].created_at,
              audit_id: logs[logs.length - 1].audit_id,
            }
          : null;

      return {
        data: logs,
        nextCursor,
        hasMore,
      };
    },

    /**
     * Get audit trail for a specific record using composite primary key
     * Supports tables with composite keys where record_id is not sufficient
     *
     * @param tableName - Table name (bookings, units, etc)
     * @param recordPk - Composite primary key as JSON object
     * @returns Promise with audit logs for this record
     *
     * @example
     * // For a composite key like { booking_date: '2024-01-15', room_id: '3' }
     * const logs = await db.auditLogs.byRecordPk('room_availability', {
     *   booking_date: '2024-01-15',
     *   room_id: '3'
     * });
     */
    byRecordPk: async (tableName: string, recordPk: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .contains("record_pk", recordPk)
        .order("created_at", { ascending: true }); // Chronological order for history

      if (error) throw error;
      return data || [];
    },
  },
};

// Storage helper for file uploads
export const storage = {
  upload: async (bucket: string, path: string, file: File) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return { path: data.path, url: publicUrl };
  },

  delete: (bucket: string, path: string) => supabase.storage.from(bucket).remove([path]),

  getUrl: (bucket: string, path: string) =>
    supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
};
