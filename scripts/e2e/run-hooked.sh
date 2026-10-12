#!/usr/bin/env bash
# CI E2E orchestrator (infra-health): preflight → seed → playwright → cleanup.
# Cleanup runs unconditionally via trap on EXIT.
set -euo pipefail

trap 'npm run cleanup:e2e' EXIT

npm run preflight:e2e
npm run seed:e2e
npx playwright test e2e/booking-card-mobile.spec.ts --project="Mobile Chrome"
npx playwright test e2e/booking-api-auth.spec.ts --project=chromium
npx playwright test e2e/admin-bookings.spec.ts e2e/admin-queue.spec.ts e2e/availability-calendar.spec.ts e2e/booking-lifecycle.spec.ts e2e/multi-role-workflows.spec.ts e2e/pricing-integrity.spec.ts --project=chromium
