/**
 * Security utilities export
 * Central export point for all security-related modules
 * Updated for Philippine Data Privacy Act Compliance
 */

// Legacy exports (maintained for compatibility)
export * from "./constants";
export * from "./token-manager";
export * from "./secure-token-manager";
export * from "./session-monitor";
export * from "./permission-guard";
export * from "./audit-logger";
export * from "./rate-limiter";

// Phase 1.4 Basic Security Modules
export * from "./phase1-4-checklist";
export * from "./simple-rate-limiter";
export * from "./security-headers";
export * from "./basic-audit-logger";
export * from "./basic-token-manager";
export * from "./basic-owasp-validator";

// DPA Compliance Modules
export * from "./dpa-audit-logger";
export * from "./privacy-consent-manager";
export * from "./data-retention-manager";
export * from "./field-encryption-manager";
export * from "./password-breach-checker";

// Legacy singleton instances (maintained for compatibility)
export { tokenManager } from "./token-manager";
export { secureTokenManager } from "./secure-token-manager";
export { sessionMonitor } from "./session-monitor";
export { permissionGuard } from "./permission-guard";
export { auditLogger } from "./audit-logger";
export { rateLimiter } from "./rate-limiter";

// Phase 1.4 singleton instances (recommended for new code)
export { basicSecurityChecker } from "./phase1-4-checklist";
export { simpleRateLimiter } from "./simple-rate-limiter";
export { securityHeadersValidator } from "./security-headers";
export { basicAuditLogger } from "./basic-audit-logger";
export { basicTokenManager } from "./basic-token-manager";
export { basicOwaspValidator } from "./basic-owasp-validator";

// DPA Compliance singleton instances
export { dpaAuditLogger } from "./dpa-audit-logger";
export { privacyConsentManager } from "./privacy-consent-manager";
export { dataRetentionManager } from "./data-retention-manager";
export { fieldEncryptionManager } from "./field-encryption-manager";
export { passwordBreachChecker } from "./password-breach-checker";
