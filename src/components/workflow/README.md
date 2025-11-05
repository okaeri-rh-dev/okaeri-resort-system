# 🔄 Workflow Module Documentation

## Overview

The **Workflow Module** provides booking status visualization and workflow state management components for the resort management system. Currently in Phase 2, this module delivers simplified status badge display with plans for comprehensive workflow automation, transition management, and analytics in future phases.

The module is designed to support the booking lifecycle from initial submission through check-in, stay, check-out, and post-stay processes. It provides visual indicators of booking status, payment status, and will eventually enable interactive workflow controls and automated state transitions.

This documentation covers the **current Phase 2 implementation** (production-ready status badges) and outlines the **Phase 3-4 roadmap** for advanced workflow management features.

## Module Architecture

```
src/components/workflow/
├── WorkflowStatusBadge.tsx               (53 lines, 1.5 KB)   # Production: Status display
└── WorkflowDashboard.phase3-4.tsx        (520 lines, 20 KB)  # Future: Workflow dashboard

Current Phase 2 Production:
└── WorkflowStatusBadge                   # Simple status badge component

Phase 3-4 Planned:
├── WorkflowDashboard                     # Comprehensive workflow management
├── WorkflowTransitionControls            # Interactive state transitions
├── WorkflowTimeline                      # Visual workflow history
├── WorkflowAutomation                    # Automated triggers and rules
└── WorkflowAnalytics                     # Performance metrics and insights

Total: 573 lines across 2 files (1 production, 1 future)
```

## Component Documentation

### WorkflowStatusBadge (Phase 2 - Production)

**Purpose:** Displays booking status and payment status as color-coded badges, providing instant visual recognition of booking state across the application. This component serves as the primary status indicator in tables, cards, and detail views.

**Key Features:**

1. **Booking Status Display**
   - Color-coded badges for each booking status
   - **Pending:** Yellow background (awaiting confirmation)
   - **Confirmed:** Blue background (booking confirmed)
   - **CheckedIn:** Green background (guest currently staying)
   - **CheckedOut:** Gray background (stay completed)
   - **Cancelled:** Red background (booking cancelled)

2. **Payment Status Display**
   - Optional secondary badge showing payment status
   - Outline variant for secondary emphasis
   - Smaller text size (text-xs) for hierarchy
   - Only shown if payment_status is present

3. **Display Variants**
   - **Default variant:** Status badge + payment status badge (if present)
   - **Compact variant:** Status badge only (no payment status)
   - Configurable via `variant` prop

4. **Consistent Styling**
   - Uses shadcn/ui Badge component
   - Border colors match background colors
   - 100 tint for backgrounds, 800 for text
   - Professional, accessible color contrast

5. **Type Safety**
   - Uses BookingStatus type from types module
   - Fallback styling for unknown statuses
   - TypeScript ensures status validity

**Component Props:**
- `booking` (Booking, required): Full booking object with status fields
- `variant` ("default" | "compact", optional, default: "default"): Display mode
- `className` (string, optional): Additional CSS classes

**Status Color Mapping:**
- **Pending:** bg-yellow-100 text-yellow-800 border-yellow-200
- **Confirmed:** bg-blue-100 text-blue-800 border-blue-200
- **CheckedIn:** bg-green-100 text-green-800 border-green-200
- **CheckedOut:** bg-gray-100 text-gray-800 border-gray-200
- **Cancelled:** bg-red-100 text-red-800 border-red-200
- **Unknown/Fallback:** bg-gray-100 text-gray-800

**Usage Contexts:**
- **Bookings table:** Compact variant in status column
- **Booking detail page:** Default variant with payment status
- **Dashboard cards:** Compact variant for space efficiency
- **Calendar views:** Badge overlay on date cells

**Accessibility:**
- Color-coded badges paired with text labels
- Sufficient color contrast (WCAG AA)
- Status text always visible (not icon-only)
- Screen readers announce status text

**Design Rationale:**
- Simplified for Phase 2 to focus on core functionality
- Interactive controls deferred to Phase 3-4
- Provides essential status visibility without complexity
- Foundation for future workflow enhancements

---

### WorkflowDashboard (Phase 3-4 - Planned)

**Purpose:** Comprehensive dashboard for monitoring and managing serverless booking workflows, providing real-time metrics, cost monitoring, execution history, automated trigger status, and batch processing controls.

**Planned Features:**

1. **Real-Time Workflow Metrics**
   - Active workflow executions count
   - Average execution duration
   - Success/failure rates
   - Pending bookings requiring attention
   - Workflow throughput metrics

2. **Cost Monitoring**
   - Serverless function execution costs
   - Daily/monthly cost tracking
   - Budget alerts and thresholds
   - Cost per booking calculation
   - Optimization recommendations

3. **Execution History**
   - Recent workflow executions table
   - Execution details and logs
   - Success/failure indicators
   - Execution duration tracking
   - Error message display

4. **Batch Processing Controls**
   - Manual trigger for batch workflow processing
   - Process multiple bookings simultaneously
   - Progress indicator during batch execution
   - Success/failure summary after completion
   - Configurable batch size

5. **Workflow Automation Status**
   - Automated trigger status display
   - Cron job execution history
   - Scheduled workflow indicators
   - Automation health monitoring

6. **Interactive Workflow Transitions**
   - Manual state transition controls
   - Validation before transitions
   - Transition confirmation dialogs
   - Workflow history timeline
   - Undo/rollback capabilities

7. **Analytics and Insights**
   - Booking funnel conversion rates
   - Average time in each status
   - Bottleneck identification
   - Trend analysis charts
   - Performance optimization suggestions

**Component Structure (Planned):**
- Tabs for Overview, Executions, Cost, Settings
- Metric cards for key performance indicators
- Execution history table with pagination
- Cost alert notifications
- Batch processing modal/drawer
- Real-time updates via polling or websockets

**Integration Points (Planned):**
- useWorkflowStore for workflow state management
- useBookingStore for booking data
- useWorkflowSummary for aggregated metrics
- useWorkflowExecutionHistory for execution logs
- useWorkflowCostMonitoring for cost tracking

**Phase 3-4 Timeline:**
- Phase 3: Workflow automation and batch processing
- Phase 4: Advanced analytics and optimization tools

---

## Technical Implementation

### Current Phase 2 Architecture

**Simple Status Display:**
- Single component for status visualization
- No state management (stateless component)
- Receives booking object via props
- Maps status to color scheme
- Renders Badge components

**Type Safety:**
- BookingStatus type imported from types module
- Ensures only valid statuses rendered
- Fallback for unknown statuses prevents errors
- TypeScript compilation enforces type safety

**Styling Approach:**
- Uses Tailwind CSS utility classes
- Color scheme defined in STATUS_STYLES constant
- Consistent with design system colors
- Accessible contrast ratios

### Phase 3-4 Architecture (Planned)

**Workflow State Management:**
- Zustand store for workflow execution state
- TanStack Query for server data fetching
- Real-time updates via polling or subscriptions
- Optimistic updates for transitions

**Serverless Integration:**
- Cloudflare Workers for workflow execution
- Scheduled cron jobs for automation
- Queue-based batch processing
- Cost tracking via analytics

**Analytics Pipeline:**
- Time-series data collection
- Aggregation queries for metrics
- Historical trend analysis
- Performance benchmarking

---

## Booking Status Workflow

### Status Flow Diagram

```
┌─────────────┐
│   Pending   │ ← Initial booking submission (public form)
└──────┬──────┘
       │ (Admin reviews and confirms)
       ▼
┌─────────────┐
│  Confirmed  │ ← Booking confirmed, payment verified
└──────┬──────┘
       │ (Guest arrives, admin checks in)
       ▼
┌─────────────┐
│ CheckedIn   │ ← Guest currently staying at resort
└──────┬──────┘
       │ (Guest departs, admin checks out)
       ▼
┌─────────────┐
│ CheckedOut  │ ← Stay completed, final settlement
└─────────────┘

Alternative Flow:
┌─────────────┐
│  Cancelled  │ ← Booking cancelled (any stage before CheckedOut)
└─────────────┘
```

### Status Definitions

**Pending:**
- Initial state after guest submits booking
- Awaiting admin review and payment verification
- Payment proof uploaded but not yet verified
- Unit assignment not yet confirmed
- Typical duration: 4-24 hours

**Confirmed:**
- Admin has verified payment
- Unit(s) assigned to booking
- Guest contacted with confirmation details
- Awaiting check-in date
- Typical duration: Days to weeks before check-in

**CheckedIn:**
- Guest has arrived and checked in
- Currently occupying unit(s)
- Active stay in progress
- Unit marked as occupied
- Typical duration: Duration of stay (1-7+ nights)

**CheckedOut:**
- Guest has departed and checked out
- Final payment settled
- Unit cleaned and ready for next guest
- Booking archived
- Permanent state (no further transitions)

**Cancelled:**
- Booking cancelled by guest or admin
- Refund processed if applicable
- Unit(s) released back to availability
- Can occur from Pending or Confirmed states
- Permanent state (no further transitions)

### Valid State Transitions

**From Pending:**
- → Confirmed (payment verified, admin confirms)
- → Cancelled (cancellation requested, payment issue)

**From Confirmed:**
- → CheckedIn (guest arrives, admin checks in)
- → Cancelled (cancellation requested before check-in)

**From CheckedIn:**
- → CheckedOut (guest departs, admin checks out)
- ⚠️ Cannot cancel (stay in progress)

**From CheckedOut:**
- No valid transitions (terminal state)

**From Cancelled:**
- No valid transitions (terminal state)

---

## Payment Status Integration

### Payment Status Values

**Payment statuses shown in default variant:**
- **Pending:** Payment proof uploaded, awaiting verification
- **Partial:** Downpayment received, balance pending
- **Paid:** Full payment received and verified
- **Refunded:** Payment refunded due to cancellation
- **Failed:** Payment verification failed

### Combined Status Display

The default variant shows both booking status and payment status for complete booking state visibility:

**Example Combinations:**
- **Pending + Pending:** New booking, payment being verified
- **Confirmed + Partial:** Booking confirmed, downpayment only
- **Confirmed + Paid:** Booking confirmed, fully paid
- **CheckedIn + Paid:** Guest currently staying, fully paid
- **Cancelled + Refunded:** Booking cancelled, refund processed

### Status Badge Hierarchy

**Primary badge (larger, colored):** Booking status
- Indicates current stage in booking lifecycle
- Color-coded for instant recognition
- Always visible in both variants

**Secondary badge (smaller, outline):** Payment status
- Provides additional financial context
- Outline variant for visual hierarchy
- Only shown in default variant
- Hidden if payment_status is null/undefined

---

## Styling and Design System

### Color Palette

**Booking Status Colors:**
- **Pending:** Yellow (cautionary, awaiting action)
- **Confirmed:** Blue (positive, confirmed state)
- **CheckedIn:** Green (success, active stay)
- **CheckedOut:** Gray (neutral, completed)
- **Cancelled:** Red (negative, terminated)

**Color Accessibility:**
- All colors meet WCAG AA contrast requirements
- Background: 100 tint (light)
- Text: 800 shade (dark)
- Border: 200 tint (medium)
- Sufficient contrast for colorblind users

### Typography

**Badge Text:**
- Font weight: Medium (inherited from Badge component)
- Font size: Small (Badge default) for status
- Font size: Extra small (text-xs) for payment status
- No text transform (maintains readability)

### Spacing and Layout

**Default Variant:**
- Inline-flex container with gap-2
- Badges aligned horizontally
- Items centered vertically
- Respects custom className for additional spacing

**Compact Variant:**
- Single badge only
- No additional container
- Minimal footprint
- Ideal for dense table layouts

---

## Best Practices

### ✅ DO:

1. **Use compact variant in tables**
   - Saves horizontal space
   - Reduces visual clutter
   - Shows most critical information (booking status)
   - Payment status visible in detail view

2. **Use default variant in detail views**
   - Provides complete status information
   - Payment status important for admin actions
   - More space available for detailed display
   - Better context for decision-making

3. **Apply custom className for layout adjustments**
   - Add margin/padding as needed
   - Align with surrounding elements
   - Maintain consistent spacing
   - Override default styles when necessary

4. **Provide full booking object**
   - Component extracts needed properties
   - Ensures all status fields available
   - Type safety via Booking interface
   - Future-proof for additional fields

5. **Use status badges consistently**
   - Same component throughout application
   - Consistent color meanings
   - Predictable behavior
   - Familiar to users

### ❌ DON'T:

1. **Don't create custom status badges**
   - Use WorkflowStatusBadge for all status display
   - Avoid duplicating color schemes
   - Maintain consistency across application
   - Reduces maintenance burden

2. **Don't override status colors**
   - Colors have specific meanings
   - Changing colors creates confusion
   - Breaks accessibility if contrast reduced
   - Users learn color associations

3. **Don't display status as text only**
   - Color coding provides instant recognition
   - Text-only harder to scan quickly
   - Badges provide visual hierarchy
   - Accessibility requires both color and text

4. **Don't show payment status in all contexts**
   - Use compact variant where space limited
   - Payment details not always relevant
   - Reduces cognitive load
   - Reserve for contexts where actionable

5. **Don't modify component for interactive controls**
   - Phase 2 component is display-only
   - Interactive controls planned for Phase 3-4
   - Premature features create technical debt
   - Wait for proper workflow implementation

---

## Future Enhancements (Phase 3-4)

### Workflow Automation

- ⬜ **Automated Status Transitions:** Auto-advance status based on conditions
- ⬜ **Payment Verification Workflow:** Auto-confirm on payment verification
- ⬜ **Check-In Reminders:** Automated reminders before check-in date
- ⬜ **Check-Out Processing:** Automated check-out after departure date
- ⬜ **Cancellation Workflows:** Automated refund processing
- ⬜ **Overdue Payment Alerts:** Flag bookings with overdue payments
- ⬜ **Unit Assignment Automation:** Auto-assign units based on rules

### Interactive Workflow Controls

- ⬜ **Manual Status Transition Buttons:** Admin controls for state changes
- ⬜ **Transition Confirmation Dialogs:** Prevent accidental state changes
- ⬜ **Validation Checks:** Ensure valid transitions only
- ⬜ **Transition History:** Log all status changes with timestamps
- ⬜ **Undo/Rollback:** Revert recent status changes
- ⬜ **Bulk Status Updates:** Change status for multiple bookings
- ⬜ **Conditional Transitions:** Rules-based state transitions

### Workflow Analytics

- ⬜ **Status Duration Metrics:** Average time in each status
- ⬜ **Conversion Funnel:** Pending → Confirmed → CheckedIn rates
- ⬜ **Bottleneck Identification:** Flag slow transitions
- ⬜ **Trend Analysis:** Status distribution over time
- ⬜ **Performance Benchmarks:** Compare against targets
- ⬜ **Predictive Analytics:** Forecast workflow completion
- ⬜ **Cost Per Transition:** Track workflow execution costs

### Workflow Dashboard

- ⬜ **Real-Time Metrics:** Live workflow execution stats
- ⬜ **Execution History:** Recent workflow runs with logs
- ⬜ **Cost Monitoring:** Serverless function cost tracking
- ⬜ **Batch Processing:** Manual trigger for bulk operations
- ⬜ **Automation Status:** Cron job health monitoring
- ⬜ **Alert Management:** Configure workflow alerts
- ⬜ **Performance Insights:** Optimization recommendations

### Enhanced Status Display

- ⬜ **Status Icons:** Add icons to badges for visual clarity
- ⬜ **Status Tooltips:** Hover details for status meaning
- ⬜ **Progress Indicators:** Show completion percentage
- ⬜ **Time Indicators:** Time in current status
- ⬜ **Next Action Hints:** Suggest next workflow step
- ⬜ **Animated Transitions:** Smooth status change animations
- ⬜ **Status Timeline:** Visual history of status changes

---

## Integration with Booking System

### Booking Table Integration

**Usage in BookingsTable:**
- Status column uses compact variant
- Sortable by booking_status field
- Filterable by status value
- Color-coded for quick scanning

**Props passed from table:**
- booking object from table row data
- variant="compact" for space efficiency
- className for table cell alignment

### Booking Detail Page Integration

**Usage in BookingDetail:**
- Header section uses default variant
- Shows both booking and payment status
- Prominent display for admin decision-making
- Additional context from surrounding fields

**Props passed from detail page:**
- booking object from page query
- variant="default" (shows payment status)
- className for page layout integration

### Dashboard Card Integration

**Usage in Dashboard:**
- Metric cards use compact variant
- Status breakdown charts reference colors
- Quick status filters use badge colors
- Consistent with table display

---

## Related Documentation

### Internal Documentation
- **[Bookings Module](../bookings/README.md)** - Booking management system using status badges
- **[UI Components](../ui/README.md)** - shadcn/ui Badge component
- **[Types Module](/src/types/index.ts)** - BookingStatus and Booking type definitions

### Store Documentation
- **[Booking Store](/src/stores/useBookingStore.ts)** - Booking state management
- **[Workflow Store](/src/stores/useWorkflowStore.ts)** - Phase 3-4 workflow state (planned)

### Phase Documentation
- **[CLAUDE.md](../../CLAUDE.md)** - Phase-based development approach
- **Phase 2:** Current simplified implementation (production)
- **Phase 3-4:** Advanced workflow features (planned)

---

## Maintenance Notes

### Known Limitations (Phase 2)

**No Interactive Controls:**
- Status badges are display-only
- No click handlers or transitions
- Admin must use booking form for status changes
- Interactive controls planned for Phase 3-4

**No Workflow Validation:**
- Component doesn't enforce valid transitions
- Backend validation handles state changes
- Frontend validation planned for Phase 3-4

**No Real-Time Updates:**
- Status display reflects current database value
- Updates require page refresh or query invalidation
- Real-time subscriptions planned for Phase 3-4

### Migration Path to Phase 3-4

**Backward Compatibility:**
- Phase 2 component will remain available
- Phase 3-4 adds new components (not replacements)
- Existing usage of WorkflowStatusBadge unchanged
- New features opt-in via new components

**Gradual Enhancement:**
- Phase 3: Add WorkflowDashboard component
- Phase 3: Add interactive transition controls
- Phase 4: Add analytics and automation
- Phase 2 component continues to work unchanged

### Browser Compatibility

**Tested and Supported:**
- ✅ All modern browsers (Chrome, Safari, Firefox, Edge 90+)
- ✅ Mobile browsers (iOS Safari, Android Chrome)
- No browser-specific features used
- Pure CSS and React (no APIs)

### Performance Considerations

**Rendering Performance:**
- Lightweight component (minimal logic)
- No expensive computations
- No state management overhead
- Fast render times (<1ms)

**Bundle Impact:**
- Minimal bundle size (~1.5KB)
- No heavy dependencies
- Badge component already in bundle
- No additional imports needed

---

**Last Updated:** 2025-01-05
**Current Phase:** Phase 2 (Production)
**Next Phase:** Phase 3-4 (Planned)
**Module Version:** 2.0.0
**Maintainer:** Okaeri Development Team
**Status:** ✅ Phase 2 Complete | 🚧 Phase 3-4 In Planning
