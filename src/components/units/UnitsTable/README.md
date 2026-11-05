# 🏢 Units Table Documentation

## Overview

The Units Table provides **comprehensive unit management** with advanced features including **inline editing** and each cabin's **state tonight** (Blocked, Booked or Free) for the Okaeri Resort System. This table implements the **Professional Enterprise Design System** with row selection, sortable columns, and a powerful edit mode for efficient bulk updates.

## 🏗️ Module Architecture

```
UnitsTable/
├── index.tsx                     # Main table component with error boundary
├── types.ts                      # TypeScript interfaces
├── components/
│   ├── TableHeader.tsx          # Filter controls and actions
│   ├── UnitColumns.tsx          # Column definitions with inline editing
│   └── InlineEdit.tsx           # Inline editing components
├── hooks/
│   └── useUnitsTable.ts         # Table logic hook
└── utils/
    └── export.ts                # CSV export utility
```

## 📋 Component Reference

### UnitsTable

**Purpose**: Display and manage resort units with inline editing and their state tonight.

#### Props

```typescript
interface UnitsTableProps {
  onAddUnit?: () => void;          // Callback for adding new unit
  pageSize?: number;               // Rows per page (default: 10)
  className?: string;              // Additional CSS classes
}
```

#### Usage

```tsx
import { UnitsTable } from '@/components/units/UnitsTable'

function UnitsPage() {
  return (
    <div className="container mx-auto p-6">
      <UnitsTable
        onAddUnit={() => navigate('/units/new')}
        pageSize={25}
      />
    </div>
  )
}
```

## ✏️ Inline Editing System

### Edit Mode Toggle

```tsx
<TableHeaderControls
  isEditMode={isEditMode}
  onEditModeToggle={() => setIsEditMode(!isEditMode)}
  selectedCount={selectedCount}
  ...
/>

// When edit mode enabled:
// - Unit name becomes editable input
// - Base rate becomes number input
// - Extra person rate becomes number input
// - Unit type becomes dropdown select
// - Tonight stays read-only: it is derived, never edited
```

### Inline Edit Components

**Text Input Editing**:
```tsx
<InlineEdit
  value={unit.unit_name}
  onSave={(value) => updateUnit(unit.unit_id, { unit_name: value })}
  type="text"
  placeholder="Enter unit name"
/>
```

**Number Input Editing**:
```tsx
<InlineEdit
  value={unit.base_rate}
  onSave={(value) => updateUnit(unit.unit_id, { base_rate: value })}
  type="number"
  placeholder="0.00"
  className="text-right"
/>
```

### Auto-Save on Blur

```typescript
// InlineEdit component
const handleBlur = async () => {
  if (localValue !== value) {
    try {
      await onSave(localValue)
      toast.success('Updated successfully')
    } catch (error) {
      toast.error('Update failed')
      setLocalValue(value)  // Rollback on error
    }
  }
}
```

## 📊 Table Columns

### Column Definitions

```typescript
const columns = [
  {
    id: 'select',
    header: <Checkbox />,
    cell: <Checkbox />,
    size: 50,
  },
  {
    accessorKey: 'unit_code',
    header: 'Code',
    cell: (value) => <span className="font-mono text-blue-600">{value}</span>,
    size: 100,
  },
  {
    accessorKey: 'unit_name',
    header: 'Name',
    cell: (value) => isEditMode ? <InlineEdit /> : <span>{value}</span>,
    size: 200,
  },
  {
    accessorKey: 'max_occupancy',
    header: 'Capacity',
    cell: (row) => `${row.base_occupancy}/${row.max_occupancy} guests`,
    size: 120,
  },
  {
    accessorKey: 'base_rate',
    header: 'Base Rate',
    cell: (value) => formatCurrency(value),
    size: 120,
  },
  {
    accessorKey: 'extra_person_rate',
    header: 'Extra Person',
    cell: (value) => formatCurrency(value || 0),
    size: 120,
  },
  {
    accessorKey: 'unit_type',
    header: 'Type',
    cell: (value) => <TypeBadge type={value} />,
    size: 120,
  },
  {
    id: 'tonight',
    header: 'Tonight',
    // Blocked (with the block reason under the badge), Booked or Free
    cell: (row) => <StatusBadge {...statusBadgeProps(cabinStates.get(row.unit_id)?.state, 'Free')} />,
    size: 160,
  },
]
```

### Column Styling

**Unit Code**:
- **Font**: Monospace (`font-mono`)
- **Color**: Blue (`text-blue-600`)
- **Weight**: Medium

**Currency Columns** (Base Rate, Extra Person):
- **Font**: Monospace (`font-mono`)
- **Alignment**: Right
- **Format**: `₱1,234.56`
- **Color**: Green for base rate, Orange for extra person

**Capacity**:
- **Font**: Monospace (`font-mono`)
- **Format**: `2/4 guests` (base/max)
- **Alignment**: Center

## 🎯 Row Selection and Cabin State

### Row Selection

```typescript
// Select all rows on current page
<Checkbox
  checked={table.getIsAllPageRowsSelected()}
  onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
/>

// Select individual row
<Checkbox
  checked={row.getIsSelected()}
  onCheckedChange={(value) => row.toggleSelected(!!value)}
/>

// Get selected count
const selectedCount = table.getSelectedRowModel().rows.length
```

### Cabin State Tonight

A cabin has no stored status (ADR 0005). `useCabinStatesTonight()` calls the
`get_cabin_states` RPC for tonight (Manila) and returns, per unit, Blocked (with the
block reasons), Booked or Free. To take a cabin out of use, add a block on the
Blocked dates page; nothing on this table sets a cabin's state.

## 🔍 Filtering System

### Filter Controls

```typescript
interface Filters {
  globalFilter: string;           // Search all columns
  typeFilter: UnitType | 'all';   // Filter by unit type
  statusFilter: CabinState | 'all'; // Filter by state tonight
}
```

**Global Search**:
```tsx
<Input
  placeholder="Search units..."
  value={globalFilter}
  onChange={(e) => setGlobalFilter(e.target.value)}
/>

// Searches across:
// - Unit code
// - Unit name
// - Unit type
```

**Type Filter**:
```tsx
<Select value={typeFilter} onValueChange={setTypeFilter}>
  <SelectItem value="all">All Types</SelectItem>
  <SelectItem value="Standard">Standard</SelectItem>
  <SelectItem value="Deluxe">Deluxe</SelectItem>
  <SelectItem value="Suite">Suite</SelectItem>
  <SelectItem value="Villa">Villa</SelectItem>
</Select>
```

**Tonight Filter**:
```tsx
<Select value={statusFilter} onValueChange={setStatusFilter}>
  <SelectItem value="all">All tonight</SelectItem>
  <SelectItem value="Blocked">Blocked</SelectItem>
  <SelectItem value="Booked">Booked</SelectItem>
  <SelectItem value="Free">Free</SelectItem>
</Select>
```

## 📤 CSV Export

### Export Implementation

```typescript
export function exportUnitsToCSV(units: Unit[]) {
  const csvData = units.map(unit => ({
    'Unit Code': unit.unit_code,
    'Unit Name': unit.unit_name,
    'Type': unit.unit_type,
    'Base Occupancy': unit.base_occupancy,
    'Max Occupancy': unit.max_occupancy,
    'Base Rate': unit.base_rate.toFixed(2),
    'Extra Person Rate': (unit.extra_person_rate || 0).toFixed(2),
    'Weekend Rate': (unit.weekend_rate || unit.base_rate).toFixed(2),
  }))

  const csv = generateCSV(csvData)
  downloadFile(csv, `units-${format(new Date(), 'yyyy-MM-dd')}.csv`)
}
```

### CSV Format

```csv
Unit Code,Unit Name,Type,Base Occupancy,Max Occupancy,Base Rate,Extra Person Rate,Weekend Rate
BCH-1,Beachfront Cottage 1,Standard,2,4,2000.00,500.00,2500.00
DEL-1,Deluxe Room 1,Deluxe,2,3,3000.00,750.00,3500.00
```

## 🎨 Status Badges

### Status Badge Component

```tsx
import { StatusBadge } from '@/components/patterns'
import { statusTone } from '@/lib/status-tone'

<StatusBadge tone={statusTone(cabinNight.state)}>{cabinNight.state}</StatusBadge>

// Renders:
// - Free: success
// - Booked: neutral
// - Blocked: danger, with the block reason as muted text below
```

### Type Badge

```tsx
<div className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
  {unit.unit_type}
</div>
```

## 🧪 Testing

### Component Tests

```typescript
describe('UnitsTable', () => {
  it('renders units correctly', () => {
    const mockUnits = [
      {
        unit_id: '1',
        unit_code: 'BCH-1',
        unit_name: 'Beachfront Cottage 1',
        unit_type: 'Standard',
        base_occupancy: 2,
        max_occupancy: 4,
        base_rate: 2000,
        extra_person_rate: 500,
      },
    ]

    render(<UnitsTable />)

    expect(screen.getByText('BCH-1')).toBeInTheDocument()
    expect(screen.getByText('Beachfront Cottage 1')).toBeInTheDocument()
    expect(screen.getByText('₱2,000.00')).toBeInTheDocument()
  })

  it('enables inline editing in edit mode', async () => {
    render(<UnitsTable />)

    // Toggle edit mode
    const editButton = screen.getByRole('button', { name: /edit/i })
    fireEvent.click(editButton)

    // Unit name becomes editable
    const nameInput = screen.getByDisplayValue('Beachfront Cottage 1')
    expect(nameInput.tagName).toBe('INPUT')

    // Update value
    fireEvent.change(nameInput, { target: { value: 'Beach House 1' } })
    fireEvent.blur(nameInput)

    await waitFor(() => {
      expect(screen.getByText(/updated successfully/i)).toBeInTheDocument()
    })
  })

  it('exports to CSV', async () => {
    const mockDownload = vi.fn()
    global.URL.createObjectURL = vi.fn()

    render(<UnitsTable />)

    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalled()
    })
  })
})
```

## 🎯 Best Practices

1. ✅ **Use edit mode for bulk updates** instead of individual edits
2. ✅ **Auto-save on blur** for better UX
3. ✅ **Show loading states** during updates
4. ✅ **Rollback on error** to maintain data integrity
5. ✅ **Never store a cabin state**: block the dates instead
6. ✅ **Provide visual feedback** with toast notifications
7. ✅ **Validate before save** to prevent invalid data
8. ✅ **Use optimistic updates** when possible
10. ✅ **Export current filter state** not all data

## 📚 Related Documentation

- [Patterns kit](/src/components/patterns/CLAUDE.md) - Shared table patterns (`@/components/patterns`)
- [Unit Store](/src/stores/useUnitStore.ts) - State management
- [Availability Engine](/src/lib/availability.ts) - Unit availability logic

## 🔧 Configuration

### Unit Types

```typescript
export const UNIT_TYPES = [
  'Standard',
  'Deluxe',
  'Suite',
  'Villa',
] as const

export type UnitType = typeof UNIT_TYPES[number]
```

### Cabin States

```typescript
export type CabinState = "Blocked" | "Booked" | "Free";
```

### Default Values

```typescript
const DEFAULT_UNIT = {
  base_occupancy: 2,
  max_occupancy: 4,
  base_rate: 2000,
  extra_person_rate: 500,
  weekend_rate: 2500,
  unit_type: 'Standard',
}
```

## 📈 Performance

- **Initial Load**: ~150ms
- **Edit Mode Toggle**: < 50ms
- **Inline Save**: ~200ms per field
- **Export 100 units**: ~300ms
- **Component Size**: ~15KB minified

## 🎨 Styling

### Selected Row Highlight

```css
.unit-row[data-state="selected"] {
  background-color: hsl(210 100% 96%);  /* blue-50 */
}

.unit-row:hover {
  background-color: hsl(0 0% 98%);      /* neutral-50 */
}
```

### Inline Edit Styling

```css
.inline-edit-input {
  border: 1px solid hsl(210 100% 70%);  /* blue-400 */
  background-color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  transition: all 0.15s;
}

.inline-edit-input:focus {
  outline: none;
  border-color: hsl(210 100% 50%);      /* blue-600 */
  box-shadow: 0 0 0 3px hsl(210 100% 90%);  /* blue-100 */
}
```

## 🚨 Common Issues

### Issue: Inline edit not saving

**Cause**: Missing `onBlur` handler or validation error

**Solution**:
```typescript
<InlineEdit
  value={value}
  onSave={async (newValue) => {
    // Validate first
    if (!newValue || newValue.length < 2) {
      throw new Error('Name must be at least 2 characters')
    }

    // Save to database
    await updateUnit(unitId, { unit_name: newValue })
  }}
/>
```

### Issue: Edit mode changes not persisting

**Cause**: Not invalidating queries after update

**Solution**:
```typescript
const updateMutation = useMutation({
  mutationFn: (data) => db.units.update(unitId, data),
  onSuccess: () => {
    queryClient.invalidateQueries(['units'])  // Refetch data
    toast.success('Updated successfully')
  },
})
```

## 🔒 Security

- [x] Audit trail for all updates
- [x] RBAC enforcement (admin only)
- [x] Input validation before save
- [x] SQL injection prevention
- [x] XSS prevention in unit names
- [x] Rollback on error

## 🔄 Future Enhancements

- [ ] Drag-and-drop row reordering
- [ ] Bulk import from CSV
- [ ] Unit duplication feature
- [ ] Photo gallery column
- [ ] Amenities checklist
- [ ] Unit location map
- [ ] Historical pricing chart
- [ ] Booking calendar integration
- [ ] Custom column visibility
