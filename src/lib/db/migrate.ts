import { migrate } from "drizzle-orm/neon-http/migrator";
import { sql, drizzleDb } from "./connection";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migration configuration
 */
export interface MigrationConfig {
  migrationsFolder?: string;
  schemaName?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migrationsRun: string[];
  error?: Error;
  duration: number;
}

/**
 * Database migration manager
 */
export class MigrationRunner {
  private migrationsPath: string;
  private executedMigrations: Set<string> = new Set();

  constructor(migrationsPath?: string) {
    this.migrationsPath = migrationsPath || path.resolve(process.cwd(), "migrations");
  }

  /**
   * Initialize migration tracking table
   */
  private async initMigrationTable(schemaName?: string): Promise<void> {
    const schema = schemaName ? `${schemaName}.` : "";

    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(schema)}schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW() NOT NULL,
        execution_time_ms INTEGER,
        checksum VARCHAR(64),
        rolled_back BOOLEAN DEFAULT false,
        rolled_back_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `;

    // Create index for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_${sql(schema)}migrations_name 
      ON ${sql(schema)}schema_migrations(migration_name)
    `;
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(schemaName?: string): Promise<Set<string>> {
    const schema = schemaName ? `${schemaName}.` : "";

    try {
      const result = await sql`
        SELECT migration_name 
        FROM ${sql(schema)}schema_migrations 
        WHERE rolled_back = false
        ORDER BY executed_at
      `;

      return new Set(result.map((r) => r.migration_name as string));
    } catch (error) {
      // Table might not exist yet
      return new Set();
    }
  }

  /**
   * Record migration execution
   */
  private async recordMigration(
    name: string,
    duration: number,
    checksum: string,
    schemaName?: string
  ): Promise<void> {
    const schema = schemaName ? `${schemaName}.` : "";

    await sql`
      INSERT INTO ${sql(schema)}schema_migrations (migration_name, execution_time_ms, checksum)
      VALUES (${name}, ${duration}, ${checksum})
      ON CONFLICT (migration_name) DO NOTHING
    `;
  }

  /**
   * Calculate checksum for migration file
   */
  private calculateChecksum(content: string): string {
    // Simple checksum for now - in production, use crypto.createHash('sha256')
    return Buffer.from(content).toString("base64").slice(0, 64);
  }

  /**
   * Run migrations for global schema
   */
  async runGlobalMigrations(config: MigrationConfig = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const migrationsRun: string[] = [];

    try {
      if (config.verbose) {
        console.log("🚀 Starting global schema migrations...");
      }

      // Initialize migration table
      await this.initMigrationTable();

      // Get executed migrations
      this.executedMigrations = await this.getExecutedMigrations();

      // Get migration files
      const migrationFiles = this.getGlobalMigrationFiles();

      // Execute migrations
      for (const file of migrationFiles) {
        if (!this.executedMigrations.has(file.name)) {
          if (config.verbose) {
            console.log(`  📝 Running migration: ${file.name}`);
          }

          if (!config.dryRun) {
            const migrationStart = Date.now();
            await this.executeMigration(file.path);
            const duration = Date.now() - migrationStart;

            const content = fs.readFileSync(file.path, "utf-8");
            const checksum = this.calculateChecksum(content);

            await this.recordMigration(file.name, duration, checksum);
            migrationsRun.push(file.name);

            if (config.verbose) {
              console.log(`     ✅ Completed in ${duration}ms`);
            }
          } else {
            console.log(`  🔍 Would run: ${file.name}`);
            migrationsRun.push(file.name);
          }
        } else if (config.verbose) {
          console.log(`  ⏭️  Skipping: ${file.name} (already executed)`);
        }
      }

      const duration = Date.now() - startTime;

      if (config.verbose) {
        console.log(
          `\n✨ Migration complete! ${migrationsRun.length} migrations run in ${duration}ms`
        );
      }

      return {
        success: true,
        migrationsRun,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("❌ Migration failed:", error);

      return {
        success: false,
        migrationsRun,
        error: error as Error,
        duration,
      };
    }
  }

  /**
   * Run migrations for a specific project schema
   */
  async runProjectMigrations(
    schemaName: string,
    config: MigrationConfig = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const migrationsRun: string[] = [];

    try {
      if (config.verbose) {
        console.log(`🚀 Starting migrations for schema: ${schemaName}`);
      }

      // Ensure schema exists
      await this.createSchemaIfNotExists(schemaName);

      // Set search path
      await sql`SET search_path TO ${sql(schemaName)}, public`;

      // Initialize migration table in project schema
      await this.initMigrationTable(schemaName);

      // Get executed migrations for this schema
      this.executedMigrations = await this.getExecutedMigrations(schemaName);

      // Get template migration
      const templatePath = path.join(this.migrationsPath, "0002_project_schema_template.sql");

      if (fs.existsSync(templatePath) && !this.executedMigrations.has("project_schema_init")) {
        if (config.verbose) {
          console.log(`  📝 Initializing project schema: ${schemaName}`);
        }

        if (!config.dryRun) {
          const migrationStart = Date.now();

          // Read and process template
          let templateContent = fs.readFileSync(templatePath, "utf-8");
          templateContent = templateContent.replace(/{SCHEMA_NAME}/g, schemaName);

          // Execute migration
          await sql.unsafe(templateContent);

          const duration = Date.now() - migrationStart;
          const checksum = this.calculateChecksum(templateContent);

          await this.recordMigration("project_schema_init", duration, checksum, schemaName);
          migrationsRun.push("project_schema_init");

          if (config.verbose) {
            console.log(`     ✅ Schema initialized in ${duration}ms`);
          }
        } else {
          console.log(`  🔍 Would initialize schema: ${schemaName}`);
          migrationsRun.push("project_schema_init");
        }
      }

      // Reset search path
      await sql`SET search_path TO public`;

      const duration = Date.now() - startTime;

      if (config.verbose) {
        console.log(
          `\n✨ Project migration complete! ${migrationsRun.length} migrations run in ${duration}ms`
        );
      }

      return {
        success: true,
        migrationsRun,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Project migration failed for ${schemaName}:`, error);

      return {
        success: false,
        migrationsRun,
        error: error as Error,
        duration,
      };
    }
  }

  /**
   * Rollback last migration
   */
  async rollbackMigration(
    schemaName?: string,
    config: MigrationConfig = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      if (config.verbose) {
        console.log("🔄 Starting migration rollback...");
      }

      const schema = schemaName ? `${schemaName}.` : "";

      // Get last executed migration
      const result = await sql`
        SELECT migration_name, checksum 
        FROM ${sql(schema)}schema_migrations 
        WHERE rolled_back = false
        ORDER BY executed_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        console.log("ℹ️  No migrations to rollback");
        return {
          success: true,
          migrationsRun: [],
          duration: Date.now() - startTime,
        };
      }

      const lastMigration = result[0];
      const rollbackFile = path.join(
        this.migrationsPath,
        "rollback",
        `${lastMigration.migration_name}.down.sql`
      );

      if (!fs.existsSync(rollbackFile)) {
        throw new Error(`Rollback file not found: ${rollbackFile}`);
      }

      if (config.verbose) {
        console.log(`  📝 Rolling back: ${lastMigration.migration_name}`);
      }

      if (!config.dryRun) {
        // Execute rollback
        await this.executeMigration(rollbackFile);

        // Mark as rolled back
        await sql`
          UPDATE ${sql(schema)}schema_migrations 
          SET rolled_back = true, rolled_back_at = NOW()
          WHERE migration_name = ${lastMigration.migration_name}
        `;

        if (config.verbose) {
          console.log(`     ✅ Rollback completed`);
        }
      } else {
        console.log(`  🔍 Would rollback: ${lastMigration.migration_name}`);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        migrationsRun: [lastMigration.migration_name as string],
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error("❌ Rollback failed:", error);

      return {
        success: false,
        migrationsRun: [],
        error: error as Error,
        duration,
      };
    }
  }

  /**
   * Get global migration files
   */
  private getGlobalMigrationFiles(): Array<{ name: string; path: string }> {
    const files = fs
      .readdirSync(this.migrationsPath)
      .filter((f) => f.endsWith(".sql") && !f.includes("template"))
      .sort()
      .map((f) => ({
        name: f.replace(".sql", ""),
        path: path.join(this.migrationsPath, f),
      }));

    return files;
  }

  /**
   * Execute a single migration file
   */
  private async executeMigration(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, "utf-8");

    // Split by semicolon but be careful with functions/triggers
    const statements = this.splitSqlStatements(content);

    for (const statement of statements) {
      if (statement.trim()) {
        await sql.unsafe(statement);
      }
    }
  }

  /**
   * Split SQL content into individual statements
   */
  private splitSqlStatements(content: string): string[] {
    // This is a simplified version - in production, use a proper SQL parser
    const statements: string[] = [];
    let currentStatement = "";
    let inFunction = false;

    const lines = content.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check for function/trigger start
      if (trimmedLine.match(/^CREATE (OR REPLACE )?(FUNCTION|TRIGGER|PROCEDURE)/i)) {
        inFunction = true;
      }

      currentStatement += line + "\n";

      // Check for statement end
      if (inFunction && trimmedLine.match(/^\$\$\s+(LANGUAGE|language)/i)) {
        // End of function body
        inFunction = false;
      } else if (!inFunction && trimmedLine.endsWith(";")) {
        // Regular statement end
        statements.push(currentStatement.trim());
        currentStatement = "";
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements;
  }

  /**
   * Create schema if it doesn't exist
   */
  private async createSchemaIfNotExists(schemaName: string): Promise<void> {
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_namespace WHERE nspname = ${schemaName}
        ) THEN
          EXECUTE format('CREATE SCHEMA %I', ${schemaName});
        END IF;
      END
      $$
    `;
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(schemaName?: string): Promise<any> {
    const schema = schemaName ? `${schemaName}.` : "";

    try {
      const executed = await sql`
        SELECT 
          migration_name,
          executed_at,
          execution_time_ms,
          rolled_back,
          rolled_back_at
        FROM ${sql(schema)}schema_migrations
        ORDER BY executed_at DESC
      `;

      const pending = this.getGlobalMigrationFiles().filter(
        (f) => !executed.some((e) => e.migration_name === f.name)
      );

      return {
        executed,
        pending: pending.map((p) => p.name),
        total: executed.length + pending.length,
      };
    } catch (error) {
      return {
        error: "Migration table not initialized",
        executed: [],
        pending: [],
        total: 0,
      };
    }
  }
}

// Export singleton instance
export const migrationRunner = new MigrationRunner();

// Export convenience functions
export const runGlobalMigrations = (config?: MigrationConfig) =>
  migrationRunner.runGlobalMigrations(config);

export const runProjectMigrations = (schemaName: string, config?: MigrationConfig) =>
  migrationRunner.runProjectMigrations(schemaName, config);

export const rollbackMigration = (schemaName?: string, config?: MigrationConfig) =>
  migrationRunner.rollbackMigration(schemaName, config);

export const getMigrationStatus = (schemaName?: string) =>
  migrationRunner.getMigrationStatus(schemaName);
