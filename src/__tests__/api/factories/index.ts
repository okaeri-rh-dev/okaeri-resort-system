/**
 * Mock Factories for API Testing
 *
 * Centralized exports for all endpoint-specific mock factories
 */

export { createAvailabilityMocks, type AvailabilityMockOptions } from "./availability-factory";
export { SupabaseMockBuilder, createMockSupabaseClient } from "../helpers/mock-supabase";

// TODO: Export remaining factories as they are created
// export { createBookingMocks, type BookingMockOptions } from './booking-factory';
// export { createUnitManagementMocks, type UnitManagementMockOptions } from './unit-factory';
// export { createPaymentMocks, type PaymentMockOptions } from './payment-factory';
