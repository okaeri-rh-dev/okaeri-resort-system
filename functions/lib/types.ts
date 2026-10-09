/**
 * Common type definitions for Cloudflare Workers API
 * Provides type safety for replacing 'any' types across the functions/ directory
 */

import type { UserRole } from "./rbac";

/**
 * Authenticated request with user context
 * Extended by RBAC middleware after authentication
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: UserRole;
  };
}
