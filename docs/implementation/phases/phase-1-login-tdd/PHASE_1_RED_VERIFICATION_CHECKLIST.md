# Phase 1 RED Verification Checklist

## Overview

This checklist ensures all documentation issues have been resolved and the
system is ready for Phase 1 RED implementation. Run through each verification
step before beginning TDD development.

## Prerequisites

- [ ] Node.js 20.x installed
- [ ] npm 10.x or higher
- [ ] Git configured
- [ ] VS Code or preferred IDE ready

## 1. Documentation Verification

### Authoritative Sources

- [ ] Verify `VERIFICATION_SCRIPT_SUITE.md` is the primary source for scripts
- [ ] Verify `PERFORMANCE_TESTING_REQUIREMENTS.md` is the primary source for
      performance
- [ ] Verify `TEST_CONFIGURATION_TEMPLATES.md` is the primary source for test
      config
- [ ] Verify `SIMPLE_DATABASE_GUIDE.md` is the primary source for database
      patterns

### Document Integrity

```bash
# Check all referenced documents exist
ls -la docs/implementation/*.md | wc -l
# Expected: 40+ documentation files

# Verify no broken references in README
grep -o '\[.*\](\.\/.*\.md)' docs/implementation/README.md | wc -l
# All links should resolve
```

## 2. Configuration Verification

### Package Dependencies

```bash
# Verify all devDependencies are installed
npm list lighthouse bundlesize start-server-and-test
# Expected: All packages listed with versions

# Verify test dependencies
npm list vitest @testing-library/react jest-axe
# Expected: All packages installed
```

### Vitest Configuration

```bash
# Verify vitest.config.ts has correct setup
grep -A 2 "environment: 'jsdom'" vitest.config.ts
# Expected: jsdom environment configured

grep "setupFiles.*setup.ts" vitest.config.ts
# Expected: Setup file configured

# Verify global thresholds (no path-based)
grep -A 5 "global:" vitest.config.ts
# Expected: Only global thresholds, no path-specific ones
```

### Test Environment

```bash
# Verify .env.test exists with canonical values
cat .env.test
# Expected:
# FIXED_TIME=2024-01-01T00:00:00Z
# RANDOM_SEED=test-seed-2024
# TEST_SCENARIO=STABLE
# MOCK_DELAY=0
```

## 3. Script Verification

### Core Scripts

```bash
# Test coverage runs without errors
npm run test:coverage
# Expected: Coverage report generated

# Custom coverage paths work
npm run verify:coverage:paths
# Expected: Path-based coverage check (may show "coverage file not found" initially)

# Security audits work
npm run security:jwt:full
# Expected: All JWT security checks pass
```

### Cross-Platform Scripts

```bash
# Test scaffolding (works on Windows/Mac/Linux)
npm run scaffold:phase2
# Expected: Creates src/features/dashboard structure

# Verify Node.js scaffolding script
node scripts/scaffold-phase.cjs 3
# Expected: Creates Phase 3 structure
```

### Performance Scripts

```bash
# Verify lighthouse uses devDependency (not npx)
grep "lighthouse http" package.json | grep -v npx
# Expected: All lighthouse commands without npx

# Verify bundlesize configuration
cat bundlesize.config.json | grep "dist/assets"
# Expected: Paths match Vite output structure
```

## 4. Security Verification

### JWT Security

```bash
# Run all security audits
npm run audit:jwt:headers
# Expected: Authorization Bearer patterns found

npm run audit:jwt:storage
# Expected: No localStorage token usage

npm run audit:jwt:no-cookies
# Expected: No cookie-based auth patterns
```

### Cross-Platform Security Scripts

```bash
# Test Node.js security scripts directly
node scripts/security-audits/jwt-audit.cjs
# Expected: Runs on all platforms

node scripts/security-audits/run-audit.cjs jwt
# Expected: Platform detection works
```

## 5. Testing Infrastructure

### Test Utilities

```bash
# Verify test utilities documentation exists
ls -la docs/implementation/TEST_UTILITIES_SPECIFICATION.md
# Expected: File exists with 400+ lines

# Verify jest-axe setup in test file
grep "toHaveNoViolations" src/test/setup.ts
# Expected: jest-axe matcher extended
```

### Deterministic Testing

```bash
# Run a simple test to verify deterministic setup
npm test -- --run --reporter=verbose src/test/setup.test.ts 2>/dev/null || echo "No setup test yet"
# Expected: Tests use fixed time and seeded random
```

## 6. Build & Performance

### Build Verification

```bash
# Test production build
npm run build
# Expected: Build completes without errors

# Verify bundle sizes
npm run verify:bundle
# Expected: Bundle size checks pass or show current sizes
```

### Lighthouse Performance

```bash
# Test performance scripts (requires build)
npm run build && npm run verify:performance
# Expected: Lighthouse runs with local devDependency

# Test accessibility
npm run verify:accessibility
# Expected: Accessibility audit completes
```

## 7. Complete Verification Suite

### Run Full Verification

```bash
# Run complete verification suite
npm run verify:all
# Expected: All verifications pass
```

### Final Checks

- [ ] All scripts run without npx downloads
- [ ] Security audits work on current platform
- [ ] Coverage thresholds are enforced
- [ ] Test environment is deterministic
- [ ] Documentation has clear SSOT hierarchy

## 8. Phase 1 RED Readiness

### Final Steps Before Starting

1. [ ] Review `FINAL_IMPLEMENTATION_REQUIREMENTS.md`
2. [ ] Check `TDD_FEEDBACK_RESOLUTION_TRACKER.md` - all issues resolved
3. [ ] Confirm with team that documentation is "rock solid"
4. [ ] Create feature branch for Phase 1 RED

### Success Criteria

- ✅ All verification commands execute successfully
- ✅ No contradictions in documentation
- ✅ Scripts work on your development platform
- ✅ Test infrastructure is properly configured
- ✅ Security compliance checks pass

## Troubleshooting

### Common Issues

**Issue**: Coverage paths script fails

```bash
# Solution: Ensure coverage report exists first
npm run test:coverage
npm run verify:coverage:paths
```

**Issue**: Lighthouse commands fail

```bash
# Solution: Ensure lighthouse is installed as devDependency
npm install --save-dev lighthouse@12.8.2
```

**Issue**: Security scripts fail on Windows

```bash
# Solution: Use Node.js versions
npm run audit:jwt:headers:node
```

**Issue**: Scaffold scripts fail

```bash
# Solution: Use Node.js version directly
node scripts/scaffold-phase.cjs 2
```

## Next Steps

Once all checks pass:

1. Begin Phase 1 RED implementation
2. Write failing authentication tests first
3. Follow TDD cycle: RED → GREEN → REFACTOR
4. Maintain 95% coverage for auth features

---

_Verification Checklist Version: 1.0.0_ _Last Updated: August 31, 2025_ _Part
of: Okaeri Resort System TDD Implementation_
