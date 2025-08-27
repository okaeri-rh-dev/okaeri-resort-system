/**
 * Centralized Error Handling for Okaeri Resort System
 * Provides consistent error handling across the application
 */

import { logger } from "./logger";

// Error types for better categorization
export type ErrorType =
  | "validation"
  | "authentication"
  | "authorization"
  | "network"
  | "database"
  | "server"
  | "client"
  | "unknown";

export interface AppError extends Error {
  type: ErrorType;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  isOperational?: boolean;
}

// Custom error classes
export class ValidationError extends Error implements AppError {
  type: ErrorType = "validation";
  isOperational = true;

  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends Error implements AppError {
  type: ErrorType = "authentication";
  statusCode = 401;
  isOperational = true;

  constructor(
    message: string = "Authentication required",
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error implements AppError {
  type: ErrorType = "authorization";
  statusCode = 403;
  isOperational = true;

  constructor(
    message: string = "Access denied",
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NetworkError extends Error implements AppError {
  type: ErrorType = "network";
  statusCode?: number;
  isOperational = true;

  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
    statusCode?: number
  ) {
    super(message);
    this.name = "NetworkError";
    this.statusCode = statusCode;
  }
}

export class DatabaseError extends Error implements AppError {
  type: ErrorType = "database";
  statusCode = 500;
  isOperational = true;

  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

// Error handling utilities
export class ErrorHandler {
  /**
   * Handle and format errors consistently
   */
  static handle(error: unknown, context?: Record<string, unknown>): AppError {
    let appError: AppError;

    if (error instanceof Error && "type" in error) {
      // Already an AppError
      appError = error as AppError;
    } else if (error instanceof Error) {
      // Regular Error - convert to AppError
      appError = {
        ...error,
        type: "unknown" as ErrorType,
        isOperational: false,
      };
    } else {
      // Non-Error object
      appError = {
        name: "UnknownError",
        message: typeof error === "string" ? error : "An unknown error occurred",
        type: "unknown" as ErrorType,
        isOperational: false,
      } as AppError;
    }

    // Log the error
    logger.error(
      `${appError.type} error occurred`,
      {
        errorName: appError.name,
        errorCode: appError.code,
        errorType: appError.type,
        statusCode: appError.statusCode,
        isOperational: appError.isOperational,
        details: appError.details,
        context,
      },
      appError
    );

    return appError;
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: AppError): string {
    switch (error.type) {
      case "validation":
        return error.message || "Please check your input and try again";

      case "authentication":
        return "Please log in to continue";

      case "authorization":
        return "You do not have permission to perform this action";

      case "network":
        return "Network error. Please check your internet connection and try again";

      case "database":
        return "We are experiencing technical difficulties. Please try again later";

      case "server":
        return "Server error. Our team has been notified and is working to fix this issue";

      default:
        return "An unexpected error occurred. Please try again";
    }
  }

  /**
   * Check if error should be retried
   */
  static isRetryable(error: AppError): boolean {
    return error.type === "network" || (error.type === "server" && error.statusCode !== 400);
  }

  /**
   * Wrap async functions with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<{ data?: T; error?: AppError }> {
    try {
      const data = await operation();
      return { data };
    } catch (error) {
      const appError = ErrorHandler.handle(error, context);
      return { error: appError };
    }
  }

  /**
   * Handle API response errors
   */
  static handleApiError(response: Response, data?: unknown): AppError {
    let errorType: ErrorType = "server";
    let message = "Server error occurred";

    switch (response.status) {
      case 400:
        errorType = "validation";
        message = "Invalid request data";
        break;
      case 401:
        errorType = "authentication";
        message = "Authentication required";
        break;
      case 403:
        errorType = "authorization";
        message = "Access denied";
        break;
      case 404:
        errorType = "client";
        message = "Resource not found";
        break;
      case 422:
        errorType = "validation";
        message = "Validation failed";
        break;
      case 429:
        errorType = "client";
        message = "Too many requests. Please try again later";
        break;
      case 500:
        errorType = "server";
        message = "Internal server error";
        break;
      case 502:
      case 503:
      case 504:
        errorType = "server";
        message = "Server temporarily unavailable";
        break;
      default:
        if (response.status >= 400 && response.status < 500) {
          errorType = "client";
          message = "Client error";
        } else if (response.status >= 500) {
          errorType = "server";
          message = "Server error";
        }
    }

    // Try to extract error message from response data
    if (data && typeof data === "object") {
      const responseData = data as Record<string, unknown>;
      if (responseData.message && typeof responseData.message === "string") {
        message = responseData.message;
      } else if (responseData.error && typeof responseData.error === "string") {
        message = responseData.error;
      }
    }

    const appError: AppError = {
      name: `ApiError${response.status}`,
      message,
      type: errorType,
      statusCode: response.status,
      code: response.status.toString(),
      isOperational: true,
      details: {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        data,
      },
    } as AppError;

    return ErrorHandler.handle(appError);
  }
}

// Async error boundary hook
export const useAsyncError = () => {
  const throwError = (error: Error) => {
    throw error;
  };

  return throwError;
};

// Error recovery utilities
export const ErrorRecovery = {
  /**
   * Retry operation with exponential backoff
   */
  async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw ErrorHandler.handle(lastError, {
            attempt,
            maxAttempts,
            operation: "retry",
          });
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(`Operation failed, retrying in ${delay}ms`, {
          attempt,
          maxAttempts,
          error: lastError.message,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw ErrorHandler.handle(lastError!, { maxAttempts, operation: "retry" });
  },

  /**
   * Circuit breaker pattern
   */
  createCircuitBreaker<T>(
    operation: () => Promise<T>,
    failureThreshold: number = 5,
    timeoutMs: number = 60000
  ) {
    let failureCount = 0;
    let lastFailureTime: number | null = null;
    let isOpen = false;

    return async (): Promise<T> => {
      // Check if circuit is open
      if (isOpen) {
        if (!lastFailureTime || Date.now() - lastFailureTime < timeoutMs) {
          throw new Error("Circuit breaker is open");
        } else {
          // Try to close circuit
          isOpen = false;
          failureCount = 0;
        }
      }

      try {
        const result = await operation();
        // Reset on success
        failureCount = 0;
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = Date.now();

        if (failureCount >= failureThreshold) {
          isOpen = true;
          logger.warn("Circuit breaker opened", {
            failureCount,
            failureThreshold,
          });
        }

        throw error;
      }
    };
  },
};

// Export convenience functions
export const createValidationError = (message: string, details?: Record<string, unknown>) =>
  new ValidationError(message, "VALIDATION_ERROR", details);

export const createAuthenticationError = (message?: string, details?: Record<string, unknown>) =>
  new AuthenticationError(message, "AUTH_ERROR", details);

export const createAuthorizationError = (message?: string, details?: Record<string, unknown>) =>
  new AuthorizationError(message, "AUTHZ_ERROR", details);

export const createNetworkError = (
  message: string,
  statusCode?: number,
  details?: Record<string, unknown>
) => new NetworkError(message, "NETWORK_ERROR", details, statusCode);

export const createDatabaseError = (message: string, details?: Record<string, unknown>) =>
  new DatabaseError(message, "DB_ERROR", details);
