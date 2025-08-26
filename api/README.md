# Okaeri Resort Management System - API Documentation

## Overview

The Okaeri Resort Management API is built on Vercel's serverless infrastructure, providing a scalable and cost-effective backend for Philippine resort businesses. The API follows RESTful principles with JWT authentication and multi-tenant data isolation.

## Architecture

### Tech Stack
- **Runtime**: Vercel Serverless Functions (Node.js 20.x)
- **Database**: Neon PostgreSQL (Serverless)
- **Caching/Rate Limiting**: Upstash Redis
- **File Storage**: Cloudflare R2
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas

### Key Features
- Multi-tenant architecture with PostgreSQL schemas
- Philippine business context (Peso currency, local payment methods)
- Automatic rate limiting and security headers
- Connection pooling for database efficiency
- Audit logging for compliance

## API Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "projectId": "uuid", // Optional - specific project to login to
  "rememberMe": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { /* user details */ },
    "token": "jwt-token",
    "refreshToken": "refresh-token",
    "projects": [ /* user's projects */ ],
    "currentProject": { /* selected project */ }
  }
}
```

#### POST /api/auth/logout
Logout current user and clear session.

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh-token",
  "projectId": "uuid" // Optional - switch project
}
```

#### GET /api/auth/me
Get current user information and projects.

### Bookings

#### GET /api/bookings
List bookings with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status[]` (array): Filter by status
- `propertyId` (uuid): Filter by property
- `checkInFrom` (date): Filter check-in date from
- `checkInTo` (date): Filter check-in date to
- `search` (string): Search guest name/email/phone

#### POST /api/bookings/create
Create a new booking.

**Request Body:**
```json
{
  "propertyId": "uuid",
  "guestName": "Juan Dela Cruz",
  "guestEmail": "juan@example.com",
  "guestPhone": "+639123456789",
  "checkIn": "2024-01-15T14:00:00Z",
  "checkOut": "2024-01-17T11:00:00Z",
  "guests": 4,
  "status": "CONFIRMED",
  "source": "DIRECT",
  "totalAmount": 5000.00,
  "paidAmount": 2500.00,
  "paymentMethod": "GCASH",
  "notes": "Late check-in requested"
}
```

#### GET /api/bookings/[id]
Get booking details by ID.

#### PUT /api/bookings/[id]
Update booking information.

#### DELETE /api/bookings/[id]
Cancel a booking.

### Properties

#### GET /api/properties
List all properties with availability status.

**Query Parameters:**
- `status[]`: Filter by status (AVAILABLE, OCCUPIED, MAINTENANCE)
- `type[]`: Filter by type (VILLA, APARTMENT, HOUSE, etc.)
- `minCapacity`: Minimum guest capacity
- `maxRate`: Maximum base rate

#### POST /api/properties/create
Add a new property.

**Request Body:**
```json
{
  "name": "Beach Villa A",
  "type": "VILLA",
  "capacity": 6,
  "bedrooms": 3,
  "bathrooms": 2,
  "baseRate": 5000.00,
  "weekendRate": 6000.00,
  "amenities": ["WiFi", "Kitchen", "Pool", "Parking"],
  "description": "Beachfront villa with ocean view"
}
```

### Expenses

#### GET /api/expenses
List expenses with filtering.

**Query Parameters:**
- `category[]`: Filter by category
- `status[]`: Filter by status
- `dateFrom`: Filter date from
- `dateTo`: Filter date to
- `minAmount`: Minimum amount
- `maxAmount`: Maximum amount

#### POST /api/expenses/create
Record a new expense.

**Request Body:**
```json
{
  "category": "UTILITIES",
  "amount": 2500.00,
  "description": "Electricity bill",
  "vendor": "Meralco",
  "date": "2024-01-15",
  "paymentMethod": "BANK_TRANSFER",
  "propertyId": "uuid" // Optional
}
```

### Reports

#### GET /api/reports/revenue
Generate revenue report.

**Query Parameters:**
- `dateFrom`: Start date
- `dateTo`: End date
- `groupBy`: day|week|month|year

#### GET /api/reports/expenses
Generate expense report by category.

#### GET /api/reports/occupancy
Generate occupancy rate report.

#### POST /api/reports/export
Export report as PDF or Excel.

**Request Body:**
```json
{
  "type": "revenue|expenses|occupancy",
  "format": "pdf|excel",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31"
}
```

### Team Management

#### GET /api/team
List team members for current project.

#### POST /api/team/invite
Invite new team member.

**Request Body:**
```json
{
  "email": "staff@example.com",
  "role": "STAFF",
  "permissions": ["bookings.read", "bookings.create"]
}
```

## Authentication

All API endpoints (except `/api/auth/login`) require authentication via JWT token.

### Headers
```
Authorization: Bearer <jwt-token>
X-Project-ID: <project-uuid> // Optional - override default project
```

### Token Lifecycle
- Access tokens expire after 24 hours (30 days with "Remember Me")
- Refresh tokens expire after 90 days
- Tokens are automatically refreshed by the client

## Multi-Tenancy

Each project (resort) has isolated data using PostgreSQL schemas:
- Schema naming: `project_<uuid_with_underscores>`
- Automatic schema switching based on JWT claims
- Project ID can be overridden per request

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Default: 100 requests per minute per user
- Login endpoint: 5 attempts per 15 minutes
- File uploads: 10 per hour

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-01T12:00:00Z
```

## Error Responses

Consistent error format across all endpoints:

```json
{
  "error": "ValidationError",
  "message": "Invalid input data",
  "statusCode": 400,
  "timestamp": "2024-01-01T12:00:00Z",
  "details": { /* Additional error context */ }
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## Philippine Business Context

### Currency
- All amounts in Philippine Peso (PHP)
- Formatted with 2 decimal places
- Uses `Intl.NumberFormat` for display

### Payment Methods
- Cash
- GCash
- Maya (PayMaya)
- Bank Transfer
- Credit/Debit Card

### Phone Numbers
- Validates Philippine format: `+639XXXXXXXXX`
- Accepts both `+63` and `09` prefixes

### Timezone
- All dates in `Asia/Manila` timezone
- ISO 8601 format for API communication

## Development

### Local Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Configure database and services in `.env.local`

4. Run development server:
```bash
npm run dev
```

### Testing API Endpoints

Using curl:
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get bookings (with auth)
curl http://localhost:3000/api/bookings \
  -H "Authorization: Bearer <token>"
```

## Deployment

### Vercel Deployment

1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy:
```bash
vercel --prod
```

### Environment Variables

Required for production:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT signing (min 32 chars)
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens

Optional services:
- `UPSTASH_REDIS_REST_URL` - Redis for rate limiting
- `R2_*` - Cloudflare R2 for file storage
- `SMTP_*` - Email configuration

## Security

### Best Practices
- JWT tokens stored in httpOnly cookies
- CORS configured for allowed origins
- Input validation with Zod schemas
- SQL injection prevention via parameterized queries
- Rate limiting on sensitive endpoints
- Audit logging for compliance

### Headers
Security headers automatically applied:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Monitoring

### Health Check
```bash
GET /api/health/check
```

Returns system status and dependency health.

### Metrics
- Request duration
- Database connection pool status
- Error rates by endpoint
- User activity tracking

## Support

For issues or questions:
- Check API logs in Vercel dashboard
- Review error details in response
- Contact support with request ID from headers