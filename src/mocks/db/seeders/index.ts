/**
 * Database Seeder
 * Populates the mock database with realistic Philippine resort data
 */

import { mockDatabase } from "../mock-database";
import { userSeeds, mockCredentials } from "./users";
import { projectSeeds, projectMembershipSeeds } from "./projects";
import { bookingSeeds } from "./bookings";

/**
 * Seeder configuration
 */
export interface SeederConfig {
  /** Force reseed even if data exists */
  force?: boolean;
  /** Only seed specific entities */
  entities?: ("users" | "projects" | "memberships" | "bookings" | "expenses")[];
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Database Seeder Class
 */
export class DatabaseSeeder {
  private config: SeederConfig;

  constructor(config: SeederConfig = {}) {
    this.config = {
      force: false,
      entities: ["users", "projects", "memberships", "bookings"],
      verbose: true,
      ...config,
    };
  }

  /**
   * Run all seeders
   */
  async seed(): Promise<void> {
    try {
      await mockDatabase.initialize();

      const startTime = Date.now();
      this.log("🌱 Starting database seeding...");

      // Check if database needs seeding
      if (!this.config.force) {
        const needsSeeding = await mockDatabase.needsSeeding();
        if (!needsSeeding) {
          this.log("✅ Database already contains data. Use force: true to reseed.");
          return;
        }
      } else {
        this.log("🔄 Force reseeding - clearing existing data...");
        await mockDatabase.clearAllData();
      }

      // Seed entities in dependency order
      const entities = this.config.entities || [];

      if (entities.includes("users")) {
        await this.seedUsers();
      }

      if (entities.includes("projects")) {
        await this.seedProjects();
      }

      if (entities.includes("memberships")) {
        await this.seedMemberships();
      }

      if (entities.includes("bookings")) {
        await this.seedBookings();
      }

      if (entities.includes("expenses")) {
        await this.seedExpenses();
      }

      const duration = Date.now() - startTime;
      this.log(`✅ Database seeding completed in ${duration}ms`);

      // Display seeding summary
      await this.showSummary();
    } catch (error) {
      console.error("❌ Database seeding failed:", error);
      throw error;
    }
  }

  /**
   * Seed users
   */
  private async seedUsers(): Promise<void> {
    this.log("👥 Seeding users...");

    for (const user of userSeeds) {
      try {
        await mockDatabase.createUser(user);
        this.log(`  ✓ Created user: ${user.name} (${user.email})`);
      } catch (error) {
        this.log(`  ⚠️ Failed to create user ${user.email}: ${error}`);
      }
    }

    this.log(`  📊 Total users seeded: ${userSeeds.length}`);
  }

  /**
   * Seed projects
   */
  private async seedProjects(): Promise<void> {
    this.log("🏨 Seeding projects...");

    for (const project of projectSeeds) {
      try {
        await mockDatabase.createProject(project);
        this.log(`  ✓ Created project: ${project.name} (${project.type})`);
      } catch (error) {
        this.log(`  ⚠️ Failed to create project ${project.name}: ${error}`);
      }
    }

    this.log(`  📊 Total projects seeded: ${projectSeeds.length}`);
  }

  /**
   * Seed project memberships
   */
  private async seedMemberships(): Promise<void> {
    this.log("🤝 Seeding project memberships...");

    for (const membership of projectMembershipSeeds) {
      try {
        await mockDatabase.createProjectMembership(membership);
        this.log(`  ✓ Created membership: ${membership.role} for project ${membership.projectId}`);
      } catch (error) {
        this.log(`  ⚠️ Failed to create membership: ${error}`);
      }
    }

    this.log(`  📊 Total memberships seeded: ${projectMembershipSeeds.length}`);
  }

  /**
   * Seed bookings
   */
  private async seedBookings(): Promise<void> {
    this.log("📅 Seeding bookings...");

    for (const booking of bookingSeeds) {
      try {
        await mockDatabase.createBooking(booking);
        this.log(`  ✓ Created booking: ${booking.guestName} (${booking.status})`);
      } catch (error) {
        this.log(`  ⚠️ Failed to create booking for ${booking.guestName}: ${error}`);
      }
    }

    this.log(`  📊 Total bookings seeded: ${bookingSeeds.length}`);
  }

  /**
   * Seed expenses (placeholder for future implementation)
   */
  private async seedExpenses(): Promise<void> {
    this.log("💰 Seeding expenses...");
    // TODO: Implement expense seeding
    this.log("  ℹ️ Expense seeding not yet implemented");
  }

  /**
   * Show seeding summary
   */
  private async showSummary(): Promise<void> {
    const stats = await mockDatabase.getStats();

    this.log("\n📈 Database Summary:");
    this.log("─".repeat(40));
    Object.entries(stats).forEach(([entity, count]) => {
      this.log(`  ${entity.padEnd(20)}: ${count.toString().padStart(3)} records`);
    });
    this.log("─".repeat(40));

    // Show login credentials for development
    if (this.config.verbose) {
      this.log("\n🔑 Test Login Credentials:");
      this.log("─".repeat(50));
      Object.entries(mockCredentials).forEach(([email, password]) => {
        const user = userSeeds.find((u) => u.email === email);
        if (user) {
          this.log(`  ${user.role.padEnd(12)} | ${email.padEnd(30)} | ${password}`);
        }
      });
      this.log("─".repeat(50));
    }
  }

  /**
   * Utility logging method
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[MockDB Seeder] ${message}`);
    }
  }
}

/**
 * Quick seed function for common usage
 */
export async function seedDatabase(config: SeederConfig = {}): Promise<void> {
  const seeder = new DatabaseSeeder(config);
  await seeder.seed();
}

/**
 * Export seeds for direct access
 */
export { userSeeds, projectSeeds, projectMembershipSeeds, bookingSeeds, mockCredentials };

/**
 * Export test data helpers
 */
export { testUsers } from "./users";
export { testProjects } from "./projects";
export { testBookings } from "./bookings";
