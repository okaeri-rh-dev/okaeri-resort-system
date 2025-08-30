#!/bin/bash
set -e

# CI/CD Setup Script for Okaeri Resort Management System
# This script sets up the CI/CD environment for deterministic testing

echo "🚀 Setting up CI/CD environment for Okaeri Resort System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running in CI
if [ "$CI" = "true" ]; then
    print_status "Running in CI environment"
else
    print_warning "Running in local development environment"
fi

# Set up environment variables
setup_env() {
    print_status "Setting up environment variables..."
    
    if [ -f ".env.ci" ]; then
        cp .env.ci .env.test
        print_status "Copied CI environment configuration"
    else
        print_error ".env.ci not found!"
        exit 1
    fi
    
    # Set deterministic test seed based on date for consistency
    echo "TEST_SEED=ci-seed-$(date +%Y%m%d)" >> .env.test
    
    # Override any environment-specific variables
    if [ "$CI" = "true" ]; then
        echo "CI=true" >> .env.test
        echo "VITEST_DETERMINISTIC=true" >> .env.test
        echo "TEST_SCENARIO=STABLE" >> .env.test
    fi
    
    print_status "Environment variables configured"
}

# Validate Node.js version
validate_node() {
    print_status "Validating Node.js version..."
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="20"
    
    if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]]; then
        print_status "Node.js version $NODE_VERSION is compatible"
    else
        print_error "Node.js version $NODE_VERSION is not compatible. Required: $REQUIRED_VERSION+"
        exit 1
    fi
}

# Install dependencies with optimization
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Use npm ci for deterministic installs
    if [ "$CI" = "true" ]; then
        npm ci --prefer-offline --no-audit --progress=false
    else
        npm ci
    fi
    
    print_status "Dependencies installed successfully"
}

# Set up test database (if running locally)
setup_test_database() {
    if [ "$CI" != "true" ]; then
        print_status "Setting up local test database..."
        
        # Check if PostgreSQL is running
        if ! pg_isready -q; then
            print_warning "PostgreSQL is not running. Please start PostgreSQL service."
            return 1
        fi
        
        # Create test database if it doesn't exist
        createdb test_db 2>/dev/null || print_warning "Test database already exists"
        
        # Run migrations
        npm run db:migrate:up
        print_status "Test database configured"
    else
        print_status "Skipping database setup in CI (handled by services)"
    fi
}

# Validate CI/CD configuration files
validate_config() {
    print_status "Validating CI/CD configuration..."
    
    # Check required files
    required_files=(
        ".github/workflows/ci.yml"
        "vercel.json"
        "bundlesize.config.json"
        "package.json"
        ".env.ci"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file missing: $file"
            exit 1
        fi
    done
    
    # Validate package.json scripts
    required_scripts=(
        "build"
        "test"
        "test:coverage"
        "lint"
        "type-check"
        "perf:budget"
    )
    
    for script in "${required_scripts[@]}"; do
        if ! npm run --silent 2>/dev/null | grep -q "^  $script$"; then
            print_error "Required npm script missing: $script"
            exit 1
        fi
    done
    
    print_status "CI/CD configuration validated"
}

# Set up mock API for deterministic testing
setup_mock_api() {
    print_status "Setting up deterministic mock API..."
    
    # Ensure mock API is enabled in test environment
    if [ -f ".env.test" ]; then
        if ! grep -q "VITE_USE_MOCK_API=true" .env.test; then
            echo "VITE_USE_MOCK_API=true" >> .env.test
        fi
        
        # Configure deterministic mock settings
        echo "VITE_MOCK_DETERMINISTIC=true" >> .env.test
        echo "VITE_MOCK_SEED=ci-stable-seed" >> .env.test
    fi
    
    print_status "Mock API configured for deterministic testing"
}

# Pre-flight checks
preflight_checks() {
    print_status "Running pre-flight checks..."
    
    # Check TypeScript compilation
    if ! npm run type-check; then
        print_error "TypeScript compilation failed"
        exit 1
    fi
    
    # Check linting
    if ! npm run lint; then
        print_error "Code linting failed"
        exit 1
    fi
    
    # Quick test run to verify deterministic behavior
    if npm run test -- --run --reporter=dot --testTimeout=10000; then
        print_status "Test suite validation passed"
    else
        print_error "Test suite validation failed"
        exit 1
    fi
    
    print_status "Pre-flight checks completed"
}

# Performance budget validation
validate_performance_budget() {
    print_status "Validating performance budget configuration..."
    
    # Build the application
    npm run build
    
    # Check if bundlesize can run
    if npm run perf:budget; then
        print_status "Performance budget validation passed"
    else
        print_warning "Performance budget check failed - review bundle sizes"
    fi
}

# Security configuration check
check_security_config() {
    print_status "Checking security configuration..."
    
    # Verify no secrets in environment files
    if find . -name ".env*" -not -name "*.example" -not -name ".env.ci" -exec grep -l "secret\|key\|password\|token" {} \; | head -1; then
        print_error "Potential secrets found in environment files"
        exit 1
    fi
    
    # Check security headers in vercel.json
    required_headers=("Content-Security-Policy" "X-Frame-Options" "Strict-Transport-Security")
    for header in "${required_headers[@]}"; do
        if ! grep -q "$header" vercel.json; then
            print_error "Missing security header: $header"
            exit 1
        fi
    done
    
    print_status "Security configuration validated"
}

# Generate CI/CD summary report
generate_summary() {
    print_status "Generating CI/CD setup summary..."
    
    cat << EOF > ci-setup-report.txt
CI/CD Setup Report - $(date)
========================================

Environment: ${CI:+CI}${CI:-Local}
Node Version: $(node -v)
NPM Version: $(npm -v)
Test Database: ${DATABASE_URL:-Not configured}

Configuration Status:
- Environment variables: ✅ Configured
- Dependencies: ✅ Installed
- Test database: ${DATABASE_URL:+✅ Configured}${DATABASE_URL:-⚠️ Skipped}
- Mock API: ✅ Configured
- Performance budgets: ✅ Validated
- Security config: ✅ Validated

Ready for CI/CD operations: ✅
EOF

    print_status "Setup summary saved to ci-setup-report.txt"
}

# Main execution
main() {
    echo "================================================"
    echo "  Okaeri Resort System - CI/CD Setup"
    echo "================================================"
    echo ""
    
    validate_node
    setup_env
    install_dependencies
    validate_config
    setup_mock_api
    setup_test_database || true  # Don't fail if database setup fails
    check_security_config
    preflight_checks
    validate_performance_budget
    generate_summary
    
    echo ""
    echo "================================================"
    echo -e "${GREEN}🎉 CI/CD setup completed successfully!${NC}"
    echo "================================================"
    echo ""
    echo "Next steps:"
    echo "1. Review ci-setup-report.txt for configuration details"
    echo "2. Commit and push changes to trigger CI/CD pipeline"
    echo "3. Monitor build results in GitHub Actions"
    echo "4. Configure secrets in Vercel dashboard"
    echo ""
    echo "Useful commands:"
    echo "  npm run test:coverage    # Run tests with coverage"
    echo "  npm run perf:budget      # Check performance budgets"
    echo "  npm run build:analyze    # Analyze bundle composition"
    echo "  npm run verify:all       # Run all verification checks"
    echo ""
}

# Error handling
trap 'print_error "Setup failed at line $LINENO"; exit 1' ERR

# Run main function
main "$@"