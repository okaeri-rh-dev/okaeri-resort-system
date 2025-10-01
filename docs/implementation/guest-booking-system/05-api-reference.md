# API Reference Documentation (Cloudflare Pages)

## Base URL

```
Production: https://your-domain.pages.dev/api (Cloudflare Pages)
Development: http://localhost:8788/api (Wrangler dev server)
```

## Authentication

Guest booking endpoints do not require authentication. However, they are protected by:

- **Cloudflare KV rate limiting** (5 bookings/hour per IP)
- **Turnstile CAPTCHA verification** (free, unlimited)
- Input validation (Zod + DOMPurify)

## Endpoints

### 1. Create Guest Booking

Creates a new booking request from an unauthenticated guest and returns a signed URL for file upload.

**Endpoint:** `POST /api/guest-booking`

**Headers:**

```http
Content-Type: application/json
X-Idempotency-Key: <optional-unique-key>
```

**Header Details**:

- `Content-Type`: Must be `application/json`
- `X-Idempotency-Key` (optional): Prevents duplicate bookings from retries
  - Format: UUID or any unique string (recommended: UUIDv4)
  - TTL: 10 minutes (cached response returned within this window)
  - Example: `550e8400-e29b-41d4-a716-446655440000`
  - If omitted: Request body hash used as fallback key
  - Successful responses cached and returned for duplicate requests

**Request Body:**

**Note**: All dates are in ISO 8601 format and will be interpreted as Asia/Manila timezone, then stored as UTC.

```json
{
  "guest": {
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "email": "juan@example.com",
    "phone": "+639171234567",
    "notes": "First time guest"
  },
  "booking": {
    "unit_id": "123e4567-e89b-12d3-a456-426614174000",
    "check_in_date": "2025-02-15T14:00:00Z",
    "check_out_date": "2025-02-18T12:00:00Z",
    "guest_count": 4,
    "payment_amount": 15000,
    "payment_method": "gcash"
  },
  "turnstile_token": "0x4AAAAAAA_turnstile_token_here",
  "termsAccepted": true
}
```

**Response (Success):** `201 Created`

**Note**: Response now uses token-based upload format for better CORS compatibility.

```json
{
  "success": true,
  "booking": {
    "booking_id": "550e8400-e29b-41d4-a716-446655440000",
    "booking_reference": "BK-2025-001234",
    "total_amount": 15000
  },
  "upload": {
    "path": "guest-bookings/550e8400.../file.jpg",
    "token": "eyJhbGc...",
    "bucket": "payment-proofs",
    "expires_at": "2025-01-27T15:30:00Z"
  },
  "message": "Booking created successfully. Please upload your payment proof (max 2MB)."
}
```

**Response (Rate Limited):** `429 Too Many Requests`

```json
{
  "error": "Too many requests",
  "retryAfter": "2025-01-27T16:00:00Z",
  "limit": 5,
  "remaining": 0
}
```

**Response Headers:**

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-01-27T16:00:00Z
Retry-After: 1800
```

**Response (Validation Error):** `400 Bad Request`

```json
{
  "error": "Validation failed",
  "details": {
    "guest.email": ["Invalid email address"],
    "booking.check_in_date": ["Check-in date must be in the future"]
  }
}
```

**Response (CAPTCHA Failed):** `403 Forbidden`

```json
{
  "error": "CAPTCHA verification failed",
  "details": {
    "score": 0.3,
    "threshold": 0.5
  }
}
```

**cURL Example:**

```bash
curl -X POST https://your-domain.com/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest": {
      "first_name": "Juan",
      "last_name": "Dela Cruz",
      "email": "juan@example.com",
      "phone": "+639171234567"
    },
    "booking": {
      "unit_id": "123e4567-e89b-12d3-a456-426614174000",
      "check_in_date": "2025-02-15T14:00:00Z",
      "check_out_date": "2025-02-18T12:00:00Z",
      "guest_count": 4,
      "payment_amount": 15000,
      "payment_method": "gcash"
    },
    "turnstile_token": "0x4AAAAAAA_turnstile_token_here",
    "termsAccepted": true
  }'
```

---

### 2. Confirm Upload Completion

Confirms that the payment proof has been successfully uploaded and triggers confirmation email.

**Endpoint:** `POST /api/guest-booking/confirm`

**Headers:**

```http
Content-Type: application/json
```

**Request Body:**

```json
{
  "booking_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_path": "payment-proofs/guest-bookings/550e8400.../1706366400_abc123.jpg",
  "verification_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (Success):** `200 OK`

```json
{
  "success": true,
  "message": "Upload confirmed and booking updated",
  "data": {
    "booking_status": "pending_review",
    "email_sent": true,
    "review_eta": "24-48 hours"
  }
}
```

**Response (Not Found):** `404 Not Found`

```json
{
  "error": "Booking not found or invalid verification token"
}
```

**Response (Already Confirmed):** `409 Conflict`

```json
{
  "error": "Upload already confirmed for this booking"
}
```

**cURL Example:**

```bash
curl -X POST https://your-domain.com/api/guest-booking/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "550e8400-e29b-41d4-a716-446655440000",
    "file_path": "payment-proofs/guest-bookings/550e8400.../file.jpg",
    "verification_token": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

---

### 3. Check Booking Status

Allows guests to check the status of their booking using reference number and email.

**Security**: Requires BOTH `reference` AND `email` to prevent enumeration attacks.

**Endpoint:** `GET /api/guest-booking/status`

**Rate Limiting**: 20 requests per hour per IP (fingerprint-based)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reference | string | **Yes** | Booking reference number (e.g., BK-2025-X7K9M2) |
| email | string | **Yes** | Email address used for booking |
| turnstile_token | string | No | Optional Turnstile token (required after rate limit) |

**Security Notes**:

- **Dual-factor authentication**: Both `reference` AND `email` required
- **Fingerprint tracking**: Uses IP + User-Agent + headers for rate limiting
- **Progressive CAPTCHA**: After 20 attempts, requires Turnstile token
- **CAPTCHA reset**: Successful Turnstile verification resets rate limit

**Response (Success):** `200 OK`

```json
{
  "success": true,
  "data": {
    "booking_reference": "BK-2025-001234",
    "status": "confirmed",
    "check_in_date": "2025-02-15",
    "check_out_date": "2025-02-18",
    "unit_name": "Deluxe Suite A",
    "guest_count": 4,
    "payment_status": "partial",
    "payment_amount": 15000,
    "payment_received": 5000,
    "balance_due": 10000,
    "created_at": "2025-01-27T14:00:00Z",
    "last_updated": "2025-01-27T15:30:00Z"
  }
}
```

**Response (Not Found):** `404 Not Found`

**Note**: Generic error message prevents revealing which parameter (reference or email) was incorrect.

```json
{
  "error": "NOT_FOUND",
  "message": "No booking found with the provided information"
}
```

**Response (Rate Limited):** `429 Too Many Requests`

```json
{
  "error": "RATE_LIMITED",
  "message": "Too many status checks. Please try again later.",
  "retryAfter": 3600,
  "requiresCaptcha": true
}
```

**Response Headers**:

```http
Retry-After: 3600
X-RateLimit-Remaining: 0
Content-Type: application/json
```

**Handling Rate Limits**:

```typescript
// Frontend handling
const response = await fetch(`/api/guest-booking/status?${params}`);

if (response.status === 429) {
  const error = await response.json();

  if (error.requiresCaptcha) {
    // Show Turnstile widget to user
    setShowCaptcha(true);
  }

  // Retry after specified seconds
  const retryAfter = error.retryAfter; // seconds
  setTimeout(() => checkStatus(), retryAfter * 1000);
}
```

**cURL Example:**

```bash
curl -G "https://your-domain.com/api/guest-booking/status" \
  --data-urlencode "reference=BK-2025-001234" \
  --data-urlencode "email=juan@example.com"
```

---

### 4. Generate Signed Upload URL

Generates a temporary signed URL for file upload (internal use by guest booking flow).

**Endpoint:** `POST /api/storage/generate-upload-url`

**Headers:**

```http
Content-Type: application/json
Authorization: Bearer {service_role_key}
```

**Request Body:**

```json
{
  "booking_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_name": "payment_proof.jpg",
  "file_type": "image/jpeg",
  "file_size": 2048576
}
```

**Note**: This endpoint is now deprecated. Token-based upload URL is returned directly from `/api/guest-booking`.

**Response (Success):** `200 OK`

```json
{
  "success": true,
  "data": {
    "path": "guest-bookings/550e8400.../file.jpg",
    "token": "eyJhbGc...",
    "bucket": "payment-proofs",
    "expires_at": "2025-01-27T15:30:00Z",
    "max_file_size": 2097152
  }
}
```

**Response (Invalid File):** `400 Bad Request`

```json
{
  "error": "Invalid file type or size",
  "details": {
    "allowed_types": ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    "max_size": 2097152
  }
}
```

---

### 5. Resend Confirmation Email

Resends the booking confirmation email to the guest.

**Endpoint:** `POST /api/guest-booking/resend-confirmation`

**Headers:**

```http
Content-Type: application/json
```

**Request Body:**

```json
{
  "booking_reference": "BK-2025-001234",
  "email": "juan@example.com",
  "turnstile_token": "0x4AAAAAAA_turnstile_token_here"
}
```

**Response (Success):** `200 OK`

```json
{
  "success": true,
  "message": "Confirmation email has been resent",
  "data": {
    "sent_to": "juan@example.com",
    "next_resend_available": "2025-01-27T15:00:00Z"
  }
}
```

**Response (Too Many Requests):** `429 Too Many Requests`

```json
{
  "error": "Please wait before requesting another email",
  "retryAfter": "2025-01-27T15:00:00Z"
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Description                                  |
| ---- | -------------------------------------------- |
| 200  | Success                                      |
| 201  | Created successfully                         |
| 400  | Bad request - validation error               |
| 403  | Forbidden - CAPTCHA or security check failed |
| 404  | Not found                                    |
| 409  | Conflict - duplicate or already exists       |
| 429  | Too many requests - rate limited             |
| 500  | Internal server error                        |
| 503  | Service unavailable                          |

### Application Error Codes

| Code                    | HTTP Status | Description                           | Resolution                         |
| ----------------------- | ----------- | ------------------------------------- | ---------------------------------- |
| `VALIDATION_ERROR`      | 400         | Request validation failed             | Check required fields and formats  |
| `MISSING_PARAMETERS`    | 400         | Required parameters missing           | Include all required fields        |
| `CAPTCHA_FAILED`        | 403         | Turnstile CAPTCHA verification failed | Refresh page and try again         |
| `RATE_LIMITED`          | 429         | Too many requests from IP             | Wait for retry-after time          |
| `FILE_TOO_LARGE`        | 400         | Upload file exceeds 2MB (free tier)   | Compress or use smaller file       |
| `INVALID_FILE_TYPE`     | 400         | File type not allowed                 | Use JPG, PNG, WebP, or PDF         |
| `NOT_FOUND`             | 404         | Booking not found (generic)           | Check both reference and email     |
| `AVAILABILITY_CONFLICT` | 409         | Selected unit not available for dates | Choose different dates or unit     |
| `BOOKING_CREATE_FAILED` | 500         | Failed to create booking              | Try again or contact support       |
| `UPLOAD_EXPIRED`        | 400         | Signed upload URL expired (1 hour)    | Create new booking                 |
| `INTERNAL_ERROR`        | 500         | Unexpected server error               | Try again later or contact support |

**Error Response Format:**

All errors follow a consistent JSON structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context (optional)"
  },
  "retryAfter": 1800
}
```

## Rate Limits

| Endpoint       | Limit       | Window | Identifier |
| -------------- | ----------- | ------ | ---------- |
| Create Booking | 5 requests  | 1 hour | IP Address |
| Upload File    | 10 uploads  | 1 hour | IP Address |
| Check Status   | 20 requests | 1 hour | IP Address |
| Resend Email   | 3 requests  | 1 hour | IP + Email |

## File Upload Specifications

### Allowed File Types

- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `image/webp` (.webp)
- `application/pdf` (.pdf)

### File Constraints

- **Maximum size:** 2MB (2,097,152 bytes) - optimized for free tier bandwidth
- **Minimum dimensions (images):** 100x100 pixels
- **Maximum dimensions (images):** 10,000x10,000 pixels
- **Maximum PDF pages:** 10 pages
- **File name:** Automatically generated for security
- **Compression:** Client-side compression automatically applied before upload

### Upload Process

1. Submit booking details to `/api/guest-booking`
2. Receive token-based upload info in response (`path`, `token`, `bucket`)
3. Compress file on client-side if needed (automatic)
4. Upload file using Supabase SDK `uploadToSignedUrl()` method
5. Confirm upload completion via `/api/guest-booking/confirm`

### Direct Upload Example

```javascript
import { createClient } from "@supabase/supabase-js";

// Using the token-based upload from booking response
const uploadFile = async (uploadInfo, file) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.storage
    .from(uploadInfo.bucket)
    .uploadToSignedUrl(uploadInfo.path, uploadInfo.token, file, {
      contentType: file.type,
      onUploadProgress: (progress) => {
        console.log(`Upload progress: ${(progress.loaded / progress.total) * 100}%`);
      },
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data;
};
```

## Webhook Events (Optional)

If webhooks are configured, the following events will be sent:

### Booking Created

```json
{
  "event": "guest_booking.created",
  "timestamp": "2025-01-27T14:00:00Z",
  "data": {
    "booking_id": "550e8400-e29b-41d4-a716-446655440000",
    "booking_reference": "BK-2025-001234",
    "guest_email": "juan@example.com",
    "check_in_date": "2025-02-15",
    "check_out_date": "2025-02-18"
  }
}
```

### Payment Proof Uploaded

```json
{
  "event": "payment_proof.uploaded",
  "timestamp": "2025-01-27T14:30:00Z",
  "data": {
    "booking_id": "550e8400-e29b-41d4-a716-446655440000",
    "file_path": "payment-proofs/guest-bookings/...",
    "file_size": 2048576,
    "file_type": "image/jpeg"
  }
}
```

## Testing

### Test Environment

```
Base URL: https://staging.your-domain.com/api
Test CAPTCHA Site Key: 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
Test CAPTCHA Secret: 6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

### Test Credit Cards

For testing payment flows, use these test card numbers:

- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- Insufficient Funds: 4000 0000 0000 9995

### Postman Collection

Download the Postman collection for easy API testing:
[Download Collection](https://api.postman.com/collections/...)

## SDK Examples

### JavaScript/TypeScript

```typescript
class GuestBookingAPI {
  private baseURL: string;

  constructor(baseURL: string = "https://your-domain.com/api") {
    this.baseURL = baseURL;
  }

  async createBooking(data: BookingData): Promise<BookingResponse> {
    const response = await fetch(`${this.baseURL}/guest-booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Booking failed");
    }

    return response.json();
  }

  async checkStatus(reference: string, email: string): Promise<StatusResponse> {
    const params = new URLSearchParams({ reference, email });
    const response = await fetch(`${this.baseURL}/guest-booking/status?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Status check failed");
    }

    return response.json();
  }
}

// Usage
const api = new GuestBookingAPI();
const booking = await api.createBooking({
  guest: {
    /* ... */
  },
  booking: {
    /* ... */
  },
  turnstile_token: "0x4AAAAAAA_turnstile_token_here",
  termsAccepted: true,
});
```

### Python

```python
import requests
from typing import Dict, Any

class GuestBookingAPI:
    def __init__(self, base_url: str = "https://your-domain.com/api"):
        self.base_url = base_url
        self.session = requests.Session()

    def create_booking(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new guest booking"""
        response = self.session.post(
            f"{self.base_url}/guest-booking",
            json=data
        )
        response.raise_for_status()
        return response.json()

    def check_status(self, reference: str, email: str) -> Dict[str, Any]:
        """Check booking status"""
        response = self.session.get(
            f"{self.base_url}/guest-booking/status",
            params={"reference": reference, "email": email}
        )
        response.raise_for_status()
        return response.json()

# Usage
api = GuestBookingAPI()
booking = api.create_booking({
    "guest": {...},
    "booking": {...},
    "turnstile_token": "0x4AAAAAAA_turnstile_token_here",
    "termsAccepted": True
})
```

### PHP

```php
<?php
class GuestBookingAPI {
    private $baseURL;

    public function __construct($baseURL = 'https://your-domain.com/api') {
        $this->baseURL = $baseURL;
    }

    public function createBooking($data) {
        $ch = curl_init($this->baseURL . '/guest-booking');
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 201) {
            throw new Exception('Booking failed: ' . $response);
        }

        return json_decode($response, true);
    }

    public function checkStatus($reference, $email) {
        $params = http_build_query([
            'reference' => $reference,
            'email' => $email
        ]);

        $ch = curl_init($this->baseURL . '/guest-booking/status?' . $params);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception('Status check failed: ' . $response);
        }

        return json_decode($response, true);
    }
}

// Usage
$api = new GuestBookingAPI();
$booking = $api->createBooking([
    'guest' => [...],
    'booking' => [...],
    'turnstile_token' => '0x4AAAAAAA_turnstile_token_here',
    'termsAccepted' => true
]);
?>
```

## Migration Guide

### From Authenticated to Guest Bookings

If migrating from an authenticated-only system:

1. **Database Changes**

```sql
-- Add guest booking column (single column approach)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT false;

-- Create index for guest lookups
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email
ON bookings(email, is_guest_booking)
WHERE is_guest_booking = true;

-- Note: Email verification fields not needed - admin pre-screens guests
```

2. **Update RLS Policies**

```sql
-- Allow guest booking creation
CREATE POLICY "allow_guest_booking_insert" ON bookings
FOR INSERT
WITH CHECK (is_guest_booking = true);

-- Allow guest status checks
CREATE POLICY "allow_guest_booking_select" ON bookings
FOR SELECT
USING (
  is_guest_booking = true AND
  auth.jwt() IS NULL
);
```

3. **Frontend Changes**

- Add guest booking form route
- Implement file upload component
- Add status check page
- Update navigation

## Support

### Common Issues

**Issue: "Turnstile verification failed"**

- Ensure Turnstile token is fresh (< 5 minutes old)
- Verify site key matches environment (visible vs. invisible mode)
- Check Cloudflare dashboard for verification logs

**Issue: "File upload fails with CORS error"**

- Verify CORS configuration in Supabase Storage settings
- Ensure your domain is whitelisted (including localhost for development)
- Use token-based `uploadToSignedUrl()` method (better CORS compatibility)
- Check browser console for specific CORS error details

**Issue: "Rate limit exceeded immediately"**

- Verify `cf-connecting-ip` header is correctly extracted
- Check Cloudflare KV namespace has sufficient quota
- Review coarse-window rate limiting configuration (hourly windows)
- Consider device fingerprinting for shared IPs (e.g., corporate networks)

### Contact

For API support and issues:

- Email: api-support@your-domain.com
- Documentation: https://docs.your-domain.com
- Status Page: https://status.your-domain.com

---

_API Version: 1.0.0_
_Last Updated: January 2025_
_Deprecation Policy: 6 months notice for breaking changes_
