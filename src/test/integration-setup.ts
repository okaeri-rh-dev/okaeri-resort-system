/**
 * Integration Test Setup
 *
 * Manages Cloudflare Workers lifecycle during integration tests.
 * Starts Wrangler dev server before tests, stops it after.
 *
 * This setup is ONLY used for integration tests that need Workers endpoints.
 * Unit tests and component tests use mocked fetch.
 */

import { exec, type ChildProcess } from "child_process";

let wranglerProcess: ChildProcess | null = null;
const WORKERS_PORT = 8788;
const WORKERS_URL = `http://localhost:${WORKERS_PORT}`;
const STARTUP_TIMEOUT = 30000; // 30 seconds
const HEALTH_CHECK_INTERVAL = 500; // 500ms

/**
 * Check if Workers are ready by polling health endpoint
 */
async function waitForWorkersReady(): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < STARTUP_TIMEOUT) {
    try {
      const response = await fetch(`${WORKERS_URL}/api/health`, {
        signal: AbortSignal.timeout(2000), // 2 second timeout per attempt
      });

      if (response.ok) {
        // eslint-disable-next-line no-console
        console.log("✅ Cloudflare Workers ready at", WORKERS_URL);
        return true;
      }
    } catch (_error) {
      // Expected during startup - continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
  }

  return false;
}

/**
 * Start Cloudflare Workers using Wrangler
 */
export async function startWorkers(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("🚀 Starting Cloudflare Workers for integration tests...");

  return new Promise((resolve, reject) => {
    // Start Wrangler in pages dev mode (matches dev:wrangler script)
    wranglerProcess = exec(`npx wrangler pages dev public --port ${WORKERS_PORT} --local`, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    // Log Wrangler output for debugging
    wranglerProcess.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Ready on") || output.includes("Listening")) {
        // eslint-disable-next-line no-console
        console.log("📡 Wrangler:", output.trim());
      }
    });

    wranglerProcess.stderr?.on("data", (data) => {
      const error = data.toString();
      // Ignore common Wrangler warnings
      if (!error.includes("ExperimentalWarning") && !error.includes("WARNING")) {
        console.error("⚠️  Wrangler stderr:", error.trim());
      }
    });

    wranglerProcess.on("error", (error) => {
      console.error("❌ Failed to start Wrangler:", error);
      reject(error);
    });

    // Wait for Workers to be ready before resolving
    waitForWorkersReady()
      .then((ready) => {
        if (ready) {
          resolve();
        } else {
          reject(new Error("Cloudflare Workers failed to start within timeout"));
        }
      })
      .catch(reject);
  });
}

/**
 * Stop Cloudflare Workers
 */
export async function stopWorkers(): Promise<void> {
  if (wranglerProcess) {
    // eslint-disable-next-line no-console
    console.log("🛑 Stopping Cloudflare Workers...");

    return new Promise((resolve) => {
      if (!wranglerProcess) {
        resolve();
        return;
      }

      wranglerProcess.on("exit", () => {
        // eslint-disable-next-line no-console
        console.log("✅ Cloudflare Workers stopped");
        wranglerProcess = null;
        resolve();
      });

      // Kill the process and all children
      if (wranglerProcess.pid) {
        try {
          // On Unix systems, kill process group
          process.kill(-wranglerProcess.pid, "SIGTERM");
        } catch (error) {
          // Fallback: kill just the main process
          wranglerProcess.kill("SIGTERM");
        }
      }

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (wranglerProcess && !wranglerProcess.killed) {
          console.warn("⚠️  Force killing Wrangler process");
          wranglerProcess.kill("SIGKILL");
        }
        resolve();
      }, 5000);
    });
  }
}

/**
 * Vitest globalSetup hook
 * Called once before all integration tests
 */
export async function setup() {
  await startWorkers();
}

/**
 * Vitest globalTeardown hook
 * Called once after all integration tests
 */
export async function teardown() {
  await stopWorkers();
}
