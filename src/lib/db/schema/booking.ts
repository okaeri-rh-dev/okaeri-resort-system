/**
 * Booking System Database Schema
 *
 * Drizzle ORM schema definitions for the booking system with
 * application-level multi-tenant isolation using project_id filtering.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  boolean,
  date,
  timestamp,
  jsonb,
  unique,
  check,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projects } from "./global";

// =============================================
// Rooms Table - Property/Room Definitions
// =============================================
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    roomNumber: varchar("room_number", { length: 50 }).notNull(),
    roomType: varchar("room_type", { length: 100 }).notNull(),
    capacity: integer("capacity").notNull().default(2),
    basePrice: decimal("base_price", { precision: 12, scale: 2 }).notNull(),
    isActive: boolean("is_active").default(true),
    amenities: jsonb("amenities").default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique room number per project
    uniqueRoomNumber: unique("rooms_project_room_number_unique").on(
      table.projectId,
      table.roomNumber
    ),
    // Business constraints
    capacityCheck: check("rooms_capacity_positive", `${table.capacity.name} > 0`),
    basePriceCheck: check("rooms_base_price_positive", `${table.basePrice.name} >= 0`),
    // Performance indexes
    projectIdIdx: index("idx_rooms_project_id").on(table.projectId),
    projectActiveIdx: index("idx_rooms_project_active").on(table.projectId, table.isActive),
    projectTypeIdx: index("idx_rooms_project_type").on(table.projectId, table.roomType),
  })
);

// =============================================
// Bookings Table - Reservation Records
// =============================================
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    bookingCode: varchar("booking_code", { length: 20 }).notNull(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    guestName: varchar("guest_name", { length: 255 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }),
    guestPhone: varchar("guest_phone", { length: 20 }).notNull(),
    guestCount: integer("guest_count").notNull().default(1),
    checkInDate: date("check_in_date").notNull(),
    checkOutDate: date("check_out_date").notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    paymentStatus: varchar("payment_status", { length: 50 }).notNull().default("pending"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique booking code per project
    uniqueBookingCode: unique("bookings_project_booking_code_unique").on(
      table.projectId,
      table.bookingCode
    ),
    // Business constraints
    checkOutAfterCheckIn: check(
      "bookings_check_out_after_check_in",
      `${table.checkOutDate.name} > ${table.checkInDate.name}`
    ),
    guestCountPositive: check("bookings_guest_count_positive", `${table.guestCount.name} > 0`),
    totalAmountPositive: check("bookings_total_amount_positive", `${table.totalAmount.name} >= 0`),
    paidAmountPositive: check("bookings_paid_amount_positive", `${table.paidAmount.name} >= 0`),
    paidNotExceedTotal: check(
      "bookings_paid_not_exceed_total",
      `${table.paidAmount.name} <= ${table.totalAmount.name}`
    ),
    // Performance indexes for availability queries
    projectIdIdx: index("idx_bookings_project_id").on(table.projectId),
    availabilityIdx: index("idx_bookings_availability")
      .on(table.projectId, table.roomId, table.checkInDate, table.checkOutDate)
      .where(`${table.status.name} != 'cancelled'`),
    calendarIdx: index("idx_bookings_calendar")
      .on(table.projectId, table.checkInDate)
      .where(`${table.status.name} != 'cancelled'`),
    projectStatusIdx: index("idx_bookings_project_status").on(table.projectId, table.status),
    projectCreatedIdx: index("idx_bookings_project_created").on(table.projectId, table.createdAt),
    projectDatesIdx: index("idx_bookings_project_dates").on(
      table.projectId,
      table.checkInDate,
      table.checkOutDate
    ),
    roomDatesIdx: index("idx_bookings_room_dates")
      .on(table.roomId, table.checkInDate, table.checkOutDate)
      .where(`${table.status.name} != 'cancelled'`),
  })
);

// =============================================
// Database Relations
// =============================================
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  project: one(projects, {
    fields: [rooms.projectId],
    references: [projects.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  project: one(projects, {
    fields: [bookings.projectId],
    references: [projects.id],
  }),
  room: one(rooms, {
    fields: [bookings.roomId],
    references: [rooms.id],
  }),
}));

// =============================================
// TypeScript Type Inference
// =============================================
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

// =============================================
// Booking Status Enums (consistent with tests)
// =============================================
export const BOOKING_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  CHECKED_OUT: "checked_out",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

export const PAYMENT_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];
