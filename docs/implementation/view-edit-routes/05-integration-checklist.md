# Detail & Edit Pages - Integration Checklist

## Overview

This document provides a step-by-step implementation checklist for integrating detail and edit pages across all entities in the Okaeri Resort System.

---

## Phase 1: Foundation Setup

### 1.1 Create Shared Type Definitions

- [ ] Create `src/types/entity-detail.types.ts`
  - [ ] Define `EntityType` union type
  - [ ] Define detail types: `BookingDetail`, `UnitDetail`, etc.
  - [ ] Define form data types: `BookingFormData`, `UnitFormData`, etc.
  - [ ] Define `EntityRouteParams<T>` generic type
  - [ ] Define `AuditFilters` type
  - [ ] Define `LoadingState` type

- [ ] Create `src/types/entity-navigation.types.ts`
  - [ ] Define `NavigationTarget` type
  - [ ] Define `EntityNavigationProps<T>` type
  - [ ] Define `EntityRelations` type

### 1.2 Create Query Infrastructure

- [ ] Create `src/lib/query-keys.ts`
  - [ ] Implement `queryKeys.entity()` factory
  - [ ] Implement `queryKeys.entities()` factory
  - [ ] Implement `queryKeys.audit()` factory
  - [ ] Implement `queryKeys.related()` factory
  - [ ] Add specific query keys: `bookingPayments`, `guestBookings`, etc.

### 1.3 Create Validation Schemas

- [ ] Create `src/lib/validation/entity-schemas.ts`
  - [ ] Implement `bookingEditSchema` with Zod
  - [ ] Implement `unitEditSchema` with Zod
  - [ ] Implement `guestEditSchema` with Zod
  - [ ] Implement `paymentEditSchema` with Zod
  - [ ] Implement `expenseEditSchema` with Zod
  - [ ] Add DOMPurify sanitization in transforms
  - [ ] Export TypeScript types using `z.infer`

### 1.4 Create Custom Hooks

- [ ] Create `src/hooks/entity/useEntityDetail.ts`
  - [ ] Implement generic entity fetching
  - [ ] Add type-safe switch for entity types
  - [ ] Configure staleTime and caching
  - [ ] Add error handling

- [ ] Create `src/hooks/entity/useEntityEdit.ts`
  - [ ] Implement generic entity updates
  - [ ] Add optimistic update logic
  - [ ] Add rollback on error
  - [ ] Integrate audit logging
  - [ ] Add toast notifications

- [ ] Create `src/hooks/entity/useEntityAudit.ts`
  - [ ] Implement audit log fetching
  - [ ] Add filtering by entity type and ID
  - [ ] Support date range filters
  - [ ] Configure query caching

- [ ] Create `src/hooks/entity/useEntityNavigation.ts`
  - [ ] Implement `navigateToDetail()` helper
  - [ ] Implement `navigateToEdit()` helper
  - [ ] Implement `navigateToList()` helper
  - [ ] Add type-safe route mapping

- [ ] Create `src/hooks/entity/useDetailPageState.ts`
  - [ ] Implement tab state management
  - [ ] Sync with URL search params
  - [ ] Add replace navigation

- [ ] Create `src/hooks/entity/index.ts`
  - [ ] Export all hooks

### 1.5 Create Shared UI Components

- [ ] Create `src/components/entity-detail/` directory

- [ ] Create `DetailPageLayout.tsx`
  - [ ] Implement layout wrapper with container
  - [ ] Add breadcrumb navigation
  - [ ] Add header with title, subtitle, actions
  - [ ] Add edit button integration
  - [ ] Add responsive styling

- [ ] Create `DetailPageHeader.tsx`
  - [ ] Implement breadcrumb component
  - [ ] Add title and subtitle display
  - [ ] Add status badge slot
  - [ ] Add actions slot
  - [ ] Add mobile responsive header

- [ ] Create `DetailSection.tsx`
  - [ ] Implement card-based section
  - [ ] Add title with optional icon
  - [ ] Add action slot
  - [ ] Add collapsible functionality
  - [ ] Add responsive padding

- [ ] Create `DetailField.tsx`
  - [ ] Implement label-value pair display
  - [ ] Support vertical and horizontal layouts
  - [ ] Add icon support
  - [ ] Add custom className props
  - [ ] Add proper styling for labels and values

- [ ] Create `RelatedEntityLink.tsx`
  - [ ] Implement type-safe Link wrapper
  - [ ] Add entity type icons
  - [ ] Map entity types to routes
  - [ ] Add badge support for secondary info
  - [ ] Add hover states

- [ ] Create `DetailAuditSection.tsx`
  - [ ] Wrap AuditLogViewer component
  - [ ] Add entity type and ID filtering
  - [ ] Implement collapsible section
  - [ ] Add mobile default collapsed state
  - [ ] Add limit prop for entries

- [ ] Create `DetailPageSkeleton.tsx`
  - [ ] Implement breadcrumb skeleton
  - [ ] Add header skeleton
  - [ ] Add section skeletons (3 sections)
  - [ ] Match layout structure
  - [ ] Add proper spacing

- [ ] Create `DetailErrorBoundary.tsx`
  - [ ] Implement error display
  - [ ] Add retry button
  - [ ] Add back button
  - [ ] Add custom error messages
  - [ ] Add reset functionality

- [ ] Create `utils/formatters.ts`
  - [ ] Implement `formatCurrency()` for PHP
  - [ ] Implement `formatTableDate()`
  - [ ] Implement `formatFullDate()`
  - [ ] Implement `formatDateTime()`
  - [ ] Implement `formatPhone()` for PH
  - [ ] Implement `formatPercentage()`
  - [ ] Implement `truncate()` helper

- [ ] Create `utils/types.ts`
  - [ ] Define shared component prop types
  - [ ] Export reusable type definitions

- [ ] Create `index.ts` barrel export
  - [ ] Export all shared components

---

## Phase 2: Bookings Implementation (Reference)

### 2.1 Create Booking Routes

- [ ] Create `src/routes/_authenticated/bookings/$bookingId.tsx`
  - [ ] Define route with params validation (Zod)
  - [ ] Define search param schema (tab selection)
  - [ ] Implement loader with booking data prefetch
  - [ ] Prefetch related data: guest, unit, payments, audit
  - [ ] Add pendingComponent (skeleton)
  - [ ] Add errorComponent
  - [ ] Set component to `BookingDetailPage`

- [ ] Create `src/routes/_authenticated/bookings/$bookingId.edit.tsx`
  - [ ] Define route with params validation
  - [ ] Add `beforeLoad` permission check
  - [ ] Add booking status check (prevent edit if CheckedOut/Cancelled)
  - [ ] Implement loader with booking fetch
  - [ ] Transform data for form initial values
  - [ ] Add pendingComponent
  - [ ] Add errorComponent
  - [ ] Set component to `BookingEditPage`

### 2.2 Create Booking Detail Component

- [ ] Create `src/components/bookings/BookingDetail/index.tsx`
  - [ ] Import DetailPageLayout
  - [ ] Use `useParams()` to get bookingId
  - [ ] Use `useLoaderData()` to get booking
  - [ ] Implement breadcrumbs: Bookings > {reference}
  - [ ] Add status badge
  - [ ] Add edit button with route

- [ ] Create "Booking Overview" section
  - [ ] Check-in/check-out dates (DetailField)
  - [ ] Number of guests
  - [ ] Total amount (monospace, bold)
  - [ ] 2-column grid responsive

- [ ] Create "Guest Information" section
  - [ ] Guest name as RelatedEntityLink
  - [ ] Email as plain text
  - [ ] Contact number formatted

- [ ] Create "Unit Information" section
  - [ ] Unit as RelatedEntityLink with badge
  - [ ] Unit type as plain text

- [ ] Create "Payment Details" section
  - [ ] Payment method badge
  - [ ] Payment status badge
  - [ ] List of payments if multiple

- [ ] Create "Special Requests" section (conditional)
  - [ ] Display sanitized text
  - [ ] Only show if exists

- [ ] Add DetailAuditSection
  - [ ] entityType: 'booking'
  - [ ] entityId: bookingId

### 2.3 Create Booking Edit Component

- [ ] Create `src/components/bookings/BookingEdit/index.tsx`
  - [ ] Import DetailPageLayout
  - [ ] Use `useParams()` and `useLoaderData()`
  - [ ] Setup `useForm` with React Hook Form
  - [ ] Use `zodResolver(bookingEditSchema)`
  - [ ] Set defaultValues from loader data
  - [ ] Setup `useEntityEdit('booking', bookingId)` mutation
  - [ ] Handle onSuccess navigation
  - [ ] Implement breadcrumbs

- [ ] Create form sections:
  - [ ] Guest Information (name, email, phone)
  - [ ] Booking Dates (check-in, check-out with validation)
  - [ ] Unit Selection (dropdown with availability)
  - [ ] Number of Guests (number input)
  - [ ] Payment Information (method, amount)
  - [ ] Special Requests (textarea, sanitized)

- [ ] Add form actions:
  - [ ] Save button (submit)
  - [ ] Cancel button (navigate back)
  - [ ] Loading state on submit
  - [ ] Validation error display

### 2.4 Update Bookings Table

- [ ] Modify `src/components/bookings/BookingsTable/components/BookingColumns.tsx`
  - [ ] Import `Link` from TanStack Router
  - [ ] Update `booking_reference` column to use Link
  - [ ] Navigate to `/bookings/$bookingId`
  - [ ] Update `guest_name` column to use Link
  - [ ] Navigate to `/guests/$guestId`
  - [ ] Add proper styling (blue text, underline on hover)

### 2.5 Test Booking Routes

- [ ] Test detail page loads correctly
- [ ] Test all data displays properly
- [ ] Test breadcrumb navigation works
- [ ] Test clicking guest name navigates to guest (when guest route exists)
- [ ] Test clicking unit name navigates to unit (when unit route exists)
- [ ] Test edit button navigates to edit page
- [ ] Test edit form validation
- [ ] Test form submission and navigation
- [ ] Test audit trail displays
- [ ] Test responsive design on mobile
- [ ] Test loading states
- [ ] Test error states

---

## Phase 3: Units Implementation

### 3.1 Create Unit Routes

- [ ] Create `src/routes/_authenticated/units/$unitId.tsx`
  - [ ] Define route with UUID validation
  - [ ] Implement loader with unit data
  - [ ] Prefetch related bookings
  - [ ] Prefetch revenue stats
  - [ ] Add loading and error components

- [ ] Create `src/routes/_authenticated/units/$unitId.edit.tsx`
  - [ ] Add permission check in `beforeLoad`
  - [ ] Implement loader with unit fetch
  - [ ] Transform for form values

### 3.2 Create Unit Components

- [ ] Create `src/components/units/UnitDetail/index.tsx`
  - [ ] Implement detail page layout
  - [ ] Add "Unit Specifications" section
  - [ ] Add "Pricing Information" section (monospace)
  - [ ] Add "Amenities" section (badges)
  - [ ] Add "Current/Upcoming Bookings" list
  - [ ] Add "Revenue Statistics" section
  - [ ] Add audit trail

- [ ] Create `src/components/units/UnitEdit/index.tsx`
  - [ ] Implement edit form
  - [ ] Basic info fields
  - [ ] Pricing fields (currency inputs)
  - [ ] Amenities multi-select
  - [ ] Status select

### 3.3 Update Units Table

- [ ] Modify `src/components/units/UnitsTable/components/UnitColumns.tsx`
  - [ ] Update `unit_name` column to Link
  - [ ] Navigate to `/units/$unitId`

### 3.4 Test Unit Routes

- [ ] Test detail page
- [ ] Test edit functionality
- [ ] Test navigation from table
- [ ] Test navigation from bookings
- [ ] Test responsive design

---

## Phase 4: Guests Implementation

### 4.1 Create Guest Routes

- [ ] Create `src/routes/_authenticated/guests/$guestId.tsx`
  - [ ] Define route with validation
  - [ ] Load guest data with bookings
  - [ ] Calculate statistics (total spent, bookings)
  - [ ] Prefetch audit logs

- [ ] Create `src/routes/_authenticated/guests/$guestId.edit.tsx`
  - [ ] Add permission check
  - [ ] Load guest data for form

### 4.2 Create Guest Components

- [ ] Create `src/components/guests/GuestDetail/index.tsx`
  - [ ] Implement detail layout
  - [ ] Add "Contact Information" section
  - [ ] Add "Guest Statistics" section (monospace amounts)
  - [ ] Add "Booking History" table/cards
  - [ ] Link each booking to detail
  - [ ] Add "Notes" section (if exists)
  - [ ] Add audit trail

- [ ] Create `src/components/guests/GuestEdit/index.tsx`
  - [ ] Implement edit form
  - [ ] Personal info fields
  - [ ] Address textarea (sanitized)
  - [ ] Notes textarea (sanitized)

### 4.3 Update Guests Table

- [ ] Modify `src/components/guests/GuestsTable/components/GuestColumns.tsx`
  - [ ] Update `guest_name` column to Link
  - [ ] Navigate to `/guests/$guestId`

### 4.4 Test Guest Routes

- [ ] Test detail page with booking history
- [ ] Test statistics calculation
- [ ] Test edit functionality
- [ ] Test navigation from bookings table
- [ ] Test navigation to booking details

---

## Phase 5: Payments Implementation

### 5.1 Create Payment Routes

- [ ] Create `src/routes/_authenticated/payments/$paymentId.tsx`
  - [ ] Define route with validation
  - [ ] Load payment with booking relation
  - [ ] Prefetch audit logs

- [ ] Create `src/routes/_authenticated/payments/$paymentId.edit.tsx`
  - [ ] Add manager permission check
  - [ ] Add verified status check
  - [ ] Only admins can edit verified payments
  - [ ] Load payment data

### 5.2 Create Payment Components

- [ ] Create `src/components/payments/PaymentDetail/index.tsx`
  - [ ] Implement detail layout
  - [ ] Add "Payment Overview" (large amount display)
  - [ ] Add "Related Booking" section with link
  - [ ] Add "Payment Proof" image viewer (if exists)
  - [ ] Add "Transaction Notes" (if exists)
  - [ ] Add audit trail

- [ ] Create `src/components/payments/PaymentEdit/index.tsx`
  - [ ] Implement edit form (limited)
  - [ ] Amount/method (disabled if verified)
  - [ ] Status select
  - [ ] Verification notes textarea
  - [ ] Proof upload/replace

### 5.3 Update Payments Table

- [ ] Modify `src/components/payments/PaymentsTable/components/PaymentColumns.tsx`
  - [ ] Update `booking_reference` column to Link
  - [ ] Navigate to `/bookings/$bookingId`

### 5.4 Test Payment Routes

- [ ] Test detail page
- [ ] Test proof image viewer
- [ ] Test edit restrictions (verified status)
- [ ] Test navigation to booking
- [ ] Test audit trail (verification history)

---

## Phase 6: Expenses Implementation

### 6.1 Create Expense Routes

- [ ] Create `src/routes/_authenticated/expenses/$expenseId.tsx`
  - [ ] Define route with validation
  - [ ] Load expense with optional unit relation
  - [ ] Load creator user info
  - [ ] Prefetch audit logs

- [ ] Create `src/routes/_authenticated/expenses/$expenseId.edit.tsx`
  - [ ] Add creator/manager permission check
  - [ ] Load expense data

### 6.2 Create Expense Components

- [ ] Create `src/components/expenses/ExpenseDetail/index.tsx`
  - [ ] Implement detail layout
  - [ ] Add "Expense Overview" (amount, category, date)
  - [ ] Add "Description" full text
  - [ ] Add "Related Unit" link (if exists)
  - [ ] Add "Receipt" image viewer (if exists)
  - [ ] Add "Internal Notes" (if exists)
  - [ ] Add audit trail

- [ ] Create `src/components/expenses/ExpenseEdit/index.tsx`
  - [ ] Implement edit form
  - [ ] Description input (max 200 chars)
  - [ ] Amount currency input
  - [ ] Date picker
  - [ ] Category select
  - [ ] Unit dropdown (optional)
  - [ ] Receipt upload
  - [ ] Notes textarea (sanitized)

### 6.3 Update Expenses Table

- [ ] Modify `src/components/expenses/ExpensesTable/components/ExpenseColumns.tsx`
  - [ ] Update `description` column to Link
  - [ ] Truncate long descriptions (50 chars)
  - [ ] Add full text as title attribute
  - [ ] Navigate to `/expenses/$expenseId`

### 6.4 Test Expense Routes

- [ ] Test detail page
- [ ] Test receipt viewer
- [ ] Test edit restrictions (creator/manager only)
- [ ] Test navigation from table
- [ ] Test unit linking

---

## Phase 7: Cross-Integration Testing

### 7.1 Navigation Flow Testing

- [ ] Test Booking → Guest navigation
- [ ] Test Booking → Unit navigation
- [ ] Test Booking → Payment navigation
- [ ] Test Guest → Booking navigation
- [ ] Test Unit → Booking navigation
- [ ] Test Payment → Booking navigation
- [ ] Test Expense → Unit navigation

### 7.2 Breadcrumb Navigation

- [ ] Test breadcrumbs on all detail pages
- [ ] Test breadcrumbs on all edit pages
- [ ] Test clicking breadcrumb links
- [ ] Verify correct navigation paths

### 7.3 Audit Trail Integration

- [ ] Verify audit logs display on all detail pages
- [ ] Test filtering by entity type and ID
- [ ] Test date range filters
- [ ] Test audit log for create actions
- [ ] Test audit log for update actions
- [ ] Test audit log for status changes

### 7.4 Permissions Testing

- [ ] Test edit access for regular users
- [ ] Test edit access for managers
- [ ] Test edit access for admins
- [ ] Test edit restrictions on finalized entities
- [ ] Test redirect on insufficient permissions

---

## Phase 8: Polish & Optimization

### 8.1 Loading States

- [ ] Verify skeleton displays on all detail pages
- [ ] Verify skeleton displays on all edit pages
- [ ] Test loading states during navigation
- [ ] Verify smooth transitions

### 8.2 Error Handling

- [ ] Test 404 for non-existent entities
- [ ] Test error display for failed loads
- [ ] Test retry functionality
- [ ] Test back navigation from errors
- [ ] Test form validation errors
- [ ] Test network error handling

### 8.3 Mobile Optimization

- [ ] Test all detail pages on mobile (<768px)
- [ ] Test all edit pages on mobile
- [ ] Verify single-column stacking
- [ ] Test collapsible audit sections on mobile
- [ ] Test touch targets (44x44px minimum)
- [ ] Test mobile breadcrumbs
- [ ] Test mobile headers with back button

### 8.4 Performance Optimization

- [ ] Verify route code splitting
- [ ] Test prefetching on hover
- [ ] Verify query caching (staleTime)
- [ ] Test optimistic updates
- [ ] Measure page load times (<2s)
- [ ] Test with slow network (3G)

### 8.5 Accessibility Audit

- [ ] Run Lighthouse accessibility audit
- [ ] Test keyboard navigation (Tab, Enter, Esc)
- [ ] Test screen reader compatibility
- [ ] Verify ARIA labels on all components
- [ ] Test color contrast (4.5:1 minimum)
- [ ] Test focus indicators
- [ ] Verify semantic HTML structure

---

## Phase 9: Documentation & Handoff

### 9.1 Code Documentation

- [ ] Add JSDoc comments to all hooks
- [ ] Add JSDoc comments to shared components
- [ ] Document component props with examples
- [ ] Add inline comments for complex logic

### 9.2 Testing Documentation

- [ ] Write unit tests for hooks
- [ ] Write component tests for shared components
- [ ] Write integration tests for navigation flows
- [ ] Document test coverage requirements

### 9.3 Usage Documentation

- [ ] Create developer guide for adding new entities
- [ ] Document common patterns and conventions
- [ ] Create troubleshooting guide
- [ ] Document performance best practices

### 9.4 Deployment Checklist

- [ ] Run all tests (`npm run test:run`)
- [ ] Run type checking (`npm run type-check`)
- [ ] Run linting (`npm run lint`)
- [ ] Run build (`npm run build`)
- [ ] Verify bundle size (check for regressions)
- [ ] Test on staging environment
- [ ] Perform smoke tests on production

---

## Implementation Timeline

### Week 1: Foundation

- Day 1-2: Types, hooks, query infrastructure
- Day 3-4: Shared UI components
- Day 5: Testing foundation components

### Week 2: Core Entities

- Day 1-2: Bookings (detail + edit + table updates)
- Day 3: Guests (detail + edit + table updates)
- Day 4: Units (detail + edit + table updates)
- Day 5: Integration testing

### Week 3: Financial Entities

- Day 1-2: Payments (detail + edit + table updates)
- Day 3: Expenses (detail + edit + table updates)
- Day 4-5: Cross-integration testing

### Week 4: Polish & Deploy

- Day 1-2: Mobile optimization
- Day 3: Performance optimization
- Day 4: Accessibility audit
- Day 5: Final testing and deployment

---

## Success Criteria

### Functionality

- ✅ All 10 routes created and functional
- ✅ All clickable navigation working
- ✅ All audit trails displaying correctly
- ✅ All edit forms validating and submitting
- ✅ All permissions enforced properly

### Quality

- ✅ Zero TypeScript errors
- ✅ All ESLint rules passing
- ✅ Test coverage >80% for new code
- ✅ Lighthouse score >90
- ✅ WCAG 2.1 AA compliance

### Performance

- ✅ Initial page load <2 seconds
- ✅ Navigation <500ms
- ✅ Form submission <1 second
- ✅ Bundle size increase <100KB

### User Experience

- ✅ Responsive on all devices
- ✅ Intuitive navigation
- ✅ Clear error messages
- ✅ Smooth loading states
- ✅ Consistent design across entities

---

## Risk Mitigation

### Potential Issues

**Issue**: Complex state management across routes

- **Mitigation**: Use TanStack Query for server state, minimize client state

**Issue**: Performance degradation with large datasets

- **Mitigation**: Implement pagination, virtual scrolling, aggressive caching

**Issue**: Navigation state loss

- **Mitigation**: Persist filters/sort in URL params or session storage

**Issue**: Mobile navigation complexity

- **Mitigation**: Simplify mobile UI, use bottom sheets for actions

**Issue**: Audit trail performance

- **Mitigation**: Limit default entries, add pagination, cache aggressively

---

## Post-Implementation

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Monitor page load performance
- [ ] Track navigation patterns
- [ ] Monitor API response times
- [ ] Track user engagement metrics

### Maintenance

- [ ] Plan for regular dependency updates
- [ ] Schedule quarterly accessibility audits
- [ ] Monitor bundle size growth
- [ ] Review and optimize slow queries

### Future Enhancements

- [ ] Add bulk actions on list pages
- [ ] Implement advanced search/filters
- [ ] Add export functionality
- [ ] Consider print views for reports
- [ ] Explore offline capabilities

---

## Summary

This integration checklist provides:

- ✅ **Step-by-step implementation plan** for all phases
- ✅ **Detailed task breakdown** for each entity
- ✅ **Testing requirements** at each phase
- ✅ **Quality assurance checklist** for polish
- ✅ **Timeline and resource planning**
- ✅ **Success criteria** for delivery
- ✅ **Risk mitigation strategies**
- ✅ **Post-implementation monitoring**

Follow this checklist sequentially to ensure successful implementation of all detail and edit pages across the Okaeri Resort System.
