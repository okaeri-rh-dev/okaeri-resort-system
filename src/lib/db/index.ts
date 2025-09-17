/**
 * Database Connection Export
 * Central export point for database access
 */

// Re-export all exports from connection, schema, and utils
export * from "./connection";
export * from "./schema";
export * from "./utils";

// Create a db alias for backward compatibility
// The drizzleDb export is already a Proxy that handles lazy initialization
export { drizzleDb as db } from "./connection";
