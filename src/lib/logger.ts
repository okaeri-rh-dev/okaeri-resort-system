/**
 * Simple browser-compatible logger utility
 * Provides structured logging with environment-aware output
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
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
          // eslint-disable-next-line no-console
          console.log(formattedMessage);
        }
        break;
      case "info":
        if (this.isDevelopment) {
          // eslint-disable-next-line no-console
          console.log(formattedMessage);
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
}

// Export singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel, LogContext };
