# Phase 1 Route Scope Documentation

## Overview

Phase 1 maintains a minimal, focused route surface area appropriate for
authentication and basic protected access. This document confirms the approved
route boundaries for Phase 1.2 GREEN.

## Approved Phase 1 Routes

### Authentication Routes (`/_auth/*`)

- `/_auth/login` - User sign-in with JWT authentication
- `/_auth/register` - User registration with project creation
- `/_auth/forgot-password` - Password reset request
- `/_auth/reset-password` - Password reset completion

**Justification:** Core authentication flow required for any user access.

### Protected Routes (`/_protected/*`)

- `/_protected/dashboard` - Basic dashboard showing authenticated state

**Justification:** Single protected route demonstrates auth guards work. No
business features implemented yet.

### Legal & Utility Routes

- `/terms` - Terms of Service (required for registration)
- `/privacy` - Privacy Policy (required for registration)
- `/unauthorized` - Error page for insufficient permissions
- `/offline` - PWA offline fallback page

**Justification:** Essential supporting routes for legal compliance and user
experience.

### System Routes

- `/` - Root index with auth-based redirects
- `/$` - 404 catch-all route

**Justification:** Basic navigation and error handling.

### Layout Routes

- `/_auth` - Authentication pages layout
- `/_protected` - Protected pages layout

**Justification:** Shared layouts for route groups.

## What's Excluded (Future Phases)

**No business feature routes in Phase 1:**

- No booking management routes
- No property management routes
- No expense tracking routes
- No reporting routes
- No team management routes
- No settings/admin routes

## Route Count Summary

- **Total Routes:** 13
- **Auth Routes:** 4
- **Protected Routes:** 1 (dashboard only)
- **Utility Routes:** 4
- **Layout Routes:** 2
- **System Routes:** 2

## Verification

This minimal scope ensures Phase 1 focuses solely on:

1. User authentication and registration
2. Route protection demonstration
3. Legal compliance
4. Basic user experience

No feature creep or premature business logic implementation.

---

**Status:** ✅ Phase 1 route scope is minimal and appropriate  
**Last Updated:** 2025-09-02  
**Next Review:** Phase 2 planning
