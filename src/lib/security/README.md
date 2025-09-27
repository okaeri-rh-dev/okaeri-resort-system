# 🔒 Security Utilities

## Overview

The `/src/lib/security/` directory contains critical security utilities for the Okaeri Resort System, focusing on input sanitization, XSS prevention, and data validation to protect against common web vulnerabilities.

## 📁 Directory Structure

```
security/
└── sanitize.ts    # Input sanitization and XSS prevention (14.3KB)
```

## 📦 Security Module Documentation

### `sanitize.ts` - Input Sanitization & XSS Prevention
**Purpose**: Comprehensive input sanitization to prevent XSS attacks and ensure data integrity

## 🛡️ Core Functions

### HTML Sanitization
```typescript
import { sanitizeHTML, sanitizeRichText } from '@/lib/security/sanitize'

// Basic HTML sanitization
const safeHTML = sanitizeHTML(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'target'],
  ALLOW_DATA_ATTR: false,
})

// Rich text sanitization (for WYSIWYG editors)
const safeRichText = sanitizeRichText(editorContent, {
  allowImages: true,
  allowLinks: true,
  allowTables: false,
  maxLength: 10000,
})

// Strict text-only sanitization
const plainText = sanitizePlainText(input, {
  maxLength: 500,
  removeHTML: true,
  trimWhitespace: true,
})
```

### Input Validation & Sanitization
```typescript
// Email sanitization
const safeEmail = sanitizeEmail(userEmail)
// Removes dangerous characters, validates format

// Phone number sanitization (Philippine format)
const safePhone = sanitizePhoneNumber(userPhone, {
  countryCode: 'PH',
  format: 'E164', // +639XXXXXXXXX
})

// URL sanitization
const safeURL = sanitizeURL(userURL, {
  allowedProtocols: ['http', 'https'],
  allowRelative: false,
  requireTLD: true,
})

// File name sanitization
const safeFileName = sanitizeFileName(uploadedFile.name, {
  maxLength: 255,
  allowSpaces: false,
  preserveExtension: true,
})
```

### SQL Injection Prevention
```typescript
// Parameter sanitization for database queries
const safeSQLParam = sanitizeSQLParameter(userInput, {
  type: 'string',
  maxLength: 100,
  allowNull: false,
})

// Identifier sanitization (table/column names)
const safeIdentifier = sanitizeSQLIdentifier(tableName, {
  allowedPattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  maxLength: 64,
})

// Safe LIKE pattern
const safeLikePattern = sanitizeLikePattern(searchTerm, {
  escapeWildcards: true,
  addWildcards: 'both', // %term%
})
```

## 🔐 Advanced Security Features

### Content Security Policy (CSP)
```typescript
// Generate CSP headers
export const generateCSP = () => {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", process.env.VITE_SUPABASE_URL],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  }

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}

// Apply CSP
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', generateCSP())
  next()
})
```

### File Upload Security
```typescript
interface FileValidationOptions {
  maxSize: number
  allowedTypes: string[]
  scanForVirus?: boolean
  checkMagicBytes?: boolean
}

export const validateFileUpload = async (
  file: File,
  options: FileValidationOptions
): Promise<ValidationResult> => {
  // Size check
  if (file.size > options.maxSize) {
    return { valid: false, error: 'File too large' }
  }

  // MIME type check
  if (!options.allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' }
  }

  // Magic bytes verification
  if (options.checkMagicBytes) {
    const isValid = await verifyMagicBytes(file)
    if (!isValid) {
      return { valid: false, error: 'File type mismatch' }
    }
  }

  // Virus scanning (if enabled)
  if (options.scanForVirus) {
    const isSafe = await scanFile(file)
    if (!isSafe) {
      return { valid: false, error: 'Security threat detected' }
    }
  }

  return { valid: true }
}

// Magic bytes verification
const magicBytes = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46],
}

async function verifyMagicBytes(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Check against known signatures
  for (const [type, signature] of Object.entries(magicBytes)) {
    if (signature.every((byte, i) => bytes[i] === byte)) {
      return file.type.includes(type)
    }
  }

  return false
}
```

### Data Masking
```typescript
// Mask sensitive data for logs/display
export const maskSensitiveData = {
  email: (email: string) => {
    const [local, domain] = email.split('@')
    const masked = local.substring(0, 2) + '***'
    return `${masked}@${domain}`
  },

  phone: (phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  },

  creditCard: (number: string) => {
    return '**** **** **** ' + number.slice(-4)
  },

  ssn: (ssn: string) => {
    return '***-**-' + ssn.slice(-4)
  },

  apiKey: (key: string) => {
    return key.substring(0, 8) + '...' + key.slice(-4)
  },
}

// Usage
const maskedEmail = maskSensitiveData.email('user@example.com')
// Returns: us***@example.com
```

## 🎯 Security Patterns

### Input Validation Pipeline
```typescript
export class ValidationPipeline {
  private validators: Validator[] = []

  add(validator: Validator): this {
    this.validators.push(validator)
    return this
  }

  async validate(input: any): Promise<ValidationResult> {
    for (const validator of this.validators) {
      const result = await validator.validate(input)
      if (!result.valid) {
        return result
      }
    }
    return { valid: true }
  }
}

// Usage
const pipeline = new ValidationPipeline()
  .add(new LengthValidator(1, 100))
  .add(new PatternValidator(/^[a-zA-Z0-9]+$/))
  .add(new SQLInjectionValidator())
  .add(new XSSValidator())

const result = await pipeline.validate(userInput)
```

### Sanitization Middleware
```typescript
// Express/API middleware
export const sanitizationMiddleware = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body)
  }

  // Sanitize query params
  if (req.query) {
    req.query = sanitizeObject(req.query)
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params)
  }

  next()
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizePlainText(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }

  if (obj && typeof obj === 'object') {
    const sanitized = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeKey(key)] = sanitizeObject(value)
    }
    return sanitized
  }

  return obj
}
```

## 🔍 Security Audit Functions

### Audit Logging
```typescript
export const securityAudit = {
  logSuspiciousActivity: (activity: SuspiciousActivity) => {
    const log = {
      timestamp: new Date().toISOString(),
      type: activity.type,
      severity: activity.severity,
      details: activity.details,
      userAgent: activity.userAgent,
      ipAddress: activity.ipAddress,
      userId: activity.userId,
    }

    // Log to security monitoring system
    sendToSecurityMonitoring(log)

    // Alert if high severity
    if (activity.severity === 'high') {
      alertSecurityTeam(log)
    }
  },

  detectPatterns: (input: string): ThreatPattern[] => {
    const patterns = []

    // SQL Injection patterns
    if (/(\bUNION\b|\bSELECT\b|\bDROP\b|\b--)/i.test(input)) {
      patterns.push({ type: 'sql_injection', confidence: 'high' })
    }

    // XSS patterns
    if (/<script|javascript:|onerror=/i.test(input)) {
      patterns.push({ type: 'xss', confidence: 'high' })
    }

    // Path traversal
    if (/\.\.[\/\\]/.test(input)) {
      patterns.push({ type: 'path_traversal', confidence: 'medium' })
    }

    return patterns
  },
}
```

## 🧪 Security Testing

```typescript
describe('Sanitization', () => {
  describe('XSS Prevention', () => {
    it('removes script tags', () => {
      const input = '<script>alert("XSS")</script>'
      const output = sanitizeHTML(input)
      expect(output).not.toContain('<script>')
      expect(output).not.toContain('alert')
    })

    it('removes event handlers', () => {
      const input = '<div onclick="alert(1)">Click</div>'
      const output = sanitizeHTML(input)
      expect(output).not.toContain('onclick')
    })
  })

  describe('SQL Injection Prevention', () => {
    it('escapes SQL special characters', () => {
      const input = "'; DROP TABLE users; --"
      const output = sanitizeSQLParameter(input)
      expect(output).not.toContain('DROP TABLE')
    })
  })
})
```

## 🚀 Performance Considerations

- DOMPurify is cached and reused
- Sanitization results are memoized for repeated inputs
- Async validation for file scanning
- Batch processing for multiple inputs

## 🔒 Security Best Practices

1. **Always Sanitize User Input**: Never trust user input
2. **Use Allowlists**: Define what's allowed, reject everything else
3. **Validate on Both Sides**: Client-side for UX, server-side for security
4. **Log Security Events**: Track suspicious activities
5. **Regular Updates**: Keep DOMPurify and security libraries updated
6. **Defense in Depth**: Layer multiple security measures
7. **Fail Securely**: Default to denying access when uncertain

## 📚 Related Documentation

- [OWASP XSS Prevention](https://owasp.org/www-community/attacks/xss/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [SQL Injection Prevention](https://owasp.org/www-community/attacks/SQL_Injection)