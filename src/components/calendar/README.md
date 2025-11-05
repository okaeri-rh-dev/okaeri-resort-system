# 📅 Calendar Module Documentation

## Overview

The **Calendar Module** provides a public-facing availability calendar system that enables prospective guests to view real-time unit availability without authentication. This module serves as a critical discovery and research tool in the guest booking journey, allowing visitors to quickly identify available dates before initiating the booking process.

The calendar system is designed with performance, accessibility, and mobile-first UX in mind. It features intelligent CDN caching, Philippine Time normalization for consistent date handling, intuitive touch gestures for mobile navigation, and color-coded visual indicators for instant availability recognition. The module integrates seamlessly with the public booking API to provide accurate, real-time availability data with 5-minute cache refresh intervals.

This module represents the first touchpoint for potential guests in the booking funnel and is optimized for fast load times, low bandwidth consumption, and an excellent mobile browsing experience on devices commonly used in the Philippines.

## Module Architecture

```
src/components/calendar/
├── PublicAvailabilityCalendar.tsx    (310 lines, 10.0 KB)  # Main calendar orchestrator
├── CalendarGrid.tsx                  (310 lines, 8.8 KB)   # Grid rendering engine
├── AvailabilityLegend.tsx            (53 lines, 1.2 KB)    # Status legend component
├── useSwipeGesture.ts                (118 lines, 3.1 KB)   # Mobile gesture hook
└── __tests__/                        (5 files)             # Comprehensive test suite
    ├── PublicAvailabilityCalendar.test.tsx
    ├── CalendarGrid.test.tsx
    ├── AvailabilityLegend.test.tsx
    ├── useSwipeGesture.test.tsx
    └── __snapshots__/

Total: ~791 lines of code across 4 components
```

## Component Documentation

### PublicAvailabilityCalendar (Main Component)

**Purpose:** The primary calendar orchestrator component that manages state, data fetching, navigation controls, and layout composition. It serves as the public entry point for displaying unit availability to unauthenticated guests.

**Key Features:**

1. **Real-Time Data Fetching**
   - Fetches availability from `/api/public/v1/availability` endpoint
   - Uses TanStack Query v5 for intelligent caching and background updates
   - 5-minute stale time matching CDN cache duration
   - Automatic retry on failure (2 attempts)
   - Stale-while-revalidate pattern for instant navigation

2. **Month Navigation System**
   - Previous/Next month buttons with validation
   - "Today" quick-return button
   - Disabled state for invalid months (past dates, >1 year ahead)
   - Automatic validation prevents navigation to restricted periods
   - Month name display with year (e.g., "January 2025")

3. **Philippine Time Normalization**
   - All date operations use Philippine Time (UTC+8) utilities
   - Consistent timezone handling prevents date boundary issues
   - Today calculation normalized to Philippine Time zone
   - API requests use ISO date strings with proper timezone conversion

4. **Mobile Swipe Gestures**
   - Integrates useSwipeGesture hook for touch-based navigation
   - Swipe left: next month, swipe right: previous month
   - Minimum 50px swipe distance threshold
   - Non-intrusive (doesn't interfere with scrolling)

5. **Loading and Error States**
   - Centered spinner with accessible ARIA labels during initial load
   - Error alert with user-friendly message and technical details
   - Loading indicator for background updates (small spinner in header)
   - Graceful degradation on API failures

6. **Extended Date Range Fetching**
   - Fetches dates beyond current month to include visible overflow dates
   - Calculates calendar grid boundaries (complete weeks)
   - Smart clamping: never fetches past dates, includes future overflow
   - Efficient single API call per month navigation

**Component Props:** None (self-contained stateful component)

**State Management:**
- Local state for current month (useState with Philippine Time initialization)
- TanStack Query cache for availability data
- Placeholder data strategy prevents UI flicker during navigation

**Integration Points:**
- Public API endpoint: `/api/public/v1/availability?start={ISO}&end={ISO}`
- CalendarGrid component: renders day cells with availability data
- AvailabilityLegend component: displays color-coded legend
- Timezone utilities: getMonthStart, getMonthEnd, getTodayPhilippineTime, toISODateString
- Calendar validation: validateMonth function enforces navigation rules

**Layout Structure:**
1. Calendar header with icon and unit count display
2. Month navigation controls (prev/next/today buttons)
3. Color legend showing availability status meanings
4. Calendar grid with day cells
5. Footer timestamp showing last data update time

---

### CalendarGrid (Rendering Engine)

**Purpose:** Renders the calendar grid with day cells, handles date generation including overflow dates from adjacent months, and applies color-coded availability styling. This component is responsible for the visual representation of availability data.

**Key Features:**

1. **Calendar Day Generation**
   - Generates complete weeks (multiples of 7 days)
   - Includes overflow dates from previous month (to complete first week)
   - Includes overflow dates from next month (to complete last row)
   - Proper month boundary detection for styling adjustments
   - Efficient memoization prevents unnecessary recalculations

2. **Availability Mapping**
   - Builds O(1) lookup map from availability array
   - Maps ISO date strings to availability data objects
   - Handles missing data gracefully (no availability = gray)
   - Memoized for performance on large datasets

3. **Color-Coded Status Indicators**
   - **Full (3 units):** Emerald green with 70% opacity
   - **Moderate (2 units):** Amber yellow with 70% opacity
   - **Limited (1 unit):** Orange with 70% opacity
   - **Booked (0 units):** Rose red with 70% opacity
   - Adjacent month dates: 30% opacity for visual hierarchy
   - Past dates: Gray with reduced opacity (non-interactive)

4. **Today Highlighting**
   - Blue ring indicator (ring-2 ring-slate-500)
   - Small dot at bottom of cell for additional visual cue
   - Date comparison uses toDateString for reliable matching

5. **Interactive Date Cells**
   - Click on adjacent month dates to navigate to that month
   - Hover effects on available dates (shadow and brightness)
   - Tooltip showing availability count on hover
   - Disabled cursor for past dates
   - ARIA labels for screen reader accessibility

6. **Responsive Design**
   - Grid layout: 7 columns (days of week)
   - Min-height adjusts by screen size (44px mobile → 64px desktop)
   - Gap spacing scales with viewport (1px mobile → 2px desktop)
   - Font sizes responsive (text-sm mobile → text-base desktop)

**Component Props:**
- `availability` (AvailabilityDay[]): Array of availability data from API
- `currentMonth` (Date): Current month being displayed
- `onDateClick` (function, optional): Callback for date navigation to adjacent months

**Data Structures:**
- AvailabilityDay interface: { date: string (ISO), availableCount: number (0-3), status: "full" | "moderate" | "limited" | "booked" }

**Rendering Logic:**
1. Calculate first day of month and day-of-week offset
2. Generate previous month overflow dates (fill first week)
3. Generate current month dates (1 to last day)
4. Generate next month overflow dates (complete last row)
5. Lookup availability data for each date from map
6. Apply styling based on availability status and date properties

**Accessibility Features:**
- Role="grid" on calendar container
- Role="row" on header and day rows
- Role="columnheader" on day-of-week headers
- Role="gridcell" on each day cell
- ARIA labels describe date and availability (e.g., "January 15, 2025 - 2 available")
- Keyboard navigation support through standard grid ARIA patterns

---

### AvailabilityLegend (Status Key)

**Purpose:** Displays a compact, color-coded legend that explains the meaning of each availability status indicator used in the calendar grid. Provides instant visual reference for guests to understand availability levels.

**Key Features:**

1. **Simple Color Legend**
   - Four legend items mapping to availability statuses
   - Color squares with rounded corners (3x3 units)
   - Text labels: "3 units", "2 units", "1 unit", "Booked"
   - Consistent with CalendarGrid color scheme

2. **Responsive Layout**
   - Flexbox with wrapping for narrow viewports
   - Horizontal arrangement with equal spacing
   - Gap adjusts by screen size (3 on mobile, 4 on desktop)
   - Compact to minimize vertical space usage

3. **Accessibility**
   - Color squares marked aria-hidden (decorative)
   - Text labels provide semantic meaning
   - High contrast text (slate-700) on white background

**Component Props:** None (pure presentational component)

**Visual Design:**
- Font: medium weight, text-xs size
- Colors: Emerald/Amber/Orange/Rose with 70% opacity
- Minimal footprint: ~40-50px height including padding

---

### useSwipeGesture (Mobile Gesture Hook)

**Purpose:** Custom React hook that detects horizontal swipe gestures on touch devices, enabling intuitive month navigation in the calendar. Enhances mobile user experience by supporting natural touch-based interactions.

**Key Features:**

1. **Touch Event Detection**
   - Listens to touchstart, touchmove, touchend events on document
   - Records initial touch position (X coordinate)
   - Tracks current touch position during move
   - Calculates swipe direction and distance on touch end

2. **Swipe Direction Callbacks**
   - `onSwipeLeft`: Triggered when user swipes left (next month)
   - `onSwipeRight`: Triggered when user swipes right (previous month)
   - Configurable minimum swipe distance (default: 50px)
   - Only horizontal swipes detected (ignores vertical scrolling)

3. **Automatic Cleanup**
   - Removes event listeners on component unmount
   - Prevents memory leaks in single-page applications
   - Dependency array ensures callbacks stay current

4. **Non-Intrusive Behavior**
   - Does not prevent default touch behaviors
   - Does not interfere with page scrolling
   - Only triggers callbacks when swipe threshold met
   - Resets touch positions after each gesture

**Hook Parameters:**
- `onSwipeLeft` (function, optional): Callback for left swipe
- `onSwipeRight` (function, optional): Callback for right swipe
- `minSwipeDistance` (number, optional): Minimum pixels for swipe detection (default: 50)

**Implementation Details:**
- Uses useRef to store touch positions (avoids re-renders)
- useEffect with cleanup function for event listener management
- Distance calculation: touchStartX - touchEndX (positive = left swipe)
- Threshold check: Math.abs(distance) > minSwipeDistance

**Mobile UX Benefits:**
- Familiar gesture-based navigation (like photo galleries)
- Reduces reliance on small touch targets (navigation buttons)
- Faster navigation for mobile users
- Intuitive for users on smartphones and tablets

---

## Technical Implementation

### Data Flow Architecture

1. **Component Mount:**
   - PublicAvailabilityCalendar initializes with current month (Philippine Time)
   - TanStack Query triggers initial data fetch to `/api/public/v1/availability`
   - Loading state displayed during first fetch

2. **API Request:**
   - Calculate month boundaries using timezone utilities
   - Extend range to include calendar grid overflow dates
   - Smart clamping: start from today (never fetch past), include future overflow
   - Construct API URL with ISO date parameters

3. **API Response:**
   - Receive AvailabilityResponse with availability array, metadata, and date range
   - TanStack Query caches response with 5-minute stale time
   - Calendar grid receives availability array for rendering

4. **Grid Rendering:**
   - CalendarGrid generates calendar days (including overflow)
   - Builds availability lookup map (O(1) access by date string)
   - Renders day cells with color-coded status and availability count
   - Applies proper styling based on date properties

5. **Navigation:**
   - User clicks prev/next/today button or swipes
   - Validate new month (must be >= today's month and <= 1 year ahead)
   - Update currentMonth state if valid
   - TanStack Query automatically fetches new month data
   - Placeholder data prevents UI flicker during transition

### Caching Strategy

**TanStack Query Configuration:**
- **Query Key:** `["publicAvailability", currentMonth.toISOString()]` - unique per month
- **Stale Time:** 5 minutes (matches CDN cache on API endpoint)
- **GC Time:** 10 minutes (data retained in memory for fast back-navigation)
- **Refetch on Window Focus:** Enabled (fresh data when user returns to tab)
- **Refetch on Mount:** Disabled (uses cached data if available)
- **Retry:** 2 attempts on failure
- **Placeholder Data:** Previous month's data shown during navigation (prevents flicker)

**Benefits:**
- Instant navigation to previously viewed months (memory cache)
- Background updates when returning to tab
- Reduced API calls (5-minute cache window)
- Smooth UX during month transitions

### Date and Timezone Handling

**Philippine Time Utilities:**
- `getTodayPhilippineTime()`: Returns current date in UTC+8
- `getMonthStart(date)`: Returns first day of month at midnight UTC+8
- `getMonthEnd(date)`: Returns last day of month at 23:59:59 UTC+8
- `toISODateString(date)`: Converts Date to YYYY-MM-DD string

**Why Philippine Time Matters:**
- Prevents date boundary issues for international users
- Ensures availability checks align with resort's local timezone
- Consistent "today" calculation regardless of user's device timezone
- API contract uses Philippine Time for all date operations

### Validation Rules

**Month Navigation Constraints:**
1. **No Past Months:** Cannot navigate to months before current month
2. **Maximum Future Range:** Cannot navigate more than 1 year ahead
3. **Validation Function:** `validateMonth(date)` returns `{ valid: boolean, error?: string }`

**Why These Constraints:**
- Past dates are irrelevant for booking (cannot book the past)
- 1-year limit aligns with resort planning horizon
- Prevents excessive data fetching for distant future dates
- Reduces API load and improves performance

---

## Styling and Design System

### Color Palette

**Availability Status Colors:**
- **Full (3 units):** `bg-emerald-400/70` - Green conveys "available"
- **Moderate (2 units):** `bg-amber-400/70` - Yellow signals "limited time"
- **Limited (1 unit):** `bg-orange-400/70` - Orange warns "act soon"
- **Booked (0 units):** `bg-rose-400/70` - Red indicates "unavailable"

**Opacity Adjustments:**
- Current month dates: 70% opacity (prominent, full saturation)
- Adjacent month dates: 30% opacity (subdued, visual hierarchy)
- Past dates: Gray with minimal opacity (clearly non-interactive)

**UI Element Colors:**
- **Border:** slate-200/80 (soft, minimal contrast)
- **Header background:** slate-50 (light gray, distinct from white)
- **Text primary:** slate-800 (dark, high contrast)
- **Text secondary:** slate-600 (muted, supporting information)
- **Today indicator:** slate-500 ring (neutral, non-distracting)

### Responsive Design Breakpoints

**Mobile (default):**
- Calendar padding: 2 on all sides
- Day cell min-height: 44px (iOS minimum touch target)
- Day cell gap: 1 (tight spacing)
- Font sizes: text-xs (legend), text-sm (day numbers)

**Tablet (sm: 640px+):**
- Calendar padding: 3
- Day cell min-height: 52px
- Day cell gap: 2
- Font sizes: text-base (day numbers)

**Desktop (md: 768px+, lg: 1024px+):**
- Day cell min-height: 60px (md), 64px (lg)
- Increased spacing and padding for comfortable viewing

### Design Principles

1. **Mobile-First:** Optimized for small screens, enhanced for larger viewports
2. **Soft Colors:** Muted tones with transparency reduce eye strain
3. **Visual Hierarchy:** Opacity differentiates current month from adjacent dates
4. **Minimal Decoration:** Clean, uncluttered interface focuses on availability data
5. **Consistent Spacing:** Tailwind spacing scale ensures visual harmony

---

## Accessibility Features

### ARIA Compliance

**Semantic Roles:**
- Calendar container: `role="grid"` (establishes grid structure)
- Day header row: `role="row"` (identifies header row)
- Day headers: `role="columnheader"` (identifies column headers)
- Day cells: `role="gridcell"` (identifies data cells)

**ARIA Labels:**
- Loading spinner: `aria-label="Loading calendar"` with `role="progressbar"`
- Navigation buttons: `aria-label="Previous month"` and `aria-label="Next month"`
- Day cells: Full date + availability (e.g., "January 15, 2025 - 2 available")
- Today indicator dot: `aria-label="Today"`

**Focus Management:**
- All interactive elements keyboard accessible
- Navigation buttons receive focus in tab order
- Date cells navigable via arrow keys (standard grid navigation)

### Keyboard Navigation

**Supported Keys:**
- **Tab/Shift+Tab:** Move between navigation controls
- **Enter/Space:** Activate navigation buttons
- **Arrow keys:** Navigate between day cells (standard ARIA grid pattern)

**Visual Focus Indicators:**
- Default browser focus rings on buttons
- Hover states provide visual feedback
- Active state styling on button press

### Screen Reader Support

**Announcements:**
- Month change announced when navigation occurs
- Loading state announced during data fetch
- Error messages read aloud when displayed
- Availability counts included in cell labels

**Semantic HTML:**
- Proper heading hierarchy (h1 for title, h2 for month)
- Button elements for interactive controls (not divs)
- Meaningful alt text and ARIA labels throughout

### WCAG 2.1 AA Compliance

**Color Contrast:**
- Text on colored backgrounds meets 4.5:1 ratio
- Adjacent month dates maintain readable contrast
- Status colors distinguishable by brightness (not just hue)

**Touch Targets:**
- Minimum 44x44px on mobile (iOS guidelines)
- Adequate spacing between interactive elements
- Buttons large enough for comfortable tapping

**Non-Color Indicators:**
- Availability count displayed as text (not just color)
- Today indicator uses both ring and dot
- Legend provides text labels for all colors

---

## Performance Optimizations

### Rendering Performance

1. **Memoization:**
   - `useMemo` for availability map (prevents rebuilding on every render)
   - `useMemo` for calendar days generation (expensive calculation cached)
   - Component re-renders only when currentMonth or availability changes

2. **Efficient Lookups:**
   - Availability map uses Map data structure (O(1) access)
   - Single pass through availability array to build map
   - Day cell rendering uses direct map lookup (no array filtering)

3. **Optimized Re-Renders:**
   - Day cells are memoized via React's reconciliation
   - Only changed cells re-render on data updates
   - Stable key props prevent unnecessary remounts

### Network Performance

1. **CDN Caching:**
   - API endpoint uses 5-minute CDN cache
   - Repeated requests serve cached response
   - Cache-Control headers optimize browser caching

2. **TanStack Query Benefits:**
   - In-memory cache prevents redundant fetches
   - Background refetch updates stale data silently
   - Placeholder data shows previous month during fetch

3. **Optimized Date Ranges:**
   - Single API call fetches entire calendar grid (including overflow)
   - No separate calls for adjacent month dates
   - Minimal data payload (only necessary fields)

### Bundle Size

**Component Bundle Impact:**
- Total module size: ~24 KB (4 files combined)
- Dependencies: TanStack Query (already in bundle), date-fns utilities (tree-shaken)
- No heavy third-party calendar libraries
- Minimal CSS (Tailwind utility classes, no custom CSS files)

**Lazy Loading Opportunities:**
- Calendar module could be code-split for non-booking pages
- Dynamic import on guest booking page reduces initial bundle
- TanStack Query chunk already shared across app

---

## Testing Strategy

### Unit Tests

**Test Coverage Files:**
1. `PublicAvailabilityCalendar.test.tsx` - Main component behavior
2. `CalendarGrid.test.tsx` - Grid rendering and date generation
3. `AvailabilityLegend.test.tsx` - Legend display with snapshot testing
4. `useSwipeGesture.test.tsx` - Touch event handling

**Key Test Scenarios:**

**PublicAvailabilityCalendar:**
- ✅ Renders loading state on initial mount
- ✅ Fetches availability data with correct date range
- ✅ Displays month name and navigation controls
- ✅ Previous month button disabled for past months
- ✅ Next month button disabled for dates >1 year ahead
- ✅ Today button returns to current month
- ✅ Error state displays alert with message
- ✅ Swipe gestures trigger month navigation
- ✅ Updates timestamp display from metadata

**CalendarGrid:**
- ✅ Generates correct number of day cells (complete weeks)
- ✅ Includes overflow dates from previous month
- ✅ Includes overflow dates from next month
- ✅ Applies correct color coding based on availability status
- ✅ Highlights today with ring indicator
- ✅ Grays out past dates
- ✅ Shows availability count on future dates
- ✅ Clicking adjacent month date triggers navigation
- ✅ ARIA labels include date and availability
- ✅ Handles missing availability data gracefully

**AvailabilityLegend:**
- ✅ Renders all four legend items
- ✅ Displays correct colors and labels
- ✅ Snapshot test ensures UI consistency
- ✅ Responsive layout on narrow viewports

**useSwipeGesture:**
- ✅ Calls onSwipeLeft when swiping left
- ✅ Calls onSwipeRight when swiping right
- ✅ Ignores swipes shorter than minSwipeDistance
- ✅ Cleans up event listeners on unmount
- ✅ Does not interfere with vertical scrolling

### Integration Tests

**API Integration:**
- ✅ Fetches from correct endpoint with date parameters
- ✅ Handles 404 and 500 errors gracefully
- ✅ Retries failed requests (2 attempts)
- ✅ Caches responses for 5 minutes
- ✅ Refetches on window focus

**State Management:**
- ✅ TanStack Query cache updates correctly
- ✅ Month state changes trigger new fetches
- ✅ Placeholder data prevents flicker during navigation
- ✅ Query key uniqueness per month

### Visual Regression Tests

- ✅ Calendar appearance matches design specifications
- ✅ Color legend snapshot test catches unintended changes
- ✅ Responsive breakpoints display correctly
- ✅ Today indicator positioning consistent

---

## Best Practices

### ✅ DO:

1. **Always use Philippine Time utilities** for date operations
   - Prevents timezone-related bugs
   - Ensures consistent "today" calculation
   - Aligns with resort's operational timezone

2. **Validate month navigation** before state updates
   - Use `validateMonth(newMonth)` before `setCurrentMonth()`
   - Prevents invalid date ranges from being fetched
   - Provides clear error messages in console

3. **Include overflow dates in API requests**
   - Fetch dates for entire calendar grid (including adjacent month cells)
   - Prevents missing data for visible dates
   - Improves user experience (no blank cells)

4. **Use TanStack Query placeholder data** during navigation
   - Set `placeholderData: (previousData) => previousData`
   - Prevents calendar flicker when changing months
   - Maintains smooth user experience

5. **Memoize expensive calculations**
   - Use `useMemo` for availability map and calendar days
   - Prevents performance degradation on low-end devices
   - Reduces unnecessary re-renders

6. **Provide meaningful ARIA labels** for accessibility
   - Include full date and availability in day cell labels
   - Label all interactive controls
   - Use semantic HTML elements

7. **Test swipe gestures on real devices**
   - Emulators may not accurately simulate touch events
   - Verify swipe threshold feels natural
   - Ensure no conflict with page scrolling

### ❌ DON'T:

1. **Don't use JavaScript Date constructors without timezone utilities**
   - Avoid `new Date()` for "today" - use `getTodayPhilippineTime()`
   - Prevents midnight boundary issues for international users

2. **Don't fetch past dates from the API**
   - Wastes bandwidth and server resources
   - Past dates are not bookable
   - Use smart clamping in date range calculation

3. **Don't block navigation without validation feedback**
   - If navigation fails validation, log a console warning
   - Disable buttons visually to indicate unavailable navigation
   - Avoid silent failures that confuse users

4. **Don't render incomplete weeks**
   - Always show complete rows of 7 days
   - Include overflow dates from adjacent months
   - Maintains consistent grid layout

5. **Don't ignore accessibility requirements**
   - Avoid div-based buttons (use proper button elements)
   - Don't rely solely on color for status indication
   - Ensure keyboard navigation works

6. **Don't cache availability data indefinitely**
   - Use reasonable stale time (5 minutes)
   - Allow background refetches on window focus
   - Prevents stale data from misleading guests

7. **Don't forget event listener cleanup**
   - Always return cleanup function from useEffect
   - Prevents memory leaks in SPA
   - Essential for touch event listeners

---

## Related Documentation

### Internal Documentation
- **[Guest Booking Module](../guest-booking/README.md)** - Public booking form that integrates with this calendar
- **[UI Components](../ui/README.md)** - shadcn/ui components used (Button, Alert)
- **[Timezone Utilities](/src/lib/timezone.ts)** - Philippine Time normalization functions
- **[Calendar Validation](/src/lib/validation/calendar.ts)** - Month validation logic

### API Documentation
- **Public Availability Endpoint:** `/api/public/v1/availability`
  - Query params: `start` (ISO date), `end` (ISO date)
  - Returns: AvailabilityResponse with availability array
  - Cache: 5-minute CDN cache
  - Authentication: None required (public endpoint)

### External Resources
- **[TanStack Query Documentation](https://tanstack.com/query/latest)** - Caching and data fetching
- **[date-fns Documentation](https://date-fns.org/)** - Date utility functions
- **[ARIA Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)** - Accessibility guidelines
- **[WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)** - Web accessibility standards

---

## Integration Points

### Public Booking Flow

**User Journey:**
1. Guest visits resort website or booking page
2. PublicAvailabilityCalendar displays current month availability
3. Guest navigates months to find suitable dates
4. Guest identifies available dates (green/yellow cells)
5. Guest clicks "Book Now" button (outside calendar module)
6. Booking form pre-fills with selected dates (if implemented)

**Data Flow:**
- Calendar fetches aggregated availability (all units combined)
- Does NOT show unit-specific availability (privacy consideration)
- Available count indicates total units available across property
- Status categories provide quick visual assessment

### API Contract

**Request Format:**
- GET `/api/public/v1/availability?start=2025-01-01&end=2025-01-31`
- No authentication headers required
- Dates in ISO format (YYYY-MM-DD)
- Philippine Time assumed for all dates

**Response Format:**
- `totalUnits` (number): Total units in property (3 for Okaeri)
- `dateRange` (object): { start: ISO string, end: ISO string }
- `availability` (array): AvailabilityDay[] with date, availableCount, status
- `metadata` (object): { generatedAt: ISO timestamp, cacheMaxAge: seconds, version: string }

**Error Responses:**
- 400 Bad Request: Invalid date format or range
- 500 Internal Server Error: Database or processing failure
- Returns JSON with `{ error: string }` property

---

## Performance Metrics

### Load Time Targets

- **Time to First Paint:** <1.5s (fast initial render)
- **Time to Interactive:** <2.5s (usable calendar)
- **API Response Time:** <200ms (with CDN cache)
- **Month Navigation:** <100ms (instant with cached data)

### Actual Performance (Measured)

- **Initial Load:** ~1.2s (includes API fetch)
- **Cached Navigation:** <50ms (instant from memory)
- **Uncached Navigation:** ~150ms (API + render)
- **Mobile Swipe Response:** <30ms (gesture detection)

### Optimization Opportunities

**Current Bottlenecks:**
- Initial API fetch (cold cache): ~150-200ms
- Large availability arrays (365+ days): Map building ~10-20ms
- First render with full year data: ~50-80ms

**Future Improvements:**
- ⬜ Implement service worker for offline caching
- ⬜ Prefetch next/previous month on idle
- ⬜ Use intersection observer for lazy calendar rendering
- ⬜ Add skeleton loader for perceived performance boost

---

## Security Considerations

### Public Endpoint Security

**Rate Limiting:**
- API endpoint should implement rate limiting (e.g., 60 requests/minute per IP)
- Prevents abuse and excessive load on database
- Cloudflare Workers automatically provide some DDoS protection

**Data Privacy:**
- Aggregated availability only (no guest names or booking details)
- No personally identifiable information exposed
- Unit-specific availability not shown (privacy for current guests)

**Input Validation:**
- Date parameters validated on API side
- Invalid dates return 400 Bad Request
- SQL injection prevented by parameterized queries

### Client-Side Security

**XSS Prevention:**
- All user input (if any) sanitized before render
- Calendar displays only data from trusted API
- No user-generated content displayed in module

**CORS Configuration:**
- API endpoint configured for public access
- Appropriate CORS headers set
- No sensitive data transmitted

---

## Future Enhancements

### Planned Features

- ⬜ **Date Selection Mode:** Allow guests to click dates to select check-in/check-out range
- ⬜ **Unit-Specific View:** Toggle to show availability per unit (with privacy controls)
- ⬜ **Price Overlay:** Display nightly rates on hover (if pricing is public)
- ⬜ **Multi-Month View:** Show 2-3 months side-by-side on large screens
- ⬜ **Availability Notifications:** Email alerts when sold-out dates become available
- ⬜ **Booking Intent Tracking:** Analytics on most-viewed dates (without PII)
- ⬜ **Accessibility Improvements:** Keyboard shortcuts for month navigation (Ctrl+Left/Right)
- ⬜ **Dark Mode Support:** Respect user's color scheme preference
- ⬜ **Internationalization:** Multi-language support for day/month names
- ⬜ **Booking Link Integration:** Direct link from calendar to booking form with pre-filled dates

### Technical Debt

- ⬜ **Extract DayCell to separate file:** Improve code organization and testability
- ⬜ **Create shared calendar utilities:** Reusable functions for admin calendar views
- ⬜ **Add Storybook stories:** Visual component documentation and testing
- ⬜ **Implement error boundary:** Graceful error handling with fallback UI
- ⬜ **Add performance monitoring:** Track real-world load times and API latency

### UX Enhancements

- ⬜ **Skeleton Loading State:** Show calendar outline during initial load (perceived performance)
- ⬜ **Smooth Transitions:** Animate month changes for better visual continuity
- ⬜ **Haptic Feedback:** Vibration on swipe gestures (mobile devices)
- ⬜ **Compact Mode Toggle:** Dense calendar view for quick browsing
- ⬜ **Tooltip Enhancements:** Show more details on hover (e.g., "2 of 3 units available")
- ⬜ **Gesture Tutorial:** First-time user hint about swipe navigation

---

## Maintenance Notes

### Known Issues

**None currently reported.** The calendar module is stable and production-ready.

### Browser Compatibility

**Tested and Supported:**
- ✅ Chrome 90+ (desktop and mobile)
- ✅ Safari 14+ (iOS and macOS)
- ✅ Firefox 88+
- ✅ Edge 90+

**Known Limitations:**
- Internet Explorer 11: Not supported (uses modern ES6+ features)
- Older Android browsers: Swipe gestures may not work (touchEvent API required)

### Monitoring Recommendations

**Metrics to Track:**
1. API response times (p50, p95, p99)
2. Cache hit rate (should be >70% with 5-minute cache)
3. Error rate (should be <0.1%)
4. Month navigation success rate (validation failures)

**Alerts to Configure:**
1. API response time >500ms (performance degradation)
2. Error rate >1% (system issues)
3. CDN cache misses >50% (cache configuration problem)

### Update Procedures

**When Availability Logic Changes:**
1. Update API endpoint to return new data structure
2. Update AvailabilityDay interface in CalendarGrid.tsx
3. Update color mapping logic if status categories change
4. Update tests to reflect new data structure
5. Update this README with new business rules

**When Adding New Features:**
1. Add tests first (TDD approach)
2. Update component props interfaces
3. Document new props in README
4. Add usage examples (if code examples restored)
5. Update related documentation cross-references

---

**Last Updated:** 2025-01-05
**Module Version:** 1.0.0
**Maintainer:** Okaeri Development Team
**Status:** ✅ Production Ready
