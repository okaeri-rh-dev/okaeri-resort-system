#!/bin/bash

# Test Performance on 3G Network Conditions
# Simulates Filipino mobile network conditions for resort staff

echo "🏝️  Testing Okaeri Resort System Performance on 3G Conditions"
echo "========================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required tools are installed
command -v lighthouse >/dev/null 2>&1 || { 
    echo -e "${RED}Error: Lighthouse is not installed. Run: npm install -g @lhci/cli lighthouse${NC}"
    exit 1
}

# Build the application
echo -e "${YELLOW}Building application...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed. Exiting.${NC}"
    exit 1
fi

# Start preview server in background
echo -e "${YELLOW}Starting preview server...${NC}"
npm run preview &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test URLs for different scenarios
URLS=(
    "http://localhost:4173/"
    "http://localhost:4173/dashboard"
    "http://localhost:4173/bookings"
    "http://localhost:4173/properties"
    "http://localhost:4173/expenses"
)

# 3G Network conditions (typical for Philippines)
# Based on: https://web.dev/adaptive-loading-cds-2019/
THROTTLING_3G="--throttling-method=devtools --throttling.rttMs=300 --throttling.throughputKbps=700 --throttling.cpuSlowdownMultiplier=4"

# Slow 3G conditions for rural areas
THROTTLING_SLOW_3G="--throttling-method=devtools --throttling.rttMs=560 --throttling.throughputKbps=400 --throttling.cpuSlowdownMultiplier=6"

echo -e "${YELLOW}Running Lighthouse tests with 3G throttling...${NC}"

# Create results directory
mkdir -p performance-reports

# Test each URL with different network conditions
for url in "${URLS[@]}"; do
    page_name=$(echo $url | sed 's|http://localhost:4173/||' | sed 's|^$|home|')
    
    echo -e "${GREEN}Testing: $page_name${NC}"
    
    # Regular 3G test
    echo "  - 3G conditions..."
    lighthouse "$url" \
        $THROTTLING_3G \
        --form-factor=mobile \
        --preset=perf \
        --chrome-flags="--headless" \
        --output=json \
        --output-path="performance-reports/${page_name}-3g.json" \
        --quiet

    # Slow 3G test (for remote areas)
    echo "  - Slow 3G conditions..."
    lighthouse "$url" \
        $THROTTLING_SLOW_3G \
        --form-factor=mobile \
        --preset=perf \
        --chrome-flags="--headless" \
        --output=json \
        --output-path="performance-reports/${page_name}-slow-3g.json" \
        --quiet
done

# Kill the preview server
kill $SERVER_PID

echo -e "${GREEN}Performance tests completed!${NC}"

# Generate summary report
echo -e "${YELLOW}Generating performance summary...${NC}"

cat > performance-reports/summary.md << EOF
# Performance Test Summary - 3G Network Conditions

## Test Configuration
- **Device**: Mobile (Moto G4)
- **Network**: 3G (700 Kbps) and Slow 3G (400 Kbps)
- **CPU**: 4x and 6x slowdown
- **Location**: Simulated Philippine mobile conditions

## Performance Targets
- **LCP**: < 2.5s (Good)
- **FID**: < 100ms (Good)  
- **CLS**: < 0.1 (Good)
- **FCP**: < 1.8s (Good)
- **SI**: < 3.4s (Good)
- **TBT**: < 200ms (Good)

## Test Results

EOF

# Extract key metrics from Lighthouse reports
for report in performance-reports/*.json; do
    if [ -f "$report" ]; then
        page=$(basename "$report" .json)
        
        echo "### $page" >> performance-reports/summary.md
        echo "" >> performance-reports/summary.md
        
        # Extract metrics using Node.js
        node -e "
        const fs = require('fs');
        const report = JSON.parse(fs.readFileSync('$report', 'utf8'));
        const audits = report.audits;
        
        console.log('| Metric | Value | Status |');
        console.log('|--------|-------|--------|');
        
        const metrics = {
            'largest-contentful-paint': { name: 'LCP', target: 2500, unit: 'ms' },
            'first-input-delay': { name: 'FID', target: 100, unit: 'ms' },
            'cumulative-layout-shift': { name: 'CLS', target: 0.1, unit: '' },
            'first-contentful-paint': { name: 'FCP', target: 1800, unit: 'ms' },
            'speed-index': { name: 'SI', target: 3400, unit: 'ms' },
            'total-blocking-time': { name: 'TBT', target: 200, unit: 'ms' }
        };
        
        Object.entries(metrics).forEach(([key, config]) => {
            if (audits[key]) {
                const value = audits[key].numericValue || 0;
                const displayValue = audits[key].displayValue || 'N/A';
                const status = value <= config.target ? '✅ Good' : value <= config.target * 1.5 ? '⚠️ Needs Improvement' : '❌ Poor';
                console.log(\`| \${config.name} | \${displayValue} | \${status} |\`);
            }
        });
        
        console.log('');
        console.log('**Performance Score:** ' + Math.round((report.categories.performance?.score || 0) * 100) + '/100');
        console.log('');
        " >> performance-reports/summary.md
    fi
done

# Add recommendations
cat >> performance-reports/summary.md << EOF

## Recommendations for Resort Staff Usage

### Good Performance (90+ Score)
- ✅ App loads quickly even on slow connections
- ✅ Smooth interactions for booking and expense entry
- ✅ Offline functionality works reliably

### Needs Improvement (50-89 Score)  
- ⚠️ Consider reducing image sizes
- ⚠️ Enable more aggressive caching
- ⚠️ Optimize critical rendering path

### Poor Performance (<50 Score)
- ❌ Bundle size too large for mobile
- ❌ Too many render-blocking resources
- ❌ Poor offline experience

## Network Optimization Tips

1. **Image Compression**: Use WebP/AVIF formats
2. **Code Splitting**: Load only needed functionality  
3. **Service Worker**: Cache critical resources
4. **Preloading**: Prefetch likely-needed resources
5. **Bundle Analysis**: Monitor chunk sizes

## Testing Commands

\`\`\`bash
# Run full performance audit
npm run perf:audit

# Test 3G conditions
npm run perf:test-3g  

# Check bundle sizes
npm run perf:budget

# Analyze bundle composition
npm run build:analyze
\`\`\`

EOF

echo -e "${GREEN}Summary report generated: performance-reports/summary.md${NC}"

# Display quick summary
echo ""
echo "📊 Performance Test Summary:"
echo "================================"

# Count results by performance score
good_count=0
needs_improvement_count=0
poor_count=0

for report in performance-reports/*.json; do
    if [ -f "$report" ]; then
        score=$(node -e "
            const report = JSON.parse(require('fs').readFileSync('$report', 'utf8'));
            console.log(Math.round((report.categories.performance?.score || 0) * 100));
        ")
        
        if [ "$score" -ge 90 ]; then
            ((good_count++))
        elif [ "$score" -ge 50 ]; then
            ((needs_improvement_count++))
        else
            ((poor_count++))
        fi
    fi
done

echo "✅ Good (90+): $good_count pages"
echo "⚠️  Needs Improvement (50-89): $needs_improvement_count pages"  
echo "❌ Poor (<50): $poor_count pages"
echo ""
echo "📁 Detailed reports saved in: performance-reports/"
echo ""

# Provide next steps
if [ $poor_count -gt 0 ]; then
    echo -e "${RED}⚠️  Some pages need optimization for 3G networks${NC}"
    echo "Consider running: npm run build:analyze"
elif [ $needs_improvement_count -gt 0 ]; then
    echo -e "${YELLOW}💡 Performance is decent but can be improved${NC}"
    echo "Consider optimizing images and reducing bundle sizes"
else
    echo -e "${GREEN}🎉 Excellent performance on 3G networks!${NC}"
    echo "Resort staff should have a smooth mobile experience"
fi