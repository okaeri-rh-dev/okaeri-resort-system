#!/bin/bash
# Weekly health check for Okaeri Resort System
# Run: npm run health-check

PROD_URL="https://okaeri-resort.pages.dev"
DATABASE_URL="postgresql://postgres:..."

echo "=== Okaeri Resort System Health Check ==="
echo "Date: $(date)"
echo

# Test API endpoints
echo "1. Testing API endpoints..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $PROD_URL/api/health)
if [ "$STATUS" = "200" ]; then
  echo "  ✅ Health endpoint: OK"
else
  echo "  ❌ Health endpoint: FAIL ($STATUS)"
fi

STATUS=$(curl -s -o /dev/null -w "%{http_code}" $PROD_URL/api/guest-booking/rates)
if [ "$STATUS" = "200" ]; then
  echo "  ✅ Rates endpoint: OK"
else
  echo "  ❌ Rates endpoint: FAIL ($STATUS)"
fi

# Check database functions
echo
echo "2. Testing database functions..."
RESULT=$(psql $DATABASE_URL -t -c "SELECT cleanup_expired_idempotency_keys();" 2>&1)
if [ $? -eq 0 ]; then
  echo "  ✅ Idempotency cleanup: OK (deleted $RESULT keys)"
else
  echo "  ❌ Idempotency cleanup: FAIL"
fi

# Check cron execution
echo
echo "3. Checking cron execution logs..."
echo "  (Run: npx wrangler pages deployment tail | grep CRON)"

# Check KV usage
echo
echo "4. KV Namespace usage..."
KV_KEYS=$(npx wrangler kv:key list --namespace-id=YOUR_KV_ID 2>&1 | jq 'length' 2>/dev/null || echo "0")
echo "  Total KV keys: $KV_KEYS"
if [ "$KV_KEYS" -lt 1000 ]; then
  echo "  ✅ KV usage normal"
else
  echo "  ⚠️  KV usage high (>1000 keys)"
fi

echo
echo "=== Health Check Complete ==="
