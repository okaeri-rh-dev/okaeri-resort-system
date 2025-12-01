# Pre-Deployment Checklist

**Last Updated**: 2025-10-28
**Chunks Covered**: 001-012 (Phases 1-3 partial complete)
**Status**: 🟢 Ready for staging deployment

---

## Overview

This checklist ensures all prerequisites are met before deploying the multi-unit guest booking system to production. Complete all sections marked for your current progress (Chunks 001-012).

**Deployment Readiness**:

- Phase 1 (Backend Infrastructure): ✅ Complete
- Phase 2 (Guest Booking Flow): ✅ Complete
- Phase 3 (Admin Interface): 🔄 Partial (Payment Verification complete)

---

## 1. Environment Setup

### Supabase (Database & Storage)

- [ ] **Production Supabase project created**
  - Project URL: `https://YOUR_PROJECT.supabase.co`
  - Project name: "okaeri-resort-production"
  - Region: Closest to target audience (e.g., Asia-Pacific for Philippines)

- [ ] **Database accessible**
  - Can connect via `psql` using connection string
  - Service role key obtained from Supabase dashboard
  - Connection pooling enabled (default in Supabase)

- [ ] **Storage bucket created** (for payment proofs - required for Chunk 008)
  - Bucket name: `booking-files` (updated from `payment-proofs`)
  - Public access: Disabled (private bucket)
  - File size limit: 5MB per file
  - Allowed MIME types: image/jpeg, image/png, application/pdf
  - RLS policies configured (see Section 9a below)
  - CORS configured for localhost + production domain

- [ ] **API keys obtained**
  - Anon key (public, safe to expose)
  - Service role key (private, server-side only)
  - Both keys copied to secure location

### Cloudflare Pages & Workers

- [ ] **Cloudflare account created**
  - Email verified
  - Payment method added (required for Workers, free tier available)

- [ ] **Cloudflare Pages project created**
  - Project name: `okaeri-resort`
  - Production branch: `main`
  - Build command: `npm run build:full`
  - Build output directory: `dist`

- [ ] **KV Namespace created**
  - Production namespace: `RATE_LIMIT_KV`
  - Namespace ID copied (for wrangler.toml)
  - Preview namespace also created (for testing)

- [ ] **Turnstile site configured**
  - Site URL: `https://okaeri-resort.pages.dev`
  - Site key (public): Obtained from Cloudflare dashboard
  - Secret key (private): Obtained from Cloudflare dashboard
  - Widget mode: Managed (recommended)

### Email Service (Resend)

- [ ] **Resend account created**
  - Domain verified (or using Resend's shared domain for testing)
  - API key generated
  - Sender email: `bookings@your-domain.com` (or Resend test email)

---

## 2. Local Development Environment

### Required Software

- [ ] **Node.js 18+ installed**

  ```bash
  node --version  # Should be v18.0.0 or higher
  ```

- [ ] **npm 9+ installed**

  ```bash
  npm --version  # Should be v9.0.0 or higher
  ```

- [ ] **PostgreSQL client (psql) installed**

  ```bash
  psql --version  # For running migrations
  ```

- [ ] **Supabase CLI installed**

  ```bash
  supabase --version  # For local development
  ```

- [ ] **Wrangler CLI installed**

  ```bash
  npx wrangler --version  # For Workers deployment
  ```

- [ ] **Git configured**
  ```bash
  git config user.name
  git config user.email
  ```

### Project Dependencies

- [ ] **Dependencies installed**

  ```bash
  npm install  # Should complete without errors
  ```

- [ ] **Husky hooks configured**
  ```bash
  npm run prepare  # Sets up pre-commit hooks
  ```

### Frontend Dependencies (Chunks 006-012)

- [ ] **React Hook Form installed**

  ```bash
  npm list react-hook-form  # Should show v7.x or higher
  ```

- [ ] **PDF viewer dependencies installed** (required for Chunk 012)

  ```bash
  npm list react-pdf react-zoom-pan-pinch pdfjs-dist
  # react-pdf@^7.7.3
  # react-zoom-pan-pinch@^3.6.1
  # pdfjs-dist@^3.11.174
  ```

- [ ] **shadcn/ui components verified**

  ```bash
  # Check critical components exist
  ls src/components/ui/calendar.tsx
  ls src/components/ui/popover.tsx
  ls src/components/ui/alert.tsx
  ls src/components/ui/card.tsx
  ```

- [ ] **PDF worker file exists**
  ```bash
  ls public/pdf.worker.js  # 1MB file from pdfjs-dist
  ```

---

## 3. Database Preparation

### Migration Files Ready

- [ ] **Migration 021**: Multi-unit schema setup
  - File: `database/migrations/021-multi-unit-guest-booking-schema.sql`
  - Creates tables: pricing_config, guest_booking_unit_requests, discount_rules, idempotency_keys
  - Extends bookings table with 9 columns
  - Creates placeholder functions (upgraded in Chunk 002)

- [ ] **Migration 022**: Security constraints & audit
  - File: `database/migrations/022-security-constraints-audit.sql`
  - EXCLUDE constraint: no_double_booking
  - CHECK constraint: all_or_nothing_assignment
  - Audit logging system with triggers

- [ ] **Migration 022a**: Critical security fixes
  - File: `database/migrations/022a-fix-critical-security-issues.sql`
  - Fixes sensitive data exposure in audit logs
  - Fixes race condition in all-or-nothing constraint
  - Fixes audit trigger WHEN clause logic

- [ ] **Migration 023**: Cleanup functions
  - File: `database/migrations/023-cleanup-functions.sql`
  - Idempotency key cleanup function
  - Payment proof cleanup function
  - Performance index: idx_idempotency_expiry

### Database Testing

- [ ] **Local Supabase running**

  ```bash
  supabase start  # Local development instance
  ```

- [ ] **Migrations tested locally**

  ```bash
  psql $DATABASE_URL -f database/migrations/021-multi-unit-guest-booking-schema.sql
  psql $DATABASE_URL -f database/migrations/022-security-constraints-audit.sql
  psql $DATABASE_URL -f database/migrations/022a-fix-critical-security-issues.sql
  psql $DATABASE_URL -f database/migrations/023-cleanup-functions.sql
  ```

- [ ] **PostgreSQL functions verified**

  ```bash
  # Verify functions exist
  psql $DATABASE_URL -c "
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('cleanup_expired_idempotency_keys', 'cleanup_expired_payment_proofs');
  "

  # Test function execution
  psql $DATABASE_URL -c "SELECT cleanup_expired_idempotency_keys();"
  psql $DATABASE_URL -c "SELECT cleanup_expired_payment_proofs();"
  ```

---

## 4. Supabase Storage Setup (Chunk 008)

### Storage Bucket Configuration

- [ ] **`booking-files` bucket created**

  ```sql
  -- In Supabase SQL Editor
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('booking-files', 'booking-files', false);
  ```

- [ ] **RLS policies created**

  ```sql
  -- Allow signed uploads (from upload-url API)
  CREATE POLICY "Allow signed uploads"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (
      bucket_id = 'booking-files' AND
      (storage.foldername(name))[1] = 'payment-proofs'
    );

  -- Allow authenticated reads (admin dashboard)
  CREATE POLICY "Allow authenticated reads"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'booking-files');

  -- Block direct deletion (use cleanup cron only)
  CREATE POLICY "Block direct deletion"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (false);
  ```

- [ ] **CORS configured**
  - In Supabase dashboard: Storage > Configuration > CORS
  - Allowed origins: `http://localhost:5173`, `https://okaeri-resort.pages.dev`
  - Allowed methods: `GET`, `POST`, `PUT`, `DELETE`
  - Allowed headers: `*`

---

## 5. Secrets & Environment Variables

### Production Environment File

- [ ] **`.env.production` created** with all required variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# App Configuration
VITE_APP_ENV=production
VITE_APP_NAME=Okaeri Resort System
VITE_APP_URL=https://okaeri-resort.pages.dev

# Audit Trail Configuration
VITE_OWNER_EMAILS=your-email@example.com
VITE_AUDIT_DEBUG=false

# Turnstile Configuration (Public) - Required for Chunk 009
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAB...

# Feature Flags (Frontend)
VITE_ENABLE_GUEST_BOOKING=true
VITE_ENABLE_ADMIN_DASHBOARD=true

# SECRETS (Never commit these, set via Wrangler)
# SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
# TURNSTILE_SECRET_KEY=0x4AAAAAAB...
# RESEND_API_KEY=re_...
```

### Wrangler Secrets Checklist

- [ ] **SUPABASE_SERVICE_ROLE_KEY** set

  ```bash
  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
  ```

- [ ] **TURNSTILE_SECRET_KEY** set

  ```bash
  npx wrangler secret put TURNSTILE_SECRET_KEY --env production
  ```

- [ ] **RESEND_API_KEY** set

  ```bash
  npx wrangler secret put RESEND_API_KEY --env production
  ```

- [ ] **Verify secrets exist**
  ```bash
  npx wrangler secret list --env production
  ```

### wrangler.toml Configuration

- [ ] **KV namespace IDs updated**

  ```toml
  [[env.production.kv_namespaces]]
  binding = "RATE_LIMIT_KV"
  id = "YOUR_ACTUAL_KV_ID"  # From Cloudflare dashboard
  ```

- [ ] **Cron triggers configured**
  ```toml
  [triggers]
  crons = [
    "0 2 * * *",   # Daily 2:00 AM UTC: Idempotency cleanup
    "0 3 * * 0"    # Weekly Sunday 3:00 AM UTC: Payment proof cleanup
  ]
  ```

---

## 6. Frontend Component Verification (Chunks 006-012)

### Guest Booking Components (Phase 2)

- [ ] **Date and Unit Selection** (Chunk 006)

  ```bash
  ls src/components/guest-booking/DateRangePicker.tsx
  ls src/components/guest-booking/UnitRequestCard.tsx
  ls src/components/guest-booking/UnitRequestSelector.tsx
  ```

- [ ] **Payment Summary** (Chunk 007)

  ```bash
  ls src/components/guest-booking/PaymentSummary.tsx
  ```

- [ ] **Payment Proof Upload** (Chunk 008)

  ```bash
  ls src/components/guest-booking/PaymentProofUpload.tsx
  ls src/lib/file-validation-client.ts
  ls functions/api/guest-booking/upload-url.ts
  ```

- [ ] **Form Validation** (Chunk 009)

  ```bash
  ls src/lib/validation/booking-schema.ts
  ls src/components/guest-booking/FormStepIndicator.tsx
  ls src/components/guest-booking/BookingReviewStep.tsx
  ls src/components/guest-booking/MultiUnitGuestBookingForm.tsx
  ```

- [ ] **Booking Confirmation** (Chunk 010)
  ```bash
  ls src/routes/booking-confirmation/\$bookingReference.tsx
  ls src/components/booking-confirmation/BookingReferenceDisplay.tsx
  ls src/components/booking-confirmation/PaymentInstructions.tsx
  ls src/styles/print.css
  ```

### Admin Components (Phase 3)

- [ ] **Payment Verification UI** (Chunk 012)
  ```bash
  ls src/components/admin/PaymentProofViewer.tsx
  ls src/lib/storage-utils.ts
  ls functions/api/admin/verify-payment.ts
  ls functions/api/admin/bookings/[bookingId].ts
  ls src/routes/admin/verify-payment.\$bookingId.tsx
  ```

---

## 7. Code Quality Gates

### TypeScript Compilation

- [ ] **No TypeScript errors**
  ```bash
  npm run type-check  # Must exit 0
  ```

### Linting

- [ ] **ESLint passes**

  ```bash
  npm run lint  # Must exit 0
  ```

- [ ] **Prettier formatting applied**
  ```bash
  npm run format  # Auto-format all files
  ```

### Testing

- [ ] **Unit tests pass**

  ```bash
  npm run test:run  # All tests passing
  ```

- [ ] **Database tests setup** (for local testing)

  Database and performance tests require a local Supabase instance:

  ```bash
  # 1. Start Supabase locally (if not already running)
  supabase start

  # 2. Verify Supabase is running
  supabase status
  # Should show:
  # - API URL: http://127.0.0.1:54321
  # - DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres

  # 3. Run database tests
  npx vitest run src/__tests__/database/
  # Expected: 11 passing, 1 skipped (multi-unit-booking.test.ts)

  # 4. Run performance tests
  npx vitest run src/__tests__/performance/
  # Expected: 10 passing (multi-unit-availability.test.ts)
  ```

  **Environment variables** (auto-configured in `vitest.config.ts`):
  - `TEST_SUPABASE_URL` - defaults to `http://127.0.0.1:54321`
  - `TEST_SUPABASE_SERVICE_ROLE_KEY` - uses local Supabase key
  - Tests automatically fallback to `.env.local` if not set

  **Notes**:
  - Database tests use `@vitest-environment node` for direct DB access
  - Tests include `beforeEach` cleanup for isolation
  - One test intentionally skipped pending schema update

- [ ] **Build succeeds**

  ```bash
  npm run build:full  # Vite build + Functions copy
  ```

- [ ] **Build output verified**
  ```bash
  ls -la dist/          # Check for index.html, assets/
  ls -la dist/functions # Check for API files
  ```

---

## 8. Security Verification

### Secrets Not Committed

- [ ] **No secrets in git history**

  ```bash
  git log --all --full-history -- .env.production
  # Should show no commits (file should be .gitignored)
  ```

- [ ] **`.gitignore` includes secrets**
  ```bash
  grep -E "\.env\.production|\.env\.local" .gitignore
  ```

### API Security Layers

- [ ] **Turnstile verification implemented**
  - Check: `functions/api/guest-booking/multi-unit.ts` calls `verifyTurnstile()`

- [ ] **Rate limiting configured**
  - Check: `functions/_middleware.ts` applies rate limits
  - Limit: 5 requests/hour for booking endpoint

- [ ] **Input sanitization present**
  - Check: All text inputs sanitized before database insertion

- [ ] **Idempotency keys enforced**
  - Check: `create_guest_booking()` function checks idempotency_keys table

---

## 9. Infrastructure Limits (Free Tier Compliance)

### Cloudflare Workers

- [ ] **Free tier limits understood**
  - 100,000 requests/day (easily sufficient)
  - 10ms CPU time per request
  - 3 cron triggers/day max (using 2/3)

### Cloudflare KV

- [ ] **Free tier limits understood**
  - 100,000 read operations/day
  - 1,000 write operations/day
  - 1GB storage
  - Cleanup cron prevents growth

### Supabase

- [ ] **Free tier limits understood**
  - 500MB database storage
  - 1GB file storage
  - 2GB bandwidth/month
  - Connection pooling enabled

---

## 10. Backup & Rollback Preparation

### Database Backup

- [ ] **Current production database backed up**

  ```bash
  pg_dump -h YOUR_HOST -U postgres -d postgres > backup-pre-deployment.sql
  ```

- [ ] **Backup stored securely**
  - Location: AWS S3, Google Drive, or local encrypted storage
  - Retention: Keep for 30 days minimum

### Rollback Scripts Ready

- [ ] **Migration rollback SQL prepared**
  - Can drop newly created tables if needed
  - Can revert function definitions
  - Can remove new constraints

- [ ] **Previous Cloudflare deployment noted**
  ```bash
  npx wrangler deployments list  # Note last deployment ID
  ```

---

## 11. Documentation Review

### Deployment Procedures

- [ ] **Read `deployment.md`** (step-by-step procedure)
- [ ] **Read `post-deployment.md`** (verification steps)

### Troubleshooting Guides

- [ ] **Review chunk-specific troubleshooting**
  - `chunks/001-database-schema-setup/troubleshooting.md`
  - `chunks/004-core-api-endpoints/troubleshooting.md`
  - `chunks/005-idempotency-rate-limiting/troubleshooting.md`

---

## 12. Stakeholder Communication

### Deployment Window

- [ ] **Maintenance window scheduled**
  - Recommended: Off-peak hours (2-4 AM PHT)
  - Duration: 1-2 hours for Phase 1 deployment

- [ ] **Stakeholders notified**
  - Email sent 24 hours in advance
  - Downtime duration communicated
  - Rollback plan explained

### Monitoring Access

- [ ] **Team has dashboard access**
  - Cloudflare dashboard login shared
  - Supabase dashboard login shared
  - Monitoring alert channels configured

---

## Quick Start Checklist (Minimum Viable)

If you're deploying for the first time and want the absolute minimum:

1. ✅ Supabase project created with service role key
2. ✅ Cloudflare Pages project created
3. ✅ KV namespace created and ID copied
4. ✅ Turnstile site configured with keys
5. ✅ All 3 Wrangler secrets set (Supabase, Turnstile, Resend)
6. ✅ Migrations 021, 022, 022a, 023 tested locally
7. ✅ TypeScript compiles, tests pass, build succeeds
8. ✅ Database backup created

**Then proceed to** `deployment.md` **for step-by-step instructions.**

---

## Common Pre-Deployment Issues

### Issue: "Can't connect to Supabase database"

**Solution**: Check connection string format:

```bash
postgresql://postgres:[YOUR-PASSWORD]@db.YOUR_PROJECT.supabase.co:5432/postgres
```

### Issue: "KV namespace not found"

**Solution**: Create namespace and update wrangler.toml:

```bash
npx wrangler kv:namespace create "RATE_LIMIT_KV" --env production
# Copy the returned ID to wrangler.toml
```

### Issue: "Turnstile verification failing"

**Solution**: Verify site key matches domain:

- Development: Use test keys (`1x00000...`)
- Production: Use real keys from Cloudflare dashboard
- Domain must match: `okaeri-resort.pages.dev`

### Issue: "Build fails with TypeScript errors"

**Solution**: Exclude Phase 3-4 files:

```json
// tsconfig.json
{
  "exclude": ["**/*.phase3-4.*", "api/workflows.phase3-4/**"]
}
```

---

## Next Steps

After completing this checklist, proceed to:

📄 **`deployment.md`** - Step-by-step deployment procedure

---

**Document Status**: Living document, updated with each chunk completion
**Current Coverage**: Chunks 001-012 (Phases 1-2 complete, Phase 3 partial)
**Next Update**: Chunk 013 will add unit assignment workflow prerequisites
