#!/bin/bash

# =================================================================
# Guest Booking System - Production Deployment Script
# =================================================================
#
# This script handles the complete deployment process to Cloudflare Pages
# including environment setup, build, tests, and deployment.
#
# Usage:
#   ./scripts/deploy.sh [environment] [--skip-tests] [--dry-run]
#
# Environments:
#   - production (default)
#   - preview
#   - development
#
# Options:
#   --skip-tests: Skip running tests before deployment
#   --dry-run: Perform all steps except actual deployment
#
# =================================================================

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="okaeri-resort"
ENVIRONMENT=${1:-production}
SKIP_TESTS=false
DRY_RUN=false

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      ;;
  esac
done

# Functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
  if ! command -v $1 &> /dev/null; then
    log_error "$1 is not installed. Please install it first."
    exit 1
  fi
}

# Header
echo ""
echo "================================================================="
echo "  Guest Booking System Deployment Script"
echo "================================================================="
echo ""
log_info "Environment: $ENVIRONMENT"
log_info "Skip Tests: $SKIP_TESTS"
log_info "Dry Run: $DRY_RUN"
echo ""

# Step 1: Check prerequisites
log_info "Checking prerequisites..."

check_command node
check_command npm
check_command wrangler

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  log_error "Node.js 18+ is required. Current version: $NODE_VERSION"
  exit 1
fi

log_success "Prerequisites check passed"

# Step 2: Check environment variables
log_info "Checking environment configuration..."

if [ "$ENVIRONMENT" == "production" ]; then
  REQUIRED_VARS=(
    "VITE_SUPABASE_URL"
    "VITE_SUPABASE_ANON_KEY"
    "VITE_TURNSTILE_SITE_KEY"
  )

  MISSING_VARS=()
  for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
      MISSING_VARS+=($var)
    fi
  done

  if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
      echo "  - $var"
    done
    echo ""
    echo "Please set these variables in your .env.local file or environment"
    exit 1
  fi

  log_success "Environment variables configured"
fi

# Step 3: Install dependencies
log_info "Installing dependencies..."
npm ci --silent
log_success "Dependencies installed"

# Step 4: Run linting
log_info "Running lint checks..."
npm run lint --silent || {
  log_warning "Lint warnings detected. Please review."
}

# Step 5: Type checking
log_info "Running TypeScript type check..."
npm run type-check || {
  log_error "Type check failed. Please fix TypeScript errors."
  exit 1
}
log_success "Type check passed"

# Step 6: Run tests (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
  log_info "Running tests..."
  npm run test:run || {
    log_error "Tests failed. Please fix failing tests."
    exit 1
  }
  log_success "All tests passed"
else
  log_warning "Skipping tests (--skip-tests flag)"
fi

# Step 7: Build the application
log_info "Building application..."
npm run build || {
  log_error "Build failed."
  exit 1
}
log_success "Build completed successfully"

# Step 8: Check build size
log_info "Analyzing build size..."

DIST_SIZE=$(du -sh dist | cut -f1)
log_info "Build size: $DIST_SIZE"

# Check if build is too large (>50MB warning)
DIST_SIZE_MB=$(du -sm dist | cut -f1)
if [ "$DIST_SIZE_MB" -gt 50 ]; then
  log_warning "Build size is large (>50MB). Consider optimizing bundle size."
fi

# Step 9: Verify KV namespace configuration
log_info "Verifying Cloudflare KV namespace..."

if ! grep -q "your-kv-namespace-id" wrangler.toml; then
  log_success "KV namespace configured"
else
  log_error "KV namespace not configured in wrangler.toml"
  echo ""
  echo "Please run: wrangler kv:namespace create \"RATE_LIMIT_KV\""
  echo "Then update the ID in wrangler.toml"
  exit 1
fi

# Step 10: Check Cloudflare secrets
log_info "Checking Cloudflare secrets configuration..."

REQUIRED_SECRETS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "TURNSTILE_SECRET_KEY"
)

echo ""
echo "Please ensure the following secrets are configured in Cloudflare:"
for secret in "${REQUIRED_SECRETS[@]}"; do
  echo "  - $secret"
done
echo ""
echo "To set a secret, run: wrangler secret put SECRET_NAME"
echo ""

read -p "Have all secrets been configured? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log_error "Please configure all required secrets before deployment"
  exit 1
fi

# Step 11: Deploy to Cloudflare Pages
if [ "$DRY_RUN" = true ]; then
  log_warning "Dry run mode - skipping actual deployment"
  log_info "Would deploy to Cloudflare Pages with:"
  echo "  wrangler pages deploy dist --project-name=$PROJECT_NAME"

  if [ "$ENVIRONMENT" != "production" ]; then
    echo "  --branch=$ENVIRONMENT"
  fi
else
  log_info "Deploying to Cloudflare Pages..."

  if [ "$ENVIRONMENT" == "production" ]; then
    wrangler pages deploy dist \
      --project-name="$PROJECT_NAME" \
      --branch=main || {
      log_error "Deployment failed"
      exit 1
    }
  else
    wrangler pages deploy dist \
      --project-name="$PROJECT_NAME" \
      --branch="$ENVIRONMENT" || {
      log_error "Deployment failed"
      exit 1
    }
  fi

  log_success "Deployment completed successfully!"
fi

# Step 12: Post-deployment verification
log_info "Running post-deployment checks..."

if [ "$DRY_RUN" = false ]; then
  # Get deployment URL
  if [ "$ENVIRONMENT" == "production" ]; then
    DEPLOY_URL="https://$PROJECT_NAME.pages.dev"
  else
    DEPLOY_URL="https://$ENVIRONMENT.$PROJECT_NAME.pages.dev"
  fi

  log_info "Deployment URL: $DEPLOY_URL"
  echo ""

  # Check if site is accessible
  log_info "Checking site accessibility..."
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL" || echo "000")

  if [ "$HTTP_STATUS" == "200" ]; then
    log_success "Site is accessible (HTTP $HTTP_STATUS)"
  else
    log_warning "Site returned HTTP $HTTP_STATUS. Please verify manually."
  fi

  # Check security headers
  log_info "Checking security headers..."
  HEADERS=$(curl -sI "$DEPLOY_URL/api/guest-booking" | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)" || true)

  if [ -n "$HEADERS" ]; then
    log_success "Security headers detected"
    echo "$HEADERS"
  else
    log_warning "Security headers not detected. Please verify configuration."
  fi
fi

# Step 13: Monitoring setup reminders
echo ""
echo "================================================================="
echo "  Post-Deployment Checklist"
echo "================================================================="
echo ""
echo "[ ] Verify cron job is running (check after 1 hour)"
echo "[ ] Test guest booking flow end-to-end"
echo "[ ] Verify email sending (Resend)"
echo "[ ] Check Supabase bandwidth usage"
echo "[ ] Monitor KV write quotas"
echo "[ ] Test rate limiting behavior"
echo "[ ] Verify CORS configuration"
echo "[ ] Check security headers at securityheaders.com"
echo ""

if [ "$ENVIRONMENT" == "production" ]; then
  echo "================================================================="
  echo "  Production Monitoring"
  echo "================================================================="
  echo ""
  echo "Monitor the following:"
  echo "  - Cloudflare Analytics: https://dash.cloudflare.com"
  echo "  - Supabase Dashboard: https://app.supabase.com"
  echo "  - Resend Dashboard: https://resend.com/emails"
  echo ""
  echo "Set up alerts for:"
  echo "  - Bandwidth usage > 80% (1.6GB/month)"
  echo "  - KV writes > 800/day"
  echo "  - Email quota > 90/day"
  echo "  - Error rate > 1%"
  echo ""
fi

log_success "Deployment process completed!"
echo ""
echo "Deployment Summary:"
echo "  Project: $PROJECT_NAME"
echo "  Environment: $ENVIRONMENT"
if [ "$DRY_RUN" = false ]; then
  echo "  URL: $DEPLOY_URL"
fi
echo "  Build Size: $DIST_SIZE"
echo "  Timestamp: $(date)"
echo ""
echo "================================================================="

# Create deployment log
LOG_FILE="deployments.log"
echo "[$(date)] Deployed $ENVIRONMENT - Build size: $DIST_SIZE" >> $LOG_FILE

exit 0