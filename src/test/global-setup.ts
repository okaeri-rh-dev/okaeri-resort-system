/**
 * Vitest Global Setup
 * Runs once before all tests start
 * Handles database availability check and automatic restart if needed
 */

import { execSync } from "child_process";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { seedPricingConfig } from "./seeds/pricing-config";

// Load environment variables for database connection
const TEST_SUPABASE_URL =
  process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const TEST_SERVICE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"; // Default local Supabase service key

/**
 * Restart Supabase local instance
 * Attempts to stop and then start Supabase using CLI commands
 * @returns true if restart succeeded, false if it failed
 */
async function restartSupabase(): Promise<boolean> {
  try {
    // eslint-disable-next-line no-console
    console.log("🔄 Attempting to restart Supabase...");

    // Stop Supabase
    try {
      // eslint-disable-next-line no-console
      console.log("   Stopping Supabase...");
      execSync("npx supabase stop", { stdio: "inherit" });
    } catch (_stopError) {
      console.warn("   Warning: supabase stop failed, continuing anyway...");
    }

    // Start Supabase
    // eslint-disable-next-line no-console
    console.log("   Starting Supabase...");
    execSync("npx supabase start", { stdio: "inherit" });

    // eslint-disable-next-line no-console
    console.log("✅ Supabase restarted successfully");

    // Wait a bit for services to be fully ready
    await new Promise((r) => setTimeout(r, 3000));

    return true;
  } catch (error) {
    console.error("❌ Failed to restart Supabase:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Check if database is available and restart if needed
 */
async function checkDatabaseAvailability(): Promise<boolean> {
  // Skip if not using local database
  if (!TEST_SUPABASE_URL || TEST_SUPABASE_URL === "http://localhost:54321") {
    if (!TEST_SERVICE_KEY) {
      // eslint-disable-next-line no-console
      console.log("⏭️  Skipping database availability check - no service key configured");
      return false;
    }
  }

  // Create admin client for availability check (bypasses RLS)
  const testSupabaseAdmin = createClient<Database>(TEST_SUPABASE_URL, TEST_SERVICE_KEY);

  // Try to connect to database (2 attempts)
  // eslint-disable-next-line no-console
  console.log("🔍 Checking database availability...");
  for (let i = 0; i < 2; i++) {
    try {
      const { error } = await testSupabaseAdmin.from("units").select("unit_id").limit(1);

      if (!error) {
        // eslint-disable-next-line no-console
        console.log("✅ Test database is ready");
        return true;
      }
    } catch (_e) {
      // eslint-disable-next-line no-console
      console.log(`   Database not ready (attempt ${i + 1}/2)`);
      await new Promise((r) => setTimeout(r, 1000)); // Wait 1 second
    }
  }

  console.warn("⚠️  Test database not available after 2 attempts");

  // Try to restart Supabase
  // eslint-disable-next-line no-console
  console.log("🔄 Attempting to restart Supabase...");
  const restartSuccess = await restartSupabase();

  if (!restartSuccess) {
    console.error("❌ Failed to restart Supabase. Tests will be skipped.");
    return false;
  }

  // After restart, check again if database is available
  // eslint-disable-next-line no-console
  console.log("🔍 Verifying database connection after restart...");
  for (let i = 0; i < 3; i++) {
    try {
      const { error } = await testSupabaseAdmin.from("units").select("unit_id").limit(1);

      if (!error) {
        // eslint-disable-next-line no-console
        console.log("✅ Test database is ready after restart");
        return true;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`   Database not ready after restart (attempt ${i + 1}/3)`);
      await new Promise((r) => setTimeout(r, 2000)); // Wait 2 seconds
    }
  }

  console.error("❌ Database still not available after restart. Tests will be skipped.");
  return false;
}

/**
 * Global setup function - runs once before all tests
 */
export default async function globalSetup() {
  // eslint-disable-next-line no-console
  console.log("\n" + "=".repeat(80));
  // eslint-disable-next-line no-console
  console.log("VITEST GLOBAL SETUP - Database Availability Check");
  // eslint-disable-next-line no-console
  console.log("=".repeat(80) + "\n");

  const dbAvailable = await checkDatabaseAvailability();

  // Seed test data if database is available
  if (dbAvailable) {
    try {
      await seedPricingConfig();
    } catch (error) {
      console.warn("⚠️  Failed to seed test data, tests may fail:", error);
    }
  }

  // eslint-disable-next-line no-console
  console.log("\n" + "=".repeat(80));
  // eslint-disable-next-line no-console
  console.log("STARTING TEST EXECUTION");
  // eslint-disable-next-line no-console
  console.log("=".repeat(80) + "\n");
}
