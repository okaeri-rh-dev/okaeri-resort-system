# Multi-Unit Booking Implementation Plan

## Overview

This directory contains the complete implementation plan for transforming the Okaeri Resort System from single-unit bookings to multi-unit bookings. This is a **major architectural change** that affects every layer of the application.

## Current State vs. Target State

### Current State (Single-Unit Bookings)
- **Database**: `bookings.unit_id` → direct foreign key to `units` table (1:1 relationship)
- **UI**: User selects ONE unit per booking
- **Payment**: ONE payment per booking/unit
- **State**: Simple booking object with single `unit_id`

### Target State (Multi-Unit Bookings)
- **Database**: Junction table `booking_units` enabling 1:N relationship
- **UI**: User can select MULTIPLE units in a single booking
- **Payment**: UNIFIED payment for all units (solves the "2 separate payments" problem)
- **State**: Complex booking object with array of units, individual pricing, guest assignments

## Business Problem Solved

**User Story**: "As a guest booking accommodation for a family reunion, I want to book 2 cabins in a single transaction so I don't have to make 2 separate payments and manage 2 separate bookings."

**Benefits**:
- ✅ Unified payment processing (reduces transaction fees)
- ✅ Single booking reference for multiple units
- ✅ Better group booking experience
- ✅ Bulk discount opportunities
- ✅ Simplified booking management

## Documentation Structure

```
docs/multi-unit-booking/
├── README.md (this file)
├── 00-MASTER-PLAN.md                  # Executive summary, timeline, risks
├── 01-database-foundation.md          # Phase 1: Database schema changes
├── 02-backend-api.md                  # Phase 2: API endpoints and logic
├── 03-state-management.md             # Phase 3: Zustand stores & TanStack Query
├── 04-ui-components.md                # Phase 4: React components & UX
├── 05-integration-testing.md          # Phase 5: E2E testing & validation
├── 06-migration-rollout.md            # Phase 6: Feature flags & deployment
├── AGENT-ASSIGNMENTS.md               # Agent responsibilities matrix
├── architecture/
│   ├── database-schema.md             # Detailed database design
│   ├── api-endpoints.md               # API contract specifications
│   ├── state-flow.md                  # State management architecture
│   └── ui-wireframes.md               # UI/UX design specifications
└── implementation-guides/
    ├── backwards-compatibility.md     # Maintaining existing functionality
    ├── testing-strategy.md            # Comprehensive testing approach
    ├── performance-considerations.md  # Performance optimization guide
    └── rollback-procedures.md         # Emergency rollback plans
```

## Implementation Timeline

| Phase | Duration | Agent Lead | Status |
|-------|----------|------------|--------|
| Phase 1: Database Foundation | Week 1 | `postgres-serverless-architect` | ⏳ Not Started |
| Phase 2: Backend API | Week 2 | `cloudflare-resort-api-architect` | ⏳ Not Started |
| Phase 3: State Management | Week 3 | `zustand-tanstack-resort-architect` | ⏳ Not Started |
| Phase 4: UI Components | Week 4-5 | `resort-ui-designer` | ⏳ Not Started |
| Phase 5: Integration & Testing | Week 6 | `code-quality-reviewer` | ⏳ Not Started |
| Phase 6: Migration & Rollout | Week 7 | `cloudflare-deployment-optimizer` | ⏳ Not Started |

**Total Estimated Duration**: 7 weeks (35 working days)

## Quick Start Guide

### For Developers

1. **Read this first**: `00-MASTER-PLAN.md` for high-level overview
2. **Understand the architecture**: Review files in `architecture/` directory
3. **Check your phase**: Read the relevant phase document (01-06)
4. **Identify your role**: Check `AGENT-ASSIGNMENTS.md` for your responsibilities
5. **Follow implementation guides**: Use guides in `implementation-guides/`

### For Project Managers

1. **Timeline**: See Phase breakdown above
2. **Risks**: Review `00-MASTER-PLAN.md` Section: Risk Analysis
3. **Dependencies**: Each phase document lists dependencies
4. **Progress Tracking**: Update status column in timeline table

### For Stakeholders

1. **Business Value**: See "Business Problem Solved" section above
2. **Success Metrics**: Defined in `00-MASTER-PLAN.md`
3. **User Impact**: Reviewed in `06-migration-rollout.md`

## Critical Success Factors

1. ✅ **Backwards Compatibility**: Existing single-unit bookings MUST continue to work
2. ✅ **Data Integrity**: No booking/payment corruption during migration
3. ✅ **Performance**: No degradation vs. current single-unit performance
4. ✅ **User Experience**: Intuitive multi-unit selection interface
5. ✅ **Testing Coverage**: Comprehensive E2E and unit tests before rollout

## Architecture Principles

### Database Layer
- **Junction Table Pattern**: `booking_units` bridges bookings ↔ units
- **Denormalization**: `booking_unit_availability` for fast queries
- **Backwards Compatibility**: Maintain `bookings.unit_id` for legacy support
- **Data Integrity**: Exclusion constraints, triggers, transactions

### API Layer
- **Batch Operations**: Minimize database round-trips
- **Atomic Transactions**: All-or-nothing multi-unit creation
- **Versioning**: New endpoints with v2 prefix where needed
- **Compatibility Layer**: Adapters for old API consumers

### State Management
- **Optimistic Updates**: Immediate UI feedback
- **Conflict Resolution**: Handle concurrent edits gracefully
- **Offline Support**: Queue operations when offline
- **Real-time Sync**: Supabase subscriptions for live updates

### UI/UX
- **Progressive Enhancement**: Start simple, add complexity gradually
- **Mobile-First**: Touch-friendly multi-unit selection
- **Accessibility**: WCAG 2.1 AA compliance
- **Error Handling**: Clear feedback for unavailable units

## Key Technologies

- **Database**: PostgreSQL (Neon Serverless) with btree_gist extension
- **Backend**: Supabase Edge Functions, Cloudflare Workers
- **State**: Zustand + TanStack Query v5 + Immer
- **UI**: React 19, shadcn/ui, Tailwind CSS v4
- **Forms**: React Hook Form + Zod validation
- **Routing**: TanStack Router v1
- **Testing**: Vitest, Playwright, React Testing Library

## Related Documentation

- [Original Feature Request](../../FEATURE-REQUESTS.md#multi-unit-bookings) (if exists)
- [Database Schema](../../database/schema.sql)
- [Current Booking Flow](../booking-flow.md)
- [Architecture Decision Records](../adr/)

## Getting Help

- **Technical Questions**: Check phase-specific documentation
- **Agent Assignment Clarification**: See `AGENT-ASSIGNMENTS.md`
- **Architecture Decisions**: Review `architecture/` directory
- **Implementation Blockers**: Escalate to phase lead agent

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-XX | System Architect | Initial implementation plan |

---

**Next Steps**:
1. Review `00-MASTER-PLAN.md` for executive summary
2. Check `AGENT-ASSIGNMENTS.md` for your role
3. Begin Phase 1 planning with `postgres-serverless-architect`
