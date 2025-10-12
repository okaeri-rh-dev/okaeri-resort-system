/**
 * API Client Configuration for Cloudflare Functions
 *
 * This module provides a centralized configuration for making API calls
 * to Cloudflare Functions, whether running locally or in production.
 */

/**
 * Get the base URL for API calls
 * In development with Cloudflare Vite plugin, API calls are automatically proxied
 */
export function getApiUrl(path: string): string {
  // Always use relative paths - the Cloudflare Vite plugin handles routing
  // This works both in development and production
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Make an API request to Cloudflare Functions
 *
 * @param path - The API path (e.g., '/api/bookings')
 * @param options - Fetch options
 * @returns Response promise
 */
export async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(path);

  // Default headers
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add auth token if available
  const token = localStorage.getItem("supabase.auth.token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Type-safe API request with JSON parsing
 */
export async function apiRequestJson<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiRequest(path, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `API request failed: ${response.status} ${response.statusText}`,
    }));
    throw new Error(error.message || "API request failed");
  }

  return response.json();
}

/**
 * Check if Cloudflare Functions are available
 * Useful for debugging local development setup
 */
export async function checkFunctionsHealth(): Promise<boolean> {
  try {
    const response = await fetch("/api/health");
    return response.ok;
  } catch (error) {
    console.error("Cloudflare Functions health check failed:", error);
    return false;
  }
}
