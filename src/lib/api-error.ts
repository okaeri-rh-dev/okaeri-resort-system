/**
 * API Error Handler
 * Consistent error responses for API endpoints
 */

import { NextResponse } from "next/server";
import { isDevelopment } from "./env-client";

export class ApiError {
  static badRequest(message: string, errors?: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message,
          errors,
        },
      },
      { status: 400 }
    );
  }

  static unauthorized(message: string = "Unauthorized") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message,
        },
      },
      { status: 401 }
    );
  }

  static forbidden(message: string = "Forbidden") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message,
        },
      },
      { status: 403 }
    );
  }

  static notFound(message: string = "Not found") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message,
        },
      },
      { status: 404 }
    );
  }

  static conflict(message: string) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONFLICT",
          message,
        },
      },
      { status: 409 }
    );
  }

  static unprocessable(message: string, errors?: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNPROCESSABLE_ENTITY",
          message,
          errors,
        },
      },
      { status: 422 }
    );
  }

  static tooManyRequests(message: string = "Too many requests") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message,
        },
      },
      { status: 429 }
    );
  }

  static internal(message: string = "Internal server error") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }

  static handle(error: unknown, context?: string) {
    console.error(`API Error${context ? ` in ${context}` : ""}:`, error);

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes("not found")) {
        return this.notFound(error.message);
      }
      if (error.message.includes("unauthorized") || error.message.includes("authentication")) {
        return this.unauthorized(error.message);
      }
      if (error.message.includes("forbidden") || error.message.includes("permission")) {
        return this.forbidden(error.message);
      }
      if (error.message.includes("conflict") || error.message.includes("already exists")) {
        return this.conflict(error.message);
      }

      // Return generic error with message in development
      if (isDevelopment()) {
        return this.internal(error.message);
      }
    }

    // Return generic error in production
    return this.internal();
  }
}
