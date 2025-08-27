/**
 * Session Monitoring Security Tests
 * Comprehensive security testing for session management
 * Tests idle timeout, cross-tab sync, and Philippine compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionMonitor, sessionMonitor } from "../session-monitor";
import { auditLogger } from "../audit-logger";
import { AUDIT_EVENTS, TOKEN_EXPIRY } from "../constants";

describe("Session Monitor Security Tests", () => {
  let monitor: SessionMonitor;
  let onTimeoutSpy: ReturnType<typeof vi.fn>;
  let onWarningSpy: ReturnType<typeof vi.fn>;
  let onActivitySpy: ReturnType<typeof vi.fn>;
  let onExtendSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear all mocks and timers
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();

    // Create fresh instance
    monitor = SessionMonitor.getInstance();

    // Stop any existing monitoring
    monitor.stop();

    // Create spy functions
    onTimeoutSpy = vi.fn();
    onWarningSpy = vi.fn();
    onActivitySpy = vi.fn();
    onExtendSpy = vi.fn();

    // Mock audit logger
    vi.spyOn(auditLogger, "log").mockImplementation(() => {});
    vi.spyOn(auditLogger, "logSecurityEvent").mockImplementation(() => {});
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Session Lifecycle Management", () => {
    it("should start session monitoring with proper configuration", () => {
      const config = {
        timeout: 30000,
        warningTime: 5000,
        onTimeout: onTimeoutSpy,
        onWarning: onWarningSpy,
        onActivity: onActivitySpy,
        onExtend: onExtendSpy,
      };

      monitor.start(config);

      expect(monitor.isSessionActive()).toBe(true);
      expect(monitor.getTimeUntilTimeout()).toBe(30000);

      // Should log session start
      expect(auditLogger.log).toHaveBeenCalledWith(
        AUDIT_EVENTS.AUTH_LOGIN,
        expect.objectContaining({
          result: "success",
          details: expect.objectContaining({
            sessionTimeout: 30000,
            warningTime: 5000,
          }),
        })
      );
    });

    it("should prevent multiple simultaneous session starts", () => {
      const config = {
        timeout: 30000,
        warningTime: 5000,
        onTimeout: onTimeoutSpy,
      };

      const consoleSpy = vi.spyOn(console, "warn");

      monitor.start(config);
      monitor.start(config); // Second start should be ignored

      expect(consoleSpy).toHaveBeenCalledWith("Session monitor already active");
      expect(monitor.isSessionActive()).toBe(true);
    });

    it("should trigger warning before timeout", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
        onWarning: onWarningSpy,
      });

      // Fast-forward to warning time (10000 - 2000 = 8000ms)
      vi.advanceTimersByTime(8000);

      expect(onWarningSpy).toHaveBeenCalledWith(2000);
      expect(onTimeoutSpy).not.toHaveBeenCalled();

      // Verify security event logged
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "suspicious",
        expect.objectContaining({
          type: "session_warning",
          timeLeft: 2000,
        })
      );
    });

    it("should trigger timeout after inactivity period", () => {
      monitor.start({
        timeout: 5000,
        warningTime: 1000,
        onTimeout: onTimeoutSpy,
      });

      // Fast-forward past timeout
      vi.advanceTimersByTime(5001);

      expect(onTimeoutSpy).toHaveBeenCalled();
      expect(monitor.isSessionActive()).toBe(false);

      // Verify security event logged
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "suspicious",
        expect.objectContaining({
          type: "session_timeout",
          lastActivity: expect.any(Number),
        })
      );
    });
  });

  describe("Activity Detection and Handling", () => {
    it("should reset timeout on user activity", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
        onActivity: onActivitySpy,
      });

      // Simulate activity after 5 seconds
      vi.advanceTimersByTime(5000);

      // Trigger activity event
      const event = new MouseEvent("click");
      window.dispatchEvent(event);

      // Allow throttle delay
      vi.advanceTimersByTime(1001);

      expect(onActivitySpy).toHaveBeenCalled();

      // Fast-forward another 8 seconds (total 14 seconds since start)
      vi.advanceTimersByTime(8000);

      // Should not have timed out yet due to activity reset
      expect(onTimeoutSpy).not.toHaveBeenCalled();

      // Fast-forward past new timeout
      vi.advanceTimersByTime(3000);
      expect(onTimeoutSpy).toHaveBeenCalled();
    });

    it("should throttle activity updates for performance", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
        onActivity: onActivitySpy,
      });

      // Trigger multiple rapid activities
      for (let i = 0; i < 10; i++) {
        const event = new MouseEvent("mousemove");
        window.dispatchEvent(event);
        vi.advanceTimersByTime(100); // 100ms between events
      }

      // Activity callback should be throttled
      expect(onActivitySpy).toHaveBeenCalledTimes(0); // No calls due to throttle

      // Advance past throttle period
      vi.advanceTimersByTime(1000);

      // Trigger another activity
      window.dispatchEvent(new MouseEvent("click"));
      vi.advanceTimersByTime(1001);

      expect(onActivitySpy).toHaveBeenCalledTimes(1);
    });

    it("should track all specified activity events", () => {
      const activityEvents = [
        "mousedown",
        "mousemove",
        "keypress",
        "scroll",
        "touchstart",
        "click",
        "keydown",
        "focus",
      ];

      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      // Restart to capture event listeners
      monitor.stop();
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Verify all activity events are registered
      activityEvents.forEach((eventType) => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          eventType,
          expect.any(Function),
          expect.objectContaining({
            passive: true,
            capture: true,
          })
        );
      });
    });
  });

  describe("Tab Visibility Handling", () => {
    it("should pause monitoring when tab becomes hidden", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Simulate tab becoming hidden
      Object.defineProperty(document, "hidden", {
        value: true,
        writable: true,
        configurable: true,
      });

      const visibilityEvent = new Event("visibilitychange");
      document.dispatchEvent(visibilityEvent);

      const status = monitor.getSessionStatus();
      expect(status.isPaused).toBe(true);

      // Time should not progress while paused
      vi.advanceTimersByTime(15000);
      expect(onTimeoutSpy).not.toHaveBeenCalled();
    });

    it("should resume monitoring when tab becomes visible", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Hide tab
      Object.defineProperty(document, "hidden", {
        value: true,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Wait 5 seconds while hidden
      vi.advanceTimersByTime(5000);

      // Show tab
      Object.defineProperty(document, "hidden", {
        value: false,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      const status = monitor.getSessionStatus();
      expect(status.isPaused).toBe(false);

      // Should have adjusted timeout to account for pause
      expect(monitor.getTimeUntilTimeout()).toBeGreaterThan(0);
      expect(onTimeoutSpy).not.toHaveBeenCalled();
    });

    it("should timeout if session expired while tab was hidden", () => {
      monitor.start({
        timeout: 5000,
        warningTime: 1000,
        onTimeout: onTimeoutSpy,
      });

      // Hide tab
      Object.defineProperty(document, "hidden", {
        value: true,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Wait longer than timeout
      vi.advanceTimersByTime(10000);

      // Show tab
      Object.defineProperty(document, "hidden", {
        value: false,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Should trigger timeout immediately
      expect(onTimeoutSpy).toHaveBeenCalled();
      expect(monitor.isSessionActive()).toBe(false);
    });
  });

  describe("Cross-Tab Synchronization", () => {
    it("should handle logout events from other tabs", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Simulate logout event from another tab
      const storageEvent = new StorageEvent("storage", {
        key: "okaeri_logout_event",
        newValue: JSON.stringify({ timestamp: Date.now() }),
      });

      window.dispatchEvent(storageEvent);

      expect(monitor.isSessionActive()).toBe(false);
      expect(auditLogger.log).toHaveBeenCalledWith(AUDIT_EVENTS.AUTH_LOGOUT, expect.any(Object));
    });

    it("should sync session extensions across tabs", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      const initialLastActivity = monitor.getLastActivity();

      // Simulate session extension from another tab
      vi.advanceTimersByTime(5000);

      const extendData = {
        timestamp: Date.now() + 1000, // Future timestamp
      };

      const storageEvent = new StorageEvent("storage", {
        key: "okaeri_session_extend",
        newValue: JSON.stringify(extendData),
      });

      window.dispatchEvent(storageEvent);

      // Last activity should be updated
      expect(monitor.getLastActivity()).toBeGreaterThan(initialLastActivity);

      // Timeout should be extended
      expect(monitor.getTimeUntilTimeout()).toBeGreaterThan(5000);
    });

    it("should ignore outdated session extension events", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      const currentLastActivity = monitor.getLastActivity();

      // Simulate outdated extension event
      const oldExtendData = {
        timestamp: currentLastActivity - 5000, // Past timestamp
      };

      const storageEvent = new StorageEvent("storage", {
        key: "okaeri_session_extend",
        newValue: JSON.stringify(oldExtendData),
      });

      window.dispatchEvent(storageEvent);

      // Last activity should not change
      expect(monitor.getLastActivity()).toBe(currentLastActivity);
    });
  });

  describe("Session Extension", () => {
    it("should extend session and reset warning state", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
        onWarning: onWarningSpy,
        onExtend: onExtendSpy,
      });

      // Trigger warning
      vi.advanceTimersByTime(8000);
      expect(onWarningSpy).toHaveBeenCalled();

      // Extend session
      monitor.extendSession();

      expect(onExtendSpy).toHaveBeenCalled();
      expect(monitor.getTimeUntilTimeout()).toBe(10000);

      // Warning should be reset
      vi.advanceTimersByTime(8000);
      expect(onWarningSpy).toHaveBeenCalledTimes(2); // Called again after extension

      // Verify audit log
      expect(auditLogger.log).toHaveBeenCalledWith(
        AUDIT_EVENTS.AUTH_TOKEN_REFRESH,
        expect.objectContaining({
          result: "success",
          details: expect.objectContaining({
            type: "session_extended",
            newTimeout: 10000,
          }),
        })
      );
    });

    it("should not extend inactive sessions", () => {
      const consoleSpy = vi.spyOn(console, "warn");

      // Try to extend without starting
      monitor.extendSession();

      expect(consoleSpy).toHaveBeenCalledWith("Cannot extend inactive session");
      expect(onExtendSpy).not.toHaveBeenCalled();
    });
  });

  describe("Philippine Compliance Requirements", () => {
    it("should maintain detailed session audit trail", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Trigger various events
      vi.advanceTimersByTime(5000);
      monitor.extendSession();
      vi.advanceTimersByTime(3000);
      monitor.pause();
      monitor.resume();

      // Get session events
      const events = monitor.getSessionEvents();

      expect(events).toContainEqual(expect.objectContaining({ event: "session_started" }));
      expect(events).toContainEqual(expect.objectContaining({ event: "session_extended" }));
      expect(events).toContainEqual(expect.objectContaining({ event: "session_paused" }));
      expect(events).toContainEqual(expect.objectContaining({ event: "session_resumed" }));

      // Each event should have timestamp
      events.forEach((event) => {
        expect(event.timestamp).toBeDefined();
        expect(event.lastActivity).toBeDefined();
      });
    });

    it("should limit stored session events for privacy", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Generate more than 50 events
      for (let i = 0; i < 60; i++) {
        (monitor as any).logSessionEvent(`test_event_${i}`);
      }

      const events = monitor.getSessionEvents();

      // Should keep only last 50 events
      expect(events.length).toBe(50);
      expect(events[events.length - 1].event).toBe("test_event_59");
    });

    it("should clear sensitive session data properly", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Generate some events
      monitor.extendSession();
      vi.advanceTimersByTime(5000);

      // Clear events
      monitor.clearSessionEvents();

      const events = monitor.getSessionEvents();
      expect(events).toEqual([]);

      // Verify storage is cleared
      expect(sessionStorage.getItem("session_events")).toBe("[]");
    });
  });

  describe("Resort Management Scenarios", () => {
    it("should handle long booking sessions with warnings", () => {
      // Simulate 30-minute booking session with 5-minute warning
      monitor.start({
        timeout: 30 * 60 * 1000, // 30 minutes
        warningTime: 5 * 60 * 1000, // 5 minute warning
        onTimeout: onTimeoutSpy,
        onWarning: onWarningSpy,
      });

      // Fast-forward to warning (25 minutes)
      vi.advanceTimersByTime(25 * 60 * 1000);

      expect(onWarningSpy).toHaveBeenCalledWith(5 * 60 * 1000);
      expect(onTimeoutSpy).not.toHaveBeenCalled();

      // User extends session
      monitor.extendSession();

      // Should have full 30 minutes again
      expect(monitor.getTimeUntilTimeout()).toBe(30 * 60 * 1000);
    });

    it("should protect payment processing with strict timeouts", () => {
      // Payment sessions should have shorter timeouts
      monitor.start({
        timeout: 5 * 60 * 1000, // 5 minutes for payment
        warningTime: 60 * 1000, // 1 minute warning
        onTimeout: onTimeoutSpy,
        onWarning: onWarningSpy,
      });

      // Simulate payment processing time
      vi.advanceTimersByTime(4 * 60 * 1000);

      expect(onWarningSpy).toHaveBeenCalledWith(60 * 1000);

      // Activity during payment entry
      window.dispatchEvent(new KeyboardEvent("keydown"));
      vi.advanceTimersByTime(1001);

      // Should reset timeout due to activity
      expect(monitor.getTimeUntilTimeout()).toBeGreaterThan(60 * 1000);
    });

    it("should handle guest check-in workflow timeouts", () => {
      // Check-in process with moderate timeout
      monitor.start({
        timeout: 15 * 60 * 1000, // 15 minutes
        warningTime: 3 * 60 * 1000, // 3 minute warning
        onTimeout: onTimeoutSpy,
        onWarning: onWarningSpy,
      });

      // Simulate check-in data entry
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes between activities
        window.dispatchEvent(new KeyboardEvent("keypress"));
        vi.advanceTimersByTime(1001);
      }

      // Should not have timed out during active use
      expect(onTimeoutSpy).not.toHaveBeenCalled();
      expect(onWarningSpy).not.toHaveBeenCalled();
    });
  });

  describe("Security Event Logging", () => {
    it("should log suspicious rapid session extensions", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Rapidly extend session multiple times
      for (let i = 0; i < 5; i++) {
        monitor.extendSession();
        vi.advanceTimersByTime(100);
      }

      // Should log multiple extension events
      const events = monitor.getSessionEvents();
      const extensionEvents = events.filter((e) => e.event === "session_extended");
      expect(extensionEvents.length).toBe(5);
    });

    it("should track force timeout for security", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      monitor.forceTimeout();

      expect(onTimeoutSpy).toHaveBeenCalled();
      expect(monitor.isSessionActive()).toBe(false);

      // Should log security event
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(
        "suspicious",
        expect.objectContaining({
          type: "forced_timeout",
          reason: "manual_trigger",
        })
      );
    });
  });

  describe("Session Metrics and Status", () => {
    it("should provide comprehensive session status", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      vi.advanceTimersByTime(3000);

      const status = monitor.getSessionStatus();

      expect(status).toEqual({
        isActive: true,
        isPaused: false,
        lastActivity: expect.any(Number),
        timeUntilTimeout: 7000,
        warningShown: false,
        sessionDuration: 3000,
      });
    });

    it("should track total session duration accurately", () => {
      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Active for 5 seconds
      vi.advanceTimersByTime(5000);

      // Pause for 3 seconds
      monitor.pause();
      vi.advanceTimersByTime(3000);

      // Resume for 2 seconds
      monitor.resume();
      vi.advanceTimersByTime(2000);

      const status = monitor.getSessionStatus();

      // Total duration should be 10 seconds (including pause)
      expect(status.sessionDuration).toBe(10000);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle activity listener errors gracefully", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });

      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      const unsubscribe = monitor.onActivity(errorListener);

      const consoleSpy = vi.spyOn(console, "error");

      // Trigger activity
      window.dispatchEvent(new MouseEvent("click"));
      vi.advanceTimersByTime(1001);

      expect(consoleSpy).toHaveBeenCalledWith("Activity listener error:", expect.any(Error));

      // Should continue working despite error
      expect(monitor.isSessionActive()).toBe(true);

      unsubscribe();
    });

    it("should handle storage errors during event logging", () => {
      const mockSetItem = vi.spyOn(Storage.prototype, "setItem");
      mockSetItem.mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      const consoleSpy = vi.spyOn(console, "error");

      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      // Should handle storage error gracefully
      expect(monitor.isSessionActive()).toBe(true);
    });

    it("should handle callback errors without crashing", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      const consoleSpy = vi.spyOn(console, "error");

      monitor.start({
        timeout: 5000,
        warningTime: 1000,
        onTimeout: errorCallback,
        onWarning: errorCallback,
        onActivity: errorCallback,
        onExtend: errorCallback,
      });

      // Trigger warning
      vi.advanceTimersByTime(4000);
      expect(consoleSpy).toHaveBeenCalledWith("Warning callback error:", expect.any(Error));

      // Trigger timeout
      vi.advanceTimersByTime(1001);
      expect(consoleSpy).toHaveBeenCalledWith("Timeout callback error:", expect.any(Error));

      // Session should still be cleaned up
      expect(monitor.isSessionActive()).toBe(false);
    });
  });

  describe("Memory Management", () => {
    it("should clean up event listeners on stop", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const documentRemoveListenerSpy = vi.spyOn(document, "removeEventListener");

      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
      });

      monitor.stop();

      // Should remove all activity listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        true
      );

      // Should remove visibility listener
      expect(documentRemoveListenerSpy).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      );

      // Should remove storage listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    });

    it("should clear all timers on stop", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      monitor.start({
        timeout: 10000,
        warningTime: 2000,
        onTimeout: onTimeoutSpy,
        onWarning: onWarningSpy,
      });

      // Advance to create warning timer
      vi.advanceTimersByTime(100);

      monitor.stop();

      // Should clear both timeout and warning timers
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
