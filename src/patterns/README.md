# 🎨 Reusable UI Patterns

## Overview

The `/src/patterns/` directory contains reusable UI patterns that standardize common implementation patterns across the application. These patterns ensure consistency, reduce code duplication, and accelerate development.

## 📁 Pattern Library

```
patterns/
├── data-fetching-pattern.tsx   # Data loading patterns (5.6KB)
├── form-pattern.tsx            # Form handling patterns (3.8KB)
├── modal-pattern.tsx           # Modal dialog patterns (6.5KB)
├── table-pattern.tsx           # Data table patterns (7.6KB)
└── index.ts                    # Pattern exports
```

## 📦 Pattern Documentation

### `data-fetching-pattern.tsx` - Data Loading Patterns
**Purpose**: Standardized data fetching with loading, error, and success states

**Pattern Components**:

```typescript
// Basic Fetch Pattern
export function DataFetchPattern<T>({
  queryKey,
  queryFn,
  renderSuccess,
  renderError,
  renderLoading,
}: DataFetchPatternProps<T>) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (isLoading) {
    return renderLoading?.() || <DefaultLoadingSkeleton />
  }

  if (error) {
    return renderError?.(error) || <DefaultErrorComponent error={error} onRetry={refetch} />
  }

  if (!data) {
    return <EmptyState />
  }

  return renderSuccess(data)
}
```

**Usage Example**:
```tsx
import { DataFetchPattern } from '@/patterns'

function BookingsList() {
  return (
    <DataFetchPattern
      queryKey={['bookings']}
      queryFn={fetchBookings}
      renderSuccess={(bookings) => (
        <BookingsTable data={bookings} />
      )}
      renderLoading={() => <BookingsTableSkeleton />}
      renderError={(error) => (
        <ErrorAlert
          message="Failed to load bookings"
          error={error}
        />
      )}
    />
  )
}
```

**Advanced Patterns**:
```typescript
// Paginated Fetch Pattern
export function PaginatedFetchPattern<T>({
  baseKey,
  fetchFn,
  pageSize = 20,
  renderItems,
}: PaginatedPatternProps<T>) {
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...baseKey, page],
    queryFn: () => fetchFn({ page, pageSize }),
    keepPreviousData: true,
  })

  return (
    <>
      {renderItems(data?.items || [])}
      <Pagination
        page={page}
        totalPages={data?.totalPages}
        onPageChange={setPage}
        isLoading={isFetching}
      />
    </>
  )
}

// Infinite Scroll Pattern
export function InfiniteFetchPattern<T>({
  queryKey,
  fetchFn,
  renderItems,
}: InfinitePatternProps<T>) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: fetchFn,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const items = data?.pages.flatMap(page => page.items) || []

  return (
    <InfiniteScroll
      items={items}
      onLoadMore={fetchNextPage}
      hasMore={hasNextPage}
      isLoading={isFetchingNextPage}
      render={renderItems}
    />
  )
}
```

### `form-pattern.tsx` - Form Handling Patterns
**Purpose**: Consistent form implementation with validation and submission

**Pattern Components**:
```typescript
// Basic Form Pattern
export function FormPattern<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  mode = 'onBlur',
}: FormPatternProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode,
  })

  const handleSubmit = async (data: T) => {
    try {
      await onSubmit(data)
      form.reset()
      toast.success('Saved successfully')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        {children(form)}
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Save
          </Button>
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Reset
          </Button>
        </FormActions>
      </form>
    </Form>
  )
}
```

**Usage Example**:
```tsx
import { FormPattern } from '@/patterns'

const guestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string(),
})

function GuestForm() {
  return (
    <FormPattern
      schema={guestSchema}
      defaultValues={{ firstName: '', lastName: '' }}
      onSubmit={async (data) => {
        await createGuest(data)
      }}
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* More fields */}
        </>
      )}
    </FormPattern>
  )
}
```

**Advanced Form Patterns**:
```typescript
// Multi-step Form Pattern
export function MultiStepFormPattern<T>({
  steps,
  onComplete,
}: MultiStepFormProps<T>) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<Partial<T>>({})

  const handleStepSubmit = (stepData: Partial<T>) => {
    const newData = { ...formData, ...stepData }
    setFormData(newData)

    if (currentStep === steps.length - 1) {
      onComplete(newData as T)
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  return (
    <div>
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
      />
      {steps[currentStep].render({
        data: formData,
        onSubmit: handleStepSubmit,
        onBack: () => setCurrentStep(prev => prev - 1),
      })}
    </div>
  )
}
```

### `modal-pattern.tsx` - Modal Dialog Patterns
**Purpose**: Consistent modal implementation with state management

**Pattern Components**:
```typescript
// Basic Modal Pattern
export function ModalPattern({
  trigger,
  title,
  description,
  children,
  size = 'default',
}: ModalPatternProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {children({ close: () => setOpen(false) })}
      </DialogContent>
    </Dialog>
  )
}

// Confirmation Modal Pattern
export function ConfirmationModal({
  trigger,
  title,
  message,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmationModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            variant={variant}
          >
            {loading && <Spinner />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### `table-pattern.tsx` - Data Table Patterns
**Purpose**: Reusable table implementations with sorting, filtering, and pagination

**Pattern Components**:
```typescript
// Advanced Table Pattern
export function TablePattern<T>({
  data,
  columns,
  searchable = false,
  filterable = false,
  sortable = false,
  selectable = false,
  onRowClick,
  actions,
}: TablePatternProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [filtering, setFiltering] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sortable ? getSortedRowModel() : undefined,
    getFilteredRowModel: filterable ? getFilteredRowModel() : undefined,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setFiltering,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters: filtering,
      rowSelection,
      globalFilter,
    },
  })

  return (
    <div className="table-container">
      {searchable && (
        <TableSearch
          value={globalFilter}
          onChange={setGlobalFilter}
        />
      )}

      {filterable && (
        <TableFilters
          filters={table.getColumn}
          onFilterChange={setFiltering}
        />
      )}

      {selectable && (
        <TableBulkActions
          selectedRows={table.getFilteredSelectedRowModel().rows}
          actions={actions}
        />
      )}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className="cursor-pointer"
            >
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TablePagination table={table} />
    </div>
  )
}
```

## 🏗️ Pattern Composition

### Combining Patterns
```tsx
// Combine data fetching with table pattern
function BookingsTableWithFetch() {
  return (
    <DataFetchPattern
      queryKey={['bookings']}
      queryFn={fetchBookings}
      renderSuccess={(bookings) => (
        <TablePattern
          data={bookings}
          columns={bookingColumns}
          searchable
          filterable
          sortable
        />
      )}
    />
  )
}

// Form inside modal pattern
function CreateGuestModal() {
  return (
    <ModalPattern
      trigger={<Button>Add Guest</Button>}
      title="Create New Guest"
    >
      {({ close }) => (
        <FormPattern
          schema={guestSchema}
          onSubmit={async (data) => {
            await createGuest(data)
            close()
          }}
        >
          {/* Form fields */}
        </FormPattern>
      )}
    </ModalPattern>
  )
}
```

## 🎨 Styling Patterns

### Consistent Theming
```typescript
// Pattern theme configuration
export const patternTheme = {
  table: {
    container: 'rounded-lg border bg-card',
    header: 'border-b bg-muted/50',
    row: 'border-b transition-colors hover:bg-muted/50',
    cell: 'p-4 align-middle',
  },
  form: {
    container: 'space-y-6',
    field: 'space-y-2',
    label: 'text-sm font-medium',
    error: 'text-sm text-destructive',
  },
  modal: {
    overlay: 'bg-background/80 backdrop-blur-sm',
    content: 'bg-background border shadow-lg',
  },
}
```

## 🔧 Pattern Configuration

### Global Pattern Settings
```typescript
export const patternConfig = {
  table: {
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
    defaultSort: { id: 'createdAt', desc: true },
  },
  form: {
    defaultMode: 'onBlur',
    showRequiredIndicator: true,
    focusFirstError: true,
  },
  modal: {
    closeOnOverlayClick: true,
    closeOnEsc: true,
    trapFocus: true,
  },
  fetch: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retryCount: 3,
  },
}
```

## 🧪 Testing Patterns

```typescript
describe('TablePattern', () => {
  it('renders data correctly', () => {
    const { getByText } = render(
      <TablePattern
        data={mockData}
        columns={mockColumns}
      />
    )

    expect(getByText('Test Item')).toBeInTheDocument()
  })

  it('handles sorting', () => {
    // Test sorting functionality
  })
})
```

## 📚 Best Practices

1. **Use Patterns Consistently**: Don't mix pattern and custom implementations
2. **Extend, Don't Modify**: Create wrapper components for customization
3. **Keep Patterns Generic**: Avoid business logic in patterns
4. **Document Customizations**: Note any deviations from standard patterns
5. **Test Pattern Usage**: Ensure patterns work in your context

## 🚀 Performance Considerations

- Patterns use React.memo for optimization
- Virtual scrolling for large datasets
- Lazy loading for heavy components
- Debounced inputs in forms and search

## 📝 Pattern Guidelines

- **Single Responsibility**: Each pattern does one thing well
- **Composability**: Patterns can be combined
- **Flexibility**: Patterns accept render props for customization
- **Type Safety**: Full TypeScript support with generics
- **Accessibility**: WCAG 2.1 AA compliant