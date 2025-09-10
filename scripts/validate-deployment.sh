#!/bin/bash

##
# Deployment Validation Script - Okaeri Resort System
# Phase 5.5 Post-Deployment Validation
#
# This script handles:
# - Comprehensive endpoint testing
# - Performance validation
# - Security header verification  
# - Database connectivity testing
# - Load testing simulation
##

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/validation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] <deployment-url>

Post-Deployment Validation Script for Okaeri Resort System

ARGUMENTS:
    deployment-url      The URL of the deployment to validate

OPTIONS:
    -h, --help          Show this help message
    --skip-load-test    Skip load testing (faster validation)
    --security-only     Run only security validations
    --performance-only  Run only performance validations

EXAMPLES:
    $0 https://okaeri-resort.vercel.app
    $0 --skip-load-test https://staging.vercel.app
    $0 --security-only https://okaeri-resort.vercel.app

EOF
}

parse_arguments() {
    SKIP_LOAD_TEST=false
    SECURITY_ONLY=false
    PERFORMANCE_ONLY=false
    DEPLOYMENT_URL=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            --skip-load-test)
                SKIP_LOAD_TEST=true
                shift
                ;;
            --security-only)
                SECURITY_ONLY=true
                shift
                ;;
            --performance-only)
                PERFORMANCE_ONLY=true
                shift
                ;;
            https://*)
                DEPLOYMENT_URL="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    if [ -z "$DEPLOYMENT_URL" ]; then
        log_error "Deployment URL is required"
        show_usage
        exit 1
    fi
}

check_dependencies() {
    log_info "Checking validation dependencies..."
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found - some validations will be limited"
    fi
    
    log_success "Dependencies validated"
}

test_basic_connectivity() {
    log_info "Testing basic connectivity..."
    
    # Test main page
    local status
    status=$(curl -s -w "%{http_code}" -o /dev/null "$DEPLOYMENT_URL/" --max-time 30 || echo "000")
    
    if [ "$status" != "200" ]; then
        log_error "Main page failed (status: $status)"
        return 1
    fi
    
    log_success "Main page responding (200)"
    return 0
}

test_health_endpoint() {
    log_info "Testing health check endpoint..."
    
    local health_url="$DEPLOYMENT_URL/api/health-check"
    local response
    local status
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$health_url" --max-time 15 || echo "HTTPSTATUS:000")
    status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" != "200" ]; then
        log_error "Health check failed (status: $status)"
        return 1
    fi
    
    # Parse health response if jq is available
    if command -v jq &> /dev/null; then
        local health_body
        health_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]{3}$//')
        
        local health_status
        health_status=$(echo "$health_body" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
        
        if [ "$health_status" = "healthy" ]; then
            log_success "Health check endpoint healthy"
        else
            log_warning "Health check status: $health_status"
        fi
    else
        log_success "Health check endpoint responding (200)"
    fi
    
    return 0
}

test_authentication_endpoints() {
    log_info "Testing authentication endpoints..."
    
    # Test login endpoint (expect validation error with empty body)
    local login_url="$DEPLOYMENT_URL/api/auth/login"
    local status
    
    status=$(curl -s -w "%{http_code}" -o /dev/null \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{}' \
        "$login_url" \
        --max-time 15 || echo "000")
    
    # Expect 400 or 422 for validation error (proves endpoint works)
    if [ "$status" = "400" ] || [ "$status" = "422" ]; then
        log_success "Login endpoint responding with validation"
    elif [ "$status" = "429" ]; then
        log_success "Login endpoint responding (rate limited)"
    else
        log_error "Login endpoint unexpected status: $status"
        return 1
    fi
    
    return 0
}

test_security_headers() {
    log_info "Testing security headers..."
    
    local headers
    headers=$(curl -s -I "$DEPLOYMENT_URL/" --max-time 15 | tr -d '\r')
    
    # Required security headers
    local required_headers=(
        "X-Content-Type-Options: nosniff"
        "X-Frame-Options: DENY"
        "Strict-Transport-Security:"
        "Referrer-Policy: strict-origin-when-cross-origin"
        "Content-Security-Policy:"
    )
    
    local missing_headers=()
    
    for header in "${required_headers[@]}"; do
        if ! echo "$headers" | grep -q "$header"; then
            missing_headers+=("$header")
        fi
    done
    
    if [ ${#missing_headers[@]} -eq 0 ]; then
        log_success "All required security headers present"
    else
        log_error "Missing security headers:"
        printf '  - %s\n' "${missing_headers[@]}"
        return 1
    fi
    
    return 0
}

test_api_endpoints() {
    log_info "Testing API endpoints availability..."
    
    # Test OPTIONS requests for CORS
    local cors_status
    cors_status=$(curl -s -w "%{http_code}" -o /dev/null \
        -X OPTIONS \
        -H "Origin: $DEPLOYMENT_URL" \
        "$DEPLOYMENT_URL/api/auth/login" \
        --max-time 15 || echo "000")
    
    if [ "$cors_status" = "200" ] || [ "$cors_status" = "204" ]; then
        log_success "CORS configured correctly"
    else
        log_warning "CORS test status: $cors_status"
    fi
    
    return 0
}

test_performance_metrics() {
    if [ "$SECURITY_ONLY" = true ]; then
        return 0
    fi
    
    log_info "Testing performance metrics..."
    
    # Test page load time
    local load_time
    load_time=$(curl -w "%{time_total}" -o /dev/null -s "$DEPLOYMENT_URL/" --max-time 30 || echo "999")
    
    log_info "Initial load time: ${load_time}s"
    
    # Performance thresholds
    if (( $(echo "$load_time > 3.0" | bc -l 2>/dev/null || echo "1") )); then
        log_error "Load time (${load_time}s) exceeds 3s threshold"
        return 1
    elif (( $(echo "$load_time > 2.0" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "Load time (${load_time}s) exceeds 2s target"
    else
        log_success "Load time within performance budget"
    fi
    
    # Test API response time
    local api_time
    api_time=$(curl -w "%{time_total}" -o /dev/null -s "$DEPLOYMENT_URL/api/health-check" --max-time 15 || echo "999")
    
    log_info "API response time: ${api_time}s"
    
    if (( $(echo "$api_time > 1.0" | bc -l 2>/dev/null || echo "1") )); then
        log_warning "API response time (${api_time}s) exceeds 1s"
    else
        log_success "API response time acceptable"
    fi
    
    return 0
}

run_load_simulation() {
    if [ "$SKIP_LOAD_TEST" = true ] || [ "$SECURITY_ONLY" = true ]; then
        return 0
    fi
    
    log_info "Running basic load simulation..."
    
    # Simple concurrent request test
    local concurrent_requests=10
    local total_requests=50
    local success_count=0
    
    log_info "Testing $total_requests requests with $concurrent_requests concurrent..."
    
    # Create temporary file for results
    local temp_file
    temp_file=$(mktemp)
    
    # Run concurrent requests
    for ((i=1; i<=total_requests; i++)); do
        {
            local status
            status=$(curl -s -w "%{http_code}" -o /dev/null "$DEPLOYMENT_URL/api/health-check" --max-time 10 || echo "000")
            echo "$status" >> "$temp_file"
        } &
        
        # Limit concurrent requests
        if (( i % concurrent_requests == 0 )); then
            wait
        fi
    done
    
    wait # Wait for remaining requests
    
    # Count successful requests
    success_count=$(grep -c "200" "$temp_file" 2>/dev/null || echo "0")
    local success_rate=$((success_count * 100 / total_requests))
    
    rm -f "$temp_file"
    
    log_info "Load test results: $success_count/$total_requests successful ($success_rate%)"
    
    if [ $success_rate -lt 95 ]; then
        log_error "Load test success rate ($success_rate%) below 95% threshold"
        return 1
    else
        log_success "Load test passed ($success_rate% success rate)"
    fi
    
    return 0
}

test_database_connectivity() {
    if [ "$PERFORMANCE_ONLY" = true ]; then
        return 0
    fi
    
    log_info "Testing database connectivity via health check..."
    
    local health_url="$DEPLOYMENT_URL/api/health-check"
    
    if command -v jq &> /dev/null; then
        local response
        response=$(curl -s "$health_url" --max-time 15 || echo '{}')
        
        local db_status
        db_status=$(echo "$response" | jq -r '.checks.database // "unknown"' 2>/dev/null || echo "unknown")
        
        if [ "$db_status" = "true" ]; then
            log_success "Database connectivity confirmed"
        else
            log_error "Database connectivity check failed"
            return 1
        fi
    else
        log_info "Database connectivity test limited without jq"
    fi
    
    return 0
}

generate_validation_report() {
    local validation_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local report_file="$PROJECT_ROOT/validation-report-$(date +%s).json"
    
    log_info "Generating validation report..."
    
    cat > "$report_file" << EOF
{
  "validationId": "$(date +%s)",
  "timestamp": "$validation_time",
  "deploymentUrl": "$DEPLOYMENT_URL",
  "validationType": "post_deployment",
  "executedBy": "$(whoami)",
  "testResults": {
    "basicConnectivity": "$([ $? -eq 0 ] && echo "passed" || echo "failed")",
    "healthCheck": "tested",
    "authenticationEndpoints": "tested",
    "securityHeaders": "tested",
    "apiEndpoints": "tested",
    "performanceMetrics": "$([ "$SECURITY_ONLY" = false ] && echo "tested" || echo "skipped")",
    "loadSimulation": "$([ "$SKIP_LOAD_TEST" = false ] && [ "$SECURITY_ONLY" = false ] && echo "tested" || echo "skipped")",
    "databaseConnectivity": "$([ "$PERFORMANCE_ONLY" = false ] && echo "tested" || echo "skipped")"
  },
  "summary": "Validation completed",
  "recommendations": [
    "Monitor application performance for first 24 hours",
    "Set up external monitoring if not already configured",
    "Review logs for any anomalies",
    "Confirm backup procedures are working"
  ]
}
EOF
    
    log_success "Validation report generated: $report_file"
}

main() {
    parse_arguments "$@"
    
    log_info "=== Starting Deployment Validation ==="
    log_info "Deployment URL: $DEPLOYMENT_URL"
    log_info "Timestamp: $(date)"
    log_info "Skip load test: $SKIP_LOAD_TEST"
    log_info "Security only: $SECURITY_ONLY"
    log_info "Performance only: $PERFORMANCE_ONLY"
    
    check_dependencies
    
    local failed_tests=0
    
    # Run validation tests
    test_basic_connectivity || ((failed_tests++))
    test_health_endpoint || ((failed_tests++))
    test_authentication_endpoints || ((failed_tests++))
    
    if [ "$PERFORMANCE_ONLY" = false ]; then
        test_security_headers || ((failed_tests++))
        test_api_endpoints || ((failed_tests++))
        test_database_connectivity || ((failed_tests++))
    fi
    
    if [ "$SECURITY_ONLY" = false ]; then
        test_performance_metrics || ((failed_tests++))
        run_load_simulation || ((failed_tests++))
    fi
    
    generate_validation_report
    
    echo ""
    if [ $failed_tests -eq 0 ]; then
        log_success "=== All Validation Tests Passed ==="
        log_info "Deployment is ready for production traffic"
    else
        log_error "=== $failed_tests Validation Test(s) Failed ==="
        log_error "Review failures before proceeding to production"
        exit 1
    fi
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi