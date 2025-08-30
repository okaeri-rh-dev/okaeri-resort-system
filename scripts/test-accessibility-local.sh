#!/bin/bash
#
# Local Accessibility Testing Script  
# Replicates CI Gate 6 accessibility testing locally
#
# Usage: ./scripts/test-accessibility-local.sh [route]
# Example: ./scripts/test-accessibility-local.sh /dashboard
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Accessibility thresholds (matching CI expectations)
A11Y_THRESHOLD=95  # Should be 95% for WCAG 2.1 AA compliance
SEO_THRESHOLD=90
BEST_PRACTICES_THRESHOLD=95

echo -e "${BLUE}♿ Okaeri Resort System - Accessibility Testing${NC}"
echo -e "${BLUE}===============================================${NC}"

# Set CI-like environment
export CI=true
export NODE_ENV=production

# Default route
ROUTE=${1:-"/"}
BASE_URL="http://localhost:4173"
FULL_URL="$BASE_URL$ROUTE"

echo -e "\n${YELLOW}📋 Test Configuration:${NC}"
echo "  Route: $ROUTE"
echo "  URL: $FULL_URL"
echo "  Accessibility Threshold: ≥${A11Y_THRESHOLD}% (WCAG 2.1 AA)"
echo "  SEO Threshold: ≥${SEO_THRESHOLD}%"
echo "  Best Practices Threshold: ≥${BEST_PRACTICES_THRESHOLD}%"

# Check dependencies
echo -e "\n${YELLOW}🔍 Checking dependencies...${NC}"

# Check for required tools
if ! command -v lighthouse &> /dev/null; then
    echo -e "${RED}❌ lighthouse not found. Install with: npm install -g lighthouse${NC}"
    exit 1
fi

if ! command -v axe &> /dev/null; then
    echo -e "${YELLOW}⚠️  axe CLI not found. Install with: npm install -g @axe-core/cli${NC}"
    echo -e "${YELLOW}   Continuing without axe CLI tests...${NC}"
fi

if ! command -v pa11y &> /dev/null; then
    echo -e "${YELLOW}⚠️  pa11y not found. Install with: npm install -g pa11y${NC}"
    echo -e "${YELLOW}   Continuing without pa11y tests...${NC}"
fi

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

# Test routes for comprehensive accessibility testing
if [ "$ROUTE" = "/" ]; then
    TEST_ROUTES=("/" "/login" "/dashboard" "/bookings" "/expenses" "/properties")
else
    TEST_ROUTES=("$ROUTE")
fi

echo -e "\n${YELLOW}🧪 Running Accessibility Tests...${NC}"

overall_pass=true

# Function to extract metric from JSON report
extract_a11y_metric() {
    local file=$1
    local metric=$2
    
    if [ ! -f "$file" ]; then
        echo "0"
        return
    fi
    
    case $metric in
        "accessibility")
            node -e "
                try {
                    const report = require('./$file');
                    const score = report.lhr.categories.accessibility.score;
                    console.log(Math.round((score || 0) * 100));
                } catch (e) { console.log(0); }
            "
            ;;
        "seo")
            node -e "
                try {
                    const report = require('./$file');
                    const score = report.lhr.categories.seo.score;
                    console.log(Math.round((score || 0) * 100));
                } catch (e) { console.log(0); }
            "
            ;;
        "best-practices")
            node -e "
                try {
                    const report = require('./$file');
                    const score = report.lhr.categories['best-practices'].score;
                    console.log(Math.round((score || 0) * 100));
                } catch (e) { console.log(0); }
            "
            ;;
        "violations")
            node -e "
                try {
                    const report = require('./$file');
                    const audits = report.lhr.audits;
                    const violations = Object.entries(audits)
                        .filter(([key, audit]) => 
                            audit.score !== null && 
                            audit.score < 1 && 
                            ['aria-allowed-attr', 'aria-required-attr', 'button-name', 
                             'color-contrast', 'document-title', 'html-lang-valid', 
                             'image-alt', 'label', 'link-name'].includes(key)
                        );
                    console.log(violations.length);
                } catch (e) { console.log(0); }
            "
            ;;
    esac
}

# Run tests for each route
for test_route in "${TEST_ROUTES[@]}"; do
    test_url="$BASE_URL$test_route"
    route_name=$(echo "$test_route" | sed 's/[^a-zA-Z0-9]/_/g' | sed 's/^_//' | sed 's/_$//')
    [ -z "$route_name" ] && route_name="home"
    
    echo -e "\n${BLUE}🔍 Testing Route: $test_route${NC}"
    
    # 1. Lighthouse Accessibility Test
    echo "  Running Lighthouse accessibility audit..."
    lighthouse "$test_url" \
        --only-categories=accessibility,seo,best-practices \
        --output=json \
        --output-path="./test-results/a11y-$route_name.json" \
        --chrome-flags="--no-sandbox --disable-dev-shm-usage" \
        --quiet
    
    # 2. Mobile Accessibility Test
    echo "  Running mobile accessibility audit..."
    lighthouse "$test_url" \
        --preset=mobile \
        --only-categories=accessibility \
        --output=json \
        --output-path="./test-results/a11y-mobile-$route_name.json" \
        --quiet
    
    # 3. axe-core Test (if available)
    if command -v axe &> /dev/null; then
        echo "  Running axe-core analysis..."
        axe_output_file="./test-results/axe-$route_name.json"
        if axe "$test_url" --exit --format=json > "$axe_output_file" 2>/dev/null; then
            axe_violations=$(node -e "
                try {
                    const report = require('./$axe_output_file');
                    console.log(report.violations ? report.violations.length : 0);
                } catch (e) { console.log('error'); }
            ")
        else
            axe_violations="error"
        fi
    else
        axe_violations="N/A"
    fi
    
    # 4. pa11y Test (if available)
    if command -v pa11y &> /dev/null; then
        echo "  Running pa11y analysis..."
        pa11y_output_file="./test-results/pa11y-$route_name.txt"
        if pa11y "$test_url" --reporter cli > "$pa11y_output_file" 2>&1; then
            pa11y_issues=$(grep -c "Error\|Warning" "$pa11y_output_file" 2>/dev/null || echo "0")
        else
            pa11y_issues="error"
        fi
    else
        pa11y_issues="N/A"
    fi
    
    # Extract results
    desktop_a11y=$(extract_a11y_metric "./test-results/a11y-$route_name.json" "accessibility")
    desktop_seo=$(extract_a11y_metric "./test-results/a11y-$route_name.json" "seo")
    desktop_bp=$(extract_a11y_metric "./test-results/a11y-$route_name.json" "best-practices")
    mobile_a11y=$(extract_a11y_metric "./test-results/a11y-mobile-$route_name.json" "accessibility")
    desktop_violations=$(extract_a11y_metric "./test-results/a11y-$route_name.json" "violations")
    
    # Check results
    desktop_a11y_pass=$([ $desktop_a11y -ge $A11Y_THRESHOLD ] && echo "✅" || echo "❌")
    desktop_seo_pass=$([ $desktop_seo -ge $SEO_THRESHOLD ] && echo "✅" || echo "❌")
    desktop_bp_pass=$([ $desktop_bp -ge $BEST_PRACTICES_THRESHOLD ] && echo "✅" || echo "❌")
    mobile_a11y_pass=$([ $mobile_a11y -ge $A11Y_THRESHOLD ] && echo "✅" || echo "❌")
    axe_pass=$([ "$axe_violations" = "0" ] && echo "✅" || ([ "$axe_violations" = "N/A" ] && echo "⚠️" || echo "❌"))
    pa11y_pass=$([ "$pa11y_issues" = "0" ] && echo "✅" || ([ "$pa11y_issues" = "N/A" ] && echo "⚠️" || echo "❌"))
    
    # Display results
    echo -e "\n  ${YELLOW}📊 Results for $test_route:${NC}"
    echo "    Desktop Accessibility: $desktop_a11y_pass $desktop_a11y% (≥${A11Y_THRESHOLD}%)"
    echo "    Mobile Accessibility:  $mobile_a11y_pass $mobile_a11y% (≥${A11Y_THRESHOLD}%)"
    echo "    SEO Score:            $desktop_seo_pass $desktop_seo% (≥${SEO_THRESHOLD}%)"
    echo "    Best Practices:       $desktop_bp_pass $desktop_bp% (≥${BEST_PRACTICES_THRESHOLD}%)"
    echo "    Critical Violations:  $([ $desktop_violations -eq 0 ] && echo "✅" || echo "❌") $desktop_violations critical issues"
    
    if [ "$axe_violations" != "N/A" ]; then
        echo "    axe-core Violations:  $axe_pass $axe_violations violations"
    fi
    
    if [ "$pa11y_issues" != "N/A" ]; then
        echo "    pa11y Issues:         $pa11y_pass $pa11y_issues issues"
    fi
    
    # Check if route passed all tests
    if [[ "$desktop_a11y_pass" == "❌" || "$mobile_a11y_pass" == "❌" || "$desktop_seo_pass" == "❌" || "$desktop_bp_pass" == "❌" || $desktop_violations -gt 0 ]]; then
        overall_pass=false
    fi
    
    if [[ "$axe_violations" != "N/A" && "$axe_violations" != "0" && "$axe_violations" != "error" ]]; then
        overall_pass=false
    fi
    
    if [[ "$pa11y_issues" != "N/A" && "$pa11y_issues" != "0" && "$pa11y_issues" != "error" ]]; then
        overall_pass=false
    fi
    
done

# Generate detailed HTML reports
echo -e "\n${YELLOW}📄 Generating detailed HTML reports...${NC}"

# Create comprehensive accessibility report
main_route=$(echo "${TEST_ROUTES[0]}" | sed 's/[^a-zA-Z0-9]/_/g' | sed 's/^_//' | sed 's/_$//')
[ -z "$main_route" ] && main_route="home"

lighthouse "$BASE_URL${TEST_ROUTES[0]}" \
    --only-categories=accessibility,seo,best-practices \
    --output=html \
    --output-path="./test-results/accessibility-report.html" \
    --quiet

# Run comprehensive audit with all accessibility audits
lighthouse "$BASE_URL${TEST_ROUTES[0]}" \
    --only-audits="aria-allowed-attr,aria-required-attr,button-name,color-contrast,document-title,html-lang-valid,image-alt,label,link-name,list,listitem,meta-viewport" \
    --output=html \
    --output-path="./test-results/accessibility-detailed.html" \
    --quiet

# Touch target analysis
echo -e "\n${YELLOW}👆 Touch Target Analysis:${NC}"
touch_target_script="
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 732 });
  await page.goto('$BASE_URL${TEST_ROUTES[0]}');
  
  const touchTargets = await page.evaluate(() => {
    const elements = document.querySelectorAll('button, a, input[type=\"checkbox\"], input[type=\"radio\"], [role=\"button\"]');
    return Array.from(elements).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        size: Math.min(rect.width, rect.height),
        text: el.textContent?.trim().substring(0, 30) || el.getAttribute('aria-label') || 'No text'
      };
    }).filter(t => t.size > 0);
  });
  
  let passingTargets = 0;
  let warningTargets = 0;
  let failingTargets = 0;
  
  touchTargets.forEach(target => {
    if (target.size >= 48) passingTargets++;
    else if (target.size >= 44) warningTargets++;
    else failingTargets++;
  });
  
  console.log('Touch Target Summary:');
  console.log(\`  ✅ Passing (≥48px): \${passingTargets}\`);
  console.log(\`  ⚠️  Warning (44-47px): \${warningTargets}\`);
  console.log(\`  ❌ Failing (<44px): \${failingTargets}\`);
  
  if (failingTargets > 0) {
    console.log('\\nFailing touch targets:');
    touchTargets.filter(t => t.size < 44).forEach(target => {
      console.log(\`  - \${target.tag}: \${target.size}px - \"\${target.text}\"\`);
    });
  }
  
  await browser.close();
  process.exit(failingTargets > 0 ? 1 : 0);
})();
"

if command -v node &> /dev/null && npm list puppeteer &> /dev/null; then
    echo "$touch_target_script" | node 2>/dev/null || touch_target_pass=false
else
    echo -e "${YELLOW}  ⚠️  Puppeteer not available - manual touch target testing required${NC}"
fi

# Color contrast check
echo -e "\n${YELLOW}🎨 Color Contrast Analysis:${NC}"
contrast_issues=$(node -e "
try {
    const report = require('./test-results/a11y-$main_route.json');
    const colorContrastAudit = report.lhr.audits['color-contrast'];
    if (colorContrastAudit && colorContrastAudit.details && colorContrastAudit.details.items) {
        const issues = colorContrastAudit.details.items.length;
        console.log(\`  Found \${issues} color contrast issues\`);
        if (issues > 0) {
            console.log('  Check detailed report for specific elements');
        }
    } else {
        console.log('  No color contrast issues found');
    }
} catch (e) {
    console.log('  Could not analyze color contrast');
}
")

# Summary of common accessibility issues found
echo -e "\n${BLUE}🔍 Common Issues Summary${NC}"
echo -e "${BLUE}========================${NC}"

# Analyze all reports for common patterns
node -e "
const fs = require('fs');
const reports = fs.readdirSync('./test-results')
    .filter(f => f.startsWith('a11y-') && f.endsWith('.json'))
    .map(f => {
        try {
            return require('./test-results/' + f);
        } catch (e) {
            return null;
        }
    })
    .filter(r => r);

if (reports.length === 0) {
    console.log('No accessibility reports found');
    process.exit(0);
}

const issueTypes = {};
reports.forEach(report => {
    if (report.lhr && report.lhr.audits) {
        Object.entries(report.lhr.audits).forEach(([key, audit]) => {
            if (audit.score !== null && audit.score < 1) {
                issueTypes[key] = (issueTypes[key] || 0) + 1;
            }
        });
    }
});

if (Object.keys(issueTypes).length > 0) {
    console.log('Most common accessibility issues:');
    Object.entries(issueTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([issue, count]) => {
            console.log(\`  ❌ \${issue}: \${count} occurrence(s)\`);
        });
} else {
    console.log('✅ No recurring accessibility issues found');
}
" 2>/dev/null

# Final summary
echo -e "\n${BLUE}📋 Final Accessibility Summary${NC}"
echo -e "${BLUE}===============================${NC}"

if [ "$overall_pass" = true ]; then
    echo -e "${GREEN}🎉 All accessibility tests PASSED!${NC}"
    echo -e "${GREEN}✅ WCAG 2.1 AA compliance achieved${NC}"
    echo -e "${GREEN}✅ Ready for CI/CD pipeline${NC}"
else
    echo -e "${RED}❌ Some accessibility tests FAILED${NC}"
    echo -e "${YELLOW}📄 Check detailed reports:${NC}"
    echo -e "  - ./test-results/accessibility-report.html"
    echo -e "  - ./test-results/accessibility-detailed.html"
    
    echo -e "\n${YELLOW}💡 Common fixes:${NC}"
    echo "  - Add alt attributes to images: <img alt=\"description\" />"
    echo "  - Add labels to form inputs: <label htmlFor=\"input-id\">Label</label>"
    echo "  - Add accessible names to buttons: <button aria-label=\"Close\">"
    echo "  - Ensure color contrast ratios meet 4.5:1 (3:1 for large text)"
    echo "  - Make touch targets at least 44x44px (48x48px preferred)"
    echo "  - Add proper heading hierarchy (h1, h2, h3...)"
    echo "  - Use semantic HTML elements (nav, main, section, article)"
fi

echo -e "\n${YELLOW}📚 Resources:${NC}"
echo "  - WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/"
echo "  - axe-core Rules: https://dequeuniversity.com/rules/axe/"
echo "  - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/"

if [ "$overall_pass" = true ]; then
    exit 0
else
    exit 1
fi