# Pull Request

## Description

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to
      not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring (no functional changes)

## TDD Compliance

### TDD Phase

<!-- Mark the current phase with an "x" -->

- [ ] **🔴 RED** - Writing failing tests
- [ ] **🟢 GREEN** - Implementing to pass tests
- [ ] **🔵 REFACTOR** - Optimizing while keeping tests green
- [ ] **📝 Documentation** - No code changes

### Test-First Development

<!-- Confirm tests were written before implementation -->

- [ ] **Yes** - Tests were written first (check commit history)
- [ ] **No** - Please explain why: **\*\***\_\_\_**\*\***
- [ ] **N/A** - Documentation or configuration change only

## Coverage Report

### Test Coverage

<!-- Paste coverage summary or link to report -->

```
Test Suites: ___ passed, ___ total
Tests:       ___ passed, ___ total
Coverage:    ___% (minimum 90% required, 95% for critical paths)
```

### Coverage by Category

- [ ] **Unit Tests**: \_\_\_% (minimum 90%)
- [ ] **Integration Tests**: \_\_\_% (minimum 85%)
- [ ] **E2E Tests**: Critical paths covered
- [ ] **Security Tests**: Authentication/authorization covered
- [ ] **Accessibility Tests**: WCAG 2.1 AA compliant

## Performance Impact

### Bundle Size Changes

<!-- Report any changes to bundle sizes -->

| Bundle | Before   | After    | Change   | Within Budget?        |
| ------ | -------- | -------- | -------- | --------------------- |
| Main   | \_\_\_KB | \_\_\_KB | \_\_\_KB | ✅/❌ (120KB max)     |
| CSS    | \_\_\_KB | \_\_\_KB | \_\_\_KB | ✅/❌ (40KB max)      |
| Total  | \_\_\_KB | \_\_\_KB | \_\_\_KB | ✅/❌ (200KB initial) |

### Lighthouse Scores

<!-- Only required for UI changes -->

- [ ] Performance: \_\_\_ (≥90 required)
- [ ] Accessibility: \_\_\_ (≥90 required)
- [ ] Best Practices: \_\_\_ (≥90 required)
- [ ] SEO: \_\_\_ (≥90 required)

## Security Considerations

### Security Checklist

<!-- Mark all that apply -->

- [ ] **No security impact** - This change doesn't affect security
- [ ] **Authentication changes** - JWT/session handling modified
- [ ] **Authorization changes** - Access control updated
- [ ] **Input validation** - New user inputs properly validated
- [ ] **Sensitive data** - No secrets or PII exposed
- [ ] **Dependencies** - No vulnerable dependencies added

### Security Review

- [ ] Security tests written and passing
- [ ] No high/critical vulnerabilities in `npm audit`
- [ ] CSP headers validated (if applicable)

## Breaking Changes

- [ ] **No breaking changes**
- [ ] **Breaking changes documented** - Migration guide provided below:

<!-- If breaking changes, provide migration instructions -->

## Quality Checklist

### Code Quality

- [ ] Code follows project conventions and patterns
- [ ] TypeScript strict mode clean (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting applied (`npm run format`)

### Testing

- [ ] All new code has tests
- [ ] All tests pass (`npm run test`)
- [ ] Edge cases covered
- [ ] Error scenarios tested
- [ ] Mocks are deterministic

### Documentation

- [ ] Code comments added where necessary
- [ ] README updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] CHANGELOG updated

### Verification

- [ ] `npm run verify` passes all checks
- [ ] `npm run build` succeeds
- [ ] Manual testing completed

## Agent Handoff

<!-- Required for phase transitions -->

### Handoff Details

- **From Agent**: **\*\***\_**\*\***
- **To Agent**: **\*\***\_**\*\***
- **Phase Transition**: **\*\***\_**\*\***
- **Handoff Report**: [Link to report or N/A]

### Handoff Checklist

- [ ] All tests documented and passing
- [ ] Implementation complete per requirements
- [ ] Known issues documented
- [ ] Next steps clearly defined
- [ ] Resources and dependencies listed

## Screenshots/Videos

<!-- Add screenshots or videos for UI changes -->

## Related Issues

<!-- Link related issues using #issue-number -->

Closes #\_\_\_

## Additional Notes

<!-- Any additional information that reviewers should know -->

---

## Reviewer Checklist

<!-- For PR reviewers -->

- [ ] Tests were written first (verify commit history)
- [ ] Coverage meets requirements
- [ ] Code follows project patterns
- [ ] Performance budgets maintained
- [ ] Security considerations addressed
- [ ] Documentation is complete
- [ ] Breaking changes handled appropriately

---

<!--
This PR template enforces TDD practices and quality standards for the Okaeri Resort Management System.
Reference: docs/implementation/TDD_SINGLE_SOURCE_OF_TRUTH.md
-->
