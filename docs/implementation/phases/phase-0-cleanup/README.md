# Phase 0: Foundation & Cleanup

## Phase Overview

Phase 0 establishes the foundation for TDD-first development by cleaning the repository, preserving valuable infrastructure, and setting up the testing environment. This phase ensures a clean slate for UI development while maintaining all valuable backend infrastructure.

## Phase Objectives

1. **Repository Cleanup** - Remove incomplete implementations while preserving infrastructure
2. **Archive Creation** - Document and archive previous implementation attempt
3. **Test Infrastructure** - Set up comprehensive testing utilities and templates
4. **Mock API Setup** - Create robust mock service layer for development
5. **Agent Protocols** - Establish clear handoff and verification procedures

## Lead Agent

**Primary**: `context-manager`
**Support**: `security-compliance-auditor`, `typescript-react-quality-expert`

## Timeline

**Duration**: 2 days (Week 1, Monday-Tuesday)
**Status**: 🔧 Ready for TDD - Mock Services Fixed

## Deliverables

### 1. Repository Assessment

**Status**: ✅ Complete

- Identified infrastructure to preserve
- Listed components to rewrite
- Created archive structure
- Documented dependencies

### 2. Archive Creation

**Status**: ✅ Complete

**Location**: `/docs/archive-2025-08-25-initial/`

Archived:
- Root-level documentation (11 files)
- Implementation plans and phases
- Security audits and reports
- Technical debt documentation

### 3. Test Infrastructure Setup

**Status**: ✅ Core Infrastructure Ready

**Existing Locations**: 
- `/src/test/` - Factories, helpers, config
- `/tests/utils/` - Test utilities

**Completed**:
- ✅ Mock data factories (`/src/test/factories/`)
- ✅ Test helpers (`/src/test/helpers.tsx`)
- ✅ Deterministic mock config (`/src/test/config/mock-service-config.ts`)
- ✅ Coverage configuration

**Still Needed** (for TDD specs):
- Custom assertion helpers
- Complete test wrapper integration

### 4. Mock API Architecture

**Status**: ✅ Complete

**Documentation**: [Mock API Architecture](../../Mock_API_Architecture.md)

Includes:
- Service interfaces
- Mock implementations
- Error simulation
- Migration strategy

### 5. Agent Handoff Protocols

**Status**: ✅ Complete

**Documentation**: [Verification Protocol](../../Verification_Protocol.md)

Established:
- Quality gates
- Handoff templates
- Iteration procedures
- Sign-off requirements

## Verification Checklist

### Pre-Cleanup
- [x] Previous implementation documented
- [x] Infrastructure inventory complete
- [x] Archive structure created
- [x] Team notified of changes

### Cleanup Execution
- [x] Documentation moved to archive
- [ ] Incomplete UI components removed
- [x] Test structure created
- [x] Mock services configured with deterministic behavior

### Post-Cleanup
- [x] New documentation created
- [x] Agent assignments confirmed
- [x] Development environment verified (Node.js compatible)
- [x] CI/CD pipeline updated (workflows exist)

## Infrastructure Preserved

### Keep (Valuable Infrastructure)

```
/src/lib/
├── api-client.ts         # API client with retry logic
├── security/             # Security features
│   ├── csrf-protection.ts       # ⚠️ JWT doesn't need CSRF - consider archiving
│   ├── session-monitor.ts
│   ├── rate-limiter.ts
│   └── audit-logger.ts
├── db/                   # Database utilities
│   ├── schema/
│   └── migrate.ts
└── validations/          # Validation schemas

/src/stores/
├── authStore.ts          # Authentication state
├── bookingStore.ts       # Booking management
├── projectStore.ts       # Multi-tenant support
└── uiStore.ts           # UI state management

/src/types/              # All TypeScript definitions
/src/mocks/              # Mock services
/api/                    # API route templates
/migrations/             # Database migrations
```

### Remove (To Be Rewritten with TDD)

```
/src/pages/              # All page components
/src/components/         # UI components (except /ui)
/src/routes/             # Route implementations
/src/layouts/            # Layout components
```

## Test Infrastructure Requirements

### Test Utilities Needed

```typescript
// tests/utils/test-wrapper.tsx
export function TestWrapper({ children }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <RouterProvider router={testRouter}>
        {children}
      </RouterProvider>
    </QueryClientProvider>
  )
}

// tests/utils/mock-factories.ts
export const factories = {
  user: () => ({ /* mock user */ }),
  booking: () => ({ /* mock booking */ }),
  expense: () => ({ /* mock expense */ })
}

// tests/utils/assertions.ts
export const customMatchers = {
  toBeAccessible: () => ({ /* a11y assertion */ }),
  toHaveValidation: () => ({ /* form validation */ })
}
```

## Mock Service Configuration

**Status**: ✅ Deterministic Configuration Implemented (2025-08-29)

### Recent Fixes
- Fixed `auth.mock.service.ts` to use seeded RNG instead of Math.random()
- Fixed `booking.mock.service.ts` for deterministic delays
- Added Node.js compatible base64 utilities
- Service registry now passes config to mock services

### Services to Mock

1. **Authentication Service**
   - Login/logout
   - Token refresh
   - Session management

2. **Booking Service**
   - CRUD operations
   - Availability checking
   - Calendar integration

3. **Financial Service**
   - Expense tracking
   - Income management
   - Report generation

4. **Property Service**
   - Property management
   - Availability rules
   - Pricing configuration

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing features | High | Comprehensive testing before removal |
| Lost documentation | Medium | Complete archive created |
| Developer confusion | Medium | Clear communication and documentation |
| CI/CD disruption | Low | Pipeline updates planned |

## Success Criteria

- [x] All valuable infrastructure preserved
- [x] Previous implementation archived
- [x] Documentation reorganized
- [x] Test environment functional (deterministic mocks ready)
- [x] Mock APIs operational (auth & booking services fixed)
- [x] All agents briefed on protocols

## Handoff to Phase 1

### Handoff Report

**From**: `context-manager`
**To**: `typescript-react-quality-expert`
**Date**: December 2024

**Completed**:
- Repository cleaned and organized
- Infrastructure preserved
- Documentation created
- Mock architecture designed

**Next Steps**:
- Write comprehensive login tests
- Implement login with TDD
- Set up form validation
- Create authentication flows

**Resources**:
- Test utilities: `/src/test/` and `/tests/utils/`
- Mock services: `/src/services/mock/` (deterministic, configurable)
- Mock config: `/src/test/config/mock-service-config.ts`
- Auth store: `/src/stores/authStore.ts`
- Service registry: `/src/services/registry.ts`
- Documentation: This folder

## Notes

This phase establishes the foundation for all subsequent TDD development. The clean repository structure and comprehensive documentation ensure that all agents can work efficiently with clear guidelines and quality standards.

The preserved infrastructure provides a solid foundation while the removed components create space for proper TDD implementation. This approach balances the need for quality with the reality of existing valuable code.

---

*Phase 0 Foundation Ready - Mock Services Deterministic, UI Cleanup Pending*
