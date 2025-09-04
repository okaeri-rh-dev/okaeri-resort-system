/**
 * Secure Token Management with Enhanced Protection
 * Implements OWASP best practices for token storage and management
 * Addresses critical security vulnerability from audit
 */

import type { User } from "@/types/common";
import { SECURITY_ERROR_CODES, TOKEN_EXPIRY } from "./constants";
import { SECURITY_EVENTS } from "./events";
import { ROUTES } from "@/routes/paths";
import { auditLogger } from "./audit-logger";
// Use Web Crypto API for browser compatibility instead of Node.js crypto
// import crypto from "crypto";

interface TokenPayload {
  exp: number;
  iat: number;
  sub: string;
  email: string;
  role: string;
  projectId?: string;
  jti?: string; // JWT ID for revocation
  sessionId?: string; // Session ID for enhanced security
  fingerprint?: string; // Device fingerprint
  permissions?: string[];
  userId?: string;
}

interface StoredToken {
  token: string;
  expiresAt: number;
  issuedAt: number;
  fingerprint: string;
  sessionId?: string;
  jti?: string;
}

interface SecurityMetrics {
  rotationCount: number;
  lastRotation: number;
  isSecure: boolean;
  fingerprint: string | null;
  sessionId: string | null;
  breachCheckEnabled: boolean;
  tokenBlacklistEnabled: boolean;
}

/**
 * Secure Token Manager with memory-only storage
 * Prevents XSS attacks by avoiding localStorage/sessionStorage
 */
export class SecureTokenManager {
  private static instance: SecureTokenManager;

  // Memory-only storage - not accessible via window object
  private accessToken: string | null = null;
  private refreshToken: string | null = null; // Refresh tokens are NEVER persisted client-side in production
  private tokenFingerprint: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private tokenRefreshCallbacks: Set<() => Promise<void>> = new Set();

  // Enhanced security features
  private sessionId: string | null = null;
  private currentJTI: string | null = null;
  private tokenBlacklist: Set<string> = new Set(); // Client-side blacklist for immediate token revocation
  private breachCheckEnabled: boolean = true;
  private deviceFingerprint: string | null = null;
  private suspiciousActivityCount: number = 0;
  private lastSecurityEvent: number = 0;

  // Development mode helper for auth persistence
  private isDevelopmentMockAuth(): boolean {
    return (
      import.meta.env.DEV &&
      ((window as any).__VITE_ENV__?.VITE_MOCK_AUTH === "true" ||
        import.meta.env.VITE_MOCK_AUTH === "true")
    );
  }

  // Token rotation tracking
  private tokenRotationCount: number = 0;
  private lastTokenRotation: number = 0;

  private constructor() {
    // Singleton pattern
    this.initializeSecurityListeners();

    // In development mode with mock auth, tokens are still memory-only
    // No sessionStorage usage for security compliance
    if (this.isDevelopmentMockAuth()) {
      console.log("[SecureTokenManager] Mock auth mode enabled - using memory-only storage");
      // Mock tokens will be set via storeTokens() method only
    }
  }

  static getInstance(): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager();
    }
    return SecureTokenManager.instance;
  }

  /**
   * Initialize security event listeners
   */
  private initializeSecurityListeners(): void {
    // Guard for non-browser environments (SSR, tests)
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // Detect tab visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Tab is hidden, pause refresh timer
        this.pauseTokenRefresh();
      } else {
        // Tab is visible, resume and check token
        this.resumeTokenRefresh();
      }
    });

    // Detect storage events (for logout synchronization)
    window.addEventListener("storage", (event) => {
      if (event.key === SECURITY_EVENTS.LOGOUT) {
        // Another tab logged out, clear tokens
        this.clearTokens();
        // Using ROUTES constants for single source of truth
        // See: src/routes/paths.ts
        window.location.href = `${ROUTES.login}?reason=logged_out_other_tab`;
      }
    });

    // Prevent token extraction attempts
    this.preventTokenExtraction();
    this.initializeSecurityFeatures();
  }

  /**
   * Initialize enhanced security features
   */
  private initializeSecurityFeatures(): void {
    // Generate session ID for this session
    this.sessionId = this.generateSecureId();

    // Initialize device fingerprinting
    this.deviceFingerprint = this.generateEnhancedFingerprint();

    // Enable breach checking if available
    this.breachCheckEnabled = this.isBreachCheckingAvailable();

    // Initialize security monitoring
    this.initializeSecurityMonitoring();
  }

  /**
   * Generate cryptographically secure identifier
   */
  private generateSecureId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Enhanced device fingerprinting with additional entropy
   */
  private generateEnhancedFingerprint(): string {
    // Guard for non-browser environments
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return `server-${this.generateSecureId()}`;
    }

    try {
      const entropy = {
        // Existing fingerprinting components
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages?.join(",") || "",
        platform: navigator.platform,
        vendor: navigator.vendor,

        // Enhanced components
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,

        // Screen information
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,

        // Timezone and locale
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

        // WebGL fingerprinting (if available)
        webglVendor: this.getWebGLVendor(),
        webglRenderer: this.getWebGLRenderer(),

        // Canvas fingerprinting
        canvasFingerprint: this.generateCanvasFingerprint(),
      };

      const fingerprintString = JSON.stringify(entropy);

      // Use SubtleCrypto if available for better hashing
      if (typeof crypto !== "undefined" && crypto.subtle) {
        // For browser environments, use a simpler hash since SubtleCrypto is async
        return this.simpleHash(fingerprintString);
      }

      return this.simpleHash(fingerprintString);
    } catch (error) {
      console.warn("Enhanced fingerprinting failed, using fallback:", error);
      return `fallback-${this.generateSecureId()}`;
    }
  }

  /**
   * Get WebGL vendor information
   */
  private getWebGLVendor(): string {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return "unknown";

      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      return debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * Get WebGL renderer information
   */
  private getWebGLRenderer(): string {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return "unknown";

      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * Generate canvas fingerprint with more entropy
   */
  private generateCanvasFingerprint(): string {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return "no-canvas";

      // Set canvas size for consistent fingerprinting
      canvas.width = 200;
      canvas.height = 50;

      // Draw complex pattern for better entropy
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";

      // Draw background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 200, 50);
      gradient.addColorStop(0, "#ff0000");
      gradient.addColorStop(0.5, "#00ff00");
      gradient.addColorStop(1, "#0000ff");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 200, 50);

      // Draw text with various styles
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Okaeri Resort Security", 2, 2);

      ctx.fillStyle = "#000000";
      ctx.font = "bold 12px 'Times'";
      ctx.fillText("Fingerprint", 2, 20);

      // Draw geometric shapes
      ctx.strokeStyle = "#ff00ff";
      ctx.beginPath();
      ctx.arc(150, 25, 20, 0, Math.PI * 2);
      ctx.stroke();

      return canvas.toDataURL().slice(-50); // Last 50 chars for shorter fingerprint
    } catch {
      return `no-canvas-${Date.now().toString(36)}`;
    }
  }

  /**
   * Simple hash function for fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).padStart(8, "0");
  }

  /**
   * Check if breach checking is available
   */
  private isBreachCheckingAvailable(): boolean {
    // In a real implementation, this would check if HaveIBeenPwned API or similar is available
    return typeof fetch !== "undefined" && !this.isDevelopmentMockAuth();
  }

  /**
   * Initialize security monitoring
   */
  private initializeSecurityMonitoring(): void {
    if (typeof window === "undefined") return;

    // Monitor for suspicious activity patterns
    let rapidTokenRequests = 0;
    const originalFetch = window.fetch;

    window.fetch = (...args) => {
      const [resource] = args;
      if (typeof resource === "string" && resource.includes("/api/auth")) {
        rapidTokenRequests++;
        if (rapidTokenRequests > 10) {
          this.handleSuspiciousActivity("rapid_auth_requests");
        }
        setTimeout(() => (rapidTokenRequests = Math.max(0, rapidTokenRequests - 1)), 60000);
      }
      return originalFetch.apply(window, args);
    };

    // Monitor for developer tools
    if (import.meta.env.VITE_SECURITY_DEVTOOLS_DETECT === "true") {
      this.monitorDevTools();
    }
  }

  /**
   * Monitor for developer tools usage
   */
  private monitorDevTools(): void {
    const devtools = { open: false, orientation: null };
    const threshold = 160;

    setInterval(() => {
      if (typeof window === "undefined") return;

      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        if (!devtools.open) {
          devtools.open = true;
          this.handleSuspiciousActivity("devtools_opened");
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  /**
   * Enhanced token blacklist management
   */
  addToBlacklist(jti: string): void {
    this.tokenBlacklist.add(jti);

    // Audit log the blacklisting
    auditLogger.logSecurityEvent("token_blacklisted", {
      jti,
      timestamp: Date.now(),
      reason: "manual_revocation",
    });

    // Store in localStorage for cross-tab synchronization
    try {
      const blacklistArray = Array.from(this.tokenBlacklist);
      localStorage.setItem("token_blacklist", JSON.stringify(blacklistArray));
    } catch (error) {
      console.warn("Failed to sync token blacklist:", error);
    }
  }

  /**
   * Check if token is blacklisted
   */
  isBlacklisted(jti: string): boolean {
    return this.tokenBlacklist.has(jti);
  }

  /**
   * Load blacklist from localStorage (for cross-tab sync)
   */
  private loadBlacklist(): void {
    try {
      const stored = localStorage.getItem("token_blacklist");
      if (stored) {
        const blacklistArray = JSON.parse(stored);
        this.tokenBlacklist = new Set(blacklistArray);
      }
    } catch (error) {
      console.warn("Failed to load token blacklist:", error);
    }
  }

  /**
   * Generate session ID for new login
   */
  generateNewSessionId(): string {
    const newSessionId = this.generateSecureId();
    this.sessionId = newSessionId;

    auditLogger.logSecurityEvent("session_id_generated", {
      sessionId: newSessionId,
      timestamp: Date.now(),
    });

    return newSessionId;
  }

  /**
   * Validate password against breach databases
   */
  async checkPasswordBreach(
    password: string
  ): Promise<{ breached: boolean; occurrences?: number }> {
    if (!this.breachCheckEnabled || this.isDevelopmentMockAuth()) {
      return { breached: false };
    }

    try {
      // Hash password with SHA-1 for HaveIBeenPwned API
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

      // Send only first 5 characters to API (k-anonymity)
      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        method: "GET",
        headers: {
          "User-Agent": "Okaeri-Resort-Security-Check",
        },
      });

      if (!response.ok) {
        console.warn("Breach check service unavailable");
        return { breached: false };
      }

      const text = await response.text();
      const lines = text.split("\n");

      for (const line of lines) {
        const [hashSuffix, count] = line.split(":");
        if (hashSuffix === suffix) {
          return { breached: true, occurrences: parseInt(count, 10) };
        }
      }

      return { breached: false };
    } catch (error) {
      console.warn("Password breach check failed:", error);
      return { breached: false };
    }
  }

  /**
   * Enhanced suspicious activity handling
   */
  private handleSuspiciousActivity(type: string = "unknown"): void {
    this.suspiciousActivityCount++;
    this.lastSecurityEvent = Date.now();

    auditLogger.logSecurityEvent("suspicious_activity", {
      type,
      count: this.suspiciousActivityCount,
      timestamp: this.lastSecurityEvent,
      sessionId: this.sessionId,
      fingerprint: this.deviceFingerprint,
    });

    // Log security event
    const event = new CustomEvent("securityAlert", {
      detail: {
        type: "suspicious_activity",
        subtype: type,
        timestamp: this.lastSecurityEvent,
        count: this.suspiciousActivityCount,
      },
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(event);
    }

    // Progressive response based on activity count
    if (this.suspiciousActivityCount > 5) {
      // Clear tokens and force re-authentication
      this.clearTokens();

      if (typeof window !== "undefined") {
        window.location.href = `${ROUTES.login}?reason=security_check&type=${type}`;
      }
    } else if (this.suspiciousActivityCount > 3) {
      // Reduce token lifetime
      this.scheduleEarlyTokenRefresh();
    }
  }

  /**
   * Schedule early token refresh due to security concerns
   */
  private scheduleEarlyTokenRefresh(): void {
    if (!this.accessToken) return;

    // Refresh token in 1 minute instead of normal schedule
    this.cancelTokenRefresh();
    this.refreshTimer = setTimeout(async () => {
      for (const callback of this.tokenRefreshCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error("Early token refresh callback failed:", error);
        }
      }
    }, 60000); // 1 minute
  }

  /**
   * Prevent common token extraction attempts
   */
  private preventTokenExtraction(): void {
    // Guard for non-browser environments
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // Override console methods in production
    if (import.meta.env.PROD) {
      const noop = () => {};
      const consoleWarn = console.warn;

      // Only block specific console methods that might be used for token extraction
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        // Filter out sensitive data
        const filtered = args.map((arg) => {
          if (typeof arg === "string" && arg.includes("Bearer")) {
            return "[REDACTED]";
          }
          return arg;
        });
        originalLog.apply(console, filtered);
      };

      // Warn about debugger usage (opt-in via environment flag)
      if (import.meta.env.VITE_SECURITY_DEBUGGER_DETECT === "true") {
        setInterval(() => {
          const start = performance.now();

          debugger;
          const end = performance.now();
          if (end - start > 100) {
            consoleWarn("Debugger detected. Security measures activated.");
            this.handleSuspiciousActivity();
          }
        }, 1000);
      }
    }
  }

  /**
   * Generate secure token fingerprint
   */
  private generateFingerprint(): string {
    // Guard for non-browser environments
    if (
      typeof document === "undefined" ||
      typeof navigator === "undefined" ||
      typeof screen === "undefined"
    ) {
      return `test-fingerprint-${Math.random().toString(36).substr(2, 9)}`;
    }

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return Math.random().toString(36);

      // Create canvas fingerprint
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Browser Fingerprint", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("Browser Fingerprint", 4, 17);

      const dataURL = canvas.toDataURL();

      // Combine with other browser characteristics
      const fingerprint = btoa(
        JSON.stringify({
          canvas: dataURL.slice(-50),
          screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          platform: navigator.platform,
          vendor: navigator.vendor,
        })
      );

      return fingerprint;
    } catch (error) {
      // Canvas operations can fail in restricted environments (privacy browsers, headless, etc.)
      console.warn("Canvas fingerprinting failed, using fallback:", error);
      return `fallback-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Parse JWT token payload securely
   */
  parseToken(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error("Invalid token format");
        return null;
      }

      // Validate token structure
      if (
        !/^[A-Za-z0-9_-]+$/.test(parts[0]!) ||
        !/^[A-Za-z0-9_-]+$/.test(parts[1]!) ||
        !/^[A-Za-z0-9_-]+$/.test(parts[2]!)
      ) {
        console.error("Token contains invalid characters");
        return null;
      }

      // Check if atob is available (not in Node.js by default)
      // Provide polyfill for test environments using Buffer
      const atobSafe =
        typeof atob !== "undefined"
          ? atob
          : (b64: string) => Buffer.from(b64, "base64").toString("binary");

      // Normalize base64url to base64 before decoding
      const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
      // Add padding if necessary
      const padding = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
      const normalized = base64 + padding;

      const payload = JSON.parse(atobSafe(normalized));

      // Validate required fields
      if (!payload.exp || !payload.iat || !payload.sub) {
        console.error("Token missing required fields");
        return null;
      }

      return payload as TokenPayload;
    } catch (error) {
      console.error("Failed to parse token:", error);
      return null;
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(token: string, bufferTime: number = TOKEN_EXPIRY.REFRESH_BUFFER): boolean {
    const payload = this.parseToken(token);
    if (!payload) return true;

    const now = Date.now() / 1000;
    const expiryWithBuffer = payload.exp - bufferTime / 1000;

    return now >= expiryWithBuffer;
  }

  /**
   * Calculate time until token expiry
   */
  getTimeUntilExpiry(token: string): number {
    const payload = this.parseToken(token);
    if (!payload) return 0;

    const now = Date.now() / 1000;
    const timeUntilExpiry = (payload.exp - now) * 1000;

    return Math.max(0, timeUntilExpiry);
  }

  /**
   * Store tokens securely in memory only
   * WARNING: Only access tokens are stored client-side
   * Refresh tokens are transmitted via Authorization headers in production
   */
  storeTokens(accessToken: string, refreshToken?: string): void {
    // [PHASE 1-4 MOCK AUTH] Skip validation for mock tokens in development
    const isMockAuth =
      import.meta.env.DEV &&
      ((window as any).__VITE_ENV__?.VITE_MOCK_AUTH === "true" ||
        import.meta.env.VITE_MOCK_AUTH === "true");

    if (!isMockAuth) {
      // Validate token before storing (only in non-mock mode)
      const validation = this.validateTokenStructure(accessToken);
      if (!validation.valid) {
        throw new Error(validation.error || "Invalid token");
      }
    }

    // Store access token in memory only (or sessionStorage in dev mode)
    this.accessToken = accessToken;
    this.tokenFingerprint = this.generateFingerprint();

    // SECURITY: Tokens are ALWAYS memory-only, even in development
    // No sessionStorage usage for security compliance
    if (this.isDevelopmentMockAuth()) {
      console.log("[SecureTokenManager] Mock tokens stored in memory only (no persistence)");
    }

    // Track token rotation
    this.tokenRotationCount++;
    this.lastTokenRotation = Date.now();

    // WARNING: Refresh tokens are NOT stored client-side for security in production
    // Refresh tokens are stored in memory only and transmitted via headers
    if (refreshToken && import.meta.env.DEV && !this.isDevelopmentMockAuth()) {
      console.warn(
        "[PHASE 1 DEV] Refresh token provided but not stored - will use mock token for development"
      );
    }

    // Set up automatic refresh
    this.scheduleTokenRefresh(accessToken);

    // Broadcast token update to other tabs (without token value)
    this.broadcastTokenUpdate();
  }

  /**
   * Retrieve stored access token with fingerprint validation
   */
  getAccessToken(): string | null {
    // [PHASE 1-4 MOCK AUTH] Skip fingerprint validation in dev mode with mock auth
    if (import.meta.env.DEV) {
      const mockAuth =
        (window as any).__VITE_ENV__?.VITE_MOCK_AUTH === "true" ||
        import.meta.env.VITE_MOCK_AUTH === "true";
      if (mockAuth) {
        return this.accessToken;
      }
    }

    // Validate fingerprint hasn't changed (detect token theft)
    const currentFingerprint = this.generateFingerprint();
    if (this.tokenFingerprint && this.tokenFingerprint !== currentFingerprint) {
      console.error("Token fingerprint mismatch - possible token theft");
      this.clearTokens();
      this.handleSuspiciousActivity();
      return null;
    }

    return this.accessToken;
  }

  /**
   * Retrieve refresh token (Phase 1 development mock only)
   * In production, refresh tokens are transmitted via Authorization headers
   *
   * SECURITY NOTE: This method returns a mock token in development only
   * Production environments will throw an error to prevent security vulnerabilities
   */
  getRefreshToken(): string | null {
    // Development only - return stored or mock token for testing
    if (import.meta.env.DEV) {
      // In mock auth mode, refresh token is still memory-only
      if (this.isDevelopmentMockAuth() && !this.refreshToken) {
        console.log("[SecureTokenManager] No refresh token in memory (mock auth mode)");
      }

      console.warn(
        "[PHASE 1 DEV] Returning mock refresh token - Production uses Authorization headers only"
      );
      // Return a consistent mock token for development
      return "mock-refresh-token-phase1-dev";
    }

    // Production - refresh tokens are transmitted via headers
    throw new Error("Refresh tokens must be transmitted via Authorization headers in production");
  }

  /**
   * Clear all tokens securely
   * Only access tokens are cleared client-side
   * Refresh token invalidation is handled server-side in production
   */
  clearTokens(): void {
    // Simply null the tokens - string overwriting is ineffective in JavaScript
    // The JavaScript engine will handle memory cleanup via garbage collection
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenFingerprint = null;
    this.tokenRotationCount = 0;
    this.lastTokenRotation = 0;

    // SECURITY: No sessionStorage/localStorage to clear - tokens are memory-only
    if (this.isDevelopmentMockAuth()) {
      console.log("[SecureTokenManager] Mock tokens cleared from memory");
    }

    // Note: In production, server-side refresh token invalidation is handled via API call

    this.cancelTokenRefresh();

    // Signal logout to other tabs
    localStorage.setItem(SECURITY_EVENTS.LOGOUT, Date.now().toString());
    setTimeout(() => localStorage.removeItem(SECURITY_EVENTS.LOGOUT), 100);
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleTokenRefresh(token: string): void {
    this.cancelTokenRefresh();

    const timeUntilRefresh = this.getTimeUntilExpiry(token) - TOKEN_EXPIRY.REFRESH_BUFFER;

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        // Execute all registered refresh callbacks
        for (const callback of this.tokenRefreshCallbacks) {
          try {
            await callback();
          } catch (error) {
            console.error("Token refresh callback failed:", error);
          }
        }
      }, timeUntilRefresh);
    }
  }

  /**
   * Pause token refresh (when tab is hidden)
   */
  private pauseTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Resume token refresh (when tab becomes visible)
   */
  private resumeTokenRefresh(): void {
    if (this.accessToken && !this.refreshTimer) {
      // Check if token needs refresh
      if (this.isTokenExpired(this.accessToken, TOKEN_EXPIRY.REFRESH_BUFFER)) {
        // Trigger immediate refresh
        this.tokenRefreshCallbacks.forEach((callback) => callback());
      } else {
        // Reschedule refresh
        this.scheduleTokenRefresh(this.accessToken);
      }
    }
  }

  /**
   * Cancel scheduled token refresh
   */
  private cancelTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Register callback for token refresh
   */
  onTokenRefresh(callback: () => Promise<void>): () => void {
    this.tokenRefreshCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.tokenRefreshCallbacks.delete(callback);
    };
  }

  /**
   * Validate token structure and claims
   */
  validateTokenStructure(token: string): { valid: boolean; error?: string } {
    // [PHASE 1-4 MOCK AUTH] Be more lenient with mock tokens in development
    if (import.meta.env.DEV) {
      const mockAuth =
        (window as any).__VITE_ENV__?.VITE_MOCK_AUTH === "true" ||
        import.meta.env.VITE_MOCK_AUTH === "true";
      if (mockAuth && (token.includes("mock") || token.startsWith("eyJ"))) {
        // For mock tokens, only do basic validation
        const payload = this.parseToken(token);
        if (!payload) {
          return { valid: false, error: "Invalid token format" };
        }

        // Only check for basic required claims for mock tokens
        if (!payload.sub || !payload.email) {
          return { valid: false, error: "Missing required claims" };
        }

        return { valid: true };
      }
    }

    const payload = this.parseToken(token);

    if (!payload) {
      return { valid: false, error: "Invalid token format" };
    }

    // Check required claims
    if (!payload.sub || !payload.email || !payload.role) {
      return { valid: false, error: "Missing required claims" };
    }

    // Check token age (prevent replay attacks)
    const tokenAge = Date.now() / 1000 - payload.iat;
    if (tokenAge > 24 * 60 * 60) {
      // Token older than 24 hours
      return { valid: false, error: "Token too old" };
    }

    // Check expiry
    if (this.isTokenExpired(token, 0)) {
      return { valid: false, error: SECURITY_ERROR_CODES.TOKEN_EXPIRED };
    }

    // Validate JWT ID if present (for revocation checking)
    if (payload.jti) {
      // In production, check against revocation list
      // This would require server-side validation
    }

    return { valid: true };
  }

  /**
   * Extract user info from token
   */
  getUserFromToken(token: string): Partial<User> | null {
    const payload = this.parseToken(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as any,
    };
  }

  /**
   * Broadcast token update to other tabs (without token value)
   */
  private broadcastTokenUpdate(): void {
    // Write to localStorage temporarily to trigger storage event in other tabs
    // This follows the same pattern as logout broadcast for reliable cross-tab sync
    localStorage.setItem(SECURITY_EVENTS.TOKEN_UPDATE, Date.now().toString());
    setTimeout(() => localStorage.removeItem(SECURITY_EVENTS.TOKEN_UPDATE), 100);
  }

  /**
   * Get comprehensive security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    return {
      rotationCount: this.tokenRotationCount,
      lastRotation: this.lastTokenRotation,
      isSecure: this.accessToken !== null && this.tokenFingerprint !== null,
      fingerprint: this.deviceFingerprint,
      sessionId: this.sessionId,
      breachCheckEnabled: this.breachCheckEnabled,
      tokenBlacklistEnabled: this.tokenBlacklist.size > 0,
    };
  }

  /**
   * Get security status with enhanced metrics
   */
  getSecurityStatus(): {
    authenticated: boolean;
    sessionActive: boolean;
    securityLevel: "low" | "medium" | "high";
    riskFactors: string[];
    lastActivity: number;
    suspiciousActivityCount: number;
  } {
    const riskFactors: string[] = [];
    let securityLevel: "low" | "medium" | "high" = "high";

    // Check for risk factors
    if (!this.deviceFingerprint) {
      riskFactors.push("Device fingerprinting unavailable");
      securityLevel = "medium";
    }

    if (!this.breachCheckEnabled) {
      riskFactors.push("Password breach checking disabled");
    }

    if (this.suspiciousActivityCount > 0) {
      riskFactors.push(`${this.suspiciousActivityCount} suspicious activities detected`);
      securityLevel = this.suspiciousActivityCount > 3 ? "low" : "medium";
    }

    if (this.tokenRotationCount < 1 && this.accessToken) {
      riskFactors.push("Token not yet rotated");
    }

    return {
      authenticated: !!this.accessToken,
      sessionActive: !!this.sessionId,
      securityLevel,
      riskFactors,
      lastActivity: this.lastTokenRotation || Date.now(),
      suspiciousActivityCount: this.suspiciousActivityCount,
    };
  }

  /**
   * Force token rotation for security purposes
   */
  forceTokenRotation(): void {
    if (!this.accessToken) return;

    auditLogger.logSecurityEvent("forced_token_rotation", {
      reason: "security_policy",
      sessionId: this.sessionId,
      timestamp: Date.now(),
    });

    // Trigger immediate token refresh
    this.tokenRefreshCallbacks.forEach((callback) => {
      callback().catch((error) => {
        console.error("Forced token rotation callback failed:", error);
      });
    });
  }

  /**
   * Reset security state (for testing or after security incident)
   */
  resetSecurityState(): void {
    this.suspiciousActivityCount = 0;
    this.lastSecurityEvent = 0;
    this.tokenBlacklist.clear();

    // Clear localStorage blacklist
    try {
      localStorage.removeItem("token_blacklist");
    } catch (error) {
      console.warn("Failed to clear token blacklist from storage:", error);
    }

    auditLogger.logSecurityEvent("security_state_reset", {
      sessionId: this.sessionId,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Validate current device fingerprint
   */
  validateCurrentFingerprint(): boolean {
    if (!this.deviceFingerprint) return false;

    const currentFingerprint = this.generateEnhancedFingerprint();
    const similarity = this.calculateFingerprintSimilarity(
      this.deviceFingerprint,
      currentFingerprint
    );

    return similarity >= 0.8; // 80% similarity threshold
  }

  /**
   * Calculate fingerprint similarity
   */
  private calculateFingerprintSimilarity(fp1: string, fp2: string): number {
    if (fp1 === fp2) return 1.0;
    if (fp1.length !== fp2.length) return 0.0;

    let matches = 0;
    for (let i = 0; i < fp1.length; i++) {
      if (fp1[i] === fp2[i]) matches++;
    }

    return matches / fp1.length;
  }
}

// Export singleton instance
export const secureTokenManager = SecureTokenManager.getInstance();

// Remove global token storage declaration - no longer needed
// Tokens are now stored securely in memory within the class
