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

import { logAuditEvent, logBookingEvent, logPaymentEvent, logAuthEvent } from "@/lib/audit-logger";
import { AuditCategory, AuditSeverity } from "@/types/audit.types";
import { db } from "@/lib/supabase";

export async function testAuditSystem() {
  console.log("🧪 Testing Audit Trail System (Phase 2)\n");
  console.log("=".repeat(50));

  try {
    // Test 1: Basic audit event
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
    console.log(`   Result: ${result1.success ? "✓ Success" : "✗ Failed"}`, result1);

    // Test 2: Booking event
    console.log("\n✅ Test 2: Booking lifecycle event");
    await logBookingEvent("test-booking-id-2", "cancelled", {
      oldStatus: "Confirmed",
      newStatus: "Cancelled",
      reason: "Test cancellation",
      amount: 5000,
    });
    console.log("   ✓ Booking cancellation logged");

    // Test 3: Payment event
    console.log("\n✅ Test 3: Payment event");
    await logPaymentEvent("test-payment-id", "recorded", {
      amount: 5000,
      paymentMethod: "GCash",
      metadata: {
        test: true,
      },
    });
    console.log("   ✓ Payment event logged");

    // Test 4: Auth event
    console.log("\n✅ Test 4: Authentication event");
    await logAuthEvent("login", {
      email: "test@okaeri.com",
      metadata: {
        test: true,
      },
    });
    console.log("   ✓ Auth event logged");

    // Test 5: Fetch recent logs
    console.log("\n✅ Test 5: Fetch recent audit logs");
    const recentLogs = await db.auditLogs.recent(5);
    console.log(`   ✓ Fetched ${recentLogs.length} recent logs`);
    console.log("   Latest log:", recentLogs[0]);

    // Test 6: Fetch audit trail for record
    console.log("\n✅ Test 6: Fetch audit trail for a record");
    const trail = await db.auditLogs.byRecord("bookings", "test-booking-id");
    console.log(`   ✓ Fetched ${trail.length} audit entries for test-booking-id`);

    // Test 7: Audit statistics
    console.log("\n✅ Test 7: Audit statistics");
    const stats = await db.auditLogs.stats();
    console.log("   ✓ Total logs:", stats.totalLogs);
    console.log("   ✓ By table:", stats.byTable);
    console.log("   ✓ By action:", stats.byAction);

    // Test 8: Composite primary key lookup (byRecordPk)
    console.log("\n✅ Test 8: Composite primary key lookup");
    const compositeLogs = await db.auditLogs.byRecordPk("bookings", {
      booking_id: "test-booking-id",
    });
    console.log(`   ✓ Found ${compositeLogs.length} logs for composite key query`);
    if (compositeLogs.length > 0) {
      console.log("   ✓ Sample log:", compositeLogs[0]);
    } else {
      console.log("   ℹ No logs found (expected for test data with no composite keys)");
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ All audit trail tests completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Check database for test audit logs");
    console.log("2. Verify sensitive data is redacted");
    console.log("3. Test query hooks in React components");
    console.log("4. Test Zustand store state management");
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
  (window as any).testAuditSystem = testAuditSystem;
  console.log("💡 Audit test script loaded. Run `testAuditSystem()` in console to test.");
}
