/**
 * Session monitoring for user activity and timeout management
 * Implements idle timeout and session security
 */

import { TOKEN_EXPIRY, AUDIT_EVENTS } from "./constants";

export interface SessionConfig {
  timeout: number;
  warningTime: number;
  onTimeout: () => void;
  onWarning?: (timeLeft: number) => void;
  onActivity?: () => void;
}

export class SessionMonitor {
  private static instance: SessionMonitor;
  private lastActivity: number = Date.now();
  private timeoutTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private config: SessionConfig | null = null;
  private isActive: boolean = false;
  private activityListeners: Set<() => void> = new Set();

  // Events to monitor for user activity
  private readonly ACTIVITY_EVENTS = [
    "mousedown",
    "mousemove",
    "keypress",
    "scroll",
    "touchstart",
    "click",
    "keydown",
  ];

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): SessionMonitor {
    if (!SessionMonitor.instance) {
      SessionMonitor.instance = new SessionMonitor();
    }
    return SessionMonitor.instance;
  }

  /**
   * Start monitoring session
   */
  start(config: SessionConfig): void {
    this.config = config;
    this.isActive = true;
    this.lastActivity = Date.now();

    // Add activity listeners
    this.ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, this.handleActivity, { passive: true });
    });

    // Start checking for timeout
    this.scheduleTimeoutCheck();

    // Log session start
    this.logSessionEvent("session_started");
  }

  /**
   * Stop monitoring session
   */
  stop(): void {
    this.isActive = false;

    // Remove activity listeners
    this.ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, this.handleActivity);
    });

    // Clear timers
    this.clearTimers();

    // Log session end
    this.logSessionEvent("session_ended");
  }

  /**
   * Handle user activity
   */
  private handleActivity = (): void => {
    if (!this.isActive) return;

    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;

    // Only update if significant time has passed (throttle)
    if (timeSinceLastActivity > 1000) {
      this.lastActivity = now;

      // Reset timers
      this.scheduleTimeoutCheck();

      // Notify activity listeners
      this.config?.onActivity?.();
      this.activityListeners.forEach((listener) => listener());
    }
  };

  /**
   * Schedule timeout check
   */
  private scheduleTimeoutCheck(): void {
    this.clearTimers();

    if (!this.config) return;

    const { timeout, warningTime, onTimeout, onWarning } = this.config;

    // Schedule warning
    if (onWarning && warningTime > 0) {
      const warningDelay = timeout - warningTime;
      this.warningTimer = setTimeout(() => {
        if (this.isActive) {
          const timeLeft = this.getTimeUntilTimeout();
          onWarning(timeLeft);
          this.logSessionEvent("session_warning");
        }
      }, warningDelay);
    }

    // Schedule timeout
    this.timeoutTimer = setTimeout(() => {
      if (this.isActive) {
        this.isActive = false;
        onTimeout();
        this.logSessionEvent("session_timeout");
        this.stop();
      }
    }, timeout);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * Get time until session timeout
   */
  getTimeUntilTimeout(): number {
    if (!this.config || !this.isActive) return 0;

    const elapsed = Date.now() - this.lastActivity;
    const remaining = this.config.timeout - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): number {
    return this.lastActivity;
  }

  /**
   * Extend session
   */
  extendSession(): void {
    if (this.isActive) {
      this.lastActivity = Date.now();
      this.scheduleTimeoutCheck();
      this.logSessionEvent("session_extended");
    }
  }

  /**
   * Register activity listener
   */
  onActivity(listener: () => void): () => void {
    this.activityListeners.add(listener);
    return () => {
      this.activityListeners.delete(listener);
    };
  }

  /**
   * Log session events for audit trail
   */
  private logSessionEvent(event: string): void {
    // Store in session storage for later submission to server
    const events = JSON.parse(sessionStorage.getItem("session_events") || "[]");
    events.push({
      event,
      timestamp: new Date().toISOString(),
      lastActivity: this.lastActivity,
    });

    // Keep only last 50 events
    if (events.length > 50) {
      events.shift();
    }

    sessionStorage.setItem("session_events", JSON.stringify(events));
  }

  /**
   * Get session events for audit submission
   */
  getSessionEvents(): any[] {
    return JSON.parse(sessionStorage.getItem("session_events") || "[]");
  }

  /**
   * Clear session events
   */
  clearSessionEvents(): void {
    sessionStorage.removeItem("session_events");
  }
}

// Export singleton instance
export const sessionMonitor = SessionMonitor.getInstance();
