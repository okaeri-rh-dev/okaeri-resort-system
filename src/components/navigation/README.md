# Navigation Components

This directory contains modular, mobile-responsive navigation components for the Okaeri Resort Management System. All components follow Philippine business context and maintain the resort's warm, professional aesthetic.

## Components

### 1. MobileMenu (`MobileMenu.tsx`)

A slide-out mobile navigation drawer with touch gesture support.

**Features:**
- Slide animation from left with backdrop overlay
- Touch gesture support (swipe to close)
- Full navigation menu with active state indicators
- Resort branding header
- Accessibility compliant (ARIA labels, keyboard navigation)
- 44px minimum touch targets
- Animated transitions respecting `prefers-reduced-motion`

**Usage:**
```tsx
import { MobileMenu } from '@/components/navigation';

<MobileMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />
```

### 2. UserProfileDropdown (`UserProfileDropdown.tsx`)

User profile dropdown with account management options.

**Features:**
- Two variants: full sidebar version and compact header version
- User avatar with online status indicator
- Account settings, notifications, help links
- Secure logout with confirmation
- Philippine localization (online status, location)
- Dark mode support

**Usage:**
```tsx
import { UserProfileDropdown, UserProfileButton } from '@/components/navigation';

// Full version for sidebar
<UserProfileDropdown />

// Compact version for header
<UserProfileButton />
```

### 3. ProjectSwitcher (`ProjectSwitcher.tsx`)

Resort/property selection component with project management.

**Features:**
- Two variants: full sidebar version and compact mobile version
- Current project stats (revenue, bookings) with PHP peso formatting
- Visual project indicators (featured badge, statistics)
- "Add New Resort" option
- Responsive design for different screen sizes
- Philippine business context integration

**Usage:**
```tsx
import { ProjectSwitcher } from '@/components/navigation';

// Full version for sidebar
<ProjectSwitcher variant="full" />

// Compact version for mobile header
<ProjectSwitcher variant="compact" />
```

### 4. NotificationBell (`NotificationBell.tsx`)

Real-time notification center with priority indicators.

**Features:**
- Unread notification badge with count
- Priority-based styling (high priority animations)
- Categorized notifications (booking, payment, alert, review)
- Mark as read/delete functionality
- Recent notifications with timestamps
- Philippine time formatting
- Action buttons for quick navigation

**Usage:**
```tsx
import { NotificationBell } from '@/components/navigation';

<NotificationBell />
```

### 5. SearchBar (`SearchBar.tsx`)

Global search component with autocomplete and modal support.

**Features:**
- Three variants: full, compact, and button (opens modal)
- Real-time search with loading states
- Recent searches history
- Categorized search results with icons
- Keyboard shortcuts (⌘K to focus)
- Mobile-optimized input
- Philippine context search (GCash, peso amounts)

**Usage:**
```tsx
import { SearchBar } from '@/components/navigation';

// Full search bar
<SearchBar variant="full" placeholder="Search bookings, expenses..." />

// Compact version
<SearchBar variant="compact" />

// Button that opens modal
<SearchBar variant="button" />
```

## Design System Compliance

All components follow the established resort design system:

### Colors
- **Ocean Blue**: Primary branding and active states
- **Coral Pink**: Highlights and call-to-action elements
- **Sand Beige**: Warm backgrounds and subtle elements
- **Palm Green**: Success states and online indicators

### Typography
- Inter font family for consistency
- Responsive text sizing
- Clear hierarchy with proper contrast ratios

### Accessibility
- **WCAG 2.1 AA compliance**
- Minimum 44px touch targets on mobile
- Keyboard navigation support
- Screen reader compatibility (ARIA labels, roles)
- High contrast mode support
- Reduced motion respect

### Mobile Optimization
- Touch-friendly interactions
- Gesture support where appropriate
- Responsive breakpoints
- Optimized for 70% mobile usage
- Bottom-heavy layouts for thumb accessibility

### Philippine Business Context
- Philippine peso (₱) currency formatting
- Philippine English terminology
- GCash and local payment methods
- Philippine holidays and business practices
- "Philippines" location indicators

## Integration with DashboardLayout

The `DashboardLayout.tsx` has been refactored to use these modular components:

- **Desktop**: Full sidebar with complete navigation
- **Mobile**: Hamburger menu with slide-out drawer
- **Responsive**: Project switcher adapts to screen size
- **Consistent**: Same components across all breakpoints

## Performance Considerations

- **Code Splitting**: Each component can be lazy-loaded
- **Bundle Size**: Modular imports prevent unnecessary code
- **Rendering**: Optimized re-renders with proper state management
- **Accessibility**: Screen reader compatible without performance impact

## Development Guidelines

When extending these components:

1. **Maintain Accessibility**: Always include proper ARIA attributes
2. **Test Mobile First**: Ensure components work on small screens
3. **Philippine Context**: Include relevant business terminology
4. **Performance**: Use React.memo() for expensive renders
5. **TypeScript**: Maintain strict type safety
6. **Design System**: Use established color tokens and spacing

## File Structure

```
src/components/navigation/
├── MobileMenu.tsx          # Mobile slide-out navigation
├── UserProfileDropdown.tsx # User account management
├── ProjectSwitcher.tsx     # Resort/property selection
├── NotificationBell.tsx    # Real-time notifications
├── SearchBar.tsx          # Global search functionality
├── index.ts               # Barrel exports
└── README.md             # This documentation
```

All components are exported through the index file for clean imports:

```tsx
import {
  MobileMenu,
  UserProfileDropdown,
  ProjectSwitcher,
  NotificationBell,
  SearchBar
} from '@/components/navigation';
```