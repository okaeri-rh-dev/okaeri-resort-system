import { useAuthStore } from "@/stores/authStore";

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: number;
  success: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
  skipAuth?: boolean;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL || import.meta.env.VITE_API_URL || "/api";
    this.timeout = config.timeout || 30000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  private async refreshTokenIfNeeded(): Promise<string | null> {
    const authStore = useAuthStore.getState();
    const { token, refreshToken, sessionExpiry } = authStore;

    if (!token || !refreshToken) {
      return null;
    }

    // Check if token is about to expire (within 5 minutes)
    if (sessionExpiry && Date.now() > sessionExpiry - 5 * 60 * 1000) {
      try {
        await authStore.refreshSession();
        return useAuthStore.getState().token;
      } catch {
        authStore.logout();
        return null;
      }
    }

    return token;
  }

  private buildURL(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseURL}${endpoint}`, window.location.origin);

    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, String(params[key]));
        }
      });
    }

    return url.toString();
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");

    if (!response.ok) {
      let errorData: any;

      try {
        errorData = isJson ? await response.json() : await response.text();
      } catch {
        errorData = { message: "Network error occurred" };
      }

      const error: ApiError = {
        message:
          errorData.message || errorData.error || `Request failed with status ${response.status}`,
        status: response.status,
        errors: errorData.errors,
      };

      // Handle specific error codes
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }

      throw error;
    }

    let data: any;

    try {
      if (response.status === 204) {
        data = null;
      } else if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch {
      data = null;
    }

    return {
      data: data?.data || data,
      message: data?.message,
      status: response.status,
      success: true,
    };
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      params,
      timeout = this.timeout,
      skipAuth = false,
      headers = {},
      body,
      ...restOptions
    } = options;

    // Get or refresh token
    const token = skipAuth ? null : await this.refreshTokenIfNeeded();

    // Create abort controller for this request
    const requestId = `${method}-${endpoint}-${Date.now()}`;
    const abortController = new AbortController();
    this.abortControllers.set(requestId, abortController);

    // Setup timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const url = this.buildURL(endpoint, params);

      const requestHeaders: HeadersInit = {
        ...this.defaultHeaders,
        ...headers,
      };

      if (token && !skipAuth) {
        requestHeaders["Authorization"] = `Bearer ${token}`;
      }

      // Get current project from store if available
      const projectId = useAuthStore.getState().user?.projects?.[0];
      if (projectId && !skipAuth) {
        requestHeaders["X-Project-Id"] = projectId;
      }

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: abortController.signal,
        ...restOptions,
      });

      return await this.handleResponse<T>(response);
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw {
          message: "Request timeout",
          status: 408,
        } as ApiError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
    }
  }

  // HTTP Methods
  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("GET", endpoint, options);
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>("POST", endpoint, { ...options, body: data });
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PUT", endpoint, { ...options, body: data });
  }

  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>("PATCH", endpoint, { ...options, body: data });
  }

  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>("DELETE", endpoint, options);
  }

  // File upload
  async upload<T = any>(
    endpoint: string,
    formData: FormData,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const { headers = {}, ...restOptions } = options || {};

    // Remove Content-Type header to let browser set it with boundary
    const uploadHeaders = { ...headers };
    delete uploadHeaders["Content-Type"];

    return this.request<T>("POST", endpoint, {
      ...restOptions,
      headers: uploadHeaders,
      body: formData as any,
    });
  }

  // Cancel a request
  cancelRequest(endpoint: string): void {
    const controllers = Array.from(this.abortControllers.entries()).filter(([key]) =>
      key.includes(endpoint)
    );

    controllers.forEach(([key, controller]) => {
      controller.abort();
      this.abortControllers.delete(key);
    });
  }

  // Cancel all requests
  cancelAllRequests(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30000,
});

// Export for use in React Query
export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiClient.get<T>(endpoint, options).then((res) => res.data),

  post: <T = any>(endpoint: string, data?: any, options?: RequestOptions) =>
    apiClient.post<T>(endpoint, data, options).then((res) => res.data),

  put: <T = any>(endpoint: string, data?: any, options?: RequestOptions) =>
    apiClient.put<T>(endpoint, data, options).then((res) => res.data),

  patch: <T = any>(endpoint: string, data?: any, options?: RequestOptions) =>
    apiClient.patch<T>(endpoint, data, options).then((res) => res.data),

  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiClient.delete<T>(endpoint, options).then((res) => res.data),

  upload: <T = any>(endpoint: string, formData: FormData, options?: RequestOptions) =>
    apiClient.upload<T>(endpoint, formData, options).then((res) => res.data),
};

export default apiClient;
