# Internal Use Requirements - Okaeri Resort System

## System Scope Definition

**Last Updated**: January 9, 2025  
**Scope Type**: INTERNAL STAFF USE ONLY  
**Customer Access**: NONE  
**Payment Status Tracking**: TRACKING ONLY (No actual payment status tracking)

## Core Purpose

The Okaeri Resort System is an internal management tool designed exclusively for
resort staff to:

- Manage room bookings and availability
- Track payment status (not process payments)
- Monitor financial metrics (income/expenses)
- Generate internal operational reports
- Coordinate staff activities and room maintenance

## What This System IS

### 1. Internal Booking Management

- **Staff-operated booking entry**: Manual entry of bookings made via
  phone/walk-in
- **Availability calendar**: Visual room availability for staff coordination
- **Booking modifications**: Edit/cancel bookings as needed by staff
- **Room status tracking**: Available, occupied, maintenance, cleaning states

### 2. Financial Tracking (Not Processing)

- **Payment status monitoring**: Track if guests have paid (cash/GCash/bank)
- **Income recording**: Log payments received offline
- **Expense tracking**: Record operational expenses for reporting
- **Balance tracking**: Monitor outstanding balances
- **Internal financial reports**: Revenue summaries for management

### 3. Staff Workflow Tools

- **Room assignment**: Assign rooms to housekeeping staff
- **Maintenance scheduling**: Track room maintenance needs
- **Shift coordination**: View who's responsible for specific tasks
- **Internal notifications**: Alert staff of important updates

### 4. Progressive Web App Features (For Staff Mobile Use)

- **Offline capability**: Continue working without internet
- **Mobile-responsive**: Optimized for staff tablets/phones
- **Push notifications**: Alert staff of urgent tasks
- **Background sync**: Sync data when connection returns
- **App-like experience**: Installable on staff devices

## What This System IS NOT

### 1. NOT Customer-Facing

- ❌ No customer registration or login
- ❌ No customer self-service booking
- ❌ No customer payment portal
- ❌ No customer profile management
- ❌ No customer-facing UI/UX

### 2. NOT Payment Processing

- ❌ No credit card processing
- ❌ No online payment gateway integration
- ❌ No e-wallet API connections
- ❌ No payment method storage
- ❌ No PCI compliance requirements

### 3. NOT Government Compliance

- ❌ No internal reporting integration or compliance
- ❌ No official receipt generation
- ❌ No balance calculation/filing
- ❌ No senior/PWD discount processing
- ❌ No internal fee generation
- ❌ No Philippine Data Privacy Act compliance UI

### 4. NOT External Integration

- ❌ No Airbnb/Booking.com sync
- ❌ No external channel management
- ❌ No third-party API integrations
- ❌ No public API endpoints
- ❌ No webhook receivers

## Simplified Architecture

### Authentication

- **Single tier**: Staff accounts only
- **Role-based**: Admin, Manager, Staff roles
- **No customer auth**: Remove all customer registration/login code
- **JWT via headers**: Continue using Authorization headers (no cookies)

### Database Schema

- **Projects table**: For multi-property support (internal use)
- **Users table**: Staff accounts only
- **Bookings table**: All bookings entered by staff
- **Rooms table**: Room inventory and status
- **Payments table**: Payment status tracking (not processing)
- **Expenses table**: Operational expense records

### User Interface

- **Dense layouts**: Optimized for operational efficiency
- **Keyboard shortcuts**: Quick navigation for power users
- **Batch operations**: Process multiple items efficiently
- **Professional design**: Enterprise-grade, not consumer-friendly
- **Data tables**: Focus on information density

### Security Model

- **Internal network**: Can assume trusted network environment
- **Basic DDoS protection**: Prevent Vercel billing attacks only
- **Simple rate limiting**: Prevent accidental loops
- **No compliance auditing**: Remove audit logs for compliance
- **Simplified security**: Focus on preventing accidents, not attacks

## Implementation Changes Required

### Phase 1 - Authentication (Simplify)

- Remove customer registration components
- Remove customer login flows
- Remove password reset for customers
- Keep only staff authentication
- Simplify to single-tier auth

### Phase 2 - Dashboard (Retain)

- Keep all dashboard components
- Focus on staff operational views
- Remove any customer-facing metrics
- Enhance for internal reporting

### Phase 3 - Booking Management (Refocus)

- Remove customer booking forms
- Remove customer booking confirmation emails
- Keep staff booking management interface
- Add manual booking entry forms
- Focus on operational efficiency

### Phase 4 - Financial Management (Simplify)

- Remove payment status tracking code
- Remove payment gateway integrations
- Keep payment status tracking
- Keep income/expense recording
- Remove compliance calculations
- Remove tax generation features

### Phase 5 - Deployment (Complete)

- Phase 5.1: Deployment pipeline ✅
- Phase 5.2: Security hardening (simplified) ✅
- Remove compliance monitoring
- Remove customer data protection features

## Benefits of Internal-Only Scope

1. **Reduced Complexity**: 60% less code to maintain
2. **Lower Costs**: No payment gateway fees, compliance costs
3. **Faster Development**: No customer UX polish needed
4. **Simplified Testing**: No edge cases for customer behavior
5. **Easier Maintenance**: Single user type, predictable usage
6. **Better Performance**: No public traffic concerns
7. **Focused Features**: Build exactly what staff needs

## Operational Workflow

### Booking Creation Flow

1. Guest calls/walks in → Staff answers
2. Staff checks availability in system
3. Staff creates booking manually
4. Staff records payment method (cash/GCash/bank)
5. Staff updates payment status when received
6. System tracks balance and status

### Daily Operations

1. Morning: Check today's check-ins/check-outs
2. Assign rooms to housekeeping
3. Update room status as cleaned
4. Record payments as received
5. Log daily expenses
6. Generate end-of-day report

## Success Metrics

- **Staff efficiency**: Reduce booking entry time by 50%
- **Accuracy**: Eliminate double-booking errors
- **Visibility**: Real-time availability across all staff
- **Reporting**: Instant financial summaries
- **Mobile access**: Staff can update from anywhere in resort
- **Offline reliability**: No lost data during internet outages

## Out of Scope (Permanently)

- Customer self-service features
- Online payment processing
- Government compliance integration
- Customer data privacy features
- External channel integration
- Public-facing APIs
- Customer mobile apps
- Marketing features
- Customer loyalty programs
- Review management

## Technology Decisions

### Keep

- React + TypeScript + Vite
- Vercel deployment
- Neon PostgreSQL
- Zustand state management
- TanStack Query
- PWA features
- Tailwind CSS + shadcn/ui

### Remove

- Payment gateway SDKs
- Compliance libraries
- Customer auth providers
- Email service integration
- SMS notification services
- Analytics tracking
- Customer support tools

## Migration Path

1. **Immediate**: Document scope change (this document)
2. **Next Sprint**: Remove customer registration/login
3. **Following Sprint**: Simplify auth to staff-only
4. **Then**: Remove payment processing code
5. **Finally**: Remove compliance features
6. **Ongoing**: Enhance staff-facing features

## Conclusion

By focusing on internal use only, the Okaeri Resort System becomes a powerful
operational tool without the complexity of customer-facing features, payment
processing, or compliance requirements. This dramatically simplifies
development, reduces costs, and allows the team to focus on building the best
possible tool for resort staff.

The system remains a Progressive Web App to support mobile staff usage, but all
features are designed for professional internal use rather than customer
experience.
