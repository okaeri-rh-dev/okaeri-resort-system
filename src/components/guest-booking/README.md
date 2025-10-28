# Guest Booking Components

Professional Enterprise UI components for the multi-unit guest booking flow following the Professional Enterprise Design System principles.

## Components

### 1. UnitRequestCard

**File**: `src/components/guest-booking/UnitRequestCard.tsx`

A card component representing exactly one unit request with variable guest count.

**Features**:
- Numbered unit title with Home icon ("Unit #1", "Unit #2", etc.)
- Guest count input with validation (min=1, max=maxCapacityPerUnit)
- Extra person warning indicator (when guests > baseOccupancy)
- Removable (shows X button if `canRemove=true`)
- Monospace currency formatting for extra person fees
- Professional Enterprise styling with neutral colors

### 2. UnitRequestSelector

**File**: `src/components/guest-booking/UnitRequestSelector.tsx`

Container component managing an array of UnitRequestCard components.

**Features**:
- Fetches static pricing rates from API on mount
- Displays reference rate card with monospace numbers
- Info banner with booking instructions and totals
- Add/Remove unit functionality
- Max units warning (default: 10 units)
- Loading state with Skeleton components
- Error state with Alert component

### 3. DateRangePicker

**File**: `src/components/guest-booking/DateRangePicker.tsx`

Professional date range selector for check-in/check-out dates.

**Features**:
- Dual-month calendar view (responsive)
- Automatic validation (no past dates, min 1 night)
- Night count display on valid selection
- Error message display for invalid selections
- Uses react-day-picker for range selection

## Usage

See component files for detailed documentation and examples.
