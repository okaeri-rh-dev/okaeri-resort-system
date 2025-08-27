#!/bin/bash

# K6 Load Testing Runner Script
# Phase 1.7 - Performance Testing
#
# Usage: ./scripts/run-load-tests.sh [scenario] [environment]
# Example: ./scripts/run-load-tests.sh load staging

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
SCENARIO=${1:-smoke}
ENVIRONMENT=${2:-local}
K6_CONFIG="k6.config.js"
TEST_FILE="tests/load/api-load-test.ts"
OUTPUT_DIR="test-results/load"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if K6 is installed
check_k6_installed() {
    if ! command -v k6 &> /dev/null; then
        print_error "K6 is not installed. Please install it first:"
        echo "  macOS: brew install k6"
        echo "  Linux: sudo apt-get install k6"
        echo "  Windows: choco install k6"
        echo "  Or download from: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    print_info "K6 version: $(k6 version)"
}

# Set environment variables based on environment
set_environment() {
    case $ENVIRONMENT in
        local)
            export API_URL="http://localhost:3000"
            export WS_URL="ws://localhost:3000"
            print_info "Using local environment: $API_URL"
            ;;
        staging)
            export API_URL="https://staging.okaeri-resort.vercel.app"
            export WS_URL="wss://staging.okaeri-resort.vercel.app"
            print_info "Using staging environment: $API_URL"
            ;;
        production)
            export API_URL="https://okaeri-resort.vercel.app"
            export WS_URL="wss://okaeri-resort.vercel.app"
            print_warning "Using PRODUCTION environment: $API_URL"
            read -p "Are you sure you want to run load tests against production? (y/N): " confirm
            if [ "$confirm" != "y" ]; then
                print_info "Aborting load test"
                exit 0
            fi
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            echo "Available environments: local, staging, production"
            exit 1
            ;;
    esac
}

# Get scenario options from config
get_scenario_options() {
    case $SCENARIO in
        smoke)
            K6_OPTIONS="--vus 1 --duration 1m"
            THRESHOLDS="--summary-trend-stats='avg,min,med,max,p(95),p(99)'"
            ;;
        load)
            K6_OPTIONS="--stage '2m:50,5m:50,2m:0'"
            THRESHOLDS="--summary-trend-stats='avg,min,med,max,p(90),p(95),p(99)'"
            ;;
        stress)
            K6_OPTIONS="--stage '2m:100,5m:100,2m:200,5m:200,2m:100,5m:100,2m:0'"
            THRESHOLDS="--summary-trend-stats='avg,min,med,max,p(90),p(95),p(99)'"
            ;;
        spike)
            K6_OPTIONS="--stage '10s:5,5s:500,10s:500,5s:5,10s:5,5s:0'"
            THRESHOLDS="--summary-trend-stats='avg,min,med,max,p(90),p(95),p(99)'"
            ;;
        soak)
            K6_OPTIONS="--stage '5m:30,60m:30,5m:0'"
            THRESHOLDS="--summary-trend-stats='avg,min,med,max,p(90),p(95),p(99)'"
            print_warning "Soak test will run for over 1 hour"
            ;;
        breakpoint)
            K6_OPTIONS="--executor ramping-arrival-rate --start-rate 10 --time-unit 1s --pre-allocated-vus 50 --max-vus 1000 --stage '10m:1000'"
            THRESHOLDS="--summary-trend-stats='avg,min,med,max,p(90),p(95),p(99)'"
            print_warning "Breakpoint test will ramp up until system breaks"
            ;;
        *)
            print_error "Unknown scenario: $SCENARIO"
            echo "Available scenarios: smoke, load, stress, spike, soak, breakpoint"
            exit 1
            ;;
    esac
}

# Ensure test environment is ready
prepare_test_environment() {
    print_info "Preparing test environment..."
    
    if [ "$ENVIRONMENT" = "local" ]; then
        # Check if local server is running
        if ! curl -s "$API_URL/api/health/check" > /dev/null; then
            print_warning "Local server is not running. Starting it..."
            npm run dev &
            SERVER_PID=$!
            print_info "Waiting for server to start (PID: $SERVER_PID)..."
            sleep 10
            
            # Verify server started
            if ! curl -s "$API_URL/api/health/check" > /dev/null; then
                print_error "Failed to start local server"
                kill $SERVER_PID 2>/dev/null || true
                exit 1
            fi
        fi
    fi
    
    # Seed test data if needed
    if [ "$SCENARIO" != "smoke" ]; then
        print_info "Seeding test data..."
        npm run db:seed:test || print_warning "Failed to seed test data"
    fi
}

# Run the load test
run_test() {
    local output_file="$OUTPUT_DIR/${SCENARIO}_${ENVIRONMENT}_${TIMESTAMP}"
    
    print_info "Starting $SCENARIO test against $ENVIRONMENT environment"
    print_info "Output will be saved to: $output_file"
    
    # Build K6 command
    local k6_cmd="k6 run"
    k6_cmd="$k6_cmd $K6_OPTIONS"
    k6_cmd="$k6_cmd --out json=$output_file.json"
    k6_cmd="$k6_cmd --out csv=$output_file.csv"
    k6_cmd="$k6_cmd --summary-export=$output_file.summary.json"
    k6_cmd="$k6_cmd $THRESHOLDS"
    k6_cmd="$k6_cmd $TEST_FILE"
    
    print_info "Running: $k6_cmd"
    
    # Run K6 test
    if eval $k6_cmd; then
        print_info "Load test completed successfully"
        return 0
    else
        print_error "Load test failed"
        return 1
    fi
}

# Generate HTML report
generate_report() {
    local output_file="$OUTPUT_DIR/${SCENARIO}_${ENVIRONMENT}_${TIMESTAMP}"
    
    print_info "Generating HTML report..."
    
    # Create HTML report using K6 summary
    cat > "$output_file.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>K6 Load Test Report - $SCENARIO ($ENVIRONMENT)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        .success { color: green; }
        .failure { color: red; }
        .warning { color: orange; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Load Test Report</h1>
    <div class="info">
        <p><strong>Scenario:</strong> $SCENARIO</p>
        <p><strong>Environment:</strong> $ENVIRONMENT ($API_URL)</p>
        <p><strong>Timestamp:</strong> $TIMESTAMP</p>
    </div>
    <h2>Results Summary</h2>
    <pre id="summary"></pre>
    <script>
        fetch('${SCENARIO}_${ENVIRONMENT}_${TIMESTAMP}.summary.json')
            .then(r => r.json())
            .then(data => {
                document.getElementById('summary').textContent = JSON.stringify(data, null, 2);
            });
    </script>
</body>
</html>
EOF
    
    print_info "HTML report generated: $output_file.html"
}

# Cleanup after test
cleanup() {
    print_info "Cleaning up..."
    
    # Stop local server if we started it
    if [ ! -z "$SERVER_PID" ]; then
        print_info "Stopping local server (PID: $SERVER_PID)"
        kill $SERVER_PID 2>/dev/null || true
    fi
    
    # Clean test data
    if [ "$SCENARIO" != "smoke" ]; then
        npm run db:cleanup:test 2>/dev/null || true
    fi
}

# Main execution
main() {
    print_info "K6 Load Testing Runner"
    print_info "====================="
    
    # Check prerequisites
    check_k6_installed
    
    # Set up environment
    set_environment
    get_scenario_options
    
    # Prepare test environment
    prepare_test_environment
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run the test
    if run_test; then
        generate_report
        print_info "✅ Load test completed successfully!"
        print_info "View results in: $OUTPUT_DIR/"
        
        # Show summary
        echo ""
        print_info "Quick Summary:"
        if [ -f "$OUTPUT_DIR/${SCENARIO}_${ENVIRONMENT}_${TIMESTAMP}.summary.json" ]; then
            cat "$OUTPUT_DIR/${SCENARIO}_${ENVIRONMENT}_${TIMESTAMP}.summary.json" | \
                grep -E '"p95"|"p99"|"failed"|"duration"' | head -10
        fi
    else
        print_error "❌ Load test failed!"
        exit 1
    fi
}

# Show help
show_help() {
    echo "K6 Load Testing Runner"
    echo ""
    echo "Usage: $0 [scenario] [environment]"
    echo ""
    echo "Scenarios:"
    echo "  smoke      - Minimal load test (1 VU, 1 minute)"
    echo "  load       - Normal load test (50 VUs, 9 minutes)"
    echo "  stress     - Stress test (up to 200 VUs, 24 minutes)"
    echo "  spike      - Spike test (up to 500 VUs, 45 seconds)"
    echo "  soak       - Soak test (30 VUs, 1+ hour)"
    echo "  breakpoint - Find breaking point (up to 1000 VUs)"
    echo ""
    echo "Environments:"
    echo "  local      - Local development (http://localhost:3000)"
    echo "  staging    - Staging environment"
    echo "  production - Production environment (requires confirmation)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run smoke test on local"
    echo "  $0 load               # Run load test on local"
    echo "  $0 stress staging     # Run stress test on staging"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main