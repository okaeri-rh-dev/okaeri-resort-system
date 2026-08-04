# API Endpoints — Quick Reference

Serverless Cloudflare Pages Functions. Implementation, validation, and middleware behavior live in the source (`functions/api/`, `functions/_middleware.ts`) — read those rather than trusting docs. The non-derivable contract:

### Public Endpoints (No Auth)

| Endpoint                     | Method | Purpose        | Rate Limit     |
| ---------------------------- | ------ | -------------- | -------------- |
| `/api/health`                | GET    | Health check   | None           |
| `/api/guest-booking`         | POST   | Create booking | 5/hour per IP  |
| `/api/guest-booking/confirm` | POST   | Confirm upload | 5/hour per IP  |
| `/api/guest-booking/status`  | GET    | Check status   | 10/hour per IP |

### Protected Endpoints (Auth Required)

| Endpoint                       | Method | Purpose         | Rate Limit |
| ------------------------------ | ------ | --------------- | ---------- |
| `/api/audit/log-with-ip`       | POST   | Log audit event | 100/hour   |
| `/api/monitoring/check-quotas` | GET    | Check quotas    | 60/hour    |

Auth on protected routes is an HS256 JWT verified in `_middleware.ts` against the LEGACY Supabase JWT secret — blanket 401s across all protected routes are almost always a secret problem, not a code problem (use the `deploy-secrets` skill).
