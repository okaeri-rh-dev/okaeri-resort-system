---
⚠️ **REFERENCE ONLY - Not Used in Current Implementation**

The Okaeri Resort System uses **application-level filtering** with `project_id` columns.
Database queries filter data at the service layer, not through RLS policies.

**See:** `/docs/implementation/SIMPLE_DATABASE_GUIDE.md` for the authoritative approach.

**Why archived:** This document describes Row-Level Security patterns that were 
considered but not implemented. The system uses simpler application-level filtering
that's easier to maintain and debug for a small family business.

---

# Archived: Advanced RLS Implementation

## Why These Files Were Archived

Date: 2025-08-29
Decision: Use Simple Application-Level Filtering for Internal App

### Context

These files were archived because the Okaeri Resort System is an **internal application** managing 1-3 resort properties. After careful analysis, we determined that Row-Level Security (RLS) adds unnecessary complexity for this use case.

### Archived Files

#### Migrations
- `004_rls_optimization.sql` - RLS policies and optimization
- `005_add_rls_policies.sql` - Additional RLS security policies

#### Documentation
- `RLS_MULTI_TENANT.md` - Multi-tenant RLS patterns
- `SET_LOCAL_PATTERNS.md` - PostgreSQL SET LOCAL context patterns

### Current Approach

The system now uses **Simple Application-Level Filtering**:
- All tables have a `project_id` column
- Queries filter by `project_id` at the application layer
- Security is enforced through service-layer validation
- No database-level RLS policies

### When to Consider RLS

These archived files should be reconsidered when:
- Managing 10+ resort properties
- External audit requirements demand database-level isolation
- Multiple external applications access the database
- Regulatory compliance requires proven data isolation

### Migration Path

If RLS becomes necessary in the future:
1. Review these archived migrations
2. Update for current schema
3. Test thoroughly in staging
4. Implement gradually with fallback plan
5. Update all service layer code to use RLS context

### Security Note

The current simple filtering approach is **secure for internal use** when:
- All queries use the secure base service pattern
- Project ID validation is enforced
- Regular security audits are performed
- Access is limited to trusted internal users

For questions about this decision, see `/docs/implementation/SIMPLE_DATABASE_GUIDE.md`