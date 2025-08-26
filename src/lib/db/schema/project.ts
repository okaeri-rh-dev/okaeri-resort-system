import {
  pgSchema,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  jsonb,
  date,
  time,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Create project-specific schema tables
 * This function generates tables for a specific project schema
 */
export function createProjectSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  /**
   * Bookings Table
   * Core table for managing resort bookings
   */
  const bookings = schema.table(
    "bookings",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      bookingCode: varchar("booking_code", { length: 20 }).notNull().unique(),

      // Guest Information
      guestName: varchar("guest_name", { length: 255 }).notNull(),
      guestEmail: varchar("guest_email", { length: 255 }),
      guestPhone: varchar("guest_phone", { length: 20 }).notNull(),
      guestAddress: text("guest_address"),
      numberOfGuests: integer("number_of_guests").notNull().default(1),
      numberOfChildren: integer("number_of_children").default(0),

      // Booking Details
      checkInDate: date("check_in_date").notNull(),
      checkOutDate: date("check_out_date").notNull(),
      checkInTime: time("check_in_time"),
      checkOutTime: time("check_out_time"),
      roomType: varchar("room_type", { length: 100 }),
      roomNumber: varchar("room_number", { length: 50 }),

      // Pricing
      basePrice: decimal("base_price", { precision: 12, scale: 2 }).notNull(),
      additionalCharges: decimal("additional_charges", { precision: 12, scale: 2 }).default("0"),
      discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
      taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
      totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
      depositAmount: decimal("deposit_amount", { precision: 12, scale: 2 }).default("0"),
      paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
      balanceAmount: decimal("balance_amount", { precision: 12, scale: 2 }).notNull(),

      // Status
      status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, confirmed, checked_in, checked_out, cancelled, no_show
      paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"), // pending, partial, paid, refunded

      // Special Requests
      specialRequests: text("special_requests"),
      internalNotes: text("internal_notes"),

      // Cancellation
      cancellationReason: text("cancellation_reason"),
      cancelledAt: timestamp("cancelled_at"),
      cancelledBy: uuid("cancelled_by"),

      // Metadata
      source: varchar("source", { length: 50 }).default("direct"), // direct, website, phone, walk_in, online_travel_agency
      metadata: jsonb("metadata").default({}),
      createdBy: uuid("created_by"),
      updatedBy: uuid("updated_by"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      bookingCodeIdx: uniqueIndex("bookings_booking_code_idx").on(table.bookingCode),
      checkInDateIdx: index("bookings_check_in_date_idx").on(table.checkInDate),
      checkOutDateIdx: index("bookings_check_out_date_idx").on(table.checkOutDate),
      statusIdx: index("bookings_status_idx").on(table.status),
      paymentStatusIdx: index("bookings_payment_status_idx").on(table.paymentStatus),
      guestPhoneIdx: index("bookings_guest_phone_idx").on(table.guestPhone),
      createdAtIdx: index("bookings_created_at_idx").on(table.createdAt),
    })
  );

  /**
   * Payments Table
   * Tracks all payment transactions
   */
  const payments = schema.table(
    "payments",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      bookingId: uuid("booking_id").references(() => bookings.id),
      paymentCode: varchar("payment_code", { length: 20 }).notNull().unique(),

      // Payment Details
      amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
      paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // cash, gcash, bank_transfer, credit_card
      paymentType: varchar("payment_type", { length: 50 }).notNull(), // deposit, partial, full, refund

      // Transaction Details
      transactionId: varchar("transaction_id", { length: 100 }),
      referenceNumber: varchar("reference_number", { length: 100 }),

      // GCash specific fields
      gcashReferenceNumber: varchar("gcash_reference_number", { length: 50 }),
      gcashAccountName: varchar("gcash_account_name", { length: 255 }),
      gcashAccountNumber: varchar("gcash_account_number", { length: 20 }),

      // Bank Transfer specific fields
      bankName: varchar("bank_name", { length: 100 }),
      bankAccountNumber: varchar("bank_account_number", { length: 50 }),
      bankAccountName: varchar("bank_account_name", { length: 255 }),

      // Status
      status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed, cancelled, refunded
      verifiedAt: timestamp("verified_at"),
      verifiedBy: uuid("verified_by"),

      // Receipt
      receiptNumber: varchar("receipt_number", { length: 50 }),
      receiptUrl: text("receipt_url"),

      // Notes
      notes: text("notes"),
      failureReason: text("failure_reason"),

      // Metadata
      metadata: jsonb("metadata").default({}),
      processedBy: uuid("processed_by"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      bookingIdx: index("payments_booking_idx").on(table.bookingId),
      paymentCodeIdx: uniqueIndex("payments_payment_code_idx").on(table.paymentCode),
      paymentMethodIdx: index("payments_payment_method_idx").on(table.paymentMethod),
      statusIdx: index("payments_status_idx").on(table.status),
      referenceNumberIdx: index("payments_reference_number_idx").on(table.referenceNumber),
      createdAtIdx: index("payments_created_at_idx").on(table.createdAt),
    })
  );

  /**
   * Expense Categories Table
   * Categories for organizing expenses
   */
  const expenseCategories = schema.table(
    "expense_categories",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      name: varchar("name", { length: 100 }).notNull(),
      slug: varchar("slug", { length: 100 }).notNull().unique(),
      description: text("description"),
      parentId: uuid("parent_id"),
      icon: varchar("icon", { length: 50 }),
      color: varchar("color", { length: 7 }),
      isActive: boolean("is_active").default(true).notNull(),
      sortOrder: integer("sort_order").default(0),
      metadata: jsonb("metadata").default({}),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      slugIdx: uniqueIndex("expense_categories_slug_idx").on(table.slug),
      parentIdx: index("expense_categories_parent_idx").on(table.parentId),
      isActiveIdx: index("expense_categories_is_active_idx").on(table.isActive),
    })
  );

  /**
   * Expenses Table
   * Records all business expenses
   */
  const expenses = schema.table(
    "expenses",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      expenseCode: varchar("expense_code", { length: 20 }).notNull().unique(),
      categoryId: uuid("category_id")
        .notNull()
        .references(() => expenseCategories.id),

      // Expense Details
      description: text("description").notNull(),
      amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
      quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
      unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),

      // Payment Information
      paymentMethod: varchar("payment_method", { length: 50 }), // cash, gcash, bank_transfer, credit_card, check
      paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("paid"), // pending, paid, partial
      paidAt: timestamp("paid_at"),

      // Vendor Information
      vendorName: varchar("vendor_name", { length: 255 }),
      vendorContact: varchar("vendor_contact", { length: 255 }),
      invoiceNumber: varchar("invoice_number", { length: 100 }),
      invoiceDate: date("invoice_date"),
      dueDate: date("due_date"),

      // Approval Workflow
      status: varchar("status", { length: 50 }).notNull().default("approved"), // draft, pending_approval, approved, rejected
      approvedBy: uuid("approved_by"),
      approvedAt: timestamp("approved_at"),
      rejectionReason: text("rejection_reason"),

      // Documentation
      receiptUrl: text("receipt_url"),
      attachments: jsonb("attachments")
        .$type<
          Array<{
            url: string;
            filename: string;
            size: number;
            mimeType: string;
          }>
        >()
        .default([]),

      // Recurring Expense
      isRecurring: boolean("is_recurring").default(false),
      recurringFrequency: varchar("recurring_frequency", { length: 20 }), // daily, weekly, monthly, quarterly, yearly
      nextRecurringDate: date("next_recurring_date"),

      // Notes
      notes: text("notes"),
      tags: jsonb("tags").$type<string[]>().default([]),

      // Metadata
      metadata: jsonb("metadata").default({}),
      createdBy: uuid("created_by"),
      updatedBy: uuid("updated_by"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      expenseCodeIdx: uniqueIndex("expenses_expense_code_idx").on(table.expenseCode),
      categoryIdx: index("expenses_category_idx").on(table.categoryId),
      paymentStatusIdx: index("expenses_payment_status_idx").on(table.paymentStatus),
      statusIdx: index("expenses_status_idx").on(table.status),
      paidAtIdx: index("expenses_paid_at_idx").on(table.paidAt),
      isRecurringIdx: index("expenses_is_recurring_idx").on(table.isRecurring),
      createdAtIdx: index("expenses_created_at_idx").on(table.createdAt),
    })
  );

  /**
   * Income Table
   * Records all revenue streams beyond bookings
   */
  const income = schema.table(
    "income",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      incomeCode: varchar("income_code", { length: 20 }).notNull().unique(),

      // Income Source
      source: varchar("source", { length: 100 }).notNull(), // booking, restaurant, amenity, rental, other
      bookingId: uuid("booking_id").references(() => bookings.id),

      // Income Details
      description: text("description").notNull(),
      amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
      quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
      unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),

      // Payment Information
      paymentMethod: varchar("payment_method", { length: 50 }), // cash, gcash, bank_transfer, credit_card
      paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("received"), // pending, received, refunded
      receivedAt: timestamp("received_at").defaultNow(),

      // Customer Information
      customerName: varchar("customer_name", { length: 255 }),
      customerContact: varchar("customer_contact", { length: 255 }),

      // Documentation
      receiptNumber: varchar("receipt_number", { length: 50 }),
      receiptUrl: text("receipt_url"),

      // Category and Tags
      category: varchar("category", { length: 100 }),
      tags: jsonb("tags").$type<string[]>().default([]),

      // Notes
      notes: text("notes"),

      // Metadata
      metadata: jsonb("metadata").default({}),
      recordedBy: uuid("recorded_by"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      incomeCodeIdx: uniqueIndex("income_income_code_idx").on(table.incomeCode),
      sourceIdx: index("income_source_idx").on(table.source),
      bookingIdx: index("income_booking_idx").on(table.bookingId),
      paymentStatusIdx: index("income_payment_status_idx").on(table.paymentStatus),
      receivedAtIdx: index("income_received_at_idx").on(table.receivedAt),
      categoryIdx: index("income_category_idx").on(table.category),
      createdAtIdx: index("income_created_at_idx").on(table.createdAt),
    })
  );

  /**
   * Booking Timeline Table
   * Tracks all events and changes for bookings
   */
  const bookingTimeline = schema.table(
    "booking_timeline",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      bookingId: uuid("booking_id")
        .notNull()
        .references(() => bookings.id, { onDelete: "cascade" }),

      // Event Details
      eventType: varchar("event_type", { length: 50 }).notNull(), // created, updated, status_changed, payment_received, note_added, etc.
      eventTitle: varchar("event_title", { length: 255 }).notNull(),
      eventDescription: text("event_description"),

      // Change Tracking
      oldValues: jsonb("old_values").default({}),
      newValues: jsonb("new_values").default({}),

      // User Tracking
      performedBy: uuid("performed_by"),
      performedByName: varchar("performed_by_name", { length: 255 }),

      // Metadata
      metadata: jsonb("metadata").default({}),
      createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
      bookingIdx: index("booking_timeline_booking_idx").on(table.bookingId),
      eventTypeIdx: index("booking_timeline_event_type_idx").on(table.eventType),
      createdAtIdx: index("booking_timeline_created_at_idx").on(table.createdAt),
    })
  );

  /**
   * Project Settings Table
   * Stores project-specific configuration
   */
  const projectSettings = schema.table(
    "project_settings",
    {
      id: uuid("id").defaultRandom().primaryKey(),
      key: varchar("key", { length: 100 }).notNull().unique(),
      value: jsonb("value").notNull(),
      category: varchar("category", { length: 50 }).notNull(), // general, booking, payment, notification, display
      description: text("description"),
      isPublic: boolean("is_public").default(false), // Whether setting is exposed to public API
      isEditable: boolean("is_editable").default(true), // Whether setting can be modified by users
      validationRules: jsonb("validation_rules").default({}),
      metadata: jsonb("metadata").default({}),
      updatedBy: uuid("updated_by"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
      keyIdx: uniqueIndex("project_settings_key_idx").on(table.key),
      categoryIdx: index("project_settings_category_idx").on(table.category),
      isPublicIdx: index("project_settings_is_public_idx").on(table.isPublic),
    })
  );

  return {
    bookings,
    payments,
    expenseCategories,
    expenses,
    income,
    bookingTimeline,
    projectSettings,
  };
}

// Export type definitions for a project schema
export type ProjectSchema = ReturnType<typeof createProjectSchema>;
