#!/usr/bin/env node

/**
 * Supabase Key Verification Script
 *
 * This script decodes and verifies your Supabase keys to ensure
 * you're using the correct key types (anon vs service_role).
 *
 * Usage:
 *   node scripts/verify-supabase-keys.js
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function decodeJWT(token) {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (base64)
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return payload;
  } catch (error) {
    return null;
  }
}

function checkKeyType(key, expectedRole) {
  const decoded = decodeJWT(key);

  if (!decoded) {
    log(`  ❌ Invalid JWT format`, "red");
    return false;
  }

  const actualRole = decoded.role;
  const issuer = decoded.iss || "unknown";

  log(`  🔍 Decoded JWT:`, "cyan");
  log(`     Role: ${actualRole}`, "cyan");
  log(`     Issuer: ${issuer}`, "cyan");
  log(`     Expires: ${decoded.exp ? new Date(decoded.exp * 1000).toISOString() : "N/A"}`, "cyan");

  if (actualRole === expectedRole) {
    log(`  ✅ Correct! Role is "${actualRole}"`, "green");
    return true;
  } else {
    log(`  ❌ WRONG! Expected "${expectedRole}", got "${actualRole}"`, "red");
    return false;
  }
}

function loadEnvFile() {
  try {
    const envPath = join(dirname(__dirname), ".env.local");
    const envContent = readFileSync(envPath, "utf8");

    const env = {};
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join("=").trim();
      }
    });

    return env;
  } catch (error) {
    log(`❌ Could not read .env.local: ${error.message}`, "red");
    return null;
  }
}

function main() {
  log("\n" + "=".repeat(60), "blue");
  log("   SUPABASE KEY VERIFICATION", "bold");
  log("=".repeat(60) + "\n", "blue");

  const env = loadEnvFile();
  if (!env) {
    process.exit(1);
  }

  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = env.VITE_SUPABASE_URL;

  log("📋 Environment Variables:", "cyan");
  log(`  VITE_SUPABASE_URL: ${supabaseUrl || "❌ NOT SET"}`, supabaseUrl ? "green" : "red");
  log(
    `  VITE_SUPABASE_ANON_KEY: ${anonKey ? "✓ Present" : "❌ NOT SET"}`,
    anonKey ? "green" : "red"
  );
  log(
    `  SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? "✓ Present" : "❌ NOT SET"}`,
    serviceKey ? "green" : "red"
  );
  log("");

  let allCorrect = true;

  // Check anon key
  if (anonKey) {
    log("🔑 Checking VITE_SUPABASE_ANON_KEY (Frontend Key):", "yellow");
    log(`  Key preview: ${anonKey.substring(0, 30)}...`, "cyan");

    const anonCorrect = checkKeyType(anonKey, "anon");
    allCorrect = allCorrect && anonCorrect;

    if (!anonCorrect) {
      log("", "reset");
      log('  ⚠️  WARNING: This key should be role "anon" for frontend use!', "yellow");
      log('  If this is "service_role", it bypasses RLS and is a security risk.', "yellow");
    }
    log("");
  } else {
    log("❌ VITE_SUPABASE_ANON_KEY is not set!", "red");
    allCorrect = false;
    log("");
  }

  // Check service role key
  if (serviceKey) {
    log("🔑 Checking SUPABASE_SERVICE_ROLE_KEY (Backend Key):", "yellow");
    log(`  Key preview: ${serviceKey.substring(0, 30)}...`, "cyan");

    const serviceCorrect = checkKeyType(serviceKey, "service_role");
    allCorrect = allCorrect && serviceCorrect;

    if (!serviceCorrect) {
      log("", "reset");
      log('  ⚠️  WARNING: This key should be role "service_role" for backend use!', "yellow");
      log('  If this is "anon", it won\'t bypass RLS as expected.', "yellow");
    }
    log("");
  } else {
    log("❌ SUPABASE_SERVICE_ROLE_KEY is not set!", "red");
    allCorrect = false;
    log("");
  }

  // Summary
  log("=".repeat(60), "blue");
  if (allCorrect) {
    log("✅ ALL KEYS ARE CORRECT!", "green");
    log("Your Supabase configuration is properly set up.", "green");
  } else {
    log("❌ KEY CONFIGURATION ISSUES DETECTED", "red");
    log("", "reset");
    log("To fix:", "yellow");
    log("1. Run: npx supabase status", "yellow");
    log("2. Copy the correct keys:", "yellow");
    log("   - Publishable key → VITE_SUPABASE_ANON_KEY", "yellow");
    log("   - Secret key → SUPABASE_SERVICE_ROLE_KEY", "yellow");
    log("3. Update your .env.local file", "yellow");
    log("4. Restart your dev server", "yellow");
  }
  log("=".repeat(60) + "\n", "blue");

  process.exit(allCorrect ? 0 : 1);
}

main();
