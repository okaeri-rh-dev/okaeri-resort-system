/**
 * Central export for all API endpoints
 */

export * from "./auth";
export * from "./projects";
export * from "./bookings";

// Re-export grouped API modules
import { authApi } from "./auth";
import { projectsApi } from "./projects";
import { bookingsApi } from "./bookings";

export const api = {
  auth: authApi,
  projects: projectsApi,
  bookings: bookingsApi,
} as const;

export default api;
