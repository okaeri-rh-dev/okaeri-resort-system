#!/usr/bin/env bash
# Pre-push E2E orchestrator: preflight → seed → playwright → cleanup.
# Cleanup runs unconditionally via trap on EXIT.
set -euo pipefail

trap 'npm run cleanup:e2e' EXIT

npm run preflight:e2e
npm run seed:e2e
npx playwright test e2e/booking-card-mobile.spec.ts --project="Mobile Chrome"
npx playwright test e2e/booking-api-auth.spec.ts --project=chromium
