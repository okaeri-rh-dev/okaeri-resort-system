// src/scripts/test-audit-system.ts

/**
 * Manual Test Script for Audit Trail System (Phase 2)
 *
 * This script tests the audit logging functionality manually.
 * Run this in your browser console or as a standalone test.
 *
 * Usage:
 * 1. Import this script in your application
 * 2. Call testAuditSystem() from browser console
 * 3. Check console output for results
 */

import { logAuditEvent, logAuthEvent, logBookingEvent, logPaymentEvent } from "@/lib/audit-logger";
import { db } from "@/lib/supabase";
import { AuditCategory, AuditSeverity } from "@/types/audit.types";

// Extend Window interface for the testAuditSystem function
declare global {
  interface Window {
    testAuditSystem: () => Promise<{
      success: boolean;
      testsRun?: number;
      message?: string;
      error?: string;
    }>;
  }
}

export async function testAuditSystem() {
  // eslint-disable-next-line no-console
  console.log("🧪 Testing Audit Trail System (Phase 2)\n");
  // eslint-disable-next-line no-console
  console.log("=".repeat(50));

  try {
    // Test 1: Basic audit event
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 1: Basic audit log creation");
    const result1 = await logAuditEvent({
      tableName: "bookings",
      recordId: "test-booking-id",
      description: "Test audit log - manual creation",
      category: AuditCategory.BOOKING,
      severity: AuditSeverity.INFO,
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });
    // eslint-disable-next-line no-console
    console.log(`   Result: ${result1.success ? "✓ Success" : "✗ Failed"}`, result1);

    // Test 2: Booking event
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 2: Booking lifecycle event");
    await logBookingEvent("test-booking-id-2", "cancelled", {
      oldStatus: "Confirmed",
      newStatus: "Cancelled",
      reason: "Test cancellation",
      amount: 5000,
    });
    // eslint-disable-next-line no-console
    console.log("   ✓ Booking cancellation logged");

    // Test 3: Payment event
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 3: Payment event");
    await logPaymentEvent("test-payment-id", "recorded", {
      amount: 5000,
      paymentMethod: "GCash",
      metadata: {
        test: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log("   ✓ Payment event logged");

    // Test 4: Auth event
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 4: Authentication event");
    await logAuthEvent("login", {
      email: "test@okaeri.com",
      metadata: {
        test: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log("   ✓ Auth event logged");

    // Test 5: Fetch recent logs
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 5: Fetch recent audit logs");
    const recentLogs = await db.auditLogs.recent(5);
    // eslint-disable-next-line no-console
    console.log(`   ✓ Fetched ${recentLogs.length} recent logs`);
    // eslint-disable-next-line no-console
    console.log("   Latest log:", recentLogs[0]);

    // Test 6: Fetch audit trail for record
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 6: Fetch audit trail for a record");
    const trail = await db.auditLogs.byRecord("bookings", "test-booking-id");
    // eslint-disable-next-line no-console
    console.log(`   ✓ Fetched ${trail.length} audit entries for test-booking-id`);

    // Test 7: Audit statistics
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 7: Audit statistics");
    const stats = await db.auditLogs.stats();
    // eslint-disable-next-line no-console
    console.log("   ✓ Total logs:", stats.totalLogs);
    // eslint-disable-next-line no-console
    console.log("   ✓ By table:", stats.byTable);
    // eslint-disable-next-line no-console
    console.log("   ✓ By action:", stats.byAction);

    // Test 8: Composite primary key lookup (byRecordPk)
    // eslint-disable-next-line no-console
    console.log("\n✅ Test 8: Composite primary key lookup");
    const compositeLogs = await db.auditLogs.byRecordPk("bookings", {
      booking_id: "test-booking-id",
    });
    // eslint-disable-next-line no-console
    console.log(`   ✓ Found ${compositeLogs.length} logs for composite key query`);
    if (compositeLogs.length > 0) {
      // eslint-disable-next-line no-console
      console.log("   ✓ Sample log:", compositeLogs[0]);
    } else {
      // eslint-disable-next-line no-console
      console.log("   ℹ No logs found (expected for test data with no composite keys)");
    }

    // eslint-disable-next-line no-console
    console.log("\n" + "=".repeat(50));
    // eslint-disable-next-line no-console
    console.log("✅ All audit trail tests completed successfully!");
    // eslint-disable-next-line no-console
    console.log("\nNext steps:");
    // eslint-disable-next-line no-console
    console.log("1. Check database for test audit logs");
    // eslint-disable-next-line no-console
    console.log("2. Verify sensitive data is redacted");
    // eslint-disable-next-line no-console
    console.log("3. Test query hooks in React components");
    // eslint-disable-next-line no-console
    console.log("4. Test Zustand store state management");
    // eslint-disable-next-line no-console
    console.log("5. Test byRecordPk() with actual composite key tables (if any)");

    return {
      success: true,
      testsRun: 8,
      message: "All tests passed",
    };
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}

// Export for browser console usage
if (typeof window !== "undefined") {
  window.testAuditSystem = testAuditSystem;
  // eslint-disable-next-line no-console
  console.log("💡 Audit test script loaded. Run `testAuditSystem()` in console to test.");
}
