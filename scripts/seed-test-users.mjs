#!/usr/bin/env node
/**
 * Seed E2E Test Users
 *
 * Creates the test users that the Playwright e2e suite relies on
 * (admin, owner, staff, logout) and assigns them their corresponding app_roles.
 * Idempotent: existing users/roles are detected and left intact.
 *
 * Reads credentials from .env.test (TEST_*_EMAIL / TEST_*_PASSWORD) and
 * Supabase admin credentials from .dev.vars (SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY). Override via env vars if needed.
 *
 * Usage:
 *   npm run seed:test-users
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

function loadDotenv(path) {
  try {
    const text = readFileSync(path, "utf8");
    const out = {};
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const envTest = loadDotenv(resolve(ROOT, ".env.test"));
const devVars = loadDotenv(resolve(ROOT, ".dev.vars"));

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  devVars.SUPABASE_URL ||
  envTest.VITE_SUPABASE_URL ||
  "http://127.0.0.1:54321";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || devVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY (looked in env + .dev.vars).");
  process.exit(1);
}

const USERS = [
  {
    label: "admin",
    role: "admin",
    email: process.env.TEST_ADMIN_EMAIL || envTest.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD || envTest.TEST_ADMIN_PASSWORD,
  },
  {
    label: "owner",
    role: "owner",
    email: process.env.TEST_OWNER_EMAIL || envTest.TEST_OWNER_EMAIL,
    password: process.env.TEST_OWNER_PASSWORD || envTest.TEST_OWNER_PASSWORD,
  },
  {
    label: "staff",
    role: "staff",
    email: process.env.TEST_STAFF_EMAIL || envTest.TEST_STAFF_EMAIL,
    password: process.env.TEST_STAFF_PASSWORD || envTest.TEST_STAFF_PASSWORD,
  },
  // Signing out revokes every session of the user, so the logout tests get a user no saved session uses.
  { label: "logout", role: "staff", email: "logout@okaeri.test", password: "test-password" },
];

const missing = USERS.filter((u) => !u.email || !u.password);
if (missing.length > 0) {
  console.error(
    `Missing test credentials for: ${missing.map((m) => m.label).join(", ")}. ` +
      "Set TEST_<ROLE>_EMAIL and TEST_<ROLE>_PASSWORD in .env.test."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAuthUser({ label, email, password }) {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`listUsers failed (${label}): ${listErr.message}`);

  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  [${label}] auth user already exists (id=${existing.id})`);
    return existing.id;
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { seeded_for: "e2e", role: label },
  });
  if (createErr) throw new Error(`createUser failed (${label}): ${createErr.message}`);
  console.log(`  [${label}] auth user created (id=${created.user.id})`);
  return created.user.id;
}

async function ensureAppRole({ userId, email, role, label }) {
  const { data: existing, error: readErr } = await supabase
    .from("app_roles")
    .select("user_id, role, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) throw new Error(`app_roles read failed (${label}): ${readErr.message}`);

  if (existing && existing.role === role && existing.is_active) {
    console.log(`  [${label}] app_role already set (${role})`);
    return;
  }

  const { error: upsertErr } = await supabase.from("app_roles").upsert(
    {
      user_id: userId,
      email,
      role,
      is_active: true,
      notes: "Seeded for e2e tests by scripts/seed-test-users.mjs",
      granted_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertErr) throw new Error(`app_roles upsert failed (${label}): ${upsertErr.message}`);
  console.log(`  [${label}] app_role assigned (${role})`);
}

async function main() {
  console.log(`Seeding e2e test users into ${SUPABASE_URL}`);
  for (const user of USERS) {
    console.log(`\n${user.label} (${user.email}):`);
    const userId = await ensureAuthUser(user);
    await ensureAppRole({ ...user, userId });
  }
  console.log("\nDone. E2E tests should now be able to log in.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
