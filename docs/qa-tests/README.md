# QA Manual Testing Suite

**Okaeri Resort Management System**
**Version**: 1.0
**Last Updated**: 2026-01-30

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

| Role | Email | Key Access |
|------|-------|------------|
| Owner | `owner@okaeri.ph` | Full access, financial reports, system settings |
| Admin | `admin@okaeri.ph` | CRUD operations, payment verification, audit logs |
| Staff | `staff@okaeri.ph` | View-only access |
| Anonymous | N/A | Public pages only |

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
└── 05-integration/                              # Phase 5: Cross-role & E2E tests
    ├── complete-booking-lifecycle.md            # INT-001: Full booking flow
    ├── role-permission-boundaries.md            # INT-002: Permission enforcement
    ├── concurrent-booking-conflict.md           # INT-003: Race condition handling
    ├── payment-booking-sync.md                  # INT-004: Payment-booking sync
    ├── audit-trail-completeness.md              # INT-005: Audit logging verification
    └── account-balance-calculation.md           # INT-006: Financial balance accuracy
```

## Test Inventory Summary

| Phase | Tests | Est. Time | Priority |
|-------|-------|-----------|----------|
| 01-Anonymous | 3 tests | 25 min | Critical |
| 02-Staff | 5 tests | 35 min | High |
| 03-Admin | 6 tests | 60 min | Critical |
| 04-Owner | 7 tests | 82 min | High |
| 05-Integration | 6 tests | 115 min | Critical |
| **Total** | **27 tests** | **~5.3 hrs** | |

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

### Full Test Execution (~4.5 hrs)

| Order | Phase | Focus |
|-------|-------|-------|
| 1 | 01-Anonymous | Public features without login |
| 2 | 02-Staff | View-only permissions enforced |
| 3 | 03-Admin | CRUD operations work correctly |
| 4 | 04-Owner | Full access and financial features |
| 5 | 05-Integration | Cross-role workflows and data sync |

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
