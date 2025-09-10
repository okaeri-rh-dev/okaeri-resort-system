#!/bin/bash

##
# Production Deployment Script - Okaeri Resort System
# Phase 5.5 Go-Live Automation
#
# This script handles:
# - Pre-deployment validation
# - Production deployment to Vercel
# - Post-deployment verification
# - Rollback capability
##

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/deployment.log"
HEALTH_CHECK_TIMEOUT=60
MAX_RETRIES=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Deployment failed with exit code $exit_code"
        log_info "Check $LOG_FILE for detailed logs"
        log_info "Consider running rollback: ./scripts/rollback-production.sh"
    fi
    exit $exit_code
}

trap cleanup EXIT

# Helper functions
check_dependencies() {
    log_info "Checking deployment dependencies..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        log_error "Vercel CLI not found. Install with: npm i -g vercel"
        exit 1
    fi
    
    # Check if authenticated with Vercel
    if ! vercel whoami &> /dev/null; then
        log_error "Not authenticated with Vercel. Run: vercel login"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | sed 's/v//')
    local required_major=20
    local current_major=$(echo "$node_version" | cut -d. -f1)
    
    if [ "$current_major" -lt "$required_major" ]; then
        log_error "Node.js $required_major.x required, found $node_version"
        exit 1
    fi
    
    # Check if in correct directory
    if [ ! -f "$PROJECT_ROOT/package.json" ] || [ ! -f "$PROJECT_ROOT/vercel.json" ]; then
        log_error "Must be run from project root with package.json and vercel.json"
        exit 1
    fi
    
    log_success "All dependencies checked"
}

run_pre_deployment_tests() {
    log_info "Running pre-deployment validation suite..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --prefer-offline --no-audit
    
    # Type checking
    log_info "Running TypeScript validation..."
    npm run type-check
    
    # Linting
    log_info "Running ESLint validation..."
    npm run lint
    
    # Unit tests with coverage
    log_info "Running unit tests with coverage..."
    npm run test:coverage
    
    # Integration tests
    log_info "Running integration tests..."
    npm test -- --run tests/integration/
    
    # Database tests
    log_info "Running database validation tests..."
    npm run test:db
    
    # Phase 1 authentication tests
    log_info "Running Phase 1 authentication tests..."
    npm run test:phase1
    
    # Security validation
    log_info "Running security validation..."
    npm run verify:security
    
    # Performance budget validation
    log_info "Validating performance budgets..."
    npm run perf:budget-ci
    
    log_success "All pre-deployment tests passed"
}

build_application() {
    log_info "Building application for production..."
    
    cd "$PROJECT_ROOT"
    
    # Set production environment
    export NODE_ENV=production
    export VITE_NODE_ENV=production
    export CI=true
    
    # Build application
    log_info "Running production build..."
    npm run build
    
    # Verify build output
    if [ ! -d "$PROJECT_ROOT/dist" ]; then
        log_error "Build output directory not found"
        exit 1
    fi
    
    # Check critical files exist
    local critical_files=("dist/index.html" "dist/assets")
    for file in "${critical_files[@]}"; do
        if [ ! -e "$PROJECT_ROOT/$file" ]; then
            log_error "Critical build file missing: $file"
            exit 1
        fi
    done
    
    log_success "Application built successfully"
}

deploy_to_vercel() {
    log_info "Deploying to Vercel production..."
    
    cd "$PROJECT_ROOT"
    
    # Deploy to production
    log_info "Executing Vercel deployment..."
    local deployment_url
    deployment_url=$(vercel --prod --yes 2>&1 | grep -o 'https://[^[:space:]]*' | tail -1)
    
    if [ -z "$deployment_url" ]; then
        log_error "Failed to get deployment URL from Vercel"
        exit 1
    fi
    
    log_success "Deployed to: $deployment_url"
    echo "$deployment_url" > "$PROJECT_ROOT/.vercel/production-url.txt"
    
    # Wait for deployment to propagate
    log_info "Waiting for deployment to propagate..."
    sleep 30
    
    return 0
}

verify_deployment() {
    log_info "Verifying production deployment..."
    
    local deployment_url
    if [ -f "$PROJECT_ROOT/.vercel/production-url.txt" ]; then
        deployment_url=$(cat "$PROJECT_ROOT/.vercel/production-url.txt")
    else
        log_error "Deployment URL not found"
        exit 1
    fi
    
    log_info "Testing deployment at: $deployment_url"
    
    # Test health check endpoint
    log_info "Testing health check endpoint..."
    local health_status
    health_status=$(curl -s -w "%{http_code}" -o /dev/null "$deployment_url/api/health-check" || echo "000")
    
    if [ "$health_status" != "200" ]; then
        log_error "Health check failed with status: $health_status"
        exit 1
    fi
    
    log_success "Health check endpoint responding"
    
    # Test authentication endpoints
    log_info "Testing authentication endpoints..."
    local auth_status
    auth_status=$(curl -s -w "%{http_code}" -o /dev/null -X POST \
        -H "Content-Type: application/json" \
        -d '{}' \
        "$deployment_url/api/auth/login" || echo "000")
    
    # Expect 400 for invalid request (proves endpoint is working)
    if [ "$auth_status" != "400" ] && [ "$auth_status" != "422" ]; then
        log_error "Auth endpoint test failed with status: $auth_status"
        exit 1
    fi
    
    log_success "Authentication endpoints responding"
    
    # Test static assets
    log_info "Testing static asset delivery..."
    local asset_status
    asset_status=$(curl -s -w "%{http_code}" -o /dev/null "$deployment_url/" || echo "000")
    
    if [ "$asset_status" != "200" ]; then
        log_error "Static assets failed with status: $asset_status"
        exit 1
    fi
    
    log_success "Static assets loading correctly"
    
    # Test performance
    log_info "Running performance validation..."
    local load_time
    load_time=$(curl -w "%{time_total}" -o /dev/null -s "$deployment_url/")
    
    # Performance budget: 2 seconds for initial load
    if (( $(echo "$load_time > 2.0" | bc -l) )); then
        log_warning "Load time ($load_time s) exceeds 2s budget"
    else
        log_success "Performance within budget ($load_time s)"
    fi
    
    log_success "Deployment verification completed"
}

create_deployment_record() {
    log_info "Creating deployment record..."
    
    local deployment_url=$(cat "$PROJECT_ROOT/.vercel/production-url.txt" 2>/dev/null || echo "unknown")
    local commit_sha=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    local deployment_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Create deployment record
    cat > "$PROJECT_ROOT/deployment-record.json" << EOF
{
  "deploymentId": "$(date +%s)",
  "timestamp": "$deployment_time",
  "commitSha": "$commit_sha",
  "deploymentUrl": "$deployment_url",
  "version": "Phase 5.5",
  "environment": "production",
  "status": "success",
  "verifiedEndpoints": [
    "/api/health-check",
    "/api/auth/login",
    "/"
  ],
  "performance": {
    "initialLoadTime": "$(curl -w "%{time_total}" -o /dev/null -s "$deployment_url/" 2>/dev/null || echo "unknown")"
  }
}
EOF
    
    log_success "Deployment record created: deployment-record.json"
}

main() {
    log_info "=== Starting Production Deployment - Phase 5.5 ==="
    log_info "Timestamp: $(date)"
    log_info "Commit: $(git rev-parse HEAD 2>/dev/null || echo "unknown")"
    log_info "User: $(whoami)"
    log_info "Directory: $PROJECT_ROOT"
    
    check_dependencies
    run_pre_deployment_tests
    build_application
    deploy_to_vercel
    verify_deployment
    create_deployment_record
    
    log_success "=== Production Deployment Complete ==="
    log_info "Deployment URL: $(cat "$PROJECT_ROOT/.vercel/production-url.txt" 2>/dev/null || echo "check Vercel dashboard")"
    log_info "Health Check: $(cat "$PROJECT_ROOT/.vercel/production-url.txt" 2>/dev/null || echo "unknown")/api/health-check"
    log_info "Next steps:"
    log_info "  1. Configure external monitoring (Uptime Robot)"
    log_info "  2. Update DNS if using custom domain"
    log_info "  3. Run post-deployment validation"
    log_info "  4. Notify team of go-live"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi