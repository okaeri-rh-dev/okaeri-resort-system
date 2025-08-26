#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration types
 */
type MigrationType = "global" | "project" | "both";

/**
 * Command line arguments
 */
interface CreateMigrationArgs {
  name: string;
  type: MigrationType;
  description?: string;
}

/**
 * Migration creator utility
 */
class MigrationCreator {
  private migrationsPath: string;
  private rl: readline.Interface;

  constructor() {
    this.migrationsPath = path.resolve(process.cwd(), "migrations");
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Ensure migrations directory exists
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }

    // Ensure rollback directory exists
    const rollbackPath = path.join(this.migrationsPath, "rollback");
    if (!fs.existsSync(rollbackPath)) {
      fs.mkdirSync(rollbackPath, { recursive: true });
    }
  }

  /**
   * Generate timestamp-based migration filename
   */
  private generateFilename(name: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "_");

    // Sanitize name
    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    return `${timestamp}_${sanitizedName}`;
  }

  /**
   * Get next migration number
   */
  private getNextMigrationNumber(): string {
    const files = fs
      .readdirSync(this.migrationsPath)
      .filter((f) => f.match(/^\d{4}_/))
      .sort();

    if (files.length === 0) {
      return "0003";
    }

    const lastFile = files[files.length - 1];
    const lastNumber = parseInt(lastFile.substring(0, 4));
    return String(lastNumber + 1).padStart(4, "0");
  }

  /**
   * Create global migration template
   */
  private createGlobalMigrationTemplate(name: string, description: string): string {
    return `-- Migration: ${name}
-- Description: ${description}
-- Created: ${new Date().toISOString().split("T")[0]}
-- Author: Okaeri Development Team

-- ============================================
-- GLOBAL SCHEMA MIGRATION
-- ============================================

-- Add your global schema changes here
-- This affects the public schema and all projects

-- Example: Add a new column to users table
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);

-- Example: Create a new global table
-- CREATE TABLE IF NOT EXISTS new_global_table (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT NOW() NOT NULL
-- );

-- Example: Add an index
-- CREATE INDEX IF NOT EXISTS idx_table_column ON table_name(column_name);

-- ============================================
-- END OF MIGRATION
-- ============================================`;
  }

  /**
   * Create project migration template
   */
  private createProjectMigrationTemplate(name: string, description: string): string {
    return `-- Migration: ${name}
-- Description: ${description}
-- Created: ${new Date().toISOString().split("T")[0]}
-- Author: Okaeri Development Team

-- ============================================
-- PROJECT SCHEMA MIGRATION TEMPLATE
-- ============================================
-- This template will be applied to each project schema
-- Replace {SCHEMA_NAME} with the actual schema name

-- Add your project-specific schema changes here

-- Example: Add a new column to bookings table
-- ALTER TABLE {SCHEMA_NAME}.bookings ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);

-- Example: Create a new project-specific table
-- CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.new_project_table (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     project_specific_field TEXT,
--     created_at TIMESTAMP DEFAULT NOW() NOT NULL
-- );

-- Example: Add an index
-- CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_table_column 
-- ON {SCHEMA_NAME}.table_name(column_name);

-- Example: Update existing data
-- UPDATE {SCHEMA_NAME}.table_name 
-- SET column = 'new_value' 
-- WHERE condition = true;

-- ============================================
-- END OF MIGRATION
-- ============================================`;
  }

  /**
   * Create rollback template
   */
  private createRollbackTemplate(name: string, type: MigrationType): string {
    const schemaNote =
      type === "project" ? "-- Remember to handle {SCHEMA_NAME} replacements\n" : "";

    return `-- Rollback: ${name}
-- Created: ${new Date().toISOString().split("T")[0]}
-- Author: Okaeri Development Team

-- ============================================
-- ROLLBACK MIGRATION
-- ============================================
${schemaNote}
-- Add your rollback statements here
-- These should reverse the changes made in the up migration

-- Example: Drop a column
-- ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;

-- Example: Drop a table
-- DROP TABLE IF EXISTS table_name;

-- Example: Drop an index
-- DROP INDEX IF EXISTS idx_name;

-- ============================================
-- END OF ROLLBACK
-- ============================================`;
  }

  /**
   * Prompt for user input
   */
  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Create migration files
   */
  async createMigration(): Promise<void> {
    console.log("🚀 Create New Migration\n");

    // Get migration name
    const name = await this.prompt("Migration name (e.g., add_user_preferences): ");
    if (!name) {
      console.error("❌ Migration name is required");
      this.rl.close();
      return;
    }

    // Get migration type
    console.log("\nMigration type:");
    console.log("1. Global (affects public schema)");
    console.log("2. Project (affects project schemas)");
    console.log("3. Both (affects both global and project schemas)");

    const typeChoice = await this.prompt("Select type (1-3): ");
    let type: MigrationType;

    switch (typeChoice) {
      case "1":
        type = "global";
        break;
      case "2":
        type = "project";
        break;
      case "3":
        type = "both";
        break;
      default:
        console.error("❌ Invalid type selection");
        this.rl.close();
        return;
    }

    // Get description
    const description = (await this.prompt("Description (optional): ")) || `Migration for ${name}`;

    // Generate filenames
    const migrationNumber = this.getNextMigrationNumber();
    const baseFilename = `${migrationNumber}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

    console.log("\n📝 Creating migration files...\n");

    // Create migration files based on type
    if (type === "global" || type === "both") {
      const globalFilename = `${baseFilename}_global.sql`;
      const globalPath = path.join(this.migrationsPath, globalFilename);
      const globalContent = this.createGlobalMigrationTemplate(globalFilename, description);

      fs.writeFileSync(globalPath, globalContent);
      console.log(`  ✅ Created: ${globalFilename}`);

      // Create rollback file
      const globalRollbackPath = path.join(
        this.migrationsPath,
        "rollback",
        `${globalFilename}.down.sql`
      );
      const globalRollbackContent = this.createRollbackTemplate(globalFilename, "global");

      fs.writeFileSync(globalRollbackPath, globalRollbackContent);
      console.log(`  ✅ Created: rollback/${globalFilename}.down.sql`);
    }

    if (type === "project" || type === "both") {
      const projectFilename = `${baseFilename}_project.sql`;
      const projectPath = path.join(this.migrationsPath, projectFilename);
      const projectContent = this.createProjectMigrationTemplate(projectFilename, description);

      fs.writeFileSync(projectPath, projectContent);
      console.log(`  ✅ Created: ${projectFilename}`);

      // Create rollback file
      const projectRollbackPath = path.join(
        this.migrationsPath,
        "rollback",
        `${projectFilename}.down.sql`
      );
      const projectRollbackContent = this.createRollbackTemplate(projectFilename, "project");

      fs.writeFileSync(projectRollbackPath, projectRollbackContent);
      console.log(`  ✅ Created: rollback/${projectFilename}.down.sql`);
    }

    // Update journal
    await this.updateJournal(baseFilename, type);

    console.log("\n✨ Migration files created successfully!");
    console.log("\nNext steps:");
    console.log("1. Edit the migration file(s) with your schema changes");
    console.log("2. Edit the corresponding rollback file(s)");
    console.log('3. Run "npm run db:migrate:up" to apply the migration');

    this.rl.close();
  }

  /**
   * Update migration journal
   */
  private async updateJournal(filename: string, type: MigrationType): Promise<void> {
    const journalPath = path.join(this.migrationsPath, "meta", "_journal.json");

    let journal: any = { version: "5", dialect: "pg", entries: [] };

    if (fs.existsSync(journalPath)) {
      const content = fs.readFileSync(journalPath, "utf-8");
      journal = JSON.parse(content);
    }

    // Add new entry
    const timestamp = Date.now();

    if (type === "global" || type === "both") {
      journal.entries.push({
        idx: journal.entries.length,
        version: "5",
        when: timestamp,
        tag: `${filename}_global`,
        breakpoints: false,
      });
    }

    if (type === "project" || type === "both") {
      journal.entries.push({
        idx: journal.entries.length,
        version: "5",
        when: timestamp + 1,
        tag: `${filename}_project`,
        breakpoints: false,
      });
    }

    // Write updated journal
    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  }

  /**
   * List existing migrations
   */
  async listMigrations(): Promise<void> {
    console.log("📋 Existing Migrations\n");

    const files = fs
      .readdirSync(this.migrationsPath)
      .filter((f) => f.endsWith(".sql") && !f.includes("template"))
      .sort();

    if (files.length === 0) {
      console.log("No migrations found.");
    } else {
      console.log("Up migrations:");
      files.forEach((f) => {
        const type = f.includes("global")
          ? "[GLOBAL]"
          : f.includes("project")
            ? "[PROJECT]"
            : "[UNKNOWN]";
        console.log(`  • ${f} ${type}`);
      });

      console.log("\nRollback migrations:");
      const rollbackPath = path.join(this.migrationsPath, "rollback");
      if (fs.existsSync(rollbackPath)) {
        const rollbackFiles = fs
          .readdirSync(rollbackPath)
          .filter((f) => f.endsWith(".down.sql"))
          .sort();

        rollbackFiles.forEach((f) => {
          console.log(`  • ${f}`);
        });
      }
    }

    this.rl.close();
  }
}

// Main execution
async function main() {
  const creator = new MigrationCreator();

  const args = process.argv.slice(2);

  if (args.includes("--list") || args.includes("-l")) {
    await creator.listMigrations();
  } else {
    await creator.createMigration();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MigrationCreator };
