/**
 * Session Monitoring with Enhanced Security
 * Implements idle timeout detection with tab visibility awareness
 * Compliant with Philippine Data Privacy Act requirements
 */

import { TOKEN_EXPIRY, AUDIT_EVENTS, SECURITY_ERROR_CODES } from "./constants";
import { auditLogger } from "./audit-logger";

export interface SessionConfig {
  timeout: number;
  warningTime: number;
  onTimeout: () => void;
  onWarning?: (timeLeft: number) => void;
  onActivity?: () => void;
  onExtend?: () => void;
}

export class SessionMonitor {
  private static instance: SessionMonitor;
  private lastActivity: number = Date.now();
  private timeoutTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private config: SessionConfig | null = null;
  private isActive: boolean = false;
  private isPaused: boolean = false;
  private activityListeners: Set<() => void> = new Set();
  private warningShown: boolean = false;
  private sessionStartTime: number = 0;
  private totalActiveTime: number = 0;
  private pausedAt: number = 0;
  private visibilityChangeHandler: (() => void) | null = null;
  private storageEventHandler: ((event: StorageEvent) => void) | null = null;
  private memorySessionEvents: any[] = []; // Memory storage for production

  // Events to monitor for user activity
  private readonly ACTIVITY_EVENTS = [
    "mousedown",
    "mousemove",
    "keypress",
    "scroll",
    "touchstart",
    "click",
    "keydown",
    "focus",
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
   * Check if running in development mode
   * SECURITY: Session events should only use browser storage in development
   */
  private isDevelopmentMode(): boolean {
    return import.meta.env.DEV;
  }

  /**
   * Start monitoring session with enhanced security
   * @param config - Session configuration
   */
  start(config: SessionConfig): void {
    // Prevent multiple starts
    if (this.isActive) {
      console.warn("Session monitor already active");
      return;
    }

    this.config = config;
    this.isActive = true;
    this.isPaused = false;
    this.warningShown = false;
    this.lastActivity = Date.now();
    this.sessionStartTime = Date.now();
    this.totalActiveTime = 0;

    // Add activity listeners with proper options
    this.ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, this.handleActivity, {
        passive: true,
        capture: true, // Capture phase for earlier detection
      });
    });

    // Set up visibility change detection
    this.setupVisibilityHandling();

    // Set up cross-tab synchronization
    this.setupCrossTabSync();

    // Start checking for timeout
    this.scheduleTimeoutCheck();

    // Log session start with audit trail
    auditLogger.log(AUDIT_EVENTS.AUTH_LOGIN, {
      result: "success",
      details: {
        sessionTimeout: config.timeout,
        warningTime: config.warningTime,
      },
    });

    this.logSessionEvent("session_started");
  }

  /**
   * Stop monitoring session with cleanup
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.isPaused = false;

    // Calculate total session time
    if (this.sessionStartTime) {
      this.totalActiveTime = Date.now() - this.sessionStartTime;
    }

    // Remove activity listeners
    this.ACTIVITY_EVENTS.forEach((event) => {
      window.removeEventListener(event, this.handleActivity, true);
    });

    // Remove visibility handler
    if (this.visibilityChangeHandler) {
      document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    // Remove storage event handler
    if (this.storageEventHandler) {
      window.removeEventListener("storage", this.storageEventHandler);
      this.storageEventHandler = null;
    }

    // Clear timers
    this.clearTimers();

    // Clear activity listeners
    this.activityListeners.clear();

    // Log session end with metrics
    auditLogger.log(AUDIT_EVENTS.AUTH_LOGOUT, {
      result: "success",
      details: {
        sessionDuration: this.totalActiveTime,
        lastActivity: this.lastActivity,
      },
    });

    this.logSessionEvent("session_ended");
  }

  /**
   * Handle user activity with throttling
   */
  private handleActivity = (event?: Event): void => {
    if (!this.isActive || this.isPaused) return;

    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;

    // Throttle updates to prevent performance issues
    if (timeSinceLastActivity > 1000) {
      this.lastActivity = now;

      // Reset warning state if warning was shown
      if (this.warningShown) {
        this.warningShown = false;
      }

      // Reset timers
      this.scheduleTimeoutCheck();

      // Notify activity listeners
      this.config?.onActivity?.();
      this.activityListeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.error("Activity listener error:", error);
        }
      });

      // Log significant activities for security audit
      if (event?.type && ["click", "keydown", "touchstart"].includes(event.type)) {
        this.logActivityMetrics();
      }
    }
  };

  /**
   * Schedule timeout check with warning support
   */
  private scheduleTimeoutCheck(): void {
    this.clearTimers();

    if (!this.config || this.isPaused) return;

    const { timeout, warningTime, onTimeout, onWarning } = this.config;

    // Schedule warning if not already shown
    if (onWarning && warningTime > 0 && !this.warningShown) {
      const warningDelay = timeout - warningTime;

      if (warningDelay > 0) {
        this.warningTimer = setTimeout(() => {
          if (this.isActive && !this.isPaused) {
            const timeLeft = this.getTimeUntilTimeout();
            this.warningShown = true;

            // Call warning callback
            try {
              onWarning(timeLeft);
            } catch (error) {
              console.error("Warning callback error:", error);
            }

            // Log warning event
            auditLogger.logSecurityEvent("suspicious", {
              type: "session_warning",
              timeLeft,
            });

            this.logSessionEvent("session_warning");
          }
        }, warningDelay);
      }
    }

    // Schedule timeout
    this.timeoutTimer = setTimeout(() => {
      if (this.isActive && !this.isPaused) {
        // Mark as inactive before calling callback
        this.isActive = false;

        // Log timeout event for security audit
        auditLogger.logSecurityEvent("suspicious", {
          type: "session_timeout",
          lastActivity: this.lastActivity,
        });

        this.logSessionEvent("session_timeout");

        // Call timeout callback
        try {
          onTimeout();
        } catch (error) {
          console.error("Timeout callback error:", error);
        }

        // Clean up
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
   * @returns Time in milliseconds until timeout
   */
  getTimeUntilTimeout(): number {
    if (!this.config || !this.isActive) return 0;

    if (this.isPaused) {
      // If paused, return the time that was remaining when paused
      const elapsed = this.pausedAt - this.lastActivity;
      const remaining = this.config.timeout - elapsed;
      return Math.max(0, remaining);
    }

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
   * @returns Timestamp of last user activity
   */
  getLastActivity(): number {
    return this.lastActivity;
  }

  /**
   * Pause session monitoring (e.g., when tab is hidden)
   */
  pause(): void {
    if (!this.isActive || this.isPaused) return;

    this.isPaused = true;
    this.pausedAt = Date.now();
    this.clearTimers();

    this.logSessionEvent("session_paused");
  }

  /**
   * Resume session monitoring (e.g., when tab becomes visible)
   */
  resume(): void {
    if (!this.isActive || !this.isPaused) return;

    this.isPaused = false;

    // Adjust last activity time to account for pause duration
    const pauseDuration = Date.now() - this.pausedAt;
    this.lastActivity = this.lastActivity + pauseDuration;

    // Check if session should have timed out during pause
    if (this.getTimeUntilTimeout() <= 0) {
      // Session expired during pause
      if (this.config?.onTimeout) {
        this.isActive = false;
        this.config.onTimeout();
        this.stop();
      }
    } else {
      // Resume normal monitoring
      this.scheduleTimeoutCheck();
      this.logSessionEvent("session_resumed");
    }
  }

  /**
   * Extend session manually
   * Used when user explicitly requests session extension
   */
  extendSession(): void {
    if (!this.isActive) {
      console.warn("Cannot extend inactive session");
      return;
    }

    this.lastActivity = Date.now();
    this.warningShown = false;
    this.scheduleTimeoutCheck();

    // Call extend callback if provided
    this.config?.onExtend?.();

    // Log extension for audit
    auditLogger.log(AUDIT_EVENTS.AUTH_TOKEN_REFRESH, {
      result: "success",
      details: {
        type: "session_extended",
        newTimeout: this.getTimeUntilTimeout(),
      },
    });

    this.logSessionEvent("session_extended");
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
    const newEvent = {
      event,
      timestamp: new Date().toISOString(),
      lastActivity: this.lastActivity,
    };

    // SECURITY: Use memory storage in production, sessionStorage only in dev
    if (this.isDevelopmentMode()) {
      // Development: Store in sessionStorage for debugging
      const events = JSON.parse(sessionStorage.getItem("session_events") || "[]");
      events.push(newEvent);

      // Keep only last 50 events
      if (events.length > 50) {
        events.shift();
      }

      sessionStorage.setItem("session_events", JSON.stringify(events));
    } else {
      // Production: Store in memory only
      this.memorySessionEvents.push(newEvent);

      // Keep only last 50 events in memory
      if (this.memorySessionEvents.length > 50) {
        this.memorySessionEvents.shift();
      }
    }
  }

  /**
   * Get session events for audit submission
   */
  getSessionEvents(): any[] {
    // SECURITY: Use memory storage in production, sessionStorage only in dev
    if (this.isDevelopmentMode()) {
      return JSON.parse(sessionStorage.getItem("session_events") || "[]");
    } else {
      // Production: Return from memory
      return [...this.memorySessionEvents];
    }
  }

  /**
   * Clear session events
   */
  clearSessionEvents(): void {
    try {
      // SECURITY: Clear based on environment
      if (this.isDevelopmentMode()) {
        sessionStorage.removeItem("session_events");
      } else {
        // Production: Clear memory
        this.memorySessionEvents = [];
      }
    } catch (error) {
      console.error("Failed to clear session events:", error);
    }
  }

  /**
   * Set up visibility change handling
   */
  private setupVisibilityHandling(): void {
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        // Tab is hidden, pause monitoring
        this.pause();
      } else {
        // Tab is visible, resume monitoring
        this.resume();
      }
    };

    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
  }

  /**
   * Set up cross-tab synchronization
   */
  private setupCrossTabSync(): void {
    this.storageEventHandler = (event: StorageEvent) => {
      // Handle logout from another tab
      if (event.key === "okaeri_logout_event" && event.newValue) {
        this.stop();
      }

      // Handle session extension from another tab
      if (event.key === "okaeri_session_extend" && event.newValue) {
        const extendData = JSON.parse(event.newValue);
        if (extendData.timestamp > this.lastActivity) {
          this.lastActivity = extendData.timestamp;
          this.scheduleTimeoutCheck();
        }
      }
    };

    window.addEventListener("storage", this.storageEventHandler);
  }

  /**
   * Log activity metrics for security analysis
   */
  private logActivityMetrics(): void {
    const metrics = {
      sessionDuration: Date.now() - this.sessionStartTime,
      idleTime: Date.now() - this.lastActivity,
      warningShown: this.warningShown,
      isPaused: this.isPaused,
    };

    // Store metrics for security analysis (in production, send to server)
    if (import.meta.env.DEV) {
      console.debug("Session activity metrics:", metrics);
    }
  }

  /**
   * Get session status
   * @returns Current session status
   */
  getSessionStatus(): {
    isActive: boolean;
    isPaused: boolean;
    lastActivity: number;
    timeUntilTimeout: number;
    warningShown: boolean;
    sessionDuration: number;
  } {
    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      lastActivity: this.lastActivity,
      timeUntilTimeout: this.getTimeUntilTimeout(),
      warningShown: this.warningShown,
      sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
    };
  }

  /**
   * Force session timeout (for testing or security purposes)
   */
  forceTimeout(): void {
    if (this.isActive && this.config?.onTimeout) {
      this.isActive = false;

      auditLogger.logSecurityEvent("suspicious", {
        type: "forced_timeout",
        reason: "manual_trigger",
      });

      this.config.onTimeout();
      this.stop();
    }
  }
}

// Export singleton instance
export const sessionMonitor = SessionMonitor.getInstance();
