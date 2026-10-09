# 📋 Audit Trail System Documentation

## Overview

The Audit Trail System provides comprehensive activity logging and viewing capabilities for the Okaeri Resort System. This module consists of ~1,585 lines of code implementing a full-featured audit log viewer with advanced filtering, diff viewing, and export capabilities.

## 🏗️ Module Architecture

```
audit/
├── AuditLogViewer.tsx       # Main audit log table (12.3KB, 343 lines)
├── AuditFilters.tsx          # Advanced filtering component (16.9KB, 473 lines)
├── AuditDiffViewer.tsx       # Change diff viewer (13KB, 362 lines)
├── SafeAuditText.tsx         # XSS-safe text rendering (6KB, 170 lines)
├── ActionBadge.tsx           # Action type badges (704 bytes, 20 lines)
├── AuditStatsPanel.tsx       # Statistics dashboard (6KB, 170 lines)
└── __tests__/                # Component tests
    └── AuditFilters.test.tsx
```

## 📦 Component Documentation

### AuditLogViewer Component

The main audit log table with expandable rows, pagination, and change viewing.

#### Features

1. **Advanced Table Display**
   - Sortable columns (timestamp, user, action, entity)
   - Expandable rows for detailed metadata
   - Pagination with configurable page size
   - Loading states and error handling

2. **Interactive Features**
   - Click to expand row details
   - View changes diff dialog
   - Metadata display (IP address, user agent)
   - Entity type and ID display with sanitization

3. **Data Presentation**
   - Relative timestamps ("2 hours ago")
   - Action type badges with color coding
   - Entity type display names
   - Safe text rendering to prevent XSS

#### Usage Example

```tsx
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { AuditFilters } from '@/components/audit/AuditFilters'

function AuditPage() {
  return (
    <div className="space-y-4">
      <AuditFilters />
      <AuditLogViewer />
    </div>
  )
}
```

#### Props & State

The component uses Zustand store for state management:

```typescript
// Store-based state (no props)
const filters = useAuditStore((state) => state.filters)
const setFilters = useAuditStore((state) => state.setFilters)
const setSelectedLog = useAuditStore((state) => state.setSelectedLog)

// Local state
const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
const [diffDialogOpen, setDiffDialogOpen] = useState(false)
```

#### Data Structure

```typescript
interface AuditLog {
  id: string
  created_at: string
  user_id: string | null
  user_email: string | null
  action: AuditAction // 'created' | 'updated' | 'deleted'
  entity_type: AuditTable
  entity_id: string
  changes: {
    before: Record<string, any> | null
    after: Record<string, any> | null
  }
  metadata: {
    ip_address?: string
    user_agent?: string
    [key: string]: any
  }
  event_type: AuditEventType
}
```

### AuditFilters Component

Advanced filtering interface with quick filters, date ranges, and export functionality.

#### Features

1. **Quick Filter Presets**
   - Recent Activity (last 24 hours)
   - My Activity (current user)
   - Critical Changes (delete actions)
   - Booking Changes
   - Guest Changes
   - Payment Changes

2. **Advanced Filters**
   - Date range picker (from/to dates)
   - Entity type selection (multi-select)
   - Action type selection (created/updated/deleted)
   - User filter
   - Full-text search

3. **Export Functionality**
   - Export to CSV format
   - Filtered data export
   - Download trigger with loading states

#### Usage Example

```tsx
// Quick filter application
const { applyQuickFilter } = useAuditStore()

applyQuickFilter('recent_activity') // Last 24 hours
applyQuickFilter('my_activity')     // Current user's actions
applyQuickFilter('critical')        // Delete actions only

// Custom filter
setFilters({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  entityTypes: ['bookings', 'payments'],
  actions: ['created', 'deleted'],
  searchQuery: 'booking-2024',
})

// Export filtered logs
const { exportLogs, isExporting } = useExportAuditLogs()
await exportLogs(filters)
```

#### Quick Filter Presets

```typescript
type QuickFilterPreset =
  | 'recent_activity'
  | 'my_activity'
  | 'critical'
  | 'bookings'
  | 'guests'
  | 'payments'

// Preset configurations
const QUICK_FILTERS = {
  recent_activity: {
    startDate: subDays(new Date(), 1),
    endDate: new Date(),
  },
  my_activity: {
    userId: currentUser.id,
  },
  critical: {
    actions: ['deleted'],
  },
  // ... etc
}
```

### AuditDiffViewer Component

Visual diff viewer for comparing before/after states of data changes.

#### Features

1. **Change Visualization**
   - Side-by-side diff view
   - Syntax highlighting for JSON
   - Color-coded additions (green) and deletions (red)
   - Field-by-field comparison

2. **Data Formatting**
   - Pretty-printed JSON
   - Nested object expansion
   - Null/undefined value handling
   - Data type preservation

3. **Security**
   - Sanitized output to prevent XSS
   - Safe rendering of user-generated content
   - Metadata sanitization

#### Usage Example

```tsx
import { AuditDiffViewer } from '@/components/audit/AuditDiffViewer'

function ViewChanges({ auditLog }: { auditLog: AuditLog }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-2" />
          View Changes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Change Details</DialogTitle>
        </DialogHeader>
        <AuditDiffViewer log={auditLog} />
      </DialogContent>
    </Dialog>
  )
}
```

#### Diff Algorithm

```typescript
// Simplified diff logic
function generateDiff(before: any, after: any) {
  const changes = []

  // Added fields (in after, not in before)
  for (const key in after) {
    if (!(key in before)) {
      changes.push({
        type: 'added',
        field: key,
        value: after[key],
      })
    }
  }

  // Removed fields (in before, not in after)
  for (const key in before) {
    if (!(key in after)) {
      changes.push({
        type: 'removed',
        field: key,
        value: before[key],
      })
    }
  }

  // Changed fields
  for (const key in before) {
    if (key in after && before[key] !== after[key]) {
      changes.push({
        type: 'modified',
        field: key,
        before: before[key],
        after: after[key],
      })
    }
  }

  return changes
}
```

### SafeAuditText Component

XSS-safe text rendering component for displaying user-generated content.

#### Features

1. **Security First**
   - DOMPurify sanitization
   - HTML entity encoding
   - Script tag removal
   - Event handler stripping

2. **Formatting Options**
   - Plain text mode (default)
   - Markdown rendering (safe subset)
   - Code block rendering
   - Link sanitization

#### Usage Example

```tsx
import { SafeAuditText } from '@/components/audit/SafeAuditText'

// Plain text (safe by default)
<SafeAuditText text={auditLog.metadata.notes} />

// With markdown support
<SafeAuditText
  text={auditLog.changes.after.description}
  allowMarkdown={true}
/>

// Code rendering
<SafeAuditText
  text={JSON.stringify(auditLog.changes, null, 2)}
  as="code"
  className="font-mono text-sm"
/>
```

#### Sanitization Config

```typescript
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre'],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
}
```

### ActionBadge Component

Color-coded action type indicator badges.

#### Features

- Visual action type differentiation
- Consistent color scheme
- Compact design for table cells

#### Action Types & Colors

```tsx
<ActionBadge log={log} />
```

Trigger rows show their SQL operation: `INSERT` "Created" (default), `UPDATE` "Updated" (secondary), `DELETE` "Deleted" (destructive). App rows (`source: "app"`) are always stored as `INSERT`, so they show `metadata.action` instead ("updated", "checked_in" → "Checked in"), or "Event" when it is missing, as an outline badge.

### AuditStatsPanel Component

Statistics dashboard for audit trail overview.

#### Metrics Displayed

1. **Activity Summary**
   - Total events count
   - Events by action type
   - Events by entity type
   - Top active users

2. **Time-based Analysis**
   - Events per hour/day/week
   - Peak activity times
   - Activity trends

3. **Security Insights**
   - Failed operations count
   - Suspicious activity detection
   - IP address analysis

#### Usage Example

```tsx
import { AuditStatsPanel } from '@/components/audit/AuditStatsPanel'

function AuditDashboard() {
  return (
    <div className="grid gap-4">
      <AuditStatsPanel filters={filters} />
      <AuditLogViewer />
    </div>
  )
}
```

## 🔄 State Management

The audit system uses Zustand for state management:

```typescript
// useAuditStore.ts
interface AuditStore {
  // Filters
  filters: AuditLogFilters
  setFilters: (filters: Partial<AuditLogFilters>) => void
  resetFilters: () => void
  applyQuickFilter: (preset: QuickFilterPreset) => void

  // Selected log
  selectedLog: AuditLog | null
  setSelectedLog: (log: AuditLog | null) => void

  // UI state
  expandedRows: Set<string>
  toggleRowExpansion: (id: string) => void
}

// Usage in components
const filters = useAuditStore((state) => state.filters)
const setFilters = useAuditStore((state) => state.setFilters)
```

## 🎨 Styling Patterns

### Enterprise Table Design

```tsx
// Compact, information-dense table
<Table className="enterprise-table">
  <TableHeader className="sticky top-0 bg-background z-10">
    <TableRow className="border-b-2">
      <TableHead className="h-10 px-2 text-xs font-semibold">
        Timestamp
      </TableHead>
      {/* ... */}
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="h-12 hover:bg-neutral-50">
      {/* Compact 12px vertical padding */}
    </TableRow>
  </TableBody>
</Table>
```

### Status Indicators

```tsx
// Professional action badges
const badgeVariants = {
  created: 'bg-blue-100 text-blue-800 border-blue-200',
  updated: 'bg-neutral-100 text-neutral-800 border-neutral-200',
  deleted: 'bg-red-100 text-red-800 border-red-200',
}
```

## 🔐 Security Considerations

### XSS Prevention

All user-generated content is sanitized before display:

```typescript
import DOMPurify from 'dompurify'
import { SafeAuditText } from './SafeAuditText'

// Sanitize all text content
const safeText = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
  ALLOWED_ATTR: [],
})

// Use SafeAuditText for display
<SafeAuditText text={auditLog.metadata.notes} />
```

### Data Privacy

- Sensitive fields are masked in audit logs
- PII is redacted from exported data
- IP addresses are logged for security but can be filtered
- User emails are displayed only to authorized users

## 📊 Performance Optimizations

1. **Pagination**: Server-side pagination to limit data transfer
2. **Virtualization**: Consider using react-virtual for large datasets
3. **Memoization**: Components memoized to prevent unnecessary re-renders
4. **Lazy Loading**: Diff viewer loads only when opened
5. **Debounced Search**: Search input debounced to reduce queries

```typescript
// Debounced search
const debouncedSearch = useMemo(
  () =>
    debounce((value: string) => {
      setFilters({ searchQuery: value })
    }, 300),
  []
)
```

## 🧪 Testing

### Unit Tests

```typescript
// AuditFilters.test.tsx
describe('AuditFilters', () => {
  it('applies quick filters correctly', () => {
    const { getByText } = render(<AuditFilters />)

    fireEvent.click(getByText('Recent Activity'))

    expect(mockSetFilters).toHaveBeenCalledWith({
      startDate: expect.any(Date),
      endDate: expect.any(Date),
    })
  })

  it('exports logs with current filters', async () => {
    const { getByText } = render(<AuditFilters />)

    fireEvent.click(getByText('Export CSV'))

    await waitFor(() => {
      expect(mockExportLogs).toHaveBeenCalledWith(currentFilters)
    })
  })
})
```

### Integration Tests

Test the full audit logging flow:

```typescript
// Full flow test
it('logs and displays audit events', async () => {
  // 1. Perform action that creates audit log
  await createBooking(bookingData)

  // 2. Navigate to audit page
  await navigateTo('/audit')

  // 3. Verify log appears
  expect(screen.getByText('booking.created')).toBeInTheDocument()

  // 4. Expand row and verify details
  fireEvent.click(screen.getByRole('button', { name: /expand/i }))
  expect(screen.getByText(bookingData.guest_name)).toBeInTheDocument()
})
```

## 📚 Related Documentation

- [Audit Logger Library](/src/lib/audit-logger.ts) - Backend audit logging
- [Audit Trail Implementation](/docs/implementation/audit-trail/README.md) - Feature documentation
- [Security Guidelines](/src/lib/security/README.md) - Security best practices
- [State Management](/src/stores/README.md) - Zustand patterns
- [Table Patterns](/src/components/tables/README.md) - Reusable table components

## 🔧 Maintenance Notes

- Components follow enterprise design system patterns
- All text content must be sanitized via SafeAuditText
- Filters are persisted in Zustand store for consistency
- Export functionality uses server-side filtering for security
- Consider implementing audit log retention policies
- Monitor audit log storage growth

## 📈 Future Enhancements

- [ ] Real-time audit log updates via Supabase Realtime
- [ ] Advanced analytics and visualization
- [ ] Anomaly detection and alerting
- [ ] Audit log archival and retention management
- [ ] Role-based audit log visibility
- [ ] Custom audit log reports
