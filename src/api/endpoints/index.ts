/**
 * Central export for all API endpoints
 */

export * from "./auth";
export * from "./projects";
export * from "./bookings";
export * from "./reports";

// Re-export grouped API modules
import { authApi } from "./auth";
import { projectsApi } from "./projects";
import { bookingsApi } from "./bookings";
import { reportsApi } from "./reports";

export const api = {
  auth: authApi,
  projects: projectsApi,
  bookings: bookingsApi,
  reports: reportsApi,
} as const;

export default api;
