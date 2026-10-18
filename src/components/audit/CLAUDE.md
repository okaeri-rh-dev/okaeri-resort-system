# Audit Trail System

Table writes are logged by `audit_trigger_func` (`source` = `db`, with the editor's `user_id` and `user_email`); every table has the trigger or is allowlisted in `src/__tests__/database/audit-trigger-coverage.test.ts`. Call `logAuditEventWithIP` (`src/lib/audit-logger-workers.ts`) only for events that are not table writes, such as auth events in Cloudflare Workers. Viewer components live in this directory; implementation details are in the source.

Non-derivable conventions:

- Action names use `entity.action.modifier` dot notation: `booking.created`, `booking.status.changed`, `payment.verified`, `auth.login.failed`, `security.rate_limit.exceeded`.
- Severity levels: `INFO` (normal, default), `WARNING` (unusual but handled), `ERROR` (recoverable), `CRITICAL`.
- Always strip sensitive fields from `changes.before` / `changes.after` before logging (`sanitizeForAudit` pattern — never log passwords, tokens, or card data).
- Rows older than 24 months are anonymized weekly (`anonymize_audit_logs`) and carry `metadata.anonymized_at`. Use `auditActorLabel` / `isAnonymized` from `src/lib/audit-display.ts` instead of reading `user_email` directly.
