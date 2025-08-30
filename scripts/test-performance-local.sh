#!/bin/bash
#
# Local Performance Testing Script
# Replicates CI Gate 5 performance testing locally
#
# Usage: ./scripts/test-performance-local.sh [route]
# Example: ./scripts/test-performance-local.sh /dashboard
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Performance thresholds (matching CI)
PERFORMANCE_THRESHOLD=90
FCP_THRESHOLD=1500
LCP_THRESHOLD=2500
CLS_THRESHOLD=0.1
TBT_THRESHOLD=300
SI_THRESHOLD=3000
TTI_THRESHOLD=3000

echo -e "${BLUE}🚀 Okaeri Resort System - Performance Testing${NC}"
echo -e "${BLUE}===============================================${NC}"

# Set CI-like environment
export CI=true
export NODE_ENV=production
export LIGHTHOUSE_SCORE_THRESHOLD=$PERFORMANCE_THRESHOLD

# Default route
ROUTE=${1:-"/"}
BASE_URL="http://localhost:4173"
FULL_URL="$BASE_URL$ROUTE"

echo -e "\n${YELLOW}📋 Test Configuration:${NC}"
echo "  Route: $ROUTE"
echo "  URL: $FULL_URL"
echo "  Performance Threshold: ≥${PERFORMANCE_THRESHOLD}%"
echo "  FCP Threshold: <${FCP_THRESHOLD}ms"
echo "  LCP Threshold: <${LCP_THRESHOLD}ms"
echo "  CLS Threshold: <${CLS_THRESHOLD}"
echo "  TBT Threshold: <${TBT_THRESHOLD}ms"

# Check if build exists
if [ ! -d "dist" ]; then
    echo -e "\n${YELLOW}🔨 Building application...${NC}"
    npm run build
fi

# Start preview server
echo -e "\n${YELLOW}🚀 Starting preview server...${NC}"
npm run preview > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Function to cleanup
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    kill $SERVER_PID 2>/dev/null || true
}

# Trap cleanup on exit
trap cleanup EXIT

# Check if server is running
if ! curl -s "$BASE_URL" > /dev/null; then
    echo -e "${RED}❌ Preview server failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Preview server running on $BASE_URL${NC}"

# Create test directory
mkdir -p test-results

# Run comprehensive performance test
echo -e "\n${YELLOW}🧪 Running Performance Tests...${NC}"

# 1. Basic Performance Test
echo -e "\n${BLUE}1. Basic Performance Test${NC}"
lighthouse "$FULL_URL" \
    --output=json \
    --output-path=./test-results/perf-basic.json \
    --chrome-flags="--no-sandbox --disable-dev-shm-usage" \
    --quiet

# 2. Mobile Performance Test (Philippines 3G)
echo -e "\n${BLUE}2. Mobile 3G Performance Test (Philippines conditions)${NC}"
lighthouse "$FULL_URL" \
    --preset=mobile \
    --form-factor=mobile \
    --throttling-method=devtools \
    --throttling.cpuSlowdownMultiplier=4 \
    --throttling.requestLatencyMs=300 \
    --throttling.downloadThroughputKbps=1474 \
    --throttling.uploadThroughputKbps=675 \
    --throttling.rttMs=300 \
    --screenEmulation.mobile=true \
    --screenEmulation.width=412 \
    --screenEmulation.height=732 \
    --screenEmulation.deviceScaleFactor=2.625 \
    --emulated-user-agent="Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36" \
    --output=json \
    --output-path=./test-results/perf-mobile-3g.json \
    --quiet

# 3. Desktop Performance Test
echo -e "\n${BLUE}3. Desktop Performance Test${NC}"
lighthouse "$FULL_URL" \
    --preset=desktop \
    --form-factor=desktop \
    --output=json \
    --output-path=./test-results/perf-desktop.json \
    --quiet

# Function to extract metric from JSON report
extract_metric() {
    local file=$1
    local metric=$2
    
    if [ ! -f "$file" ]; then
        echo "0"
        return
    fi
    
    case $metric in
        "performance")
            node -e "
                try {
                    const report = require('./$file');
                    const score = report.lhr.categories.performance.score;
                    console.log(Math.round((score || 0) * 100));
                } catch (e) { console.log(0); }
            "
            ;;
        "fcp")
            node -e "
                try {
                    const report = require('./$file');
                    const value = report.lhr.audits['first-contentful-paint'].numericValue;
                    console.log(Math.round(value || 0));
                } catch (e) { console.log(0); }
            "
            ;;
        "lcp")
            node -e "
                try {
                    const report = require('./$file');
                    const value = report.lhr.audits['largest-contentful-paint'].numericValue;
                    console.log(Math.round(value || 0));
                } catch (e) { console.log(0); }
            "
            ;;
        "cls")
            node -e "
                try {
                    const report = require('./$file');
                    const value = report.lhr.audits['cumulative-layout-shift'].numericValue;
                    console.log((value || 0).toFixed(3));
                } catch (e) { console.log(0); }
            "
            ;;
        "tbt")
            node -e "
                try {
                    const report = require('./$file');
                    const value = report.lhr.audits['total-blocking-time'].numericValue;
                    console.log(Math.round(value || 0));
                } catch (e) { console.log(0); }
            "
            ;;
        "si")
            node -e "
                try {
                    const report = require('./$file');
                    const value = report.lhr.audits['speed-index'].numericValue;
                    console.log(Math.round(value || 0));
                } catch (e) { console.log(0); }
            "
            ;;
        "tti")
            node -e "
                try {
                    const report = require('./$file');
                    const value = report.lhr.audits['interactive'].numericValue;
                    console.log(Math.round(value || 0));
                } catch (e) { console.log(0); }
            "
            ;;
    esac
}

# Function to check if metric passes threshold
check_metric() {
    local value=$1
    local threshold=$2
    local comparison=$3  # "gt" for greater than, "lt" for less than
    
    if [ "$comparison" = "gt" ]; then
        [ $(echo "$value >= $threshold" | bc -l) -eq 1 ]
    else
        [ $(echo "$value <= $threshold" | bc -l) -eq 1 ]
    fi
}

# Analyze results
echo -e "\n${BLUE}📊 Performance Analysis Results${NC}"
echo -e "${BLUE}================================${NC}"

# Process each test result
declare -A test_results
test_results["Basic"]="./test-results/perf-basic.json"
test_results["Mobile 3G"]="./test-results/perf-mobile-3g.json" 
test_results["Desktop"]="./test-results/perf-desktop.json"

overall_pass=true

for test_name in "${!test_results[@]}"; do
    report_file=${test_results[$test_name]}
    
    echo -e "\n${YELLOW}📱 $test_name Test Results:${NC}"
    
    # Extract metrics
    perf_score=$(extract_metric "$report_file" "performance")
    fcp_value=$(extract_metric "$report_file" "fcp")
    lcp_value=$(extract_metric "$report_file" "lcp")
    cls_value=$(extract_metric "$report_file" "cls")
    tbt_value=$(extract_metric "$report_file" "tbt")
    si_value=$(extract_metric "$report_file" "si")
    tti_value=$(extract_metric "$report_file" "tti")
    
    # Check each metric
    perf_pass=$(check_metric $perf_score $PERFORMANCE_THRESHOLD "gt" && echo "✅" || echo "❌")
    fcp_pass=$(check_metric $fcp_value $FCP_THRESHOLD "lt" && echo "✅" || echo "❌")
    lcp_pass=$(check_metric $lcp_value $LCP_THRESHOLD "lt" && echo "✅" || echo "❌")
    cls_pass=$(echo "$cls_value <= $CLS_THRESHOLD" | bc -l | xargs -I {} test {} -eq 1 && echo "✅" || echo "❌")
    tbt_pass=$(check_metric $tbt_value $TBT_THRESHOLD "lt" && echo "✅" || echo "❌")
    si_pass=$(check_metric $si_value $SI_THRESHOLD "lt" && echo "✅" || echo "❌")
    tti_pass=$(check_metric $tti_value $TTI_THRESHOLD "lt" && echo "✅" || echo "❌")
    
    # Display results
    echo "  Performance Score: $perf_pass $perf_score% (≥${PERFORMANCE_THRESHOLD}%)"
    echo "  First Contentful Paint: $fcp_pass ${fcp_value}ms (<${FCP_THRESHOLD}ms)"
    echo "  Largest Contentful Paint: $lcp_pass ${lcp_value}ms (<${LCP_THRESHOLD}ms)"
    echo "  Cumulative Layout Shift: $cls_pass $cls_value (<${CLS_THRESHOLD})"
    echo "  Total Blocking Time: $tbt_pass ${tbt_value}ms (<${TBT_THRESHOLD}ms)"
    echo "  Speed Index: $si_pass ${si_value}ms (<${SI_THRESHOLD}ms)"
    echo "  Time to Interactive: $tti_pass ${tti_value}ms (<${TTI_THRESHOLD}ms)"
    
    # Check if any metric failed for this test
    if [[ "$perf_pass" == "❌" || "$fcp_pass" == "❌" || "$lcp_pass" == "❌" || "$cls_pass" == "❌" || "$tbt_pass" == "❌" || "$si_pass" == "❌" || "$tti_pass" == "❌" ]]; then
        overall_pass=false
    fi
done

# Bundle size check
echo -e "\n${YELLOW}📦 Bundle Size Analysis:${NC}"
if command -v bundlesize >/dev/null 2>&1; then
    if bundlesize; then
        echo -e "${GREEN}✅ All bundle sizes within limits${NC}"
    else
        echo -e "${RED}❌ Bundle size limits exceeded${NC}"
        overall_pass=false
    fi
else
    echo -e "${YELLOW}⚠️  bundlesize not installed - run: npm install -g bundlesize${NC}"
fi

# Generate HTML report for detailed analysis
echo -e "\n${YELLOW}📄 Generating detailed HTML report...${NC}"
lighthouse "$FULL_URL" \
    --preset=mobile \
    --throttling.downloadThroughputKbps=1474 \
    --output=html \
    --output-path=./test-results/performance-report.html \
    --quiet

# Final summary
echo -e "\n${BLUE}📋 Final Summary${NC}"
echo -e "${BLUE}=================${NC}"

if [ "$overall_pass" = true ]; then
    echo -e "${GREEN}🎉 All performance tests PASSED!${NC}"
    echo -e "${GREEN}✅ Ready for CI/CD pipeline${NC}"
    exit 0
else
    echo -e "${RED}❌ Some performance tests FAILED${NC}"
    echo -e "${YELLOW}📄 Check detailed report: ./test-results/performance-report.html${NC}"
    echo -e "${YELLOW}🔍 Review specific failing metrics above${NC}"
    echo -e "\n${YELLOW}💡 Common fixes:${NC}"
    echo "  - Optimize images (use WebP, proper sizing)"
    echo "  - Implement code splitting for large bundles"
    echo "  - Add resource preloading for critical assets"
    echo "  - Minimize render-blocking resources"
    echo "  - Use React.lazy() for route-based code splitting"
    exit 1
fi