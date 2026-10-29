#!/usr/bin/env node

/**
 * Script to verify Cloudflare Functions local development setup
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("🔍 Verifying Cloudflare Functions Local Development Setup...\n");

// Check for required files
const requiredFiles = [
  { file: ".dev.vars", desc: "Local development secrets" },
  { file: "wrangler.toml", desc: "Wrangler configuration" },
  { file: "vite.config.ts", desc: "Vite configuration" },
  { file: "functions/_middleware.ts", desc: "Middleware function" },
];

let hasErrors = false;

console.log("📁 Checking required files:");
requiredFiles.forEach(({ file, desc }) => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file} - ${desc}`);
  } else {
    console.log(`  ❌ ${file} - ${desc} (MISSING)`);
    hasErrors = true;
  }
});

// Check for functions directory
console.log("\n📂 Checking functions directory:");
const functionsDir = path.join(projectRoot, "functions");
if (fs.existsSync(functionsDir)) {
  const apiDir = path.join(functionsDir, "api");
  if (fs.existsSync(apiDir)) {
    const files = fs.readdirSync(apiDir);
    console.log(`  ✅ Found ${files.length} API endpoints in functions/api/`);
    if (files.length > 0) {
      console.log(`     Examples: ${files.slice(0, 3).join(", ")}${files.length > 3 ? "..." : ""}`);
    }
  } else {
    console.log("  ⚠️  No api directory found in functions/");
  }
} else {
  console.log("  ❌ Functions directory not found!");
  hasErrors = true;
}

// Check package.json for Cloudflare plugin
console.log("\n📦 Checking dependencies:");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
if (packageJson.devDependencies?.["@cloudflare/vite-plugin"]) {
  console.log(
    `  ✅ @cloudflare/vite-plugin installed (v${packageJson.devDependencies["@cloudflare/vite-plugin"]})`
  );
} else {
  console.log("  ❌ @cloudflare/vite-plugin not found in devDependencies");
  hasErrors = true;
}

if (packageJson.devDependencies?.["@cloudflare/workers-types"]) {
  console.log(
    `  ✅ @cloudflare/workers-types installed (v${packageJson.devDependencies["@cloudflare/workers-types"]})`
  );
} else {
  console.log("  ⚠️  @cloudflare/workers-types not found (optional but recommended)");
}

// Check for dev scripts
console.log("\n📜 Checking npm scripts:");
const scripts = packageJson.scripts || {};
const devScripts = ["dev", "dev:cf", "dev:pages"];
devScripts.forEach((script) => {
  if (scripts[script]) {
    console.log(`  ✅ npm run ${script}: ${scripts[script].substring(0, 50)}...`);
  } else {
    console.log(`  ⚠️  npm run ${script} not found`);
  }
});

// Check Vite config for Cloudflare plugin
console.log("\n⚙️  Checking Vite configuration:");
const viteConfig = fs.readFileSync(path.join(projectRoot, "vite.config.ts"), "utf8");
if (viteConfig.includes("@cloudflare/vite-plugin")) {
  console.log("  ✅ Cloudflare plugin imported in vite.config.ts");
  if (viteConfig.includes("cloudflare({")) {
    console.log("  ✅ Cloudflare plugin configured");
  } else {
    console.log("  ⚠️  Cloudflare plugin imported but not configured");
  }
} else {
  console.log("  ❌ Cloudflare plugin not found in vite.config.ts");
  hasErrors = true;
}

// Check wrangler.toml configuration
console.log("\n🔧 Checking Wrangler configuration:");
const wranglerToml = fs.readFileSync(path.join(projectRoot, "wrangler.toml"), "utf8");
if (wranglerToml.includes("[dev]")) {
  console.log("  ✅ Development configuration found");
}
// Note: [env.development] should be commented out for Cloudflare Pages compatibility
if (wranglerToml.includes("# [env.development]")) {
  console.log("  ✅ Development environment commented out (correct for Pages deployment)");
} else if (wranglerToml.includes("[env.development]")) {
  console.log("  ⚠️  [env.development] is active - this will break Cloudflare Pages deployment!");
  console.log("     Cloudflare Pages only supports 'preview' and 'production' environments.");
}
if (wranglerToml.includes("RATE_LIMIT_KV")) {
  console.log("  ✅ KV namespace configured");
}

// Check for .dev.vars template
console.log("\n🔐 Checking environment variables:");
const devVarsPath = path.join(projectRoot, ".dev.vars");
if (fs.existsSync(devVarsPath)) {
  const devVars = fs.readFileSync(devVarsPath, "utf8");
  const requiredVars = ["SUPABASE_SERVICE_ROLE_KEY", "TURNSTILE_SECRET_KEY"];
  requiredVars.forEach((varName) => {
    if (devVars.includes(varName)) {
      const hasPlaceholder = devVars.includes(`${varName}=your-`);
      if (hasPlaceholder) {
        console.log(`  ⚠️  ${varName} found but still using placeholder value`);
      } else {
        console.log(`  ✅ ${varName} configured`);
      }
    } else {
      console.log(`  ❌ ${varName} not found in .dev.vars`);
    }
  });
}

// Summary
console.log("\n" + "=".repeat(60));
if (hasErrors) {
  console.log("❌ Setup has errors. Please fix the issues above.");
  process.exit(1);
} else {
  console.log("✅ Cloudflare Functions local development setup looks good!");
  console.log("\n📚 Next steps:");
  console.log("  1. Update .dev.vars with your actual secret keys");
  console.log("  2. Ensure .env.local has your VITE_* environment variables");
  console.log("  3. Run: npm run dev:cf");
  console.log("  4. Visit http://localhost:5173 for the frontend");
  console.log("  5. API endpoints will be available at http://localhost:5173/api/*");
  console.log("\n💡 Tips:");
  console.log("  - Functions will hot-reload when you make changes");
  console.log("  - Check console for Cloudflare Workers logs");
  console.log("  - Use wrangler tail for production logs");
}
