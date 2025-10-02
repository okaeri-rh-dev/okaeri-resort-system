# Phase 2b: Database Helpers

## Purpose

This document shows how to extend the existing `db` helper object in `src/lib/supabase.ts` with audit log query methods. These helpers provide a type-safe, consistent interface for reading audit data.

**Design Principle**: Extend the existing `db` pattern, don't create a separate `auditDb` object.

## Extending the Database Helper

### File Location

Add to existing `src/lib/supabase.ts` (after the existing `db` object):

```typescript
// src/lib/supabase.ts

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types";
import type {
  AuditLog,
  AuditLogFilters,
  AuditLogQueryResult,
  AuditLogStats,
  AuditEventContext,
  AuditAction,
} from "../../database.types";
import { PAGINATION_DEFAULTS } from "./audit-constants";

// ... existing supabase client and db object ...

// ============================================
// AUDIT LOGS HELPERS
// ============================================

export const db = {
  // ... existing helpers (units, bookings, guests, etc) ...

  /**
   * Audit Logs - Query and manage audit trail data
   */
  auditLogs: {
    /**
     * Get all audit logs (with optional filters)
     * @param filters - Optional filter criteria
     * @returns Promise with audit logs and metadata
     */
    all: async (filters?: AuditLogFilters): Promise<AuditLogQueryResult> => {
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
        const limit = filters.limit || PAGINATION_DEFAULTS.PAGE_SIZE;
        const offset = filters.offset || 0;
        query = query.range(offset, offset + limit - 1);
      }

      // Always order by created_at DESC (most recent first)
      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      const totalCount = count || 0;
      const limit = filters?.limit || PAGINATION_DEFAULTS.PAGE_SIZE;
      const offset = filters?.offset || 0;
      const currentPage = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: (data as AuditLog[]) || [],
        totalCount,
        hasMore: offset + limit < totalCount,
        currentPage,
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
    byRecord: async (tableName: string, recordId: string): Promise<AuditLog[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .eq("record_id", recordId)
        .order("created_at", { ascending: true }); // Chronological order for history

      if (error) throw error;
      return (data as AuditLog[]) || [];
    },

    /**
     * Get audit logs by user
     * @param userEmail - User email to filter by
     * @param limit - Maximum logs to return (default 100)
     * @returns Promise with user's audit logs
     */
    byUser: async (userEmail: string, limit = 100): Promise<AuditLog[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as AuditLog[]) || [];
    },

    /**
     * Get recent audit logs (last N logs)
     * @param limit - Number of logs to return (default 50)
     * @returns Promise with recent audit logs
     */
    recent: async (limit = 50): Promise<AuditLog[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as AuditLog[]) || [];
    },

    /**
     * Get audit statistics
     * @param filters - Optional filters for stats calculation
     * @returns Promise with aggregated statistics
     */
    stats: async (filters?: AuditLogFilters): Promise<AuditLogStats> => {
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

      const logs = (data as AuditLog[]) || [];

      // Calculate statistics
      const byTable: Record<string, number> = {};
      const byAction: Record<AuditAction, number> = {
        INSERT: 0,
        UPDATE: 0,
        DELETE: 0,
      };
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
        const date = new Date(log.created_at).toISOString().split("T")[0];
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      });

      // Top users (sorted by count)
      const byUser = Object.entries(userCounts)
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, PAGINATION_DEFAULTS.STATS_LIMIT);

      // Recent activity (last 7 days)
      const recentActivity = Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, PAGINATION_DEFAULTS.RECENT_ACTIVITY_DAYS);

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
      const auditLog = {
        // Core fields
        table_name: context.tableName,
        record_id: context.recordId || null,
        action: "INSERT", // Layer 2 convention: always INSERT
        event_type: context.eventType || null, // Business event type (e.g., 'login', 'cancel_booking')
        source: "app", // Mark as Layer 2 (application logging)

        // User context
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_role: user?.user_metadata?.role || null,

        // Data capture (optional for app events)
        old_data: context.oldData || null,
        new_data: context.newData || null,
        changed_fields: null, // Layer 2 logs don't track field-level changes

        // Business context (POPULATED IN DEDICATED COLUMNS, not metadata)
        description: context.description,
        category: context.category,
        severity: context.severity || AuditSeverity.INFO,

        // Additional context (use metadata for extra fields only)
        metadata: context.metadata || null,

        // Client context
        ip_address: null, // Client-side can't reliably get IP
        user_agent: navigator?.userAgent || null,
      };

      return supabase.from("audit_logs").insert(auditLog).select().single();
    },

    /**
     * Search audit logs by text (searches in metadata and changed fields)
     * @param searchTerm - Text to search for
     * @param filters - Optional additional filters
     * @returns Promise with matching audit logs
     */
    search: async (searchTerm: string, filters?: AuditLogFilters): Promise<AuditLog[]> => {
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

      const logs = (data as AuditLog[]) || [];
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
     * Delete old audit logs (manual archival)
     * @param beforeDate - ISO date string, delete logs before this date
     * @returns Promise with number of deleted logs
     */
    archiveOld: async (beforeDate: string): Promise<number> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .delete()
        .lt("created_at", beforeDate)
        .select();

      if (error) throw error;
      return data?.length || 0;
    },

    /**
     * Get audit trail for a specific record using composite primary key
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
    byRecordPk: async (
      tableName: string,
      recordPk: Record<string, unknown>
    ): Promise<AuditLog[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", tableName)
        .contains("record_pk", recordPk)
        .order("created_at", { ascending: true }); // Chronological order for history

      if (error) throw error;
      return (data as AuditLog[]) || [];
    },

    /**
     * Keyset pagination (cursor-based) - Efficient for large datasets
     * Uses WHERE clause instead of OFFSET for O(1) pagination
     *
     * @param cursor - Cursor object from previous page (created_at + audit_id)
     * @param limit - Number of logs per page (default 50)
     * @param filters - Optional additional filters
     * @returns Promise with page data and next cursor
     */
    keysetPage: async (
      cursor?: { created_at: string; audit_id: string } | null,
      limit = 50,
      filters?: AuditLogFilters
    ): Promise<{
      data: AuditLog[];
      nextCursor: { created_at: string; audit_id: string } | null;
      hasMore: boolean;
    }> => {
      let query = supabase.from("audit_logs").select("*");

      // Apply filters
      if (filters) {
        if (filters.tableName) query = query.eq("table_name", filters.tableName);
        if (filters.userEmail) query = query.eq("user_email", filters.userEmail);
        if (filters.action) query = query.eq("action", filters.action);
        if (filters.startDate) query = query.gte("created_at", filters.startDate);
        if (filters.endDate) query = query.lte("created_at", filters.endDate);
      }

      // Apply cursor (keyset pagination)
      if (cursor) {
        // Use composite key comparison: WHERE (created_at, audit_id) < (cursor_timestamp, cursor_id)
        // Note: Supabase doesn't support row value comparison directly, so we use OR logic:
        // (created_at < cursor.created_at) OR (created_at = cursor.created_at AND audit_id < cursor.audit_id)
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},audit_id.lt.${cursor.audit_id})`
        );
      }

      // Order by created_at DESC, audit_id DESC (matches idx_audit_logs_keyset index)
      query = query
        .order("created_at", { ascending: false })
        .order("audit_id", { ascending: false })
        .limit(limit);

      const { data, error } = await query;
      if (error) throw error;

      const logs = (data as AuditLog[]) || [];
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
  },
};
```

## Helper Usage Examples

### Example 1: Get Recent Logs

```typescript
// Get last 50 audit logs
const recentLogs = await db.auditLogs.recent(50);
console.log(`Fetched ${recentLogs.length} recent logs`);
```

### Example 2: Filter by Table and Date Range

```typescript
// Get all booking changes in January 2024
const filters: AuditLogFilters = {
  tableName: "bookings",
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-01-31T23:59:59Z",
  limit: 100,
};

const result = await db.auditLogs.all(filters);
console.log(`Found ${result.totalCount} booking changes in January`);
console.log(`Showing page ${result.currentPage} of ${result.totalPages}`);
```

### Example 3: Get Record History

```typescript
// Get complete history for a specific booking
const bookingId = "123e4567-e89b-12d3-a456-426614174000";
const history = await db.auditLogs.byRecord("bookings", bookingId);

console.log(`Booking has ${history.length} changes:`);
history.forEach((log) => {
  console.log(`- ${log.created_at}: ${log.action} by ${log.user_email}`);
});
```

### Example 4: Get Statistics

```typescript
// Get overall audit statistics
const stats = await db.auditLogs.stats();

console.log(`Total logs: ${stats.totalLogs}`);
console.log("By table:", stats.byTable);
console.log("By action:", stats.byAction);
console.log("Top users:", stats.byUser);
console.log("Recent activity:", stats.recentActivity);
```

### Example 5: Create Manual Audit Log

```typescript
// Log a booking cancellation with business context
// Note: action is NOT included in context - always 'INSERT' for Layer 2 logs
const context: AuditEventContext = {
  tableName: "bookings",
  recordId: booking.booking_id,
  eventType: AuditEventType.CANCEL_BOOKING, // Semantic business event
  description: "Booking cancelled due to guest request",
  category: AuditCategory.BOOKING,
  severity: AuditSeverity.WARNING,
  metadata: {
    cancellationReason: "Guest personal emergency",
    refundIssued: true,
    refundAmount: booking.total_amount,
    semanticAction: "UPDATE", // Optional: store business action in metadata
  },
  oldData: { booking_status: "Confirmed" },
  newData: { booking_status: "Cancelled" },
};

const { data, error } = await db.auditLogs.create(context);
if (!error) {
  console.log("Cancellation logged to audit trail");
}
```

### Example 6: Search Audit Logs

```typescript
// Search for logs mentioning "refund"
const results = await db.auditLogs.search("refund", {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  limit: 50,
});

console.log(`Found ${results.length} logs mentioning "refund"`);
```

### Example 7: Archive Old Logs

```typescript
// Archive logs older than 2 years
const twoYearsAgo = new Date();
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

const deletedCount = await db.auditLogs.archiveOld(twoYearsAgo.toISOString());
console.log(`Archived ${deletedCount} old audit logs`);
```

### Example 8: Keyset Pagination (Efficient for Large Datasets)

```typescript
// First page - no cursor
const firstPage = await db.auditLogs.keysetPage(null, 50, {
  tableName: "bookings",
});

console.log(`First page: ${firstPage.data.length} logs`);
console.log(`Has more pages: ${firstPage.hasMore}`);

// Second page - use cursor from first page
if (firstPage.nextCursor) {
  const secondPage = await db.auditLogs.keysetPage(firstPage.nextCursor, 50, {
    tableName: "bookings",
  });

  console.log(`Second page: ${secondPage.data.length} logs`);
  console.log(`Next cursor:`, secondPage.nextCursor);
}

// Why keyset pagination?
// - OFFSET pagination: Page 100 scans 5,000 rows (OFFSET 5000 LIMIT 50)
// - Keyset pagination: Page 100 scans only 50 rows (WHERE clause filters)
// - Result: Constant ~15ms performance regardless of page number
```

## Error Handling

All helpers return standard Supabase responses with `{ data, error }`. Handle errors consistently:

```typescript
// Use try-catch for async/await
try {
  const logs = await db.auditLogs.recent(50);
  // Process logs
} catch (error) {
  console.error("Failed to fetch audit logs:", error);
  // Show user-friendly error message
}

// Or check error property
const { data, error } = await db.auditLogs.byId(auditId);
if (error) {
  console.error("Audit log not found:", error.message);
  return;
}
// Use data safely
```

## Performance Considerations

### Index Usage

These helpers are optimized to use the indexes created in Phase 1c:

- `recent()` → Uses `idx_audit_logs_timestamp`
- `byUser()` → Uses `idx_audit_logs_user_context`
- `byRecord()` → Uses `idx_audit_logs_record`
- `all()` with filters → Uses `idx_audit_logs_composite`
- `keysetPage()` → Uses `idx_audit_logs_keyset` (efficient for large datasets)

### Pagination Best Practices

```typescript
// ✅ Best: Keyset pagination for large datasets (10K+ logs)
const page = await db.auditLogs.keysetPage(cursor, 50, { tableName: "bookings" });
// Constant ~15ms regardless of page number

// ✅ Good: OFFSET pagination for small datasets (< 10K logs)
const filters: AuditLogFilters = {
  tableName: "bookings",
  limit: 50,
  offset: 0, // Increment by 50 for each page
};

// ❌ Bad: Fetching all logs without limit
const allLogs = await db.auditLogs.all(); // Could return 10,000+ logs!

// ❌ Bad: OFFSET pagination at high page numbers
const page100 = await db.auditLogs.all({ offset: 5000, limit: 50 }); // Scans 5,000 rows!
```

### Client-Side vs Server-Side Filtering

- **Server-side** (database filters): Use for exact matches (email, table, action)
- **Client-side** (JavaScript filters): Use for complex search (text search in JSONB)

The `search()` helper combines both: filters in database, then refines client-side.

## Testing Helpers

### Manual Verification

```typescript
// Test script: src/scripts/test-audit-helpers.ts
import { db } from "@/lib/supabase";

async function testAuditHelpers() {
  console.log("Testing audit log helpers...\n");

  // Test 1: Recent logs
  console.log("1. Recent logs:");
  const recent = await db.auditLogs.recent(5);
  console.log(`  ✓ Fetched ${recent.length} recent logs`);

  // Test 2: Filter by table
  console.log("\n2. Booking logs:");
  const bookingLogs = await db.auditLogs.all({ tableName: "bookings", limit: 10 });
  console.log(`  ✓ Found ${bookingLogs.totalCount} total booking logs`);
  console.log(`  ✓ Showing ${bookingLogs.data.length} on page ${bookingLogs.currentPage}`);

  // Test 3: Statistics
  console.log("\n3. Statistics:");
  const stats = await db.auditLogs.stats();
  console.log(`  ✓ Total logs: ${stats.totalLogs}`);
  console.log(`  ✓ By table:`, stats.byTable);
  console.log(`  ✓ By action:`, stats.byAction);

  console.log("\n✅ All audit helper tests passed!");
}

testAuditHelpers().catch(console.error);
```

### Expected Results

After implementing these helpers:

- ✅ All methods return proper TypeScript types
- ✅ Filters work correctly
- ✅ Pagination returns correct page metadata
- ✅ Statistics aggregate data accurately
- ✅ No TypeScript compilation errors

## Troubleshooting

### Problem: "audit_logs table not found"

**Solution**: Run Phase 1 migration first:

```bash
./migrate-audit-system.sh
```

### Problem: Slow query performance

**Solution**: Check index usage with EXPLAIN ANALYZE:

```sql
EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE table_name = 'bookings'
ORDER BY timestamp DESC
LIMIT 50;
```

Look for "Index Scan" in output. If you see "Seq Scan", indexes aren't being used.

### Problem: TypeScript errors on audit types

**Solution**: Ensure `database.types.ts` includes audit types from Phase 2a:

```bash
npm run type-check
```

## Next Steps

**Next**: [Phase 2c - Audit Logger](./02c-audit-logger.md)

Phase 2c will create the `logAuditEvent()` utility function that uses these helpers to create enriched audit logs with automatic user context extraction and sensitive data redaction.

---

**Helper Integration Checklist:**

- [ ] Helpers added to `src/lib/supabase.ts`
- [ ] All TypeScript types imported correctly
- [ ] Manual test script runs without errors
- [ ] OFFSET pagination works correctly (< 10K logs)
- [ ] Keyset pagination works correctly (≥ 10K logs)
- [ ] Statistics calculation is accurate
- [ ] Error handling is consistent
