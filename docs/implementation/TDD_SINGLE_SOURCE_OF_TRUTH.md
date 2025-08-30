# TDD Single Source of Truth

> **Status**: Authoritative Source - All Other Documents Must Reference This  
> **Last Updated**: August 2025  
> **Owner**: typescript-react-quality-expert agent

---

## Overview

This document is the **ONLY** authoritative source for all TDD-related
decisions, metrics, and standards for the Okaeri Resort Management System. All
other documentation must reference this document for testing standards to ensure
consistency.

---

## 1. Test Coverage Standards

### Global Coverage Requirements

| Category              | Minimum Coverage    | Notes                              |
| --------------------- | ------------------- | ---------------------------------- |
| **Unit Tests**        | 90%                 | All components, stores, utilities  |
| **Integration Tests** | 85%                 | User flows and API interactions    |
| **E2E Tests**         | Critical paths only | Login, booking, payment flows      |
| **Overall Project**   | 90%                 | Combined coverage across all tests |

### Critical Path Coverage (95% Required)

The following areas require **95% minimum coverage** due to their critical
nature:

| Area                       | Justification       | Test Categories             |
| -------------------------- | ------------------- | --------------------------- |
| **Authentication**         | Security critical   | Unit, Integration, Security |
| **Financial Calculations** | Business critical   | Unit, Integration, E2E      |
| **Payment Processing**     | Revenue critical    | Unit, Integration, Security |
| **Booking Management**     | Core business logic | Unit, Integration, E2E      |
| **Data Validation**        | Data integrity      | Unit, Integration           |

### Phase-Specific Coverage

| Phase                   | Unit | Integration | E2E  | Security | Notes             |
| ----------------------- | ---- | ----------- | ---- | -------- | ----------------- |
| **Phase 1: Login**      | 95%  | 90%         | 100% | 100%     | Auth is critical  |
| **Phase 2: Dashboard**  | 90%  | 85%         | 80%  | 85%      | Standard coverage |
| **Phase 3: Booking**    | 95%  | 90%         | 100% | 90%      | Core business     |
| **Phase 4: Financial**  | 95%  | 90%         | 100% | 95%      | Money critical    |
| **Phase 5: Deployment** | 90%  | 85%         | 100% | 100%     | Production ready  |

---

## 2. Quality Gates

### RED Phase Entry Criteria

- [ ] Test specifications documented
- [ ] Test skeletons created (compile but fail)
- [ ] Mock data prepared
- [ ] Test utilities available
- [ ] Agent assigned

### RED Phase Exit Criteria

- [ ] All test files compile
- [ ] All tests fail with clear messages
- [ ] Coverage targets achievable
- [ ] No implementation code exists

### GREEN Phase Entry Criteria

- [ ] RED phase complete
- [ ] Implementation approach documented
- [ ] Performance budgets confirmed
- [ ] Security requirements clear

### GREEN Phase Exit Criteria

- [ ] All tests pass
- [ ] Coverage targets met
- [ ] No lint errors
- [ ] Type checking passes
- [ ] Performance budgets met

### REFACTOR Phase Entry Criteria

- [ ] GREEN phase complete
- [ ] Code review completed
- [ ] Refactoring opportunities identified
- [ ] Performance baseline established

### REFACTOR Phase Exit Criteria

- [ ] Tests still pass
- [ ] Coverage maintained or improved
- [ ] Performance improved or maintained
- [ ] Code quality metrics improved
- [ ] Documentation updated

---

## 3. Testing Categories

### Unit Tests

**Purpose**: Test individual components, functions, stores in isolation

**Requirements**:

- Fast execution (<100ms per test)
- No external dependencies
- Deterministic results
- Clear test names
- Single responsibility

**Tools**: Vitest, React Testing Library, MSW

### Integration Tests

**Purpose**: Test component interactions, API calls, state management

**Requirements**:

- Test user flows
- Mock external services
- Test error scenarios
- Validate data flow
- <500ms per test

**Tools**: Vitest, React Testing Library, MSW, Testing Utilities

### E2E Tests

**Purpose**: Test complete user journeys

**Requirements**:

- Critical paths only
- Real browser environment
- Production-like data
- Performance validation
- <30s per test

**Tools**: Playwright, Lighthouse CI

### Security Tests

**Purpose**: Validate security controls

**Requirements**:

- Authentication flows
- Authorization checks
- Input validation
- XSS prevention
- CSRF protection (where applicable)

**Tools**: Custom security test utilities, OWASP ZAP (optional)

### Accessibility Tests

**Purpose**: Ensure WCAG 2.1 AA compliance

**Requirements**:

- Automated axe checks
- Keyboard navigation
- Screen reader testing
- Color contrast validation
- Focus management

**Tools**: axe-core, Pa11y, Manual testing

### Performance Tests

**Purpose**: Validate performance budgets

**Requirements**:

- Bundle size limits
- Load time targets
- Runtime performance
- Memory usage
- Network efficiency

**Tools**: Lighthouse CI, Bundlesize, Custom metrics

---

## 4. Phase Status Tracking

### Single Source of Truth

**MASTER_VERIFICATION_INDEX.md** is the **ONLY** source for phase status
tracking.

All other documents must reference:
`[Status tracked in Master Verification Index](./phases/MASTER_VERIFICATION_INDEX.md)`

### Status States

| State           | Description   | Next Action           |
| --------------- | ------------- | --------------------- |
| **⏳ Pending**  | Not started   | Begin RED phase       |
| **🔴 RED**      | Writing tests | Complete test suite   |
| **🟢 GREEN**    | Implementing  | Pass all tests        |
| **🔵 REFACTOR** | Optimizing    | Improve quality       |
| **✅ Complete** | Done          | Handoff to next phase |
| **⚠️ Blocked**  | Issue found   | Resolve blocker       |

---

## 5. Mock Service Readiness

### Service Maturity Levels

| Level              | Description     | Capabilities                    |
| ------------------ | --------------- | ------------------------------- |
| **L1: Basic**      | CRUD operations | Create, Read, Update, Delete    |
| **L2: Advanced**   | Business logic  | Validation, calculations, rules |
| **L3: Production** | Full simulation | Errors, delays, edge cases      |

### Phase Requirements

| Phase       | Required Services       | Maturity Level |
| ----------- | ----------------------- | -------------- |
| **Phase 1** | Auth                    | L3             |
| **Phase 2** | Auth, Property, Metrics | L2, L1, L1     |
| **Phase 3** | Booking, Payment        | L3, L2         |
| **Phase 4** | Financial, Reports      | L3, L2         |
| **Phase 5** | All services            | L3             |

---

## 6. Deterministic Testing Standards

### Default Configuration

```typescript
// Always applied in test environment
const TEST_CONFIG = {
  scenario: "STABLE",
  seed: "test-seed-2024",
  timestamp: "2024-01-01T00:00:00Z",
  timezone: "Asia/Manila",
  locale: "en-PH",
  currency: "PHP",
};
```

### Environment Variables

| Variable        | Test Value     | Purpose                 |
| --------------- | -------------- | ----------------------- |
| `NODE_ENV`      | test           | Enable test mode        |
| `TEST_SCENARIO` | STABLE         | Deterministic responses |
| `MOCK_DELAY`    | 0              | No artificial delays    |
| `RANDOM_SEED`   | test-seed-2024 | Predictable random      |
| `FIXED_TIME`    | 2024-01-01     | Consistent timestamps   |

### Mock Data Standards

- User IDs: Sequential from 1000
- Booking IDs: Sequential from 2000
- Transaction IDs: Sequential from 3000
- Timestamps: Fixed to TEST_CONFIG.timestamp
- Random values: Seeded with TEST_CONFIG.seed

---

## 7. TDD Enforcement Rules

### Pre-commit Requirements

1. **Test file exists** for modified source files
2. **Tests pass** for modified files
3. **Coverage maintained** (no regression)
4. **Lint passes** (ESLint, Prettier)
5. **Type check passes** (TypeScript strict)

### CI/CD Gates

| Check         | Threshold                  | Action on Failure |
| ------------- | -------------------------- | ----------------- |
| Unit Tests    | Pass 100%                  | Block merge       |
| Coverage      | 90% minimum                | Block merge       |
| Lint          | No errors                  | Block merge       |
| Type Check    | No errors                  | Block merge       |
| Bundle Size   | Per Performance_Budgets.md | Block merge       |
| Security Scan | No high/critical           | Block merge       |
| Lighthouse    | ≥90 score                  | Warning only      |

### PR Template Requirements

Required sections:

- [ ] TDD Phase (RED/GREEN/REFACTOR)
- [ ] Tests Written First (Yes/No)
- [ ] Coverage Report
- [ ] Performance Impact
- [ ] Security Considerations
- [ ] Breaking Changes
- [ ] Agent Handoff (if applicable)

### Code Review Checklist

Reviewers must verify:

- [ ] Tests exist and are comprehensive
- [ ] Tests were written first (check commit history)
- [ ] Coverage meets requirements
- [ ] Tests are deterministic
- [ ] Error scenarios covered
- [ ] Documentation updated

---

## 8. Standards References

### Performance Standards

All performance metrics reference:
**[Performance_Budgets.md](./Performance_Budgets.md)**

Key metrics:

- Bundle sizes
- Load times
- Core Web Vitals
- Lighthouse scores

### Security Standards

Security requirements reference:
**[SECURITY_TEST_REQUIREMENTS.md](../security/SECURITY_TEST_REQUIREMENTS.md)**

Key areas:

- Authentication
- Authorization
- Input validation
- Data protection

### Accessibility Standards

Accessibility requirements: **WCAG 2.1 Level AA**

Key requirements:

- Keyboard navigable
- Screen reader compatible
- Sufficient color contrast
- Focus indicators

---

## 9. Conflict Resolution

### Previously Conflicting Standards (Now Resolved)

| Conflict         | Previous Values        | Resolution                 | Authority                    |
| ---------------- | ---------------------- | -------------------------- | ---------------------------- |
| Coverage Target  | 90% vs 95%             | 90% global, 95% critical   | This document                |
| Bundle Size      | 50KB vs 120KB vs 200KB | Per Performance_Budgets.md | Performance_Budgets.md       |
| Lighthouse Score | 90 vs 95               | ≥90 production             | Performance_Budgets.md       |
| Phase Status     | Multiple sources       | Single source              | MASTER_VERIFICATION_INDEX.md |
| Mock Services    | Unclear requirements   | L1-L3 maturity levels      | This document                |

---

## 10. Change Management

### Update Process

1. Changes to this document require:
   - Technical Design Review
   - Impact Assessment
   - Agent Consensus
   - Documentation Update PR

2. Notification required to:
   - All active agents
   - CI/CD configuration owners
   - Team leads

### Version History

| Version | Date       | Changes                        | Author                          |
| ------- | ---------- | ------------------------------ | ------------------------------- |
| 1.0.0   | 2025-08-29 | Initial consolidated standards | typescript-react-quality-expert |

---

## 11. Enforcement and Monitoring

### Automated Enforcement

- **Pre-commit hooks**: Validate before commit
- **CI/CD pipeline**: Enforce on every push
- **PR checks**: Block non-compliant merges
- **Monitoring**: Track metrics over time

### Manual Enforcement

- **Code reviews**: Human verification
- **Pair programming**: Real-time compliance
- **Team ceremonies**: Regular reviews
- **Retrospectives**: Process improvement

### Compliance Tracking

Weekly metrics:

- Test coverage trends
- TDD compliance rate
- Quality gate pass rate
- Violation frequency
- Time to resolution

---

## 12. Success Metrics

### Quality Indicators

- Coverage consistently >90%
- Defect rate <1 per 1000 LOC
- Test execution time <5 minutes
- Build success rate >95%

### Process Indicators

- Tests written first >95% of time
- PR first-time pass rate >80%
- Coverage regression incidents <1/month
- TDD adoption rate 100%

### Business Indicators

- Production incidents reduced 50%
- Development velocity stable/improved
- Technical debt reduced
- Maintenance cost reduced

---

## Summary

This document establishes the authoritative standards for TDD implementation in
the Okaeri Resort Management System. All team members, automated tools, and
processes must comply with these standards. Regular reviews ensure continuous
improvement while maintaining consistency and quality.
