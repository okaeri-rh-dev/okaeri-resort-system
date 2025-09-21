/**
 * MSW Browser Setup
 * Configures Mock Service Worker for browser environment
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { mockDatabase } from "./db/mock-database";
import { seedDatabase } from "./db/seeders";

/**
 * Create the mock service worker
 */
export const worker = setupWorker(...handlers);

/**
 * Initialize the mock API system
 */
export async function initializeMockAPI(
  options: {
    /** Force reseed the database */
    forceSeed?: boolean;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Delay before starting (useful for debugging) */
    startDelay?: number;
  } = {}
): Promise<void> {
  const { forceSeed = false, verbose = true, startDelay = 0 } = options;

  if (startDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, startDelay));
  }

  try {
    // Initialize the database
    if (verbose) {
      console.log("🔧 [Mock API] Initializing database...");
    }
    await mockDatabase.initialize();

    // Seed the database if needed
    if (verbose) {
      console.log("🌱 [Mock API] Checking database seed status...");
    }

    const needsSeeding = await mockDatabase.needsSeeding();
    if (needsSeeding || forceSeed) {
      if (verbose) {
        console.log("🌱 [Mock API] Seeding database with test data...");
      }
      await seedDatabase({ force: forceSeed, verbose });
    } else {
      if (verbose) {
        console.log("✅ [Mock API] Database already seeded");
      }
    }

    // Start the service worker
    if (verbose) {
      console.log("🚀 [Mock API] Starting service worker...");
    }

    await worker.start({
      onUnhandledRequest: (request, print) => {
        // Only warn about unhandled API requests
        if (request.url.includes("/api/")) {
          print.warning();
        }
      },
      serviceWorker: {
        url: "/mockServiceWorker.js",
      },
    });

    if (verbose) {
      console.log("✅ [Mock API] Service worker started successfully");
      console.log("📊 [Mock API] Database statistics:");
      const stats = await mockDatabase.getStats();
      Object.entries(stats).forEach(([table, count]) => {
        console.log(`   ${table}: ${count} records`);
      });
    }
  } catch (error) {
    console.error("❌ [Mock API] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Stop the mock API system
 */
export async function stopMockAPI(): Promise<void> {
  worker.stop();
  await mockDatabase.close();
  console.log("🛑 [Mock API] Service worker stopped");
}

/**
 * Reset the mock database to initial seeded state
 */
export async function resetMockDatabase(): Promise<void> {
  console.log("🔄 [Mock API] Resetting database...");
  await seedDatabase({ force: true, verbose: true });
  console.log("✅ [Mock API] Database reset complete");
}

/**
 * Get mock database statistics
 */
export async function getMockDatabaseStats(): Promise<Record<string, number>> {
  return await mockDatabase.getStats();
}

/**
 * Export data for debugging/backup
 */
export async function exportMockData(): Promise<Record<string, any[]>> {
  return await mockDatabase.exportData();
}

/**
 * Development utilities (only available in development mode)
 */
export const mockAPIUtils = {
  worker,
  database: mockDatabase,
  reset: resetMockDatabase,
  stats: getMockDatabaseStats,
  export: exportMockData,
};
