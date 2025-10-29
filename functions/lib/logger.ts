/**
 * Simple Cloudflare Workers-compatible logger utility
 * Provides structured logging with environment-aware output
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor(isDevelopment = false) {
    this.isDevelopment = isDevelopment;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`;
    }

    return `${prefix} ${message}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(level, message, context);

    switch (level) {
      case "debug":
        if (this.isDevelopment) {
          console.warn(formattedMessage); // Use console.warn for Workers compatibility
        }
        break;
      case "info":
        if (this.isDevelopment) {
          console.warn(formattedMessage); // Use console.warn for Workers compatibility
        }
        break;
      case "warn":
        console.warn(formattedMessage);
        break;
      case "error":
        console.error(formattedMessage);
        break;
    }
  }

  /**
   * Log debug information (only in development)
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Log general information (only in development)
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  /**
   * Log warnings (always logged)
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  /**
   * Log errors (always logged)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      ...(error instanceof Error
        ? {
            error: error.message,
            stack: error.stack,
            name: error.name,
          }
        : { error: String(error) }),
    };

    this.log("error", message, errorContext);
  }

  /**
   * Create a child logger with a specific context
   */
  child(defaultContext: LogContext): Logger {
    const childLogger = new Logger(this.isDevelopment);
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (level: LogLevel, message: string, context?: LogContext) => {
      originalLog(level, message, { ...defaultContext, ...context });
    };

    return childLogger;
  }

  /**
   * Set development mode (useful for testing)
   */
  setDevelopment(isDevelopment: boolean): void {
    this.isDevelopment = isDevelopment;
  }
}

// Export factory function for environment-aware logger
export function createLogger(env?: { ENVIRONMENT?: string }): Logger {
  const isDevelopment = env?.ENVIRONMENT !== "production";
  return new Logger(isDevelopment);
}

// Export default logger instance
export const logger = new Logger(false); // Default to production mode

// Export type for external use
export type { LogLevel, LogContext, Logger };
