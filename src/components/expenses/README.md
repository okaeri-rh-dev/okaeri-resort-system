# 💰 Expense Management Components

## Overview

The Expense Management module provides comprehensive expense tracking, categorization, approval workflows, and financial reporting for resort operations. It includes receipt management, vendor tracking, and budget monitoring capabilities.

## 📁 Component Structure

```
expenses/
├── ExpenseForm.tsx       # Expense entry form
├── ExpensesTable.tsx     # Expense list and management
├── ExpenseDetails.tsx    # Detailed expense view
└── components/
    ├── CategorySelect.tsx
    ├── ReceiptViewer.tsx
    └── ApprovalFlow.tsx
```

## 📦 Component Documentation

### `ExpenseForm` - Expense Entry
**Purpose**: Record and categorize business expenses

**Features**:
- Category-based entry
- Receipt upload with OCR (Phase 3)
- Vendor management
- Approval routing
- Recurring expense support

**Props**:
```typescript
interface ExpenseFormProps {
  expense?: Expense  // For editing
  onSubmit: (expense: Expense) => Promise<void>
  onCancel: () => void
  defaultCategory?: ExpenseCategory
  requireApproval?: boolean
}
```

**Usage**:
```tsx
import { ExpenseForm } from '@/components/expenses'

function AddExpense() {
  const handleSubmit = async (expenseData: Expense) => {
    const { data, error } = await db.expenses.create(expenseData)
    if (data) {
      toast.success('Expense recorded successfully')
      if (data.status === 'pending') {
        notifyApprover(data.expense_id)
      }
    }
  }

  return (
    <ExpenseForm
      onSubmit={handleSubmit}
      requireApproval={true}
      defaultCategory="utilities"
    />
  )
}
```

**Form Fields**:
- Category* (dropdown)
- Amount* (PHP)
- Description*
- Expense Date*
- Vendor (with autocomplete)
- Receipt Upload
- Payment Method
- Reference Number
- Notes
- Recurring (checkbox)

### `ExpensesTable` - Expense Management
**Purpose**: View, filter, and manage all expenses

**Features**:
- Advanced filtering by category/date/status
- Bulk approval/rejection
- Receipt viewing
- Export to CSV/Excel
- Budget tracking indicators

**Props**:
```typescript
interface ExpensesTableProps {
  dateRange?: DateRange
  category?: ExpenseCategory
  status?: ExpenseStatus
  onExpenseSelect?: (expense: Expense) => void
  showApprovalActions?: boolean
  viewMode?: 'table' | 'cards' | 'summary'
}
```

**Columns**:
```typescript
const columns = [
  { key: 'date', label: 'Date', sortable: true },
  { key: 'category', label: 'Category', filterable: true },
  { key: 'description', label: 'Description' },
  { key: 'vendor', label: 'Vendor', searchable: true },
  { key: 'amount', label: 'Amount', sortable: true },
  { key: 'status', label: 'Status', badge: true },
  { key: 'receipt', label: 'Receipt', action: true },
  { key: 'actions', label: '', component: ExpenseActions }
]
```

## 📊 Expense Categories

### Category Configuration
```typescript
export const expenseCategories = {
  utilities: {
    label: 'Utilities',
    icon: '⚡',
    color: 'blue',
    subcategories: ['Electricity', 'Water', 'Internet', 'Gas']
  },
  maintenance: {
    label: 'Maintenance & Repairs',
    icon: '🔧',
    color: 'orange',
    subcategories: ['Routine', 'Emergency', 'Preventive']
  },
  supplies: {
    label: 'Supplies',
    icon: '📦',
    color: 'green',
    subcategories: ['Cleaning', 'Office', 'Guest Amenities']
  },
  salaries: {
    label: 'Salaries & Wages',
    icon: '👥',
    color: 'purple',
    subcategories: ['Regular', 'Overtime', 'Bonuses']
  },
  marketing: {
    label: 'Marketing',
    icon: '📣',
    color: 'pink',
    subcategories: ['Advertising', 'Promotions', 'Website']
  },
  food_beverage: {
    label: 'Food & Beverage',
    icon: '🍽️',
    color: 'red',
    subcategories: ['Restaurant', 'Bar', 'Room Service']
  },
  equipment: {
    label: 'Equipment',
    icon: '🖥️',
    color: 'gray',
    subcategories: ['Purchase', 'Rental', 'Maintenance']
  }
}
```

### Budget Tracking
```typescript
interface BudgetConfig {
  category: ExpenseCategory
  monthlyLimit: number
  yearlyLimit: number
  alertThreshold: number // Percentage
}

// Check budget status
const budgetStatus = await checkBudgetStatus('utilities', {
  period: 'monthly',
  includeProjected: true
})

if (budgetStatus.percentUsed > 80) {
  showBudgetWarning(budgetStatus)
}
```

## 🧾 Receipt Management

### Receipt Upload
```typescript
const receiptConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  acceptedFormats: [
    'image/jpeg',
    'image/png',
    'application/pdf'
  ],
  ocrEnabled: false, // Phase 3 feature
  autoExtract: false // Phase 3 feature
}

// Upload receipt
const uploadReceipt = async (file: File, expenseId: string) => {
  const compressed = await compressImage(file)
  const { url, error } = await uploadToStorage(compressed, {
    bucket: 'receipts',
    path: `expenses/${expenseId}`
  })

  return url
}
```

### Receipt Viewer
```tsx
<ReceiptViewer
  url={expense.receipt_url}
  type={expense.receipt_type}
  onDownload={() => downloadReceipt(expense)}
  onRotate={(angle) => rotateReceipt(expense, angle)}
/>
```

## 👥 Vendor Management

### Vendor Tracking
```typescript
interface Vendor {
  vendor_id: string
  name: string
  category: ExpenseCategory[]
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  tin?: string // Tax ID for Philippines
  payment_terms?: string
  notes?: string
}

// Vendor autocomplete
const vendorSuggestions = await searchVendors(query, {
  category: selectedCategory,
  limit: 10
})
```

## ✅ Approval Workflow

### Approval Process
```typescript
interface ApprovalRule {
  category: ExpenseCategory
  amountThreshold: number
  approver: string // User ID
  autoApprove?: boolean
}

// Submit for approval
const submitForApproval = async (expense: Expense) => {
  const approver = getApprover(expense)

  await db.expenses.update(expense.expense_id, {
    status: 'pending',
    assigned_to: approver
  })

  await sendApprovalNotification(approver, expense)
}

// Approve/Reject
const handleApproval = async (
  expenseId: string,
  decision: 'approved' | 'rejected',
  notes?: string
) => {
  await db.expenses.update(expenseId, {
    status: decision,
    approved_by: currentUser.id,
    approval_notes: notes,
    approved_at: new Date()
  })
}
```

### Approval Status
```tsx
const statusConfig = {
  pending: { color: 'yellow', icon: '⏳', label: 'Pending Approval' },
  approved: { color: 'green', icon: '✅', label: 'Approved' },
  rejected: { color: 'red', icon: '❌', label: 'Rejected' },
  paid: { color: 'blue', icon: '💰', label: 'Paid' },
  reimbursed: { color: 'purple', icon: '↩️', label: 'Reimbursed' }
}
```

## 📈 Reporting & Analytics

### Expense Summary
```typescript
interface ExpenseSummary {
  totalExpenses: number
  byCategory: Record<ExpenseCategory, number>
  byVendor: VendorExpense[]
  byMonth: MonthlyExpense[]
  topExpenses: Expense[]
  budgetUtilization: BudgetStatus[]
}

// Generate summary
const summary = await generateExpenseSummary({
  dateRange: { start: firstDayOfYear, end: today },
  groupBy: ['category', 'month']
})
```

### Expense Trends
```tsx
<ExpenseTrends
  data={expenseTrends}
  view="monthly"
  categories={selectedCategories}
  showBudgetLine
  showProjection
/>
```

## 🔍 Search & Filters

### Advanced Filtering
```typescript
interface ExpenseFilters {
  search?: string
  categories?: ExpenseCategory[]
  dateRange?: DateRange
  amountRange?: { min: number; max: number }
  vendors?: string[]
  status?: ExpenseStatus[]
  hasReceipt?: boolean
  approvedBy?: string
}

// Apply filters
const filtered = applyExpenseFilters(expenses, {
  categories: ['utilities', 'maintenance'],
  dateRange: thisMonth,
  amountRange: { min: 1000, max: 10000 }
})
```

## 🎨 UI Components

### Expense Card
```tsx
<ExpenseCard>
  <CategoryIcon category={expense.category} />
  <ExpenseInfo>
    <Description>{expense.description}</Description>
    <Vendor>{expense.vendor}</Vendor>
    <Date>{formatDate(expense.expense_date)}</Date>
  </ExpenseInfo>
  <Amount>{formatCurrency(expense.amount)}</Amount>
  <StatusBadge status={expense.status} />
  <Actions>
    <ViewReceipt />
    <EditExpense />
    <ApproveReject />
  </Actions>
</ExpenseCard>
```

### Budget Indicator
```tsx
<BudgetIndicator
  used={categoryExpenses}
  budget={categoryBudget}
  showPercentage
  showRemaining
  alertThreshold={0.8}
/>
```

## 🔒 Security & Compliance

### Data Security
- Receipt encryption at rest
- Audit trail for all changes
- Role-based access control
- Sensitive data masking in logs

### Compliance Features
- BIR compliance for Philippines
- Expense categorization for tax reporting
- Receipt retention policy (7 years)
- Approval audit trail

## 🧪 Testing

```typescript
describe('ExpenseForm', () => {
  it('validates amount is positive', () => {
    const { getByLabelText } = render(<ExpenseForm />)
    const amountInput = getByLabelText('Amount')

    fireEvent.change(amountInput, { target: { value: '-100' } })
    fireEvent.blur(amountInput)

    expect(getByText('Amount must be positive')).toBeInTheDocument()
  })

  it('requires receipt for amounts over 5000', () => {
    // Test receipt requirement validation
  })
})
```

## 🚀 Performance

- Lazy loading of receipts
- Virtualized expense list
- Debounced search (300ms)
- Optimistic UI for approvals
- Cached vendor suggestions

## 📚 Related Documentation

- [Payment Components](/src/components/payments/README.md)
- [Financial Reports](/src/utils/reports.ts)
- [Expense Store](/src/stores/useExpenseStore.ts)
- [Database Schema](/database/SCHEMA.md#expenses-table)

## 🔧 Configuration

```typescript
export const expenseConfig = {
  requireReceiptThreshold: 5000, // PHP
  autoApprovalLimit: 1000,
  defaultPaymentTerms: 30, // days
  budgetAlertThreshold: 0.8, // 80%
  receiptRetentionYears: 7,
  allowedCurrencies: ['PHP'],
  taxRate: 0.12 // 12% VAT
}
```