# Audit Trail System

Logging is **mandatory** for every state-changing operation — call `logAuditEvent` (`src/lib/audit-logger.ts`; use `logAuditEventWithIP` from `src/lib/audit-logger-workers.ts` inside Cloudflare Workers). Viewer components live in this directory; implementation details are in the source.

Non-derivable conventions:

- Action names use `entity.action.modifier` dot notation: `booking.created`, `booking.status.changed`, `payment.verified`, `auth.login.failed`, `security.rate_limit.exceeded`.
- Severity levels: `INFO` (normal, default), `WARNING` (unusual but handled), `ERROR` (recoverable), `CRITICAL`.
- Always strip sensitive fields from `changes.before` / `changes.after` before logging (`sanitizeForAudit` pattern — never log passwords, tokens, or card data).
