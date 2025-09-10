#!/bin/bash

##
# Production Rollback Script - Okaeri Resort System
# Phase 5.5 Emergency Rollback Automation
#
# This script handles:
# - Immediate rollback to previous deployment
# - Health verification of rollback
# - Incident documentation
# - Team notification
##

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/rollback.log"
HEALTH_CHECK_TIMEOUT=60

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
        log_error "Rollback failed with exit code $exit_code"
        log_error "CRITICAL: Manual intervention required!"
        log_info "Contact system administrator immediately"
    fi
    exit $exit_code
}

trap cleanup EXIT

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Production Rollback Script for Okaeri Resort System

OPTIONS:
    -h, --help          Show this help message
    -f, --force         Skip confirmation prompts
    -r, --reason TEXT   Specify rollback reason
    -t, --target URL    Target specific deployment URL to rollback to

EXAMPLES:
    $0                                    # Interactive rollback
    $0 --force --reason "Critical bug"    # Automated rollback
    $0 --target https://old-deployment.vercel.app  # Rollback to specific version

EOF
}

parse_arguments() {
    FORCE_ROLLBACK=false
    ROLLBACK_REASON=""
    TARGET_DEPLOYMENT=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -f|--force)
                FORCE_ROLLBACK=true
                shift
                ;;
            -r|--reason)
                ROLLBACK_REASON="$2"
                shift 2
                ;;
            -t|--target)
                TARGET_DEPLOYMENT="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

check_prerequisites() {
    log_info "Checking rollback prerequisites..."
    
    # Check if Vercel CLI is available
    if ! command -v vercel &> /dev/null; then
        log_error "Vercel CLI not found. Install with: npm i -g vercel"
        exit 1
    fi
    
    # Check if authenticated
    if ! vercel whoami &> /dev/null; then
        log_error "Not authenticated with Vercel. Run: vercel login"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/vercel.json" ]; then
        log_error "Must be run from project root"
        exit 1
    fi
    
    log_success "Prerequisites validated"
}

get_deployment_list() {
    log_info "Retrieving deployment history..."
    
    cd "$PROJECT_ROOT"
    
    # Get list of deployments
    local deployments
    deployments=$(vercel ls --scope $(vercel whoami) 2>/dev/null | grep -E '^[[:space:]]*https://' | head -10)
    
    if [ -z "$deployments" ]; then
        log_error "No deployments found"
        exit 1
    fi
    
    echo "$deployments"
}

select_rollback_target() {
    if [ -n "$TARGET_DEPLOYMENT" ]; then
        log_info "Using specified target: $TARGET_DEPLOYMENT"
        echo "$TARGET_DEPLOYMENT"
        return
    fi
    
    log_info "Available deployments:"
    local deployments
    deployments=$(get_deployment_list)
    
    echo "$deployments" | nl -v 0
    
    echo ""
    read -p "Select deployment to rollback to (0-9): " selection
    
    local target
    target=$(echo "$deployments" | sed -n "$((selection + 1))p" | awk '{print $1}')
    
    if [ -z "$target" ]; then
        log_error "Invalid selection"
        exit 1
    fi
    
    echo "$target"
}

confirm_rollback() {
    if [ "$FORCE_ROLLBACK" = true ]; then
        return 0
    fi
    
    local target_url="$1"
    
    echo ""
    log_warning "=== ROLLBACK CONFIRMATION ==="
    log_warning "Target URL: $target_url"
    log_warning "Reason: ${ROLLBACK_REASON:-"Not specified"}"
    log_warning "This will replace the current production deployment"
    echo ""
    
    read -p "Are you sure you want to proceed? (yes/no): " confirmation
    
    case $confirmation in
        yes|YES|y|Y)
            return 0
            ;;
        *)
            log_info "Rollback cancelled by user"
            exit 0
            ;;
    esac
}

execute_rollback() {
    local target_url="$1"
    
    log_info "Executing rollback to: $target_url"
    
    cd "$PROJECT_ROOT"
    
    # Extract deployment ID from URL
    local deployment_id
    deployment_id=$(echo "$target_url" | sed -E 's|https://([^.]+).*|\1|')
    
    # Promote the target deployment
    log_info "Promoting deployment: $deployment_id"
    vercel promote "$target_url" --yes
    
    if [ $? -ne 0 ]; then
        log_error "Failed to promote deployment"
        exit 1
    fi
    
    log_success "Rollback executed successfully"
    
    # Wait for propagation
    log_info "Waiting for rollback to propagate..."
    sleep 45
}

verify_rollback() {
    local target_url="$1"
    
    log_info "Verifying rollback deployment..."
    
    # Test health check
    log_info "Testing health check endpoint..."
    local health_attempts=0
    local max_attempts=5
    
    while [ $health_attempts -lt $max_attempts ]; do
        local health_status
        health_status=$(curl -s -w "%{http_code}" -o /dev/null "$target_url/api/health-check" || echo "000")
        
        if [ "$health_status" = "200" ]; then
            log_success "Health check responding (attempt $((health_attempts + 1)))"
            break
        else
            log_warning "Health check failed, attempt $((health_attempts + 1))/$max_attempts (status: $health_status)"
            health_attempts=$((health_attempts + 1))
            sleep 10
        fi
    done
    
    if [ $health_attempts -eq $max_attempts ]; then
        log_error "Health check verification failed after $max_attempts attempts"
        exit 1
    fi
    
    # Test main application
    log_info "Testing main application..."
    local app_status
    app_status=$(curl -s -w "%{http_code}" -o /dev/null "$target_url/" || echo "000")
    
    if [ "$app_status" != "200" ]; then
        log_error "Main application test failed (status: $app_status)"
        exit 1
    fi
    
    log_success "Rollback verification completed"
}

create_incident_report() {
    local target_url="$1"
    local rollback_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local commit_sha=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    
    log_info "Creating incident report..."
    
    cat > "$PROJECT_ROOT/incident-report-$(date +%s).json" << EOF
{
  "incidentId": "$(date +%s)",
  "timestamp": "$rollback_time",
  "type": "production_rollback",
  "reason": "${ROLLBACK_REASON:-"Not specified"}",
  "rollbackTarget": "$target_url",
  "previousCommit": "$commit_sha",
  "executedBy": "$(whoami)",
  "verificationStatus": "passed",
  "affectedServices": [
    "web_application",
    "api_endpoints",
    "authentication"
  ],
  "rollbackDuration": "~2 minutes",
  "postRollbackChecks": {
    "healthCheck": "passed",
    "mainApplication": "passed",
    "apiEndpoints": "not_tested"
  },
  "recommendations": [
    "Investigate root cause of original issue",
    "Review deployment process",
    "Consider additional pre-deployment tests",
    "Update monitoring alerts if needed"
  ]
}
EOF
    
    log_success "Incident report created: incident-report-$(date +%s).json"
}

notify_team() {
    local target_url="$1"
    
    log_info "=== ROLLBACK NOTIFICATION ==="
    log_info "Rollback completed successfully"
    log_info "Target URL: $target_url"
    log_info "Reason: ${ROLLBACK_REASON:-"Not specified"}"
    log_info "Time: $(date)"
    log_info "Executed by: $(whoami)"
    echo ""
    log_info "Next steps:"
    log_info "  1. Verify all systems are functioning normally"
    log_info "  2. Investigate root cause of the issue"
    log_info "  3. Update the incident report with findings"
    log_info "  4. Plan corrective measures for next deployment"
    echo ""
    log_warning "Remember to notify relevant team members!"
}

main() {
    parse_arguments "$@"
    
    log_info "=== Starting Production Rollback ==="
    log_info "Timestamp: $(date)"
    log_info "User: $(whoami)"
    log_info "Reason: ${ROLLBACK_REASON:-"Not specified"}"
    
    check_prerequisites
    
    local target_url
    target_url=$(select_rollback_target)
    
    confirm_rollback "$target_url"
    execute_rollback "$target_url"
    verify_rollback "$target_url"
    create_incident_report "$target_url"
    notify_team "$target_url"
    
    log_success "=== Rollback Completed Successfully ==="
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi