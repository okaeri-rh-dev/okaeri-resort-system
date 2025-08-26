#!/usr/bin/env node
import * as dotenv from "dotenv";
import { sql } from "../src/lib/db/connection";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// Load environment variables
dotenv.config();

/**
 * Seeding configuration
 */
interface SeedConfig {
  environment?: "development" | "staging" | "production";
  includeTestUsers?: boolean;
  includeSampleProject?: boolean;
  verbose?: boolean;
}

/**
 * Philippine-specific data
 */
const PHILIPPINE_PROVINCES = [
  "Batangas",
  "Palawan",
  "Bohol",
  "Cebu",
  "Siargao",
  "La Union",
  "Zambales",
  "Bataan",
  "Quezon",
  "Albay",
];

const PHILIPPINE_CITIES = {
  Batangas: ["Nasugbu", "Laiya", "Mabini", "Anilao"],
  Palawan: ["El Nido", "Coron", "Puerto Princesa", "San Vicente"],
  Bohol: ["Panglao", "Tagbilaran", "Anda", "Loboc"],
  Cebu: ["Malapascua", "Bantayan", "Moalboal", "Mactan"],
  Siargao: ["General Luna", "Dapa", "Del Carmen", "San Isidro"],
};

const DEFAULT_EXPENSE_CATEGORIES = [
  // Utilities
  { name: "Electricity", slug: "electricity", icon: "⚡", color: "#FFD700", category: "utilities" },
  { name: "Water", slug: "water", icon: "💧", color: "#4169E1", category: "utilities" },
  { name: "Internet", slug: "internet", icon: "🌐", color: "#8A2BE2", category: "utilities" },
  { name: "Gas/LPG", slug: "gas-lpg", icon: "🔥", color: "#FF4500", category: "utilities" },

  // Staff & Labor
  { name: "Salaries", slug: "salaries", icon: "💰", color: "#228B22", category: "staff" },
  { name: "Overtime Pay", slug: "overtime", icon: "⏰", color: "#32CD32", category: "staff" },
  { name: "Benefits", slug: "benefits", icon: "🏥", color: "#20B2AA", category: "staff" },
  { name: "Training", slug: "training", icon: "📚", color: "#4682B4", category: "staff" },

  // Supplies & Inventory
  {
    name: "Food & Beverages",
    slug: "food-beverages",
    icon: "🍽️",
    color: "#FF6347",
    category: "supplies",
  },
  {
    name: "Cleaning Supplies",
    slug: "cleaning-supplies",
    icon: "🧹",
    color: "#00CED1",
    category: "supplies",
  },
  { name: "Toiletries", slug: "toiletries", icon: "🧼", color: "#FFB6C1", category: "supplies" },
  {
    name: "Linens & Bedding",
    slug: "linens-bedding",
    icon: "🛏️",
    color: "#DDA0DD",
    category: "supplies",
  },
  {
    name: "Kitchen Supplies",
    slug: "kitchen-supplies",
    icon: "🍳",
    color: "#FF8C00",
    category: "supplies",
  },

  // Maintenance & Repairs
  {
    name: "Building Maintenance",
    slug: "building-maintenance",
    icon: "🏗️",
    color: "#708090",
    category: "maintenance",
  },
  {
    name: "Pool Maintenance",
    slug: "pool-maintenance",
    icon: "🏊",
    color: "#00BFFF",
    category: "maintenance",
  },
  {
    name: "Garden/Landscaping",
    slug: "landscaping",
    icon: "🌳",
    color: "#228B22",
    category: "maintenance",
  },
  {
    name: "Equipment Repairs",
    slug: "equipment-repairs",
    icon: "🔧",
    color: "#696969",
    category: "maintenance",
  },
  {
    name: "Vehicle Maintenance",
    slug: "vehicle-maintenance",
    icon: "🚗",
    color: "#483D8B",
    category: "maintenance",
  },

  // Marketing & Advertising
  {
    name: "Online Advertising",
    slug: "online-ads",
    icon: "📱",
    color: "#FF1493",
    category: "marketing",
  },
  {
    name: "Print Materials",
    slug: "print-materials",
    icon: "📄",
    color: "#DB7093",
    category: "marketing",
  },
  {
    name: "Social Media",
    slug: "social-media",
    icon: "📲",
    color: "#FF69B4",
    category: "marketing",
  },
  {
    name: "Website Maintenance",
    slug: "website",
    icon: "💻",
    color: "#BA55D3",
    category: "marketing",
  },

  // Administrative
  {
    name: "Office Supplies",
    slug: "office-supplies",
    icon: "📎",
    color: "#778899",
    category: "admin",
  },
  {
    name: "Accounting/Legal",
    slug: "accounting-legal",
    icon: "⚖️",
    color: "#2F4F4F",
    category: "admin",
  },
  {
    name: "Permits & Licenses",
    slug: "permits-licenses",
    icon: "📋",
    color: "#800080",
    category: "admin",
  },
  { name: "Insurance", slug: "insurance", icon: "🛡️", color: "#4B0082", category: "admin" },
  { name: "Bank Fees", slug: "bank-fees", icon: "🏦", color: "#191970", category: "admin" },

  // Others
  { name: "Miscellaneous", slug: "miscellaneous", icon: "📦", color: "#A9A9A9", category: "other" },
  {
    name: "Emergency Expenses",
    slug: "emergency",
    icon: "🚨",
    color: "#DC143C",
    category: "other",
  },
];

/**
 * Database seeder
 */
class DatabaseSeeder {
  private config: SeedConfig;

  constructor(config: SeedConfig = {}) {
    this.config = {
      environment: config.environment || "development",
      includeTestUsers: config.includeTestUsers ?? true,
      includeSampleProject: config.includeSampleProject ?? true,
      verbose: config.verbose ?? true,
    };
  }

  /**
   * Run all seeders
   */
  async seed(): Promise<void> {
    console.log("🌱 Starting database seeding...\n");

    try {
      // Test connection
      await this.testConnection();

      // Seed data based on environment
      if (this.config.environment === "production") {
        await this.seedProduction();
      } else {
        await this.seedDevelopment();
      }

      console.log("\n✨ Database seeding completed successfully!");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ Seeding failed:", error);
      process.exit(1);
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    if (this.config.verbose) {
      console.log("Testing database connection...");
    }

    const result = await sql`SELECT version()`;

    if (this.config.verbose) {
      console.log("✅ Connected to PostgreSQL\n");
    }
  }

  /**
   * Seed production data (minimal, essential data only)
   */
  private async seedProduction(): Promise<void> {
    console.log("🏭 Seeding production data...\n");

    // Create default admin user if not exists
    await this.createDefaultAdmin();

    console.log("Production seeding complete.");
  }

  /**
   * Seed development data (includes test data)
   */
  private async seedDevelopment(): Promise<void> {
    console.log("🔧 Seeding development data...\n");

    // Create test users
    if (this.config.includeTestUsers) {
      await this.createTestUsers();
    }

    // Create sample project
    if (this.config.includeSampleProject) {
      await this.createSampleProject();
    }

    console.log("Development seeding complete.");
  }

  /**
   * Create default admin user
   */
  private async createDefaultAdmin(): Promise<void> {
    if (this.config.verbose) {
      console.log("Creating default admin user...");
    }

    const email = process.env.DEFAULT_ADMIN_EMAIL || "admin@okaeri.ph";
    const password = process.env.DEFAULT_ADMIN_PASSWORD || "OkaeriAdmin2024!";

    // Check if user exists
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existing.length > 0) {
      console.log("  ⏭️  Admin user already exists");
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const [admin] = await sql`
      INSERT INTO users (
        email, password_hash, first_name, last_name,
        is_active, is_email_verified, phone,
        preferences, metadata
      ) VALUES (
        ${email},
        ${passwordHash},
        'Admin',
        'User',
        true,
        true,
        '+639123456789',
        ${JSON.stringify({
          language: "en",
          timezone: "Asia/Manila",
          notifications: { email: true, sms: false, push: true },
        })},
        ${JSON.stringify({ role: "system_admin" })}
      )
      RETURNING id
    `;

    console.log(`  ✅ Admin user created: ${email}`);

    if (this.config.environment === "development") {
      console.log(`     Password: ${password}`);
    }
  }

  /**
   * Create test users for development
   */
  private async createTestUsers(): Promise<void> {
    if (this.config.verbose) {
      console.log("Creating test users...");
    }

    const testUsers = [
      {
        email: "owner@test.com",
        password: "Test1234!",
        firstName: "Juan",
        lastName: "Dela Cruz",
        phone: "+639181234567",
      },
      {
        email: "manager@test.com",
        password: "Test1234!",
        firstName: "Maria",
        lastName: "Santos",
        phone: "+639271234567",
      },
      {
        email: "staff@test.com",
        password: "Test1234!",
        firstName: "Pedro",
        lastName: "Reyes",
        phone: "+639361234567",
      },
    ];

    for (const user of testUsers) {
      // Check if user exists
      const existing = await sql`
        SELECT id FROM users WHERE email = ${user.email}
      `;

      if (existing.length > 0) {
        console.log(`  ⏭️  User ${user.email} already exists`);
        continue;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Create user
      await sql`
        INSERT INTO users (
          email, password_hash, first_name, last_name, phone,
          is_active, is_email_verified,
          preferences
        ) VALUES (
          ${user.email},
          ${passwordHash},
          ${user.firstName},
          ${user.lastName},
          ${user.phone},
          true,
          true,
          ${JSON.stringify({
            language: "en",
            timezone: "Asia/Manila",
            notifications: { email: true, sms: true, push: true },
          })}
        )
      `;

      console.log(`  ✅ Test user created: ${user.email} (password: ${user.password})`);
    }
  }

  /**
   * Create sample project with data
   */
  private async createSampleProject(): Promise<void> {
    if (this.config.verbose) {
      console.log("\nCreating sample project...");
    }

    // Get owner user
    const [owner] = await sql`
      SELECT id FROM users WHERE email = 'owner@test.com' OR email = 'admin@okaeri.ph' LIMIT 1
    `;

    if (!owner) {
      console.log("  ⚠️  No owner user found, skipping project creation");
      return;
    }

    // Check if project exists
    const existingProject = await sql`
      SELECT id FROM projects WHERE slug = 'paradise-beach-resort'
    `;

    if (existingProject.length > 0) {
      console.log("  ⏭️  Sample project already exists");
      await this.seedProjectData("paradise-beach-resort");
      return;
    }

    // Create project
    const province = PHILIPPINE_PROVINCES[0];
    const city = PHILIPPINE_CITIES[province][0];

    const [project] = await sql`
      INSERT INTO projects (
        name, slug, schema_name, owner_id,
        business_type, description,
        business_name, business_registration_number, tax_identification_number,
        address, city, province, country,
        contact_email, contact_phone, website,
        currency, timezone,
        settings,
        is_active, is_paid, trial_ends_at
      ) VALUES (
        'Paradise Beach Resort',
        'paradise-beach-resort',
        'project_paradise',
        ${owner.id},
        'resort',
        'A beautiful beachfront resort in Nasugbu, Batangas offering comfortable accommodations and exciting water activities.',
        'Paradise Beach Resort Inc.',
        'SEC-2024-123456',
        'TIN-123-456-789-000',
        '123 Bayshore Drive, Brgy. Natipuan',
        ${city},
        ${province},
        'PH',
        'info@paradisebeach.ph',
        '+639123456789',
        'https://paradisebeach.ph',
        'PHP',
        'Asia/Manila',
        ${JSON.stringify({
          bookingRules: {
            advanceBookingDays: 90,
            cancellationHours: 48,
            requireDeposit: true,
            depositPercentage: 50,
          },
          paymentMethods: {
            cash: true,
            gcash: true,
            bankTransfer: true,
            creditCard: false,
          },
          notifications: {
            bookingConfirmation: true,
            paymentReceived: true,
            dailyReport: true,
          },
        })},
        true,
        false,
        ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()} -- 30 days trial
      )
      RETURNING id, schema_name
    `;

    console.log(`  ✅ Sample project created: Paradise Beach Resort`);

    // Create project schema
    await sql`SELECT create_project_schema(${project.schema_name})`;
    console.log(`  ✅ Project schema created: ${project.schema_name}`);

    // Grant permissions
    await sql`
      INSERT INTO user_project_permissions (
        user_id, project_id, role, permissions, is_active
      ) VALUES (
        ${owner.id},
        ${project.id},
        'owner',
        ${JSON.stringify({
          bookings: { view: true, create: true, update: true, delete: true },
          payments: { view: true, create: true, update: true, delete: true },
          expenses: { view: true, create: true, update: true, delete: true },
          reports: { view: true, export: true },
          settings: { view: true, update: true },
          users: { view: true, invite: true, remove: true, updateRoles: true },
        })},
        true
      )
    `;

    console.log(`  ✅ Owner permissions granted`);

    // Seed project data
    await this.seedProjectData(project.schema_name);
  }

  /**
   * Seed data for a specific project
   */
  private async seedProjectData(schemaName: string): Promise<void> {
    if (this.config.verbose) {
      console.log(`\nSeeding data for schema: ${schemaName}`);
    }

    // Set search path
    await sql`SET search_path TO ${sql(schemaName)}, public`;

    // Create expense categories
    await this.createExpenseCategories(schemaName);

    // Create sample bookings
    await this.createSampleBookings(schemaName);

    // Create sample expenses
    await this.createSampleExpenses(schemaName);

    // Create project settings
    await this.createProjectSettings(schemaName);

    // Reset search path
    await sql`SET search_path TO public`;
  }

  /**
   * Create expense categories for project
   */
  private async createExpenseCategories(schemaName: string): Promise<void> {
    console.log("  Creating expense categories...");

    const parentCategories = [
      { name: "Utilities", slug: "utilities", icon: "⚡", color: "#FFD700" },
      { name: "Staff & Labor", slug: "staff", icon: "👥", color: "#228B22" },
      { name: "Supplies & Inventory", slug: "supplies", icon: "📦", color: "#FF6347" },
      { name: "Maintenance & Repairs", slug: "maintenance", icon: "🔧", color: "#708090" },
      { name: "Marketing & Advertising", slug: "marketing", icon: "📢", color: "#FF1493" },
      { name: "Administrative", slug: "admin", icon: "📋", color: "#778899" },
      { name: "Other", slug: "other", icon: "📌", color: "#A9A9A9" },
    ];

    const parentIds: Record<string, string> = {};

    // Create parent categories
    for (const category of parentCategories) {
      const existing = await sql`
        SELECT id FROM ${sql(schemaName)}.expense_categories WHERE slug = ${category.slug}
      `;

      if (existing.length > 0) {
        parentIds[category.slug] = existing[0].id;
        continue;
      }

      const [created] = await sql`
        INSERT INTO ${sql(schemaName)}.expense_categories (
          name, slug, icon, color, is_active, sort_order
        ) VALUES (
          ${category.name},
          ${category.slug},
          ${category.icon},
          ${category.color},
          true,
          ${parentCategories.indexOf(category)}
        )
        RETURNING id
      `;

      parentIds[category.slug] = created.id;
    }

    // Create subcategories
    for (const subcategory of DEFAULT_EXPENSE_CATEGORIES) {
      const parentSlug = subcategory.category;
      const parentId = parentIds[parentSlug];

      if (!parentId) continue;

      const existing = await sql`
        SELECT id FROM ${sql(schemaName)}.expense_categories WHERE slug = ${subcategory.slug}
      `;

      if (existing.length > 0) continue;

      await sql`
        INSERT INTO ${sql(schemaName)}.expense_categories (
          name, slug, parent_id, icon, color, is_active
        ) VALUES (
          ${subcategory.name},
          ${subcategory.slug},
          ${parentId},
          ${subcategory.icon},
          ${subcategory.color},
          true
        )
      `;
    }

    console.log("    ✅ Expense categories created");
  }

  /**
   * Create sample bookings
   */
  private async createSampleBookings(schemaName: string): Promise<void> {
    console.log("  Creating sample bookings...");

    const bookings = [
      {
        bookingCode: "BK-2024-001",
        guestName: "Antonio Rodriguez",
        guestEmail: "antonio@example.com",
        guestPhone: "+639181234567",
        checkInDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        checkOutDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        numberOfGuests: 4,
        roomType: "Deluxe Room",
        basePrice: 5000,
        totalAmount: 15000,
        depositAmount: 7500,
        paidAmount: 7500,
        status: "confirmed",
        paymentStatus: "partial",
      },
      {
        bookingCode: "BK-2024-002",
        guestName: "Isabella Garcia",
        guestEmail: "isabella@example.com",
        guestPhone: "+639271234567",
        checkInDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        checkOutDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        numberOfGuests: 2,
        roomType: "Standard Room",
        basePrice: 3500,
        totalAmount: 14000,
        depositAmount: 14000,
        paidAmount: 14000,
        status: "checked_in",
        paymentStatus: "paid",
      },
    ];

    for (const booking of bookings) {
      const existing = await sql`
        SELECT id FROM ${sql(schemaName)}.bookings WHERE booking_code = ${booking.bookingCode}
      `;

      if (existing.length > 0) continue;

      await sql`
        INSERT INTO ${sql(schemaName)}.bookings (
          booking_code, guest_name, guest_email, guest_phone,
          check_in_date, check_out_date, number_of_guests,
          room_type, base_price, total_amount,
          deposit_amount, paid_amount, balance_amount,
          status, payment_status, source
        ) VALUES (
          ${booking.bookingCode},
          ${booking.guestName},
          ${booking.guestEmail},
          ${booking.guestPhone},
          ${booking.checkInDate.toISOString().split("T")[0]},
          ${booking.checkOutDate.toISOString().split("T")[0]},
          ${booking.numberOfGuests},
          ${booking.roomType},
          ${booking.basePrice},
          ${booking.totalAmount},
          ${booking.depositAmount},
          ${booking.paidAmount},
          ${booking.totalAmount - booking.paidAmount},
          ${booking.status},
          ${booking.paymentStatus},
          'direct'
        )
      `;
    }

    console.log("    ✅ Sample bookings created");
  }

  /**
   * Create sample expenses
   */
  private async createSampleExpenses(schemaName: string): Promise<void> {
    console.log("  Creating sample expenses...");

    // Get electricity category
    const [electricityCategory] = await sql`
      SELECT id FROM ${sql(schemaName)}.expense_categories WHERE slug = 'electricity'
    `;

    if (!electricityCategory) return;

    const expenses = [
      {
        expenseCode: "EXP-2024-001",
        categoryId: electricityCategory.id,
        description: "Monthly electricity bill - January 2024",
        amount: 12500,
        vendorName: "Meralco",
        paymentMethod: "bank_transfer",
        status: "approved",
      },
    ];

    for (const expense of expenses) {
      const existing = await sql`
        SELECT id FROM ${sql(schemaName)}.expenses WHERE expense_code = ${expense.expenseCode}
      `;

      if (existing.length > 0) continue;

      await sql`
        INSERT INTO ${sql(schemaName)}.expenses (
          expense_code, category_id, description, amount,
          vendor_name, payment_method, payment_status, status
        ) VALUES (
          ${expense.expenseCode},
          ${expense.categoryId},
          ${expense.description},
          ${expense.amount},
          ${expense.vendorName},
          ${expense.paymentMethod},
          'paid',
          ${expense.status}
        )
      `;
    }

    console.log("    ✅ Sample expenses created");
  }

  /**
   * Create project settings
   */
  private async createProjectSettings(schemaName: string): Promise<void> {
    console.log("  Creating project settings...");

    const settings = [
      {
        key: "booking_prefix",
        value: '"BK"',
        category: "booking",
        description: "Prefix for booking codes",
      },
      {
        key: "expense_prefix",
        value: '"EXP"',
        category: "expense",
        description: "Prefix for expense codes",
      },
      {
        key: "payment_prefix",
        value: '"PAY"',
        category: "payment",
        description: "Prefix for payment codes",
      },
      {
        key: "default_check_in_time",
        value: '"14:00"',
        category: "booking",
        description: "Default check-in time",
      },
      {
        key: "default_check_out_time",
        value: '"12:00"',
        category: "booking",
        description: "Default check-out time",
      },
    ];

    for (const setting of settings) {
      const existing = await sql`
        SELECT id FROM ${sql(schemaName)}.project_settings WHERE key = ${setting.key}
      `;

      if (existing.length > 0) continue;

      await sql`
        INSERT INTO ${sql(schemaName)}.project_settings (
          key, value, category, description, is_public, is_editable
        ) VALUES (
          ${setting.key},
          ${setting.value}::jsonb,
          ${setting.category},
          ${setting.description},
          false,
          true
        )
      `;
    }

    console.log("    ✅ Project settings created");
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  const config: SeedConfig = {
    environment: (process.env.NODE_ENV as any) || "development",
    includeTestUsers: !args.includes("--no-test-users"),
    includeSampleProject: !args.includes("--no-sample-project"),
    verbose: !args.includes("--quiet"),
  };

  if (args.includes("--production")) {
    config.environment = "production";
    config.includeTestUsers = false;
    config.includeSampleProject = false;
  }

  const seeder = new DatabaseSeeder(config);
  await seeder.seed();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DatabaseSeeder };
