/**
 * Pricing Config Test Seed Data
 *
 * Seeds the pricing_config table with realistic test data for pricing calculations.
 * This data is used by property-based tests and integration tests.
 *
 * Pricing Structure:
 * - Base Rate: ₱1,250/night (for base occupancy)
 * - Weekend Rate: ₱1,500/night (Friday-Saturday)
 * - Extra Person Rate: ₱500/night (above base occupancy)
 * - Base Occupancy: 2 guests (included in base rate)
 * - Max Capacity: 4 guests per unit
 * - Downpayment: 30% of total amount
 */

import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

type PricingConfig = Database["public"]["Tables"]["pricing_config"]["Insert"];

/**
 * Test pricing configuration matching Philippine resort pricing
 * Based on Chunk 005 pricing specifications
 */
export const TEST_PRICING_CONFIG: PricingConfig = {
  id: "test-pricing-config-001", // Fixed ID for test predictability
  base_rate: 1250, // ₱1,250/night base rate
  weekend_rate: 1500, // ₱1,500/night weekend rate (20% premium)
  extra_person_rate: 500, // ₱500/night per extra person
  base_occupancy: 2, // 2 guests included in base rate
  max_capacity_per_unit: 4, // Maximum 4 guests per unit
  downpayment_percent: 30, // 30% downpayment required
  currency: "PHP", // Philippine Peso
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Seed the pricing_config table with test data
 * Uses upsert to handle both initial seed and re-runs
 */
export async function seedPricingConfig(): Promise<void> {
  // Try multiple environment variable names (VITE_, TEST_, plain)
  const supabaseUrl =
    getEnv("VITE_SUPABASE_URL") ||
    (typeof process !== "undefined" && process.env.TEST_SUPABASE_URL);
  const supabaseKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    (typeof process !== "undefined" && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️  Skipping pricing_config seed - Supabase credentials not configured");
    return;
  }

  // Type assertion: We've checked they're defined above
  const supabase = createClient<Database>(supabaseUrl as string, supabaseKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("🌱 Seeding pricing_config table...");

    // Upsert pricing config (insert or update if exists)
    const { error } = await supabase
      .from("pricing_config")
      .upsert(TEST_PRICING_CONFIG, {
        onConflict: "id", // Update if ID already exists
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("❌ Failed to seed pricing_config:", error.message);
      throw error;
    }

    console.log("✅ Successfully seeded pricing_config table");
    console.log("   Base Rate: ₱" + TEST_PRICING_CONFIG.base_rate);
    console.log("   Weekend Rate: ₱" + TEST_PRICING_CONFIG.weekend_rate);
    console.log("   Extra Person Rate: ₱" + TEST_PRICING_CONFIG.extra_person_rate);
  } catch (error) {
    console.error("❌ Error seeding pricing_config:", error);
    throw error;
  }
}

/**
 * Clean up test pricing configuration
 * Called after tests complete
 */
export async function cleanupPricingConfig(): Promise<void> {
  const supabaseUrl =
    getEnv("VITE_SUPABASE_URL") ||
    (typeof process !== "undefined" && process.env.TEST_SUPABASE_URL);
  const supabaseKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    (typeof process !== "undefined" && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  // Type assertion: We've checked they're defined above
  const supabase = createClient<Database>(supabaseUrl as string, supabaseKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("🧹 Cleaning up pricing_config test data...");

    const { error } = await supabase
      .from("pricing_config")
      .delete()
      .eq("id", TEST_PRICING_CONFIG.id!);

    if (error) {
      console.warn("⚠️  Failed to cleanup pricing_config:", error.message);
    } else {
      console.log("✅ Successfully cleaned up pricing_config test data");
    }
  } catch (error) {
    console.warn("⚠️  Error cleaning up pricing_config:", error);
  }
}

/**
 * Verify pricing configuration is correctly seeded
 * Useful for debugging test failures
 */
export async function verifyPricingConfig(): Promise<boolean> {
  const supabaseUrl =
    getEnv("VITE_SUPABASE_URL") ||
    (typeof process !== "undefined" && process.env.TEST_SUPABASE_URL);
  const supabaseKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    (typeof process !== "undefined" && process.env.TEST_SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !supabaseKey) {
    return false;
  }

  // Type assertion: We've checked they're defined above
  const supabase = createClient<Database>(supabaseUrl as string, supabaseKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data, error } = await supabase
      .from("pricing_config")
      .select("*")
      .eq("id", TEST_PRICING_CONFIG.id!)
      .single();

    if (error || !data) {
      console.error("❌ Pricing config verification failed:", error?.message);
      return false;
    }

    console.log("✅ Pricing config verified:", {
      base_rate: data.base_rate,
      weekend_rate: data.weekend_rate,
      extra_person_rate: data.extra_person_rate,
    });

    return true;
  } catch (error) {
    console.error("❌ Error verifying pricing_config:", error);
    return false;
  }
}
