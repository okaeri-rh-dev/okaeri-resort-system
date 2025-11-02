/**
 * MSW Request Handlers
 *
 * Aggregates all mock API handlers for the test suite.
 */

import { availabilityHandlers } from "./availability";
import { bookingHandlers, resetIdempotencyCache } from "./booking";
import { multiUnitHandlers, resetMultiUnitBookings } from "./multi-unit";

// Export all handlers
export const handlers = [...bookingHandlers, ...availabilityHandlers, ...multiUnitHandlers];

// Export cache reset helpers
export { resetIdempotencyCache, resetMultiUnitBookings };
