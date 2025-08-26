/**
 * Security constants and configuration
 * Aligned with OWASP best practices and Philippine Data Privacy Act requirements
 */

/**
 * Token expiry times (in milliseconds)
 */
export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: 15 * 60 * 1000, // 15 minutes
  REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 days
  REFRESH_BUFFER: 2 * 60 * 1000, // Refresh 2 minutes before expiry
  SESSION_TIMEOUT: 60 * 60 * 1000, // 60 minutes of inactivity (1 hour as per requirement)
  SESSION_WARNING: 5 * 60 * 1000, // 5 minutes before timeout
} as const;

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  LOGIN_ATTEMPTS: {
    MAX: 5,
    WINDOW: 15 * 60 * 1000, // 15 minutes
    LOCKOUT: 30 * 60 * 1000, // 30 minutes lockout
  },
  API_CALLS: {
    MAX: 100,
    WINDOW: 60 * 1000, // 1 minute
  },
  PASSWORD_RESET: {
    MAX: 3,
    WINDOW: 60 * 60 * 1000, // 1 hour
  },
} as const;

/**
 * Password policy configuration
 */
export const PASSWORD_POLICY = {
  MIN_LENGTH: 12,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  SPECIAL_CHARS: "!@#$%^&*()_+-=[]{}|;:,.<>?",
  COMMON_PASSWORDS_CHECK: true,
  BREACH_CHECK: true,
} as const;

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  COOKIE_NAME: "okaeri_session",
  SECURE: true,
  HTTP_ONLY: true,
  SAME_SITE: "strict" as const,
  MAX_AGE: 7 * 24 * 60 * 60, // 7 days
} as const;

/**
 * Audit log event types
 */
export const AUDIT_EVENTS = {
  // Authentication events
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_TOKEN_REFRESH: "auth.token_refresh",
  AUTH_PASSWORD_RESET: "auth.password_reset",
  AUTH_PASSWORD_CHANGE: "auth.password_change",
  AUTH_MFA_ENABLE: "auth.mfa_enable",
  AUTH_MFA_DISABLE: "auth.mfa_disable",

  // Authorization events
  ACCESS_GRANTED: "access.granted",
  ACCESS_DENIED: "access.denied",
  PERMISSION_CHANGE: "permission.change",
  ROLE_CHANGE: "role.change",

  // Data events
  DATA_CREATE: "data.create",
  DATA_READ: "data.read",
  DATA_UPDATE: "data.update",
  DATA_DELETE: "data.delete",
  DATA_EXPORT: "data.export",
  DATA_IMPORT: "data.import",

  // Security events
  SECURITY_VIOLATION: "security.violation",
  SUSPICIOUS_ACTIVITY: "security.suspicious",
  RATE_LIMIT_EXCEEDED: "security.rate_limit",
  INVALID_TOKEN: "security.invalid_token",

  // Compliance events
  CONSENT_GIVEN: "compliance.consent_given",
  CONSENT_WITHDRAWN: "compliance.consent_withdrawn",
  DATA_RETENTION_DELETE: "compliance.retention_delete",
  GDPR_REQUEST: "compliance.gdpr_request",
} as const;

/**
 * Permission resources and actions
 */
export const PERMISSIONS = {
  RESOURCES: {
    BOOKING: "booking",
    PROPERTY: "property",
    EXPENSE: "expense",
    REPORT: "report",
    USER: "user",
    PROJECT: "project",
    SETTINGS: "settings",
    AUDIT_LOG: "audit_log",
  },
  ACTIONS: {
    CREATE: "create",
    READ: "read",
    UPDATE: "update",
    DELETE: "delete",
    EXPORT: "export",
    APPROVE: "approve",
    MANAGE: "manage",
  },
} as const;

/**
 * Philippine Data Privacy Act compliance
 */
export const DPA_COMPLIANCE = {
  CONSENT_TYPES: {
    DATA_PROCESSING: "data_processing",
    MARKETING: "marketing",
    THIRD_PARTY_SHARING: "third_party_sharing",
    CROSS_BORDER_TRANSFER: "cross_border_transfer",
  },
  RETENTION_PERIODS: {
    BOOKING_DATA: 5 * 365 * 24 * 60 * 60 * 1000, // 5 years for tax purposes
    FINANCIAL_DATA: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years for BIR compliance
    USER_DATA: 3 * 365 * 24 * 60 * 60 * 1000, // 3 years after last activity
    AUDIT_LOGS: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years for compliance
  },
  REQUIRED_NOTICES: {
    PRIVACY_POLICY: true,
    TERMS_OF_SERVICE: true,
    COOKIE_POLICY: true,
    DATA_BREACH_NOTIFICATION: true,
  },
} as const;

/**
 * Error codes for security violations
 */
export const SECURITY_ERROR_CODES = {
  INVALID_TOKEN: "SEC001",
  TOKEN_EXPIRED: "SEC002",
  INSUFFICIENT_PERMISSIONS: "SEC003",
  RATE_LIMIT_EXCEEDED: "SEC004",
  SESSION_EXPIRED: "SEC005",
  INVALID_CSRF_TOKEN: "SEC006",
  SUSPICIOUS_ACTIVITY: "SEC007",
  ACCOUNT_LOCKED: "SEC008",
  INVALID_PASSWORD: "SEC009",
  MFA_REQUIRED: "SEC010",
} as const;
