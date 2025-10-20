/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "path";
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
      setupFiles: ["./src/test/setup.ts"],
      // Make env variables available to tests
      env: testEnv,

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
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
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
      // Reduced from 4 to 2 threads to prevent database connection pool exhaustion
      // Database tests create multiple connections per thread, causing TIME_WAIT accumulation
      threads: true,
      maxThreads: 4,
      minThreads: 1,

      // File-level parallelism control
      fileParallelism: false, // Run test files sequentially to prevent database connection issues
    },

    // Resolve configuration for tests
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
