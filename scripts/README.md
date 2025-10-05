# Deployment Helper Scripts

This directory contains helper scripts to simplify the deployment and configuration of the guest booking system.

## Quick Start

For first-time setup, run:
```bash
./scripts/easy-setup.sh
```

This interactive script will guide you through the entire deployment process.

## Individual Scripts

### 🚀 easy-setup.sh
**Purpose**: Interactive setup wizard for complete deployment
```bash
./scripts/easy-setup.sh
```
- Checks prerequisites
- Configures environment variables
- Runs database migrations
- Sets up Cloudflare
- Deploys to production
- Verifies deployment

### 🗄️ run-migrations.sh
**Purpose**: Run database migrations on Supabase
```bash
# Using Supabase CLI (recommended)
./scripts/run-migrations.sh --method cli

# Using Supabase API
./scripts/run-migrations.sh --method api

# Using direct psql connection
./scripts/run-migrations.sh --method psql --password YOUR_PASSWORD
```

### ☁️ configure-cloudflare.sh
**Purpose**: Automatically configure Cloudflare settings
```bash
# Configure with API
./scripts/configure-cloudflare.sh --zone YOUR_ZONE_ID --token YOUR_API_TOKEN

# Dry run to see what would be changed
./scripts/configure-cloudflare.sh --zone YOUR_ZONE_ID --token YOUR_API_TOKEN --dry-run
```

### ✅ verify-deployment.sh
**Purpose**: Verify all components are working correctly
```bash
# Run verification
./scripts/verify-deployment.sh

# Set environment first
export DOMAIN=your-domain.pages.dev
export SUPABASE_PROJECT_REF=your-project-ref
./scripts/verify-deployment.sh
```

### 🚢 deploy.sh
**Purpose**: Deploy to Cloudflare Pages with quality checks
```bash
# Deploy to production
./scripts/deploy.sh production

# Deploy to preview
./scripts/deploy.sh preview

# Skip tests for hotfix
./scripts/deploy.sh production --skip-tests
```

## Environment Variables

Create a `.env.local` file with:
```env
# Supabase
SUPABASE_PROJECT_REF=your-project-ref
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare Turnstile
VITE_TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key

# Optional
RESEND_API_KEY=your-resend-key
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-api-token
DOMAIN=your-domain.pages.dev
```

## Common Issues & Solutions

### 1.C - Supabase CORS Configuration

#### Problem: Can't find CORS settings in Supabase Dashboard

**Solution via SQL Editor**:
```sql
-- Run this in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
```

**Solution via cURL**:
```bash
curl -X PUT https://YOUR_PROJECT_REF.supabase.co/storage/v1/bucket/payment-proofs/cors \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '[{
    "allowedOrigins": ["*"],
    "allowedMethods": ["GET", "POST", "PUT"],
    "allowedHeaders": ["*"],
    "maxAge": 3600
  }]'
```

### 3.B - Alert System Setup

#### Problem: Email alerts not working

**Solution - Use Cloudflare Email Routing**:
1. Go to Cloudflare Dashboard → Email → Email Routing
2. Add your domain
3. Create address: alerts@yourdomain.com → your-email@gmail.com
4. The monitoring function will send to this address

**Alternative - Use Discord Webhook**:
```javascript
// In your monitoring function
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/...";
await fetch(DISCORD_WEBHOOK, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    content: `🚨 Alert: ${alerts.map(a => a.message).join('\n')}`
  })
});
```

### 3.C - Metrics Collection

#### Problem: KV writes exceeding quota

**Solution - Batch metrics**:
The `MetricsCollector` class already batches writes. To further optimize:
- Increase flush interval: `flushInterval: 300000` (5 minutes)
- Use coarser time windows (hourly instead of per-request)
- Store aggregated data only

### 4.B.4 - Cloudflare Features

#### Problem: Can't find settings in dashboard

**Quick Navigation Links**:
- SSL/TLS: `https://dash.cloudflare.com/YOUR_ZONE_ID/ssl-tls`
- Speed: `https://dash.cloudflare.com/YOUR_ZONE_ID/speed/optimization`
- Caching: `https://dash.cloudflare.com/YOUR_ZONE_ID/caching/configuration`
- Rules: `https://dash.cloudflare.com/YOUR_ZONE_ID/rules`

**Use the API instead**:
```bash
# Run the configure script
./scripts/configure-cloudflare.sh --zone YOUR_ZONE_ID --token YOUR_TOKEN
```

## Monitoring Endpoints

After deployment, these endpoints are available:

- **Health Check**: `https://your-domain.pages.dev/api/health`
- **Quota Monitoring**: `https://your-domain.pages.dev/api/monitoring/check-quotas`
- **Guest Booking**: `https://your-domain.pages.dev/guest-booking`
- **Status Check**: `https://your-domain.pages.dev/check-booking`

## Testing

Run verification after deployment:
```bash
# Quick verification
./scripts/verify-deployment.sh

# Full test suite
npm test

# E2E tests only
npm run test:e2e

# Load testing
k6 run test/load.js
```

## Rollback Procedure

If something goes wrong:

1. **Immediate Rollback**:
```bash
wrangler pages deployment list
wrangler pages deployment rollback
```

2. **Database Rollback**:
```sql
-- Remove guest booking columns
ALTER TABLE bookings
DROP COLUMN IF EXISTS is_guest_booking,
DROP COLUMN IF EXISTS payment_proof_url,
DROP COLUMN IF EXISTS upload_status,
DROP COLUMN IF EXISTS upload_expires_at;
```

3. **Restore Previous Version**:
```bash
git checkout tags/v1.0.0
npm run build
npm run deploy
```

## Support

For issues or questions:
1. Check the verification report: `docs/implementation/guest-booking-system/COMPLETE_SYSTEM_VERIFICATION_REPORT.md`
2. Run diagnostics: `./scripts/verify-deployment.sh`
3. Check logs: `wrangler tail --env production`
4. Review documentation: `docs/implementation/guest-booking-system/`

## License

These scripts are part of the Okaeri Resort System and follow the same license terms.