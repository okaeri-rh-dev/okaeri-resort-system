# 📊 Dashboard Components

## Overview

The Dashboard module provides the main operational view for the resort management system, displaying key metrics, real-time booking status, and actionable insights for resort operations.

## 📁 Component Structure

```
dashboard/
├── DashboardStats.tsx       # Key metrics display (3.3KB)
├── DashboardCalendar.tsx    # Booking calendar view (8.2KB)
├── BookingIndicators.tsx    # Visual booking status (2.4KB)
└── BookingTooltip.tsx       # Interactive booking details (4.3KB)
```

## 📦 Component Documentation

### `DashboardStats` - Key Performance Indicators
**Purpose**: Display critical business metrics at a glance

**Metrics Displayed**:
- Total Revenue (current month)
- Occupancy Rate (percentage)
- Active Bookings (current)
- Total Guests (this month)

**Usage**:
```tsx
<DashboardStats
  period="monthly"
  compareWithPrevious={true}
  animate={true}
/>
```

### `DashboardCalendar` - Booking Overview
**Purpose**: Visual calendar representation of bookings

**Features**:
- Month/Week/Day views
- Drag-and-drop booking management
- Color-coded booking status
- Quick booking creation

**Props**:
```typescript
interface DashboardCalendarProps {
  view?: 'month' | 'week' | 'day'
  onBookingSelect?: (booking: Booking) => void
  onDateSelect?: (date: Date) => void
  highlightToday?: boolean
}
```

### `BookingIndicators` - Visual Status System
**Purpose**: Color-coded visual indicators for booking status

**Status Colors**:
- 🟡 Pending - Awaiting confirmation
- 🟢 Confirmed - Ready for check-in
- 🔵 Checked In - Guest on premises
- ⚫ Checked Out - Completed stay
- 🔴 Cancelled - Booking cancelled

### `BookingTooltip` - Interactive Details
**Purpose**: Hover/click tooltip showing booking details

**Information Shown**:
- Guest name and contact
- Booking dates and duration
- Unit information
- Payment status
- Quick actions (Edit, View, Check-in)

## 🎨 Dashboard Layouts

### Grid Layout
```tsx
<DashboardGrid>
  <MetricsRow>
    <DashboardStats />
  </MetricsRow>
  <CalendarRow>
    <DashboardCalendar />
  </CalendarRow>
  <TablesRow>
    <RecentBookings />
    <PendingPayments />
  </TablesRow>
</DashboardGrid>
```

### Mobile Layout
```tsx
<MobileDashboard>
  <SwipeableViews>
    <StatsView />
    <CalendarView />
    <BookingsView />
  </SwipeableViews>
</MobileDashboard>
```

## 📊 Data Integration

### Real-time Updates
```typescript
// Subscribe to real-time dashboard updates
const { data: metrics, refetch } = useQuery({
  queryKey: ['dashboard-metrics'],
  queryFn: fetchDashboardMetrics,
  refetchInterval: 30000, // Refresh every 30 seconds
})

// Real-time booking updates
const subscription = supabase
  .channel('dashboard-bookings')
  .on('*', () => refetch())
  .subscribe()
```

### Performance Metrics
```typescript
interface DashboardMetrics {
  revenue: {
    current: number
    previous: number
    trend: 'up' | 'down' | 'stable'
  }
  occupancy: {
    rate: number
    available: number
    occupied: number
  }
  bookings: {
    new: number
    pending: number
    confirmed: number
  }
  guests: {
    total: number
    returning: number
    vip: number
  }
}
```

## 🚀 Performance Optimization

- Widget lazy loading
- Memoized calculations
- Virtual calendar for large datasets
- Debounced metric updates
- Progressive data loading

## 📱 Responsive Design

- Mobile-first approach
- Touch-friendly interactions
- Swipeable views on mobile
- Collapsible sections
- Adaptive data density

## 🔧 Configuration

```typescript
export const dashboardConfig = {
  refreshInterval: 30000,
  defaultView: 'month',
  metricsToShow: ['revenue', 'occupancy', 'bookings', 'guests'],
  enableRealtime: true,
  mobileBreakpoint: 768,
}
```