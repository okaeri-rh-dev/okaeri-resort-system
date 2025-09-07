/**
 * Database Performance Monitoring Service
 *
 * Real-time monitoring and alerting for database performance optimization
 * Tracks materialized view performance, index usage, query patterns, and
 * connection efficiency for Neon PostgreSQL serverless optimization.
 */

import { db } from "../db/connection";
import { sql } from "drizzle-orm";

// =============================================
// Types and Interfaces
// =============================================

export interface DatabaseMetrics {
  connectionCount: number;
  activeQueries: number;
  averageQueryTime: number;
  cacheHitRatio: number;
  lockCount: number;
  totalSize: string;
  lastUpdated: Date;
}

export interface IndexUsageStats {
  schemaName: string;
  tableName: string;
  indexName: string;
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
  size: string;
  usage: "high" | "medium" | "low" | "unused";
  recommendation: string;
}

export interface QueryPerformanceStats {
  queryHash: string;
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  minTime: number;
  maxTime: number;
  stddevTime: number;
  rows: number;
  hitRatio: number;
  ioTime: number;
  planCacheHitRatio: number;
}

export interface MaterializedViewMetrics {
  viewName: string;
  size: string;
  rowCount: number;
  lastRefreshed: Date;
  refreshDuration?: number;
  isPopulated: boolean;
  refreshInProgress: boolean;
  hitRatio: number;
  queryCount: number;
}

export interface TablePartitionMetrics {
  schemaName: string;
  tableName: string;
  partitionName: string;
  rowCount: number;
  size: string;
  lastAccessed: Date | null;
  queryCount: number;
  recommendation: string;
}

export interface PerformanceAlert {
  id: string;
  type:
    | "slow_query"
    | "index_unused"
    | "materialized_view_stale"
    | "partition_bloat"
    | "connection_limit";
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

// =============================================
// Database Performance Monitoring Service
// =============================================

export class DatabasePerformanceService {
  private alertThresholds = {
    slowQueryTime: 1000, // 1 second
    cacheHitRatio: 0.95, // 95%
    connectionUtilization: 0.8, // 80%
    indexScanThreshold: 10, // minimum scans to be considered
    materializedViewStaleHours: 24, // hours
  };

  private alerts: PerformanceAlert[] = [];

  /**
   * Get comprehensive database metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const [connectionResult, queryResult, cacheResult, lockResult, sizeResult] =
        await Promise.all([
          // Connection count
          db.execute(sql`
          SELECT count(*) as connection_count
          FROM pg_stat_activity
          WHERE state = 'active'
        `),

          // Active queries with timing
          db.execute(sql`
          SELECT 
            count(*) as active_queries,
            avg(extract(epoch from (now() - query_start)) * 1000) as avg_query_time
          FROM pg_stat_activity
          WHERE state = 'active' AND query != '<IDLE>'
        `),

          // Cache hit ratio
          db.execute(sql`
          SELECT 
            sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) as cache_hit_ratio
          FROM pg_statio_user_tables
        `),

          // Lock count
          db.execute(sql`
          SELECT count(*) as lock_count
          FROM pg_locks
          WHERE granted = false
        `),

          // Database size
          db.execute(sql`
          SELECT pg_size_pretty(pg_database_size(current_database())) as total_size
        `),
        ]);

      return {
        connectionCount: connectionResult.rows[0]?.connection_count || 0,
        activeQueries: queryResult.rows[0]?.active_queries || 0,
        averageQueryTime: queryResult.rows[0]?.avg_query_time || 0,
        cacheHitRatio: cacheResult.rows[0]?.cache_hit_ratio || 0,
        lockCount: lockResult.rows[0]?.lock_count || 0,
        totalSize: sizeResult.rows[0]?.total_size || "0 bytes",
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Error getting database metrics:", error);
      throw new Error("Failed to get database metrics");
    }
  }

  /**
   * Analyze index usage statistics
   */
  async getIndexUsageStats(minScans: number = 0): Promise<IndexUsageStats[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
          CASE 
            WHEN idx_scan = 0 THEN 'unused'
            WHEN idx_scan < 100 THEN 'low'
            WHEN idx_scan < 1000 THEN 'medium'
            ELSE 'high'
          END as usage,
          CASE
            WHEN idx_scan = 0 THEN 'Consider dropping this index'
            WHEN idx_scan < 10 THEN 'Monitor usage and consider removal'
            WHEN idx_tup_fetch::numeric / NULLIF(idx_scan, 0) < 1 THEN 'Low selectivity - review index definition'
            ELSE 'Index performing well'
          END as recommendation
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND idx_scan >= ${minScans}
        ORDER BY idx_scan DESC, pg_relation_size(indexname::regclass) DESC
      `);

      return result.rows.map((row) => ({
        schemaName: row.schemaname,
        tableName: row.tablename,
        indexName: row.indexname,
        scans: row.scans,
        tuplesRead: row.tuples_read,
        tuplesFetched: row.tuples_fetched,
        size: row.size,
        usage: row.usage as "high" | "medium" | "low" | "unused",
        recommendation: row.recommendation,
      }));
    } catch (error) {
      console.error("Error getting index usage stats:", error);
      throw new Error("Failed to get index usage statistics");
    }
  }

  /**
   * Get query performance statistics from pg_stat_statements
   */
  async getQueryPerformanceStats(limit: number = 20): Promise<QueryPerformanceStats[]> {
    try {
      // Check if pg_stat_statements is available
      const extensionCheck = await db.execute(sql`
        SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
      `);

      if (extensionCheck.rows.length === 0) {
        console.warn("pg_stat_statements extension not available");
        return [];
      }

      const result = await db.execute(sql`
        SELECT 
          queryid::text as query_hash,
          query,
          calls,
          total_exec_time as total_time,
          mean_exec_time as mean_time,
          min_exec_time as min_time,
          max_exec_time as max_time,
          stddev_exec_time as stddev_time,
          rows,
          shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0) as hit_ratio,
          blk_read_time + blk_write_time as io_time,
          plans / NULLIF(calls, 0) as plan_cache_hit_ratio
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        AND query NOT LIKE '%REFRESH MATERIALIZED VIEW%'
        ORDER BY total_exec_time DESC
        LIMIT ${limit}
      `);

      return result.rows.map((row) => ({
        queryHash: row.query_hash,
        query: row.query,
        calls: row.calls,
        totalTime: row.total_time,
        meanTime: row.mean_time,
        minTime: row.min_time,
        maxTime: row.max_time,
        stddevTime: row.stddev_time,
        rows: row.rows,
        hitRatio: row.hit_ratio || 0,
        ioTime: row.io_time || 0,
        planCacheHitRatio: row.plan_cache_hit_ratio || 0,
      }));
    } catch (error) {
      console.error("Error getting query performance stats:", error);
      return []; // Return empty array if pg_stat_statements is not available
    }
  }

  /**
   * Get materialized view performance metrics
   */
  async getMaterializedViewMetrics(): Promise<MaterializedViewMetrics[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          mv.matviewname as view_name,
          pg_size_pretty(pg_total_relation_size(mv.matviewname::regclass)) as size,
          COALESCE(c.reltuples::bigint, 0) as row_count,
          COALESCE(
            EXTRACT(EPOCH FROM (NOW() - 
              CASE mv.matviewname
                WHEN 'financial_summary_mv' THEN (SELECT MAX(last_refreshed) FROM financial_summary_mv)
                WHEN 'income_summary_mv' THEN (SELECT MAX(last_refreshed) FROM income_summary_mv)
                WHEN 'tax_summary_mv' THEN (SELECT MAX(last_refreshed) FROM tax_summary_mv)
                WHEN 'vendor_summary_mv' THEN (SELECT MAX(last_refreshed) FROM vendor_summary_mv)
                ELSE NOW() - INTERVAL '1 hour'
              END
            )) * 1000, 0
          ) as refresh_duration,
          mv.ispopulated,
          EXISTS(
            SELECT 1 FROM pg_stat_activity 
            WHERE query LIKE '%REFRESH%' || mv.matviewname || '%'
          ) as refresh_in_progress,
          COALESCE(st.heap_blks_hit::numeric / NULLIF(st.heap_blks_hit + st.heap_blks_read, 0), 0) as hit_ratio,
          COALESCE(st.n_tup_fetched + st.n_tup_returned, 0) as query_count
        FROM pg_matviews mv
        LEFT JOIN pg_class c ON c.relname = mv.matviewname
        LEFT JOIN pg_stat_user_tables st ON st.relname = mv.matviewname
        WHERE mv.schemaname = 'public'
        AND mv.matviewname LIKE '%_mv'
      `);

      return result.rows.map((row) => ({
        viewName: row.view_name,
        size: row.size,
        rowCount: row.row_count,
        lastRefreshed: new Date(Date.now() - row.refresh_duration),
        refreshDuration: row.refresh_duration,
        isPopulated: row.ispopulated,
        refreshInProgress: row.refresh_in_progress,
        hitRatio: row.hit_ratio,
        queryCount: row.query_count,
      }));
    } catch (error) {
      console.error("Error getting materialized view metrics:", error);
      throw new Error("Failed to get materialized view metrics");
    }
  }

  /**
   * Get table partition metrics
   */
  async getTablePartitionMetrics(): Promise<TablePartitionMetrics[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          tablename as partition_name,
          COALESCE(n_tup_ins + n_tup_upd + n_tup_del, 0) as row_count,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          last_vacuum as last_accessed,
          COALESCE(seq_scan + idx_scan, 0) as query_count,
          CASE 
            WHEN last_vacuum < CURRENT_DATE - INTERVAL '30 days' AND n_dead_tup > 1000 THEN 'Needs VACUUM'
            WHEN last_analyze < CURRENT_DATE - INTERVAL '7 days' THEN 'Needs ANALYZE'
            WHEN pg_total_relation_size(schemaname||'.'||tablename) > 1073741824 THEN 'Large partition - monitor'
            ELSE 'Healthy'
          END as recommendation
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        AND (
          tablename LIKE 'expenses_____%%'
          OR tablename LIKE 'income_____%%' 
          OR tablename LIKE 'payments_____%%'
          OR tablename LIKE 'audit_____%%'
        )
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      return result.rows.map((row) => ({
        schemaName: row.schemaname,
        tableName: row.tablename.split("_")[0], // Extract base table name
        partitionName: row.partition_name,
        rowCount: row.row_count,
        size: row.size,
        lastAccessed: row.last_accessed,
        queryCount: row.query_count,
        recommendation: row.recommendation,
      }));
    } catch (error) {
      console.error("Error getting table partition metrics:", error);
      throw new Error("Failed to get table partition metrics");
    }
  }

  /**
   * Generate performance alerts based on thresholds
   */
  async generatePerformanceAlerts(): Promise<PerformanceAlert[]> {
    try {
      const alerts: PerformanceAlert[] = [];

      // Get current metrics
      const [metrics, indexStats, queryStats, materializedViewMetrics] = await Promise.all([
        this.getDatabaseMetrics(),
        this.getIndexUsageStats(),
        this.getQueryPerformanceStats(10),
        this.getMaterializedViewMetrics(),
      ]);

      // Check slow queries
      queryStats.forEach((query) => {
        if (query.meanTime > this.alertThresholds.slowQueryTime) {
          alerts.push({
            id: `slow_query_${query.queryHash}`,
            type: "slow_query",
            severity: query.meanTime > 5000 ? "critical" : "warning",
            message: `Slow query detected: ${query.meanTime.toFixed(2)}ms average execution time`,
            details: {
              queryHash: query.queryHash,
              meanTime: query.meanTime,
              calls: query.calls,
              query: query.query.substring(0, 100) + "...",
            },
            timestamp: new Date(),
            resolved: false,
          });
        }
      });

      // Check unused indexes
      indexStats.forEach((index) => {
        if (index.usage === "unused") {
          alerts.push({
            id: `unused_index_${index.indexName}`,
            type: "index_unused",
            severity: "info",
            message: `Unused index detected: ${index.indexName}`,
            details: {
              indexName: index.indexName,
              tableName: index.tableName,
              size: index.size,
              scans: index.scans,
            },
            timestamp: new Date(),
            resolved: false,
          });
        }
      });

      // Check stale materialized views
      materializedViewMetrics.forEach((view) => {
        const hoursSinceRefresh = (Date.now() - view.lastRefreshed.getTime()) / (1000 * 60 * 60);
        if (hoursSinceRefresh > this.alertThresholds.materializedViewStaleHours) {
          alerts.push({
            id: `stale_materialized_view_${view.viewName}`,
            type: "materialized_view_stale",
            severity: hoursSinceRefresh > 48 ? "warning" : "info",
            message: `Stale materialized view: ${view.viewName} (${hoursSinceRefresh.toFixed(1)}h since refresh)`,
            details: {
              viewName: view.viewName,
              lastRefreshed: view.lastRefreshed,
              hoursSinceRefresh,
              rowCount: view.rowCount,
            },
            timestamp: new Date(),
            resolved: false,
          });
        }
      });

      // Check cache hit ratio
      if (metrics.cacheHitRatio < this.alertThresholds.cacheHitRatio) {
        alerts.push({
          id: "low_cache_hit_ratio",
          type: "slow_query",
          severity: metrics.cacheHitRatio < 0.9 ? "warning" : "info",
          message: `Low cache hit ratio: ${(metrics.cacheHitRatio * 100).toFixed(1)}%`,
          details: {
            cacheHitRatio: metrics.cacheHitRatio,
            recommendation: "Consider reviewing query patterns or increasing cache size",
          },
          timestamp: new Date(),
          resolved: false,
        });
      }

      this.alerts = alerts;
      return alerts;
    } catch (error) {
      console.error("Error generating performance alerts:", error);
      throw new Error("Failed to generate performance alerts");
    }
  }

  /**
   * Get optimization recommendations based on current performance
   */
  async getOptimizationRecommendations(): Promise<
    {
      category: string;
      priority: "high" | "medium" | "low";
      recommendation: string;
      impact: string;
      action: string;
    }[]
  > {
    try {
      const recommendations = [];

      const [metrics, indexStats, materializedViewMetrics] = await Promise.all([
        this.getDatabaseMetrics(),
        this.getIndexUsageStats(),
        this.getMaterializedViewMetrics(),
      ]);

      // Index optimization recommendations
      const unusedIndexes = indexStats.filter((idx) => idx.usage === "unused");
      if (unusedIndexes.length > 0) {
        recommendations.push({
          category: "Indexes",
          priority: "medium" as const,
          recommendation: `Remove ${unusedIndexes.length} unused indexes`,
          impact: "Reduced storage usage and faster writes",
          action: `DROP INDEX ${unusedIndexes.map((idx) => idx.indexName).join(", ")}`,
        });
      }

      // Materialized view refresh recommendations
      const staleViews = materializedViewMetrics.filter(
        (view) => (Date.now() - view.lastRefreshed.getTime()) / (1000 * 60 * 60) > 12
      );
      if (staleViews.length > 0) {
        recommendations.push({
          category: "Materialized Views",
          priority: "high" as const,
          recommendation: `Refresh ${staleViews.length} stale materialized views`,
          impact: "Improved query performance and data freshness",
          action: "Run scheduled materialized view refresh",
        });
      }

      // Cache optimization recommendations
      if (metrics.cacheHitRatio < 0.95) {
        recommendations.push({
          category: "Cache",
          priority: "medium" as const,
          recommendation: "Optimize query patterns to improve cache hit ratio",
          impact: "Reduced disk I/O and faster query execution",
          action: "Review and optimize frequently executed queries",
        });
      }

      // Connection optimization for Neon
      if (metrics.connectionCount > 20) {
        recommendations.push({
          category: "Connections",
          priority: "high" as const,
          recommendation: "Optimize connection pooling for serverless environment",
          impact: "Better resource utilization and cost optimization",
          action: "Implement connection pooling strategies",
        });
      }

      return recommendations;
    } catch (error) {
      console.error("Error getting optimization recommendations:", error);
      throw new Error("Failed to get optimization recommendations");
    }
  }

  /**
   * Execute performance maintenance tasks
   */
  async runMaintenanceTasks(): Promise<
    {
      task: string;
      status: "completed" | "failed" | "skipped";
      duration?: number;
      details?: string;
    }[]
  > {
    const results = [];

    try {
      // Task 1: Update table statistics
      const analyzeStart = Date.now();
      await db.execute(sql`
        ANALYZE expenses, income_transactions, payment_transactions, vendors;
      `);
      results.push({
        task: "Update table statistics",
        status: "completed" as const,
        duration: Date.now() - analyzeStart,
        details: "Updated statistics for main tables",
      });
    } catch (error) {
      results.push({
        task: "Update table statistics",
        status: "failed" as const,
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    try {
      // Task 2: Refresh materialized view statistics
      const refreshStart = Date.now();
      await db.execute(sql`
        REFRESH MATERIALIZED VIEW CONCURRENTLY financial_summary_mv;
      `);
      results.push({
        task: "Refresh financial summary materialized view",
        status: "completed" as const,
        duration: Date.now() - refreshStart,
      });
    } catch (error) {
      results.push({
        task: "Refresh financial summary materialized view",
        status: "failed" as const,
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    try {
      // Task 3: Clean up old query statistics (if pg_stat_statements is available)
      await db.execute(sql`
        SELECT pg_stat_statements_reset() 
        WHERE (SELECT count(*) FROM pg_stat_statements) > 10000;
      `);
      results.push({
        task: "Clean up query statistics",
        status: "completed" as const,
        details: "Reset query statistics if threshold exceeded",
      });
    } catch (error) {
      results.push({
        task: "Clean up query statistics",
        status: "skipped" as const,
        details: "pg_stat_statements not available or not needed",
      });
    }

    // Log maintenance completion
    await db.execute(sql`
      INSERT INTO audit_logs (
        entity_type, entity_id, action, details, created_at
      ) VALUES (
        'maintenance',
        'performance_maintenance',
        'maintenance_completed',
        ${JSON.stringify({ results, timestamp: new Date() })},
        NOW()
      )
    `);

    return results;
  }

  /**
   * Get current alerts
   */
  getCurrentAlerts(): PerformanceAlert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Export performance report
   */
  async exportPerformanceReport(): Promise<{
    timestamp: Date;
    metrics: DatabaseMetrics;
    indexStats: IndexUsageStats[];
    materializedViewMetrics: MaterializedViewMetrics[];
    alerts: PerformanceAlert[];
    recommendations: any[];
  }> {
    const [metrics, indexStats, materializedViewMetrics, alerts, recommendations] =
      await Promise.all([
        this.getDatabaseMetrics(),
        this.getIndexUsageStats(),
        this.getMaterializedViewMetrics(),
        this.generatePerformanceAlerts(),
        this.getOptimizationRecommendations(),
      ]);

    return {
      timestamp: new Date(),
      metrics,
      indexStats,
      materializedViewMetrics,
      alerts,
      recommendations,
    };
  }
}

// Export singleton instance
export const databasePerformanceService = new DatabasePerformanceService();
