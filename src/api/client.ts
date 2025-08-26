/**
 * Main API client configuration with interceptors and error handling
 */

import type { ProjectConfig as _ProjectConfig } from "@/types/common";

// Re-export to avoid unused import warning
export type ProjectConfig = _ProjectConfig;

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private headers: Record<string, string>;
  private activeProjectId: string | null = null;

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL || import.meta.env.VITE_API_URL || "/api";
    this.timeout = config.timeout || 30000;
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  /**
   * Set the active project ID for multi-tenant requests
   */
  setActiveProject(projectId: string | null) {
    this.activeProjectId = projectId;
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string | null) {
    if (token) {
      this.headers["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.headers["Authorization"];
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildURL(endpoint: string, params?: Record<string, unknown>): string {
    const url = new URL(`${this.baseURL}${endpoint}`);

    // Add project ID to query params if available
    if (this.activeProjectId) {
      url.searchParams.append("projectId", this.activeProjectId);
    }

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: unknown): ApiError {
    // Type guard for error with response
    if (typeof error === "object" && error !== null && "response" in error) {
      const errorResponse = error as {
        response: {
          data?: { message?: string; code?: string; details?: unknown };
          status: number;
        };
      };
      return {
        message: errorResponse.response.data?.message || "An error occurred",
        status: errorResponse.response.status,
        code: errorResponse.response.data?.code,
        details: errorResponse.response.data?.details,
      };
    } else if (typeof error === "object" && error !== null && "request" in error) {
      // Request was made but no response received
      return {
        message: "Network error - please check your connection",
        code: "NETWORK_ERROR",
      };
    } else {
      // Something happened in setting up the request
      return {
        message:
          (error instanceof Error ? error.message : String(error)) ||
          "An unexpected error occurred",
        code: "CLIENT_ERROR",
      };
    }
  }

  /**
   * Make a fetch request with proper error handling
   */
  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: unknown;
      params?: Record<string, unknown>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.buildURL(endpoint, options?.params), {
        method,
        headers: {
          ...this.headers,
          ...options?.headers,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: options?.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as T;

      if (!response.ok) {
        throw {
          response: {
            status: response.status,
            data,
          },
        };
      }

      return {
        data,
        status: response.status,
        message: (data as { message?: string }).message,
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw this.handleError({
          message: "Request timeout",
          code: "TIMEOUT",
        });
      }

      throw this.handleError(error);
    }
  }

  /**
   * GET request
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, { params, signal: options?.signal });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal }
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, {
      body,
      params: options?.params,
      signal: options?.signal,
    });
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal }
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, {
      body,
      params: options?.params,
      signal: options?.signal,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal }
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", endpoint, {
      body,
      params: options?.params,
      signal: options?.signal,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(
    endpoint: string,
    options?: { params?: Record<string, unknown>; signal?: AbortSignal }
  ): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint, {
      params: options?.params,
      signal: options?.signal,
    });
  }

  /**
   * Upload file with multipart/form-data
   */
  async upload<T>(
    endpoint: string,
    formData: FormData,
    options?: {
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<ApiResponse<T>> {
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && options?.onProgress) {
          const progress = (e.loaded / e.total) * 100;
          options.onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            data,
            status: xhr.status,
            message: data.message,
          });
        } else {
          reject(
            this.handleError({
              response: {
                status: xhr.status,
                data,
              },
            })
          );
        }
      });

      xhr.addEventListener("error", () => {
        reject(
          this.handleError({
            message: "Upload failed",
            code: "UPLOAD_ERROR",
          })
        );
      });

      xhr.addEventListener("abort", () => {
        reject(
          this.handleError({
            message: "Upload cancelled",
            code: "UPLOAD_CANCELLED",
          })
        );
      });

      xhr.open("POST", this.buildURL(endpoint));

      // Set auth header if available
      if (this.headers["Authorization"]) {
        xhr.setRequestHeader("Authorization", this.headers["Authorization"]);
      }

      // Handle abort signal
      if (options?.signal) {
        options.signal.addEventListener("abort", () => xhr.abort());
      }

      xhr.send(formData);
    });
  }
}

// Create and export default API client instance
export const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30000,
});

export default apiClient;
