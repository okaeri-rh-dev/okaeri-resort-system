# 🛠️ Core Libraries & Utilities

## Overview

The `/src/lib/` directory contains the core infrastructure and utilities that power the Okaeri Resort System. These modules provide essential services including database access, authentication, availability calculations, and security functions.

## 📁 Directory Structure

```
lib/
├── security/           # Security utilities and sanitization
│   └── sanitize.ts    # XSS prevention and input sanitization
├── auth.ts            # Authentication and authorization utilities
├── availability.ts    # Availability checking and calculation engine
├── storage-security.ts # File storage security utilities
├── supabase.ts        # Typed database client and helpers
├── utils.ts           # General utility functions
└── validations.ts     # Validation schemas and utilities
```

## 📦 Module Documentation

### `supabase.ts` - Database Client & Helpers
**Purpose**: Provides typed Supabase client and database helper methods

**Key Features**:
- Typed database client with auto-completion
- Helper methods for common database operations
- Error handling utilities
- Row Level Security (RLS) support

**Usage Example**:
```typescript
import { supabase, db, handleSupabaseError } from '@/lib/supabase'

// Using typed helpers (preferred)
const { data, error } = await db.bookings.byId(bookingId)
const { data: units } = await db.units.available()

// Error handling
if (error) {
  const message = handleSupabaseError(error)
  toast.error(message)
}

// Real-time subscriptions
const channel = supabase
  .channel('bookings-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'bookings'
  }, handleRealtimeUpdate)
  .subscribe()
```

### `auth.ts` - Authentication Utilities
**Purpose**: Manages authentication state and user sessions

**Key Features**:
- User authentication and session management
- Role-based access control (RBAC)
- Protected route utilities
- Token refresh handling

**Usage Example**:
```typescript
import { getCurrentUser, signIn, signOut, requireAuth } from '@/lib/auth'

// Get current user
const user = await getCurrentUser()

// Sign in
const { user, error } = await signIn(email, password)

// Protected API calls
const data = await requireAuth(async (user) => {
  return db.bookings.byUser(user.id)
})
```

### `availability.ts` - Availability Engine
**Purpose**: Complex availability checking and booking conflict detection

**Key Features**:
- Multi-unit availability checking
- Date range conflict detection
- Optimized database queries with caching
- Support for blocked dates and maintenance periods

**Usage Example**:
```typescript
import {
  checkAvailability,
  getAvailableUnits,
  calculateBookingDates,
  hasConflict
} from '@/lib/availability'

// Check if unit is available
const isAvailable = await checkAvailability(
  unitId,
  checkInDate,
  checkOutDate
)

// Get all available units for date range
const availableUnits = await getAvailableUnits({
  checkIn: '2024-01-20',
  checkOut: '2024-01-25',
  guestCount: 4
})

// Check for booking conflicts
const conflict = await hasConflict(unitId, dateRange)
```

### `validations.ts` - Validation Schemas
**Purpose**: Centralized validation schemas using Zod

**Key Features**:
- Reusable validation schemas
- Custom validation rules
- Philippine-specific validations (phone, etc.)
- Form field validators

**Usage Example**:
```typescript
import {
  bookingSchema,
  paymentSchema,
  phoneSchema,
  validateBookingDates
} from '@/lib/validations'

// Validate booking data
const result = bookingSchema.safeParse(formData)
if (!result.success) {
  console.error(result.error.issues)
}

// Custom date validation
const isValid = validateBookingDates(checkIn, checkOut)

// Phone validation (Philippine format)
const isValidPhone = phoneSchema.safeParse('+639123456789')
```

### `security/sanitize.ts` - Security Utilities
**Purpose**: Input sanitization and XSS prevention

**Key Features**:
- HTML sanitization with DOMPurify
- SQL injection prevention
- File upload validation
- Content Security Policy helpers

**Usage Example**:
```typescript
import { sanitizeHTML, sanitizeInput, validateFileUpload } from '@/lib/security/sanitize'

// Sanitize user HTML input
const safeHTML = sanitizeHTML(userInput, {
  allowedTags: ['b', 'i', 'a'],
  allowedAttributes: { 'a': ['href'] }
})

// Sanitize form input
const safeName = sanitizeInput(formData.name)

// Validate file uploads
const isValid = validateFileUpload(file, {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
})
```

### `storage-security.ts` - File Storage Security
**Purpose**: Secure file handling and storage operations

**Key Features**:
- Secure file upload with virus scanning
- Access control for stored files
- Signed URL generation
- File metadata validation

**Usage Example**:
```typescript
import {
  uploadSecureFile,
  getSignedUrl,
  deleteFile,
  validateFileMetadata
} from '@/lib/storage-security'

// Upload file securely
const { url, error } = await uploadSecureFile(file, {
  bucket: 'receipts',
  path: `payments/${paymentId}`,
  validateContent: true
})

// Generate time-limited access URL
const signedUrl = await getSignedUrl(filePath, {
  expiresIn: 3600 // 1 hour
})
```

## 🏗️ Architecture Patterns

### Database Access Pattern
Always prefer typed helpers over direct Supabase queries:
```typescript
// ✅ Good - Type-safe and maintainable
const { data } = await db.bookings.byGuest(guestId)

// ❌ Avoid - Less type safety
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('guest_id', guestId)
```

### Error Handling Pattern
Consistent error handling across all modules:
```typescript
try {
  const result = await someOperation()
  return { data: result, error: null }
} catch (error) {
  const message = handleSupabaseError(error)
  return { data: null, error: message }
}
```

### Security-First Pattern
All user inputs must be sanitized:
```typescript
// Always sanitize before database operations
const sanitized = {
  name: sanitizeInput(data.name),
  description: sanitizeHTML(data.description),
  amount: validateAmount(data.amount)
}

await db.items.create(sanitized)
```

## 🔒 Security Considerations

1. **Input Validation**: All inputs are validated using Zod schemas
2. **XSS Prevention**: HTML content sanitized with DOMPurify
3. **SQL Injection**: Prevented through parameterized queries
4. **File Security**: Files scanned and validated before storage
5. **Access Control**: Row Level Security (RLS) enforced at database level

## 🚀 Best Practices

1. **Use Typed Helpers**: Always use the `db` object for database operations
2. **Handle Errors**: Use `handleSupabaseError` for consistent error messages
3. **Validate Early**: Validate data at the edge before processing
4. **Sanitize Inputs**: Always sanitize user inputs before storage
5. **Cache When Possible**: Use React Query for caching database results

## 📚 Related Documentation

- [State Management](/src/stores/README.md) - Zustand stores using these utilities
- [Components Documentation](/src/components/bookings/README.md) - Components built on these libraries
- [API Documentation](/api/README.md) - API endpoints using these utilities
- [Database Schema](/database/SCHEMA.md) - Database structure these utilities interact with

## 🔧 Maintenance Notes

- **Phase 2**: Core functionality complete and tested
- **Phase 3-4**: Some utilities have `.phase3-4` variants for future features
- **TypeScript**: Strict mode progressively enabled
- **Performance**: Availability queries optimized with database indexes