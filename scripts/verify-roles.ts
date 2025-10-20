#!/usr/bin/env node

/**
 * Role Verification Script
 * Displays current role assignments and validates configuration
 *
 * Usage:
 *   npm run seed:roles:verify
 *   tsx scripts/verify-roles.ts
 */
import { createClient } from "@supabase/supabase-js";

// Use service role key for admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  console.error("   Make sure to set these in your .env.local file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function verifyRoles() {
  console.log("\n📋 Fetching Current Role Assignments...\n");

  try {
    // Get all roles
    const { data: roles, error: rolesError } = await supabase
      .from("app_roles")
      .select("*")
      .order("role")
      .order("granted_at", { ascending: false });

    if (rolesError) {
      console.error("❌ Error fetching roles:", rolesError.message);
      process.exit(1);
    }

    if (!roles || roles.length === 0) {
      console.log("⚠️  No roles found in app_roles table");
      console.log("\n💡 Run 'npm run seed:roles:dev' to seed development roles");
      return;
    }

    // Format data for display
    const formattedRoles = roles.map((r) => ({
      Email: r.email || "unknown",
      Role: r.role.toUpperCase(),
      Active: r.is_active ? "✅" : "❌",
      "Granted At": new Date(r.granted_at).toLocaleDateString(),
      Notes: r.notes?.substring(0, 30) || "-",
    }));

    // Display table
    console.table(formattedRoles);

    // Summary by role
    const summary: Record<string, number> = {};
    const activeSummary: Record<string, number> = {};

    roles.forEach((r) => {
      summary[r.role] = (summary[r.role] || 0) + 1;
      if (r.is_active) {
        activeSummary[r.role] = (activeSummary[r.role] || 0) + 1;
      }
    });

    console.log("\n📊 Role Distribution:");
    console.table({
      Admin: { Total: summary.admin || 0, Active: activeSummary.admin || 0 },
      Owner: { Total: summary.owner || 0, Active: activeSummary.owner || 0 },
      Manager: { Total: summary.manager || 0, Active: activeSummary.manager || 0 },
      Staff: { Total: summary.staff || 0, Active: activeSummary.staff || 0 },
    });

    // Warnings
    console.log("\n⚠️  Security Checks:");

    if (!activeSummary.admin || activeSummary.admin === 0) {
      console.log("   ❌ No active admin users - system may be locked!");
    } else {
      console.log("   ✅ At least one admin exists");
    }

    const inactiveCount = roles.filter((r) => !r.is_active).length;
    if (inactiveCount > 0) {
      console.log(`   ⚠️  ${inactiveCount} inactive role(s) found`);
    }

    // Test SQL helper functions
    console.log("\n🔧 Testing SQL Helper Functions:");

    try {
      const { data: currentRole, error: roleError } = await supabase.rpc("get_current_audit_role");
      if (roleError) {
        console.log("   ❌ get_current_audit_role() failed:", roleError.message);
      } else {
        console.log(`   ✅ get_current_audit_role() works (returns: ${currentRole || "none"})`);
      }
    } catch (error) {
      console.log("   ❌ get_current_audit_role() not found");
    }

    try {
      const { data: isAdmin, error: adminError } = await supabase.rpc("is_audit_admin");
      if (adminError) {
        console.log("   ❌ is_audit_admin() failed:", adminError.message);
      } else {
        console.log(`   ✅ is_audit_admin() works (returns: ${isAdmin})`);
      }
    } catch (error) {
      console.log("   ❌ is_audit_admin() not found");
    }

    console.log("\n✨ Role verification complete!");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run verification
verifyRoles();
