/// <reference types="vitest" />
import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Load env file for tests - try .env.test first, then .env.local, then .env
  const env = loadEnv(mode || "test", process.cwd(), "");

  // Override with test-specific values
  const testEnv = {
    ...env,
    // Force local Supabase for tests
    VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    VITE_SUPABASE_ANON_KEY:
      env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    SUPABASE_SERVICE_ROLE_KEY:
      env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    TEST_SUPABASE_URL: "http://127.0.0.1:54321",
    TEST_SUPABASE_ANON_KEY:
      env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    TEST_SUPABASE_SERVICE_ROLE_KEY:
      env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
  };

  return {
    plugins: [react(), tsconfigPaths()],
    test: {
      // Test environment configuration
      environment: "happy-dom",
      globals: true,
      globalSetup: ["./src/test/global-setup.ts"],
      setupFiles: ["./src/test/setup.ts", "./__tests__/setup/msw-setup.ts"],
      // Make env variables available to tests
      env: {
        ...testEnv,
        // Workers API base URL for integration tests
        VITE_API_URL: "http://localhost:8788",
      },

      // Coverage configuration
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        exclude: [
          "node_modules/",
          "src/test/",
          "*.config.ts",
          "**/*.d.ts",
          "src/main.tsx",
          "src/vite-env.d.ts",
          "src/types/database.types.ts", // Generated file
        ],
        thresholds: {
          branches: 70,
          functions: 70,
          lines: 80,
          statements: 80,
        },
      },

      // Test execution configuration
      include: ["src/**/*.{test,spec}.{ts,tsx}", "__tests__/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
      testTimeout: 10000,
      hookTimeout: 10000,

      // Mock configuration
      mockReset: true,
      restoreMocks: true,
      clearMocks: true,

      // Aliases for testing
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@/test": path.resolve(__dirname, "./src/test"),
      },

      // Reporter configuration
      reporters: ["default", "html"],
      outputFile: {
        html: "./test-results/index.html",
      },

      // Watch configuration for development
      watchExclude: ["**/node_modules/**", "**/dist/**"],

      // Thread configuration for performance
      // Tests run in threads for within-file parallelism, but files run sequentially
      // to prevent database connection pool exhaustion and data conflicts
      threads: true,
      maxThreads: 4,
      minThreads: 1,

      // File-level parallelism: DISABLED
      // Reason: Database tests share state and race conditions occur when running
      // test files in parallel. The 77s execution time is acceptable for reliability.
      //
      // Future optimization options:
      // 1. CI/CD: Use --shard flag to split tests across multiple runners
      //    Example: vitest run --shard=1/4, vitest run --shard=2/4, etc.
      // 2. Local: Run unit tests separately with --grep to exclude database tests
      //    Example: npm run test:unit (excludes database tests)
      fileParallelism: false,
    },

    // Resolve configuration for tests
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
