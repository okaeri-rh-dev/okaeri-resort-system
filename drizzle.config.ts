import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

export default defineConfig({
  schema: "./src/lib/db/schema/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
  // Migration configuration
  migrations: {
    prefix: "timestamp",
    schema: "public",
  },
  // Neon PostgreSQL specific optimizations
  introspect: {
    casing: "snake_case",
  },
  // Enhanced configuration for authentication schema
  tablesFilter: ["!pg_*", "!information_schema.*"],
  schemaFilter: ["public"],
});
