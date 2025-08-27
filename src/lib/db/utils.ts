import { sql, drizzleDb, executeWithRetry } from "./connection";
import { eq, and } from "drizzle-orm";
import {
  users,
  projects,
  userProjectPermissions,
  auditLogs,
  type Project,
  type UserProjectPermission,
  type NewAuditLog,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
} from "./schema";
import { createProjectSchema } from "./schema/project";

/**
 * Create a new project schema in the database
 * This function creates a new PostgreSQL schema for project isolation
 */
export async function setupProjectSchema(
  projectId: string,
  schemaName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Sanitize schema name to prevent SQL injection
    const sanitizedSchemaName = schemaName.replace(/[^a-z0-9_]/g, "_").toLowerCase();

    // Create the schema
    await executeWithRetry(async () => {
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(sanitizedSchemaName)}`;
    });

    // Create all tables in the new schema
    const projectSchema = createProjectSchema(sanitizedSchemaName);

    // Create tables using raw SQL for better control
    await executeWithRetry(async () => {
      // Set search path to the new schema
      await sql`SET search_path TO ${sql.identifier(sanitizedSchemaName)}`;

      // Create bookings table
      await sql`
        CREATE TABLE IF NOT EXISTS bookings (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          booking_code VARCHAR(20) NOT NULL UNIQUE,
          guest_name VARCHAR(255) NOT NULL,
          guest_email VARCHAR(255),
          guest_phone VARCHAR(20) NOT NULL,
          guest_address TEXT,
          number_of_guests INTEGER NOT NULL DEFAULT 1,
          number_of_children INTEGER DEFAULT 0,
          check_in_date DATE NOT NULL,
          check_out_date DATE NOT NULL,
          check_in_time TIME,
          check_out_time TIME,
          room_type VARCHAR(100),
          room_number VARCHAR(50),
          base_price DECIMAL(12, 2) NOT NULL,
          additional_charges DECIMAL(12, 2) DEFAULT 0,
          discount_amount DECIMAL(12, 2) DEFAULT 0,
          tax_amount DECIMAL(12, 2) DEFAULT 0,
          total_amount DECIMAL(12, 2) NOT NULL,
          deposit_amount DECIMAL(12, 2) DEFAULT 0,
          paid_amount DECIMAL(12, 2) DEFAULT 0,
          balance_amount DECIMAL(12, 2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
          special_requests TEXT,
          internal_notes TEXT,
          cancellation_reason TEXT,
          cancelled_at TIMESTAMP,
          cancelled_by UUID,
          source VARCHAR(50) DEFAULT 'direct',
          metadata JSONB DEFAULT '{}',
          created_by UUID,
          updated_by UUID,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create indexes for bookings
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_code_idx ON bookings(booking_code)`;
      await sql`CREATE INDEX IF NOT EXISTS bookings_check_in_date_idx ON bookings(check_in_date)`;
      await sql`CREATE INDEX IF NOT EXISTS bookings_check_out_date_idx ON bookings(check_out_date)`;
      await sql`CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status)`;
      await sql`CREATE INDEX IF NOT EXISTS bookings_payment_status_idx ON bookings(payment_status)`;

      // Create expense_categories table
      await sql`
        CREATE TABLE IF NOT EXISTS expense_categories (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          parent_id UUID,
          icon VARCHAR(50),
          color VARCHAR(7),
          is_active BOOLEAN DEFAULT true NOT NULL,
          sort_order INTEGER DEFAULT 0,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create payments table
      await sql`
        CREATE TABLE IF NOT EXISTS payments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          booking_id UUID REFERENCES bookings(id),
          payment_code VARCHAR(20) NOT NULL UNIQUE,
          amount DECIMAL(12, 2) NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          payment_type VARCHAR(50) NOT NULL,
          transaction_id VARCHAR(100),
          reference_number VARCHAR(100),
          gcash_reference_number VARCHAR(50),
          gcash_account_name VARCHAR(255),
          gcash_account_number VARCHAR(20),
          bank_name VARCHAR(100),
          bank_account_number VARCHAR(50),
          bank_account_name VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          verified_at TIMESTAMP,
          verified_by UUID,
          receipt_number VARCHAR(50),
          receipt_url TEXT,
          notes TEXT,
          failure_reason TEXT,
          metadata JSONB DEFAULT '{}',
          processed_by UUID,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create indexes for payments
      await sql`CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS payments_payment_code_idx ON payments(payment_code)`;
      await sql`CREATE INDEX IF NOT EXISTS payments_payment_method_idx ON payments(payment_method)`;
      await sql`CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status)`;

      // Create expenses table
      await sql`
        CREATE TABLE IF NOT EXISTS expenses (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          expense_code VARCHAR(20) NOT NULL UNIQUE,
          category_id UUID NOT NULL REFERENCES expense_categories(id),
          description TEXT NOT NULL,
          amount DECIMAL(12, 2) NOT NULL,
          quantity DECIMAL(10, 2) DEFAULT 1,
          unit_price DECIMAL(12, 2),
          payment_method VARCHAR(50),
          payment_status VARCHAR(50) NOT NULL DEFAULT 'paid',
          paid_at TIMESTAMP,
          vendor_name VARCHAR(255),
          vendor_contact VARCHAR(255),
          invoice_number VARCHAR(100),
          invoice_date DATE,
          due_date DATE,
          status VARCHAR(50) NOT NULL DEFAULT 'approved',
          approved_by UUID,
          approved_at TIMESTAMP,
          rejection_reason TEXT,
          receipt_url TEXT,
          attachments JSONB DEFAULT '[]',
          is_recurring BOOLEAN DEFAULT false,
          recurring_frequency VARCHAR(20),
          next_recurring_date DATE,
          notes TEXT,
          tags JSONB DEFAULT '[]',
          metadata JSONB DEFAULT '{}',
          created_by UUID,
          updated_by UUID,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create indexes for expenses
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS expenses_expense_code_idx ON expenses(expense_code)`;
      await sql`CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category_id)`;
      await sql`CREATE INDEX IF NOT EXISTS expenses_payment_status_idx ON expenses(payment_status)`;
      await sql`CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses(status)`;

      // Create income table
      await sql`
        CREATE TABLE IF NOT EXISTS income (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          income_code VARCHAR(20) NOT NULL UNIQUE,
          source VARCHAR(100) NOT NULL,
          booking_id UUID REFERENCES bookings(id),
          description TEXT NOT NULL,
          amount DECIMAL(12, 2) NOT NULL,
          quantity DECIMAL(10, 2) DEFAULT 1,
          unit_price DECIMAL(12, 2),
          payment_method VARCHAR(50),
          payment_status VARCHAR(50) NOT NULL DEFAULT 'received',
          received_at TIMESTAMP DEFAULT NOW(),
          customer_name VARCHAR(255),
          customer_contact VARCHAR(255),
          receipt_number VARCHAR(50),
          receipt_url TEXT,
          category VARCHAR(100),
          tags JSONB DEFAULT '[]',
          notes TEXT,
          metadata JSONB DEFAULT '{}',
          recorded_by UUID,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create indexes for income
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS income_income_code_idx ON income(income_code)`;
      await sql`CREATE INDEX IF NOT EXISTS income_source_idx ON income(source)`;
      await sql`CREATE INDEX IF NOT EXISTS income_booking_idx ON income(booking_id)`;
      await sql`CREATE INDEX IF NOT EXISTS income_payment_status_idx ON income(payment_status)`;

      // Create booking_timeline table
      await sql`
        CREATE TABLE IF NOT EXISTS booking_timeline (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          event_type VARCHAR(50) NOT NULL,
          event_title VARCHAR(255) NOT NULL,
          event_description TEXT,
          old_values JSONB DEFAULT '{}',
          new_values JSONB DEFAULT '{}',
          performed_by UUID,
          performed_by_name VARCHAR(255),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create indexes for booking_timeline
      await sql`CREATE INDEX IF NOT EXISTS booking_timeline_booking_idx ON booking_timeline(booking_id)`;
      await sql`CREATE INDEX IF NOT EXISTS booking_timeline_event_type_idx ON booking_timeline(event_type)`;

      // Create project_settings table
      await sql`
        CREATE TABLE IF NOT EXISTS project_settings (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          key VARCHAR(100) NOT NULL UNIQUE,
          value JSONB NOT NULL,
          category VARCHAR(50) NOT NULL,
          description TEXT,
          is_public BOOLEAN DEFAULT false,
          is_editable BOOLEAN DEFAULT true,
          validation_rules JSONB DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          updated_by UUID,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `;

      // Create indexes for project_settings
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS project_settings_key_idx ON project_settings(key)`;
      await sql`CREATE INDEX IF NOT EXISTS project_settings_category_idx ON project_settings(category)`;

      // Reset search path to public
      await sql`SET search_path TO public`;
    });

    // Insert default expense categories
    await executeWithRetry(async () => {
      await sql`SET search_path TO ${sql.identifier(sanitizedSchemaName)}`;

      await sql`
        INSERT INTO expense_categories (name, slug, description, sort_order)
        VALUES 
          ('Utilities', 'utilities', 'Electricity, water, internet, and other utilities', 1),
          ('Maintenance', 'maintenance', 'Property maintenance and repairs', 2),
          ('Supplies', 'supplies', 'Cleaning supplies, toiletries, and consumables', 3),
          ('Staff', 'staff', 'Salaries, wages, and employee benefits', 4),
          ('Marketing', 'marketing', 'Advertising and promotional expenses', 5),
          ('Food & Beverage', 'food-beverage', 'Restaurant and kitchen expenses', 6),
          ('Equipment', 'equipment', 'Equipment purchases and rentals', 7),
          ('Insurance', 'insurance', 'Business insurance premiums', 8),
          ('Taxes & Licenses', 'taxes-licenses', 'Government taxes and licensing fees', 9),
          ('Other', 'other', 'Miscellaneous expenses', 10)
        ON CONFLICT (slug) DO NOTHING
      `;

      await sql`SET search_path TO public`;
    });

    // Log the schema creation in audit logs
    await logAudit({
      userId: null,
      projectId,
      action: "create_project_schema",
      category: AUDIT_CATEGORIES.SETTINGS,
      severity: AUDIT_SEVERITIES.INFO,
      entityType: "project_schema",
      entityId: projectId,
      newValues: { schemaName: sanitizedSchemaName },
      success: true,
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating project schema:", error);

    // Log the error
    await logAudit({
      userId: null,
      projectId,
      action: "create_project_schema",
      category: AUDIT_CATEGORIES.SETTINGS,
      severity: AUDIT_SEVERITIES.ERROR,
      entityType: "project_schema",
      entityId: projectId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create project schema",
    };
  }
}

/**
 * Get a database connection for a specific project schema
 */
export async function getProjectDb(projectId: string): Promise<{
  sql: any;
  schemaName: string;
  project: Project | null;
}> {
  try {
    // Get the project to find its schema name
    const [project] = await drizzleDb
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new Error("Project not found");
    }

    // Create a schema-specific SQL client
    const projectSql = async (strings: TemplateStringsArray, ...values: any[]) => {
      // Always set the search path before executing queries
      await sql`SET search_path TO ${sql.identifier(project.schemaName)}, public`;
      return sql(strings, ...values);
    };

    return {
      sql: projectSql,
      schemaName: project.schemaName,
      project,
    };
  } catch (error) {
    console.error("Error getting project database connection:", error);
    throw error;
  }
}

/**
 * Check if a user has access to a project
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
  requiredPermission?: string
): Promise<{
  hasAccess: boolean;
  permission: UserProjectPermission | null;
  project: Project | null;
}> {
  try {
    // Get the project
    const [project] = await drizzleDb
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || !project.isActive) {
      return { hasAccess: false, permission: null, project: null };
    }

    // Check if user is the owner
    if (project.ownerId === userId) {
      return {
        hasAccess: true,
        permission: {
          userId,
          projectId,
          role: "owner",
          permissions: {}, // Owner has all permissions
          isActive: true,
        } as UserProjectPermission,
        project,
      };
    }

    // Check user permissions
    const [permission] = await drizzleDb
      .select()
      .from(userProjectPermissions)
      .where(
        and(
          eq(userProjectPermissions.userId, userId),
          eq(userProjectPermissions.projectId, projectId),
          eq(userProjectPermissions.isActive, true)
        )
      )
      .limit(1);

    if (!permission) {
      return { hasAccess: false, permission: null, project };
    }

    // If a specific permission is required, check for it
    if (requiredPermission) {
      const permissionParts = requiredPermission.split(".");
      let permissionValue: any = permission.permissions;

      for (const part of permissionParts) {
        permissionValue = permissionValue?.[part];
        if (permissionValue === undefined) {
          return { hasAccess: false, permission, project };
        }
      }

      return { hasAccess: permissionValue === true, permission, project };
    }

    return { hasAccess: true, permission, project };
  } catch (error) {
    console.error("Error checking project access:", error);
    return { hasAccess: false, permission: null, project: null };
  }
}

/**
 * Generate a unique code for various entities
 */
export function generateCode(prefix: string, length: number = 8): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, length).toUpperCase();
  return `${prefix}-${timestamp}${random}`.substring(0, prefix.length + 1 + length);
}

/**
 * Log an audit event
 */
export async function logAudit(auditLog: Omit<NewAuditLog, "id" | "createdAt">): Promise<void> {
  try {
    await drizzleDb.insert(auditLogs).values(auditLog);
  } catch (error) {
    console.error("Error logging audit event:", error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Sanitize a string for use as a PostgreSQL identifier
 */
export function sanitizeIdentifier(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 63); // PostgreSQL identifier limit
}

/**
 * Drop a project schema (use with caution!)
 */
export async function dropProjectSchema(
  projectId: string,
  schemaName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const sanitizedSchemaName = sanitizeIdentifier(schemaName);

    // Drop the schema cascade
    await executeWithRetry(async () => {
      await sql`DROP SCHEMA IF EXISTS ${sql.identifier(sanitizedSchemaName)} CASCADE`;
    });

    // Log the schema deletion
    await logAudit({
      userId: null,
      projectId,
      action: "drop_project_schema",
      category: AUDIT_CATEGORIES.SETTINGS,
      severity: AUDIT_SEVERITIES.WARNING,
      entityType: "project_schema",
      entityId: projectId,
      oldValues: { schemaName: sanitizedSchemaName },
      success: true,
    });

    return { success: true };
  } catch (error) {
    console.error("Error dropping project schema:", error);

    // Log the error
    await logAudit({
      userId: null,
      projectId,
      action: "drop_project_schema",
      category: AUDIT_CATEGORIES.SETTINGS,
      severity: AUDIT_SEVERITIES.ERROR,
      entityType: "project_schema",
      entityId: projectId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to drop project schema",
    };
  }
}
