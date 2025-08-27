/**
 * Structured Logger for Okaeri Resort System
 * Optimized for serverless environments with proper error handling
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
  userId?: string;
  projectId?: string;
  requestId?: string;
  timestamp?: string;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.minLevel = this.isDevelopment ? "debug" : "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[this.minLevel];
  }

  private formatMessage(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Development: Human-readable format
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context, null, 2)}` : "";
      const errorStr = entry.error
        ? `\nError: ${entry.error.message}\nStack: ${entry.error.stack}`
        : "";

      return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}${contextStr}${errorStr}`;
    } else {
      // Production: Structured JSON for log aggregation
      return JSON.stringify({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        context: entry.context,
        error: entry.error
          ? {
              message: entry.error.message,
              stack: entry.error.stack,
              name: entry.error.name,
            }
          : undefined,
      });
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      error,
    };

    const formattedMessage = this.formatMessage(entry);

    // Route to appropriate console method
    switch (level) {
      case "debug":
        console.debug(formattedMessage);
        break;
      case "info":
        console.info(formattedMessage);
        break;
      case "warn":
        console.warn(formattedMessage);
        break;
      case "error":
        console.error(formattedMessage);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log("warn", message, context, error);
  }

  error(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    // Handle overloaded parameters
    let context: LogContext | undefined;
    let actualError: Error | undefined;

    if (contextOrError instanceof Error) {
      actualError = contextOrError;
    } else {
      context = contextOrError;
      actualError = error;
    }

    this.log("error", message, context, actualError);
  }

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();

    // Override log method to include parent context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (
      level: LogLevel,
      message: string,
      childContext?: LogContext,
      error?: Error
    ) => {
      const mergedContext = { ...context, ...childContext };
      originalLog(level, message, mergedContext, error);
    };

    return childLogger;
  }

  /**
   * Time a function execution
   */
  time<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    const startTime = performance.now();

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((value) => {
            const duration = performance.now() - startTime;
            this.debug(`${label} completed`, { duration: Math.round(duration) });
            return value;
          })
          .catch((error) => {
            const duration = performance.now() - startTime;
            this.error(`${label} failed`, { duration: Math.round(duration) }, error);
            throw error;
          });
      } else {
        const duration = performance.now() - startTime;
        this.debug(`${label} completed`, { duration: Math.round(duration) });
        return result;
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      this.error(`${label} failed`, { duration: Math.round(duration) }, error as Error);
      throw error;
    }
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Export types for external use
export type { LogLevel, LogContext };

// Create convenience functions for common use cases
export const createRequestLogger = (requestId: string, userId?: string, projectId?: string) => {
  return logger.child({ requestId, userId, projectId });
};

export const createDatabaseLogger = (operation: string, projectId?: string) => {
  return logger.child({ component: "database", operation, projectId });
};

export const createAuthLogger = (userId?: string) => {
  return logger.child({ component: "auth", userId });
};
