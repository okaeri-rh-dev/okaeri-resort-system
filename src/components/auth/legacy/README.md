# Legacy Auth Components

These components are the original Phase 0 authentication implementations that have been superseded by the Phase 1.2 GREEN implementations located in `src/features/auth/`.

## Status: DEPRECATED

**DO NOT USE THESE COMPONENTS IN NEW CODE**

## Current Auth Components Location

The active authentication components are now located at:
- `src/features/auth/components/LoginForm.tsx`
- `src/features/auth/components/RegisterForm.tsx`
- `src/features/auth/components/PasswordResetForm.tsx`

## Why These Are Preserved

These legacy components are kept for reference purposes only:
- Historical context for the migration from Phase 0 to Phase 1
- Reference implementation patterns
- Potential reuse of specific logic in future refactoring

## Migration Notes

All new features and bug fixes should be applied to the components in `src/features/auth/`, not these legacy versions.

These legacy components still contain hardcoded paths like `/login` and `/dashboard` which are incorrect for the current routing structure (`/_auth/*` and `/_protected/*`).