/**
 * Booking Management Components Index
 *
 * Professional Enterprise Design System components for internal staff booking management.
 * All components follow dense, operational design patterns optimized for business efficiency.
 */

// Main unified interface
export { default as BookingManagementInterface } from "./BookingManagementInterface";

// Individual components for custom implementations
export { default as StaffBookingCalendar } from "./StaffBookingCalendar";
export { default as StaffBookingEntryForm } from "./StaffBookingEntryForm";
export { default as PaymentStatusTracker } from "./PaymentStatusTracker";
export { default as RoomStatusManager } from "./RoomStatusManager";

// Re-export existing booking components if they exist
export * from "../booking/BookingCalendar";
export * from "../booking/AvailabilityIndicator";
export * from "../booking/CalendarNavigation";
export * from "../booking/DateRangePicker";
