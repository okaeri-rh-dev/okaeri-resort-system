#!/usr/bin/env node

/**
 * Development Role Seeding Script
 * Seeds app_roles table with test users for development environment
 *
 * Usage:
 *   npm run seed:roles:dev
 *   tsx scripts/seed-dev-roles.ts
 */
import { createClient } from "@supabase/supabase-js";

import { AuditRole } from "../src/lib/audit-roles";

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

// Development test users
const devUsers = [
  { email: "dev-admin@localhost", role: AuditRole.ADMIN },
  { email: "dev-owner@localhost", role: AuditRole.OWNER },
  { email: "dev-manager@localhost", role: AuditRole.MANAGER },
  { email: "dev-staff@localhost", role: AuditRole.STAFF },
];

async function seedDevRoles() {
  console.log("🌱 Seeding development roles...\n");

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const user of devUsers) {
    try {
      // Find user by email in auth.users
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error(`❌ Error listing users: ${authError.message}`);
        errorCount++;
        continue;
      }

      const authUser = authUsers.users.find((u) => u.email === user.email);

      if (!authUser) {
        console.log(`⚠️  User ${user.email} not found in auth.users, skipping...`);
        console.log(`   (Create this user first via Supabase Auth)`);
        skipCount++;
        continue;
      }

      // Check if role already exists
      const { data: existingRole } = await supabase
        .from("app_roles")
        .select("role, is_active")
        .eq("user_id", authUser.id)
        .single();

      if (existingRole) {
        if (existingRole.role === user.role && existingRole.is_active) {
          console.log(`⏭️  ${user.email} already has ${user.role} role, skipping...`);
          skipCount++;
        } else {
          // Update existing role
          const { error: updateError } = await supabase
            .from("app_roles")
            .update({
              role: user.role,
              is_active: true,
              notes: "Updated via dev seeding script",
              granted_at: new Date().toISOString(),
            })
            .eq("user_id", authUser.id);

          if (updateError) {
            console.error(
              `❌ Failed to update ${user.role} for ${user.email}: ${updateError.message}`
            );
            errorCount++;
          } else {
            console.log(`✅ Updated ${user.email} to ${user.role} role`);
            successCount++;
          }
        }
        continue;
      }

      // Grant new role
      const { error: insertError } = await supabase.from("app_roles").insert({
        user_id: authUser.id,
        email: user.email,
        role: user.role,
        granted_by: authUser.id, // Self-granted for dev
        granted_at: new Date().toISOString(),
        is_active: true,
        notes: "Auto-seeded for development",
      });

      if (insertError) {
        console.error(`❌ Failed to grant ${user.role} to ${user.email}: ${insertError.message}`);
        errorCount++;
      } else {
        console.log(`✅ Granted ${user.role} to ${user.email}`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Unexpected error for ${user.email}:`, error);
      errorCount++;
    }
  }

  console.log("\n📊 Summary:");
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  if (skipCount > 0) {
    console.log("\n💡 Tip: Create missing test users via Supabase Dashboard:");
    console.log("   1. Go to Authentication → Users");
    console.log("   2. Click 'Add User'");
    console.log("   3. Enter the dev email addresses above");
    console.log("   4. Run this script again");
  }

  console.log("\n✨ Development role seeding complete!");
}

// Run the seeding
seedDevRoles().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
