# Multi-Unit Guest Booking System - Pre-Deployment Checklist

**Last Updated**: 2025-10-29
**Covers**: Chunks 001-013 (Phase 1-3 Complete)
**Estimated Time**: 30-45 minutes
**Purpose**: Verify system readiness before deployment

---

## Overview

This checklist ensures all prerequisites are met before deploying the multi-unit guest booking system. Complete all sections before proceeding to DURING-DEPLOYMENT-CHECKLIST.md.

**Critical**: Do NOT skip any section marked with ⚠️

---

## ✅ Section 1: Software Prerequisites (5 min)

### 1.1 Node.js & npm

- [ ] Node.js version 18.x or higher installed

  ```bash
  node --version
  # Expected: v18.x.x or v20.x.x
  ```

- [ ] npm version 9.x or higher installed
  ```bash
  npm --version
  # Expected: 9.x.x or 10.x.x
  ```

### 1.2 Git

- [ ] Git installed and configured

  ```bash
  git --version
  # Expected: git version 2.x.x
  ```

- [ ] Repository cloned locally
  ```bash
  git remote -v
  # Expected: origin URL pointing to your repository
  ```

### 1.3 Development Tools

- [ ] Code editor installed (VS Code recommended)
- [ ] Terminal/shell access (bash, zsh, or PowerShell)
- [ ] PostgreSQL client installed (psql) - for database verification
  ```bash
  psql --version
  # Expected: psql (PostgreSQL) 14.x or higher
  ```

---

## ✅ Section 2: Accounts & Services (5 min)

### 2.1 Supabase ⚠️ CRITICAL

- [ ] Supabase account created (https://supabase.com)
- [ ] Supabase project created
- [ ] Supabase project URL obtained
- [ ] Supabase anon/public key obtained
- [ ] Supabase service role key obtained (for admin operations)
- [ ] Database password saved securely

**Verification**:

```bash
# Test connection to Supabase
psql "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
# Expected: PostgreSQL prompt
```

### 2.2 Cloudflare ⚠️ CRITICAL (Chunks 004, 005, 008, 011-013)

- [ ] Cloudflare account created (https://cloudflare.com)
- [ ] Cloudflare Workers enabled
- [ ] Cloudflare Pages enabled (for frontend hosting)
- [ ] Cloudflare R2 enabled (for file storage - chunk 008)
- [ ] Cloudflare API token obtained (with Workers & R2 permissions)

### 2.3 Domain (Optional)

- [ ] Domain registered (if using custom domain)
- [ ] DNS configured to point to Cloudflare

---

## ✅ Section 3: Database Prerequisites ⚠️ CRITICAL (10 min)

**Chunks**: 001, 002, 003, 013

### 3.1 PostgreSQL Version

- [ ] PostgreSQL 14.x or higher
  ```sql
  SELECT version();
  -- Expected: PostgreSQL 14.x or 15.x
  ```

### 3.2 Required Extensions

- [ ] **btree_gist extension enabled** (required for EXCLUDE constraint - chunk 003, 013)

  ```sql
  SELECT * FROM pg_extension WHERE extname = 'btree_gist';
  -- Expected: 1 row returned

  -- If not enabled, run:
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ```

### 3.3 Database User Permissions

- [ ] User has CREATE permission on database
- [ ] User has ALTER permission on tables
- [ ] User has DROP permission (for rollback scenarios)
- [ ] User can create functions (EXECUTE permission)
- [ ] User can create triggers

**Verification**:

```sql
-- Check current user permissions
SELECT
  has_database_privilege(current_user, current_database(), 'CREATE') as can_create,
  has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect;
-- Expected: both columns = true
```

### 3.4 Database Backup ⚠️ CRITICAL

- [ ] **Database backup created** (via Supabase Dashboard or pg_dump)

  ```bash
  # Option 1: Supabase Dashboard
  # Go to: Database → Backups → Create Backup

  # Option 2: pg_dump (if using self-hosted PostgreSQL)
  pg_dump -h [HOST] -U [USER] -d [DATABASE] -f backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] Backup verified (can be restored if needed)

### 3.5 Database Connection Pooling

- [ ] Connection pooling configured in Supabase (default: enabled)
- [ ] Max connections set appropriately (default: 15 for free tier)

---

## ✅ Section 4: API & Infrastructure Prerequisites (10 min)

**Chunks**: 004, 005, 008, 011, 012, 013

### 4.1 Cloudflare Workers Configuration

- [ ] Workers project created

  ```bash
  # Navigate to: Workers & Pages → Create application → Create Worker
  ```

- [ ] Worker domain assigned (e.g., `worker-name.your-subdomain.workers.dev`)

### 4.2 Cloudflare KV Namespace ⚠️ CRITICAL (Chunk 005)

- [ ] KV namespace created for rate limiting

  ```bash
  # Navigate to: Workers & Pages → KV → Create namespace
  # Name: rate-limit-kv (or similar)
  ```

- [ ] KV namespace ID obtained
- [ ] KV namespace bound to Worker

**Verification**:

```javascript
// In wrangler.toml
kv_namespaces = [
  { binding = "RATE_LIMIT_KV", id = "your-kv-namespace-id" }
]
```

### 4.3 Cloudflare R2 Bucket ⚠️ CRITICAL (Chunk 008)

- [ ] R2 bucket created for payment proof uploads

  ```bash
  # Navigate to: R2 → Create bucket
  # Name: payment-proofs (or similar)
  ```

- [ ] R2 access key created
- [ ] R2 secret key saved securely
- [ ] R2 bucket public access configured (or pre-signed URLs enabled)

### 4.4 Supabase Authentication ⚠️ CRITICAL (Chunks 011, 012, 013)

- [ ] Supabase Auth enabled
- [ ] JWT secret obtained from Supabase project settings
- [ ] Auth providers configured (email/password minimum)

### 4.5 Admin User Created ⚠️ CRITICAL (Chunks 011, 012, 013)

- [ ] Admin user created in Supabase Auth
- [ ] `user_profiles` table has admin user with `app_role = 'admin'`

**Verification**:

```sql
-- Check admin user exists
SELECT user_id, email, app_role
FROM user_profiles
WHERE app_role = 'admin';
-- Expected: At least 1 row with app_role = 'admin'
```

- [ ] Admin JWT token can be generated
  ```bash
  # Log in as admin via your app, then extract JWT from localStorage
  # Or use Supabase Auth API to generate token
  ```

---

## ✅ Section 5: Frontend Prerequisites (5 min)

**Chunks**: 006, 007, 009, 010

### 5.1 Dependencies Installed

- [ ] All npm packages installed
  ```bash
  npm install
  # Expected: No errors, all packages installed
  ```

### 5.2 Build Succeeds Locally

- [ ] Development build works

  ```bash
  npm run dev
  # Expected: Server starts on port 5173, no errors
  ```

- [ ] Production build works
  ```bash
  npm run build
  # Expected: Build completes successfully, dist/ folder created
  ```

### 5.3 TypeScript Compilation

- [ ] TypeScript compiles without errors
  ```bash
  npm run type-check
  # Expected: 0 errors (warnings acceptable)
  # Note: Pre-existing booking_units schema errors are documented and acceptable
  ```

### 5.4 ESLint Passes

- [ ] ESLint runs without errors

  ```bash
  npm run lint
  # Expected: 0 errors (warnings acceptable)
  ```

- [ ] Auto-fix applied if needed
  ```bash
  npm run lint:fix
  ```

---

## ✅ Section 6: Code Quality Verification (5 min)

### 6.1 Chunk Checkpoints Passed

Review progress tracker (`docs/implementation/guest-booking-multi-unit/chunks/progress-tracker.md`) and verify:

- [ ] **Chunk 001**: Database schema setup ✅ COMPLETE
- [ ] **Chunk 002**: PostgreSQL pricing engine ✅ COMPLETE (25+ test scenarios passed)
- [ ] **Chunk 003**: Security, RLS, constraints ✅ COMPLETE (17 SQL tests passed)
- [ ] **Chunk 004**: Core API endpoints ✅ COMPLETE
- [ ] **Chunk 005**: Idempotency and rate limiting ✅ COMPLETE
- [ ] **Chunk 006**: Date and unit selection UI ✅ COMPLETE
- [ ] **Chunk 007**: Payment summary with preview ✅ COMPLETE
- [ ] **Chunk 008**: Payment proof upload ✅ COMPLETE
- [ ] **Chunk 009**: Form validation and submission ✅ COMPLETE
- [ ] **Chunk 010**: Booking confirmation flow ✅ COMPLETE
- [ ] **Chunk 011**: Admin queue urgency scoring ✅ COMPLETE
- [ ] **Chunk 012**: Payment verification UI ✅ COMPLETE
- [ ] **Chunk 013**: Unit assignment system ✅ COMPLETE (6 critical fixes applied)

### 6.2 Security Review

- [ ] All admin endpoints require JWT authentication (chunks 011, 012, 013)
- [ ] Admin role verification enforced
- [ ] XSS prevention implemented (DOMPurify for user inputs)
- [ ] SQL injection prevention (parameterized queries, Supabase client)
- [ ] Rate limiting configured (100 req/hour for admin endpoints)
- [ ] Audit logging enabled (chunks 003, 013)

### 6.3 Performance Benchmarks

- [ ] Pricing engine tests passed (chunk 002)
- [ ] Database queries optimized (indexes created - chunks 003, 013)
- [ ] Frontend bundle size acceptable (<500KB main bundle)
  ```bash
  npm run build:size
  # Review output for bundle sizes
  ```

---

## ✅ Section 7: Environment Configuration ⚠️ CRITICAL (5 min)

### 7.1 Environment Variables Prepared

Create `.env.local` (development) and `.env.production` files with:

**Required Variables**:

```bash
# Supabase
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudflare (for Workers - set in wrangler.toml or Workers dashboard)
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Cloudflare R2 (chunk 008)
R2_BUCKET_NAME=payment-proofs
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key

# Rate Limiting (chunk 005)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_SECONDS=3600
```

**Verification**:

- [ ] All required environment variables set
- [ ] No sensitive keys committed to git (check `.gitignore`)
- [ ] Production environment variables different from development

### 7.2 Secrets Management

- [ ] Supabase service role key stored securely (Cloudflare Workers Secrets or Vercel Secrets)

  ```bash
  # For Cloudflare Workers:
  wrangler secret put SUPABASE_SERVICE_KEY

  # For Vercel:
  vercel env add SUPABASE_SERVICE_KEY production
  ```

- [ ] R2 credentials stored as secrets (not environment variables)
- [ ] Database password not exposed in client code

---

## ✅ Section 8: Deployment Targets Ready (5 min)

### 8.1 Cloudflare Workers

- [ ] Workers project exists
- [ ] `wrangler.toml` configured correctly

  ```toml
  name = "okaeri-resort-api"
  main = "functions/_worker.ts"
  compatibility_date = "2024-01-01"

  [vars]
  # Non-sensitive environment variables

  [[kv_namespaces]]
  binding = "RATE_LIMIT_KV"
  id = "your-kv-namespace-id"

  [[r2_buckets]]
  binding = "PAYMENT_PROOFS"
  bucket_name = "payment-proofs"
  ```

- [ ] Can deploy to Workers (test with dry run)
  ```bash
  wrangler deploy --dry-run
  # Expected: No errors, shows what would be deployed
  ```

### 8.2 Frontend Hosting

**Option A: Cloudflare Pages**

- [ ] Cloudflare Pages project created
- [ ] Git repository connected
- [ ] Build command configured: `npm run build`
- [ ] Output directory configured: `dist`

**Option B: Vercel**

- [ ] Vercel project created
- [ ] Git repository connected
- [ ] Framework preset: Vite
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`

### 8.3 Custom Domain (Optional)

- [ ] Domain DNS configured
- [ ] SSL certificate provisioned (automatic with Cloudflare/Vercel)

---

## ✅ Section 9: Pre-Deployment Testing (5 min)

### 9.1 Local End-to-End Test

- [ ] **Guest booking flow works locally** (chunks 006-010)
  - Navigate to `/guest-booking`
  - Select dates and units
  - Fill guest information
  - Upload payment proof (test file)
  - Submit booking
  - Verify confirmation page shows

- [ ] **Admin workflow works locally** (chunks 011-013)
  - Navigate to `/admin/queue`
  - View pending bookings
  - Verify payment for booking
  - Assign units to booking
  - Verify booking confirmed

### 9.2 Database Tests

- [ ] Pricing engine tests pass (chunk 002)

  ```bash
  # Run SQL test file
  psql -h [HOST] -U [USER] -d [DATABASE] -f __tests__/database/pricing-engine.test.sql
  # Expected: All 25+ scenarios PASSED
  ```

- [ ] Security tests pass (chunk 003)
  ```bash
  # Run security test file
  psql -h [HOST] -U [USER] -d [DATABASE] -f __tests__/database/security-rls-constraints.test.sql
  # Expected: All 17 tests PASSED
  ```

---

## ✅ Section 10: Pre-Deployment Sign-Off

### 10.1 Critical Checklist

**Before proceeding to DURING-DEPLOYMENT-CHECKLIST.md, confirm**:

- [ ] ⚠️ **Database backup created and verified**
- [ ] ⚠️ **btree_gist extension enabled**
- [ ] ⚠️ **Admin user exists with app_role = 'admin'**
- [ ] ⚠️ **All environment variables prepared**
- [ ] ⚠️ **Supabase service role key secured**
- [ ] ⚠️ **Cloudflare KV namespace created and bound**
- [ ] ⚠️ **Cloudflare R2 bucket created**
- [ ] ⚠️ **TypeScript compilation passes (0 new errors)**
- [ ] ⚠️ **ESLint passes (0 errors)**
- [ ] ⚠️ **Local end-to-end tests work**

### 10.2 Deployment Readiness Assessment

**Rate your readiness** (1-5 scale):

- [ ] Prerequisites complete: \_\_\_ / 5
- [ ] Code quality verified: \_\_\_ / 5
- [ ] Environment configured: \_\_\_ / 5
- [ ] Testing completed: \_\_\_ / 5

**Required**: All scores must be 4 or 5 to proceed

### 10.3 Rollback Plan Confirmed

- [ ] Rollback procedures reviewed (see DURING-DEPLOYMENT-CHECKLIST.md)
- [ ] Database backup location documented
- [ ] Rollback SQL scripts prepared
- [ ] Team notified of deployment window
- [ ] Stakeholders informed

---

## ⏭️ Next Steps

**If all checklist items completed** ✅:

1. **Proceed to DURING-DEPLOYMENT-CHECKLIST.md**
2. Follow deployment steps sequentially
3. Verify each phase before continuing

**If any checklist items incomplete** ⚠️:

1. **Do NOT proceed to deployment**
2. Complete missing prerequisites
3. Re-run this checklist
4. Only proceed when 100% complete

---

## 📋 Known Issues & Acceptable Warnings

### TypeScript Warnings (Acceptable)

- **booking_units schema errors**: Pre-existing type generation issues (unrelated to chunks 001-013)
- **@ts-expect-error directives**: Used for TanStack Router type limitations (chunk 013)

### ESLint Warnings (Acceptable)

- **Console.log statements**: Used for debugging in development
- **Unused variables**: Prefixed with `_` to indicate intentional (e.g., `_ctx`)

### Build Warnings (Acceptable)

- **Chunk size warnings**: Bundle optimization ongoing (acceptable for Phase 1-3)

---

**Last Updated**: 2025-10-29
**Next Checklist**: DURING-DEPLOYMENT-CHECKLIST.md
**Deployment Status**: ⏳ READY TO PROCEED (after completing this checklist)
