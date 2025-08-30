# Secret Management Guide - Okaeri Resort System

## Overview

This guide provides practical instructions for managing secrets and credentials
in the Okaeri Resort Management System. As a family-owned business application,
we balance security with simplicity.

## Secret Categories & Criticality

### Critical Secrets (Rotate Every 90 Days)

- `JWT_SECRET` - Used for user authentication tokens
- `JWT_REFRESH_SECRET` - Used for refresh tokens
- `DATABASE_URL` - Database connection string

### Important Secrets (Rotate Every 180 Days)

- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 storage access
- `UPSTASH_REDIS_REST_TOKEN` - Redis cache access
- `SMTP_PASS` - Email sending credentials

### Low Priority (Rotate Annually or As Needed)

- `R2_ACCESS_KEY_ID` - R2 public identifier
- `SENTRY_DSN` - Error monitoring endpoint
- API monitoring tokens

## How to Generate Strong Secrets

### For JWT Secrets (Use for JWT_SECRET and JWT_REFRESH_SECRET)

```bash
# Option 1: Using OpenSSL (Recommended)
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### For API Keys

```bash
# Generate UUID-based API key
uuidgen | sha256sum | base64 | head -c 32

# Or simpler random string
openssl rand -hex 20
```

### For Database Passwords

```bash
# Generate strong password with special characters
openssl rand -base64 24 | tr -d "=+/" | cut -c1-16
```

## Setting Up Secrets in Different Environments

### Local Development (.env.local)

1. Copy the example file:

```bash
cp .env.example .env.local
```

2. Generate and replace all placeholder values:

```bash
# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Update .env.local
echo "JWT_SECRET=$JWT_SECRET" >> .env.local
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> .env.local
```

3. Never commit .env.local:

```bash
# Verify it's in .gitignore
grep ".env.local" .gitignore
```

### Production (Vercel Dashboard)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `okaeri-resort-system`
3. Navigate to Settings → Environment Variables
4. Add each secret:
   - Name: `JWT_SECRET`
   - Value: (paste generated secret)
   - Environment: ✓ Production, ✓ Preview
5. Click "Save"

### Staging/Preview Environments

Use different secrets from production:

```bash
# Generate staging-specific secrets
JWT_SECRET_STAGING=$(openssl rand -base64 32)
JWT_REFRESH_SECRET_STAGING=$(openssl rand -base64 32)
```

Add with "Preview" environment selected in Vercel.

## Secret Rotation Process

### Step-by-Step Rotation (Quarterly Task)

#### 1. Generate New Secrets

```bash
# Create a secure document (don't save to disk)
echo "=== SECRET ROTATION $(date) ==="
echo "OLD_JWT_SECRET: [Copy from Vercel]"
echo "NEW_JWT_SECRET: $(openssl rand -base64 32)"
echo "OLD_JWT_REFRESH: [Copy from Vercel]"
echo "NEW_JWT_REFRESH: $(openssl rand -base64 32)"
```

#### 2. Update in Vercel (Zero-Downtime Process)

1. Add new secrets with temporary names:
   - `JWT_SECRET_NEW`
   - `JWT_REFRESH_SECRET_NEW`

2. Deploy application update that checks both:

```typescript
// Temporary rotation code
const jwtSecret = process.env.JWT_SECRET_NEW || process.env.JWT_SECRET;
```

3. Once deployed, rename in Vercel:
   - Delete old `JWT_SECRET`
   - Rename `JWT_SECRET_NEW` to `JWT_SECRET`

4. Remove temporary code and redeploy

#### 3. Invalidate Old Sessions

```sql
-- After rotation, invalidate existing sessions
UPDATE users SET refresh_token = NULL WHERE refresh_token IS NOT NULL;
```

## Security Best Practices

### DO's ✅

1. **Use Environment Variables**

```typescript
// Good
const jwtSecret = process.env.JWT_SECRET;

// Bad
const jwtSecret = "hardcoded-secret-key";
```

2. **Validate Secret Strength on Startup**

```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}
```

3. **Use Different Secrets Per Environment**

- Development: `.env.local`
- Staging: Vercel Preview vars
- Production: Vercel Production vars

4. **Implement Secret Expiry Checks**

```typescript
// Check if secret rotation is due
const SECRET_ROTATION_DAYS = 90;
const lastRotation = new Date(process.env.LAST_SECRET_ROTATION);
const daysSinceRotation = (Date.now() - lastRotation) / (1000 * 60 * 60 * 24);
if (daysSinceRotation > SECRET_ROTATION_DAYS) {
  console.warn("Secret rotation overdue!");
}
```

### DON'T's ❌

1. **Never Commit Secrets**

```bash
# Bad - Never do this
git add .env
git commit -m "Added secrets"

# Good - Use .gitignore
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore
```

2. **Don't Log Secrets**

```typescript
// Bad
console.log("JWT Secret:", process.env.JWT_SECRET);

// Good
console.log("JWT Secret configured:", !!process.env.JWT_SECRET);
```

3. **Don't Share Secrets via Chat/Email**

```
❌ "Hey, the JWT secret is: abc123..."
✅ "I've added the JWT secret to Vercel env vars"
```

4. **Don't Use Weak Secrets**

```
❌ JWT_SECRET=password123
❌ JWT_SECRET=okaeri-resort-secret
✅ JWT_SECRET=Kj8$mP2@vN9#xQ4&zL6*wE3!tR5^yU7
```

## Emergency Procedures

### If a Secret is Exposed

1. **Immediately rotate the exposed secret**

```bash
# Generate new secret NOW
NEW_SECRET=$(openssl rand -base64 32)
echo "Emergency rotation: $NEW_SECRET"
```

2. **Update in Vercel immediately**

- Don't wait for normal rotation schedule
- Update production first

3. **Invalidate affected resources**

```sql
-- For JWT exposure
UPDATE users SET refresh_token = NULL;
DELETE FROM sessions;
```

4. **Notify affected users if necessary**

- Force re-login for all users
- Send security notification if data was accessed

5. **Review logs for unauthorized access**

```sql
-- Check for suspicious activity
SELECT * FROM audit_logs
WHERE created_at > '[exposure_time]'
ORDER BY created_at DESC;
```

### Secret Recovery Process

If you lose access to secrets:

1. **Check Vercel Dashboard** - Primary source of truth
2. **Check secure backup** (if maintained)
3. **Generate new secrets** if unrecoverable
4. **Force all users to re-authenticate**

## Monitoring & Alerts

### Set up Secret Expiry Reminders

1. **Calendar Reminders**

- Set quarterly calendar events
- Title: "Rotate Okaeri Resort Secrets"
- Include this guide's link

2. **Automated Checks** Add to health check endpoint:

```typescript
app.get("/api/health", (req, res) => {
  const checks = {
    secrets_configured: !!process.env.JWT_SECRET,
    secret_length_ok: process.env.JWT_SECRET?.length >= 32,
    // Don't expose actual values
  };
  res.json(checks);
});
```

3. **GitHub Action for Reminders**

```yaml
name: Secret Rotation Reminder
on:
  schedule:
    - cron: "0 9 1 */3 *" # First day of each quarter
jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Create Issue
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'Quarterly Secret Rotation Due',
              body: 'Time to rotate secrets. See SECRET_MANAGEMENT_GUIDE.md'
            })
```

## Family Member Access Guidelines

### For Family Admin (Full Access)

- Has Vercel account owner access
- Can view and modify all secrets
- Responsible for rotation

### For Family Developers

- Has Vercel member access
- Can deploy but not view production secrets
- Gets development secrets separately

### For Family Users (Resort Staff)

- No direct secret access
- Uses the application only
- Reports security concerns to admin

## Quick Reference Card

Print and keep secure:

```
=== OKAERI RESORT SECRET ROTATION ===
Schedule: Every 90 days
Next Rotation: _____________

Checklist:
□ Generate new JWT_SECRET (32+ chars)
□ Generate new JWT_REFRESH_SECRET (32+ chars)
□ Update in Vercel Dashboard
□ Test authentication works
□ Clear all user sessions
□ Update rotation date
□ Mark calendar for next rotation

Emergency Contact:
Admin: [Family admin name/phone]
Vercel Support: https://vercel.com/support
```

## Testing Secret Configuration

### Verify Secrets are Loaded

```bash
# Check locally
npm run dev
# Check console for "Environment loaded" message

# Check production
curl https://okaeri-resort.vercel.app/api/health
```

### Test Authentication Flow

1. Login with test account
2. Verify JWT token is returned
3. Make authenticated request
4. Verify refresh token works
5. Logout and verify token invalidation

## Compliance Notes

Per Philippine Data Privacy Act of 2012:

- Secrets are considered "security measures"
- Must be "appropriate to the data"
- Regular updates show "reasonable security"
- Document rotation for compliance audits

## Summary

Remember:

1. **Generate strong secrets** (32+ characters)
2. **Rotate every 90 days** for critical secrets
3. **Never commit secrets** to git
4. **Use Vercel env vars** for production
5. **Different secrets** per environment
6. **Document rotations** for compliance

This is a living document. Update it when:

- Adding new secrets
- Changing rotation schedule
- Learning from security incidents
- Improving processes

Last Updated: August 28, 2025 Next Review: November 28, 2025
