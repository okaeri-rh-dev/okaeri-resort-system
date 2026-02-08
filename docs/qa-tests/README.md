# QA Manual Testing Suite

**Okaeri Resort Management System**
**Version**: 1.0
**Last Updated**: 2026-02-08

## Overview

This comprehensive QA testing suite provides manual test cases organized by user role. Each test file contains detailed test cases (10+ steps each) covering happy paths, edge cases, and error scenarios.

## Quick Start

### Prerequisites

1. **Development Environment**
   ```bash
   npm run dev  # Start local development server at http://localhost:5173
   ```

2. **Or Production URL**
   - Use the deployed application URL

3. **Browser Setup**
   - Open Browser DevTools (F12) with Console tab visible
   - Enable "Preserve log" to catch errors during navigation

### Test Credentials

See [`00-setup/test-credentials.md`](./00-setup/test-credentials.md) for login credentials.

| Role | Email | Password | Key Access |
|------|-------|----------|------------|
| Owner | `jasonacido+owner@gmail.com` | `12345678` | Full access, financial reports, system settings |
| Admin | `jasonacido+admin@gmail.com` | `12345678` | CRUD operations, payment verification, audit logs |
| Staff | `jasonacido+staff@gmail.com` | `12345678` | View-only access |
| Anonymous | N/A | N/A | Public pages only |

## Test Organization

```
docs/qa-tests/
├── README.md                                    # This file
├── 00-setup/                                    # Test environment setup
│   └── test-credentials.md                      # Test account reference
│
├── 01-anonymous/                                # Phase 1: Public/guest user tests
│   ├── public-booking.md                        # ANON-001: Guest booking flow
│   ├── check-booking-status.md                  # ANON-002: Booking status lookup
│   └── calendar-availability.md                 # ANON-003: Availability calendar
│
├── 02-staff/                                    # Phase 2: Staff role tests (view-only)
│   ├── login-authentication.md                  # STF-001: Staff login
│   ├── view-bookings.md                         # STF-002: View bookings (read-only)
│   ├── view-payments.md                         # STF-003: View payments (read-only)
│   ├── dashboard-readonly.md                    # STF-004: Dashboard access
│   └── edit-denied.md                           # STF-005: Permission denial tests
│
├── 03-admin/                                    # Phase 3: Admin role tests (full CRUD)
│   ├── bookings-crud.md                         # ADM-001: Booking management
│   ├── payments-verification.md                 # ADM-002: Payment verification
│   ├── units-management.md                      # ADM-003: Unit management
│   ├── pricing-configuration.md                 # ADM-004: Pricing setup
│   ├── role-management.md                       # ADM-005: User role assignment
│   └── audit-logs.md                            # ADM-006: Audit log access
│
├── 04-owner/                                    # Phase 4: Owner role tests
│   ├── full-system-access.md                    # OWN-001: Complete system access
│   ├── financial-reports.md                     # OWN-002: Revenue & profit reports
│   ├── expense-management.md                    # OWN-003: Expense CRUD
│   ├── system-settings.md                       # OWN-004: System configuration
│   ├── data-export.md                           # OWN-005: Export functionality
│   ├── accounts-management.md                   # OWN-006: Financial accounts CRUD
│   └── account-transfers.md                     # OWN-007: Inter-account transfers
│
├── 05-integration/                              # Phase 5: Cross-role & E2E tests
│   ├── complete-booking-lifecycle.md            # INT-001: Full booking flow
│   ├── role-permission-boundaries.md            # INT-002: Permission enforcement
│   ├── concurrent-booking-conflict.md           # INT-003: Race condition handling
│   ├── payment-booking-sync.md                  # INT-004: Payment-booking sync
│   ├── audit-trail-completeness.md              # INT-005: Audit logging verification
│   ├── account-balance-calculation.md           # INT-006: Financial balance accuracy
│   ├── guest-booking-approval-flow.md           # INT-007: Guest booking → approval E2E
│   ├── guest-booking-rejection-flow.md          # INT-008: Guest booking → rejection E2E
│   └── guest-booking-calendar-sync.md           # INT-009: Calendar sync verification
│
└── 06-integration/                              # Phase 6: Complex Multi-User Integration
    ├── calendar-sync.md                         # INT-CAL-001 to 003: Booking → Calendar sync
    ├── payment-booking-sync.md                  # INT-PAY-001 to 002: Payment → Booking status
    ├── financial-balance-sync.md                # INT-FIN-001 to 003: Transactions → Balances
    ├── audit-trail-complete.md                  # INT-AUDIT-001 to 003: Audit completeness
    ├── multi-user-sync.md                       # INT-MULTI-001 to 002: Cross-role sync
    └── guest-booking-flow.md                    # INT-GUEST-001 to 002: Guest E2E flows
```

## Test Inventory Summary

| Phase | Tests | Est. Time | Priority |
|-------|-------|-----------|----------|
| 01-Anonymous | 3 tests | 25 min | Critical |
| 02-Staff | 5 tests | 35 min | High |
| 03-Admin | 6 tests | 60 min | Critical |
| 04-Owner | 7 tests | 82 min | High |
| 05-Integration | 9 tests | 173 min | Critical |
| 06-Integration (Complex) | 15 tests | 120 min | Critical |
| **Total** | **45 tests** | **~8.3 hrs** | |

### 06-Integration: Complex Multi-User Tests

These advanced integration tests focus on cross-role data synchronization, real-time updates, and end-to-end workflows where actions by one user affect what another user sees.

| Test ID | Category | Description | Priority |
|---------|----------|-------------|----------|
| INT-CAL-001 | Calendar Sync | Booking confirmation reflects in anonymous calendar | Critical |
| INT-CAL-002 | Calendar Sync | Booking cancellation restores calendar availability | Critical |
| INT-CAL-003 | Calendar Sync | Date modification updates calendar | High |
| INT-PAY-001 | Payment Sync | Payment creates updates booking payment status | Critical |
| INT-PAY-002 | Payment Sync | Payment deletion reverts booking payment status | High |
| INT-FIN-001 | Financial Sync | Payment received updates account balance | Critical |
| INT-FIN-002 | Financial Sync | Expense deducts from account balance | Critical |
| INT-FIN-003 | Financial Sync | Transfer updates both account balances | Critical |
| INT-AUDIT-001 | Audit Trail | Booking status changes logged | High |
| INT-AUDIT-002 | Audit Trail | Financial operations logged | High |
| INT-AUDIT-003 | Audit Trail | Payment events with severity levels | Medium |
| INT-MULTI-001 | Multi-User | Staff sees Admin's booking changes | High |
| INT-MULTI-002 | Multi-User | Concurrent booking conflict detection | Critical |
| INT-GUEST-001 | Guest Flow | Guest booking → Admin queue → Calendar flow | Critical |
| INT-GUEST-002 | Guest Flow | Booking rejection flow | High |

### Two-Browser Approach for Integration Tests

Most 06-integration tests require simultaneous sessions to verify cross-role synchronization:

```
┌─────────────────────────────────────────────────────────────┐
│  Browser Session Setup for Integration Tests                │
├─────────────────────────────────────────────────────────────┤
│  Session A (Tab 1)        │  Session B (Tab 2/Incognito)    │
│  ─────────────────────    │  ────────────────────────────   │
│  • Admin/Owner role       │  • Anonymous/Staff role         │
│  • Performs actions       │  • Verifies data visibility     │
│  • Makes changes          │  • Checks sync/updates          │
└─────────────────────────────────────────────────────────────┘
```

**Setup Options:**
1. **Two Tabs (Same Browser)**: Works for most tests, uses different logins
2. **Tab + Incognito Window**: Better isolation for anonymous + authenticated tests
3. **Two Different Browsers**: Best isolation for concurrent conflict tests

### Execution Strategy for 06-Integration

Execute tests in dependency order for optimal data reuse:

| Order | Test IDs | Why This Order |
|-------|----------|----------------|
| 1 | INT-CAL-001 | Creates confirmed booking for subsequent tests |
| 2 | INT-CAL-002 | Uses booking from CAL-001, cancels it |
| 3 | INT-CAL-003 | Fresh booking with date modification |
| 4 | INT-PAY-001 | Creates payments, tests status progression |
| 5 | INT-PAY-002 | Uses payments from PAY-001, deletes them |
| 6 | INT-FIN-001 | Tests account balance after payment |
| 7 | INT-FIN-002 | Tests account balance after expense |
| 8 | INT-FIN-003 | Tests transfer between accounts |
| 9 | INT-AUDIT-001-003 | Run after other tests to verify audit trail |
| 10 | INT-MULTI-001 | Cross-role sync verification |
| 11 | INT-MULTI-002 | Concurrent conflict detection |
| 12 | INT-GUEST-001-002 | Full E2E guest flows |

## Permission Matrix

| Feature | Anonymous | Staff | Admin | Owner |
|---------|:---------:|:-----:|:-----:|:-----:|
| Public Booking | ✓ | - | - | - |
| View Dashboard | ✗ | ✓ (limited) | ✓ | ✓ (full) |
| View Bookings | ✗ | ✓ | ✓ | ✓ |
| Create/Edit Bookings | ✗ | ✗ | ✓ | ✓ |
| Delete Bookings | ✗ | ✗ | ✗ | ✓ |
| View Payments | ✗ | ✓ | ✓ | ✓ |
| Verify Payments | ✗ | ✗ | ✓ | ✓ |
| Manage Units | ✗ | ✗ | ✓ | ✓ |
| View Expenses | ✗ | ✗ | ✓ | ✓ |
| Manage Expenses | ✗ | ✗ | ✗ | ✓ |
| View Accounts | ✗ | ✗ | ✓ | ✓ |
| Manage Accounts | ✗ | ✗ | ✗ | ✓ |
| View Transfers | ✗ | ✗ | ✓ | ✓ |
| Create Transfers | ✗ | ✗ | ✗ | ✓ |
| View Audit Logs | ✗ | ✗ | ✓ (limited) | ✓ (full) |
| System Settings | ✗ | ✗ | ✗ | ✓ |
| User Role Management | ✗ | ✗ | ✓ | ✗ |
| Financial Reports | ✗ | ✗ | ✗ | ✓ |
| Data Export | ✗ | ✗ | ✓ (limited) | ✓ (full) |

## Route Reference

### Public Routes

| Route | Description |
|-------|-------------|
| `/` | Home - Availability calendar |
| `/booking` | Guest booking form |
| `/booking/confirmation/{ref}` | Booking confirmation page |
| `/booking/check-status` | Booking status lookup |
| `/login` | Login page |

### Admin Routes (Authentication Required)

| Route | Description | Minimum Role |
|-------|-------------|--------------|
| `/admin/dashboard` | Dashboard with analytics | Staff |
| `/admin/bookings` | Booking list & management | Staff (view) / Admin (edit) |
| `/admin/bookings/queue` | Pending bookings queue | Admin |
| `/admin/bookings/{id}/assign-units` | Unit assignment for booking | Admin |
| `/admin/verify-payment/{id}` | Payment verification page | Admin |
| `/admin/guests` | Guest list & management | Staff (view) / Admin (edit) |
| `/admin/payments` | Payment list & verification | Staff (view) / Admin (verify) |
| `/admin/expenses` | Expense tracking | Admin (view) / Owner (manage) |
| `/admin/accounts` | Financial accounts management | Admin (view) / Owner (manage) |
| `/admin/transfers` | Inter-account transfers | Admin (view) / Owner (create) |
| `/admin/units` | Unit management | Staff (view) / Admin (manage) |
| `/admin/audit-logs` | Audit trail viewer | Admin |
| `/admin/roles` | Role management | Admin only |
| `/admin/settings` | System configuration | Owner only |

## Execution Order Recommendation

For comprehensive testing, follow this order:

### Quick Smoke Test (~15 min)
1. Public booking form loads and submits
2. Login works for all roles
3. Dashboard displays correctly
4. One CRUD operation works
5. Logout functions properly

### Full Test Execution (~8.3 hrs)

| Order | Phase | Focus |
|-------|-------|-------|
| 1 | 01-Anonymous | Public features without login |
| 2 | 02-Staff | View-only permissions enforced |
| 3 | 03-Admin | CRUD operations work correctly |
| 4 | 04-Owner | Full access and financial features |
| 5 | 05-Integration | Cross-role workflows and data sync |
| 6 | 06-Integration | Complex multi-user synchronization |

## Test Result Tracking

### Result Format

Each test case includes tracking fields:

```markdown
| Action | Expected Result | Pass/Fail |
|--------|-----------------|-----------|
| Click submit | Success message | [ ] |

**Notes:**
Test Date: _______________
Tester: _______________
Issues Found: _______________
```

### Issue Reporting

When a test fails:

1. **Document in the test file** under "Notes"
2. **Include**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Console errors (if any)
   - Screenshot (if captured)
3. **Create GitHub issue** with label `bug` and reference the test ID

### Test Execution Log Template

| Date | Tester | Environment | Phases Tested | Pass Rate | Critical Issues |
|------|--------|-------------|---------------|-----------|-----------------|
| 2026-01-30 | [Name] | Local | 01-05 | 22/24 (92%) | 2 issues filed |

## Test Data Requirements

### Minimum Test Data

Before running tests, ensure:

- [ ] At least 2 active units exist
- [ ] At least 3 bookings exist (various statuses: Pending, Confirmed, Completed)
- [ ] At least 2 guest records exist
- [ ] At least 1 payment record exists (verified)
- [ ] At least 1 payment record exists (pending)
- [ ] At least 1 expense record exists
- [ ] At least 3 financial accounts exist (Bank, E-Wallet, Cash types)
- [ ] At least 1 account transfer exists

### Additional Requirements for 06-Integration Tests

Before running complex integration tests, also ensure:

- [ ] At least 1 Pending booking available for confirmation testing
- [ ] Unit with available dates in future (e.g., Feb/Mar 2026) for calendar sync tests
- [ ] Cash account with positive balance for expense/transfer tests
- [ ] GCash/Bank account available as transfer destination
- [ ] Payment proof image ready for guest booking tests
- [ ] Test email access for notification verification (optional)

### Test Data Cleanup

After testing:
- Delete test bookings created with "Test" or "E2E" in guest name
- Reset any modified settings to original values
- Remove test units created during testing

## Mobile Viewport Reference

When testing mobile responsiveness, use Browser DevTools:

| Device | Width | Height |
|--------|-------|--------|
| Mobile (iPhone SE) | 375px | 667px |
| Mobile (iPhone 12) | 390px | 844px |
| Tablet (iPad) | 768px | 1024px |
| Desktop | 1280px | 720px |

**DevTools Steps:**
1. Open DevTools (F12)
2. Click device toggle toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select device or enter custom dimensions

## Contributing

When adding new tests:

1. Follow the test case template format
2. Use sequential test IDs within each phase
3. Include at least 10 detailed steps
4. Document preconditions clearly
5. Include expected results for each step
6. Update this README if adding new test files
