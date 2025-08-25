# User Interface & Experience Design Plan - Updated 2025 Stack

## Overview
The UI/UX design leverages the **latest 2025 technology stack**: **Vite 7 + React 19 + Zustand + TanStack Query + TanStack Router + shadcn/ui + Tailwind CSS v4**, creating a mobile-first Progressive Web Application (PWA) that provides an intuitive, efficient experience for family-owned resort management with optimistic UI updates and real-time state synchronization.

## Updated Technology Foundation

### Core Stack (2025)
- **Build Tool:** Vite 7.0.0 with Lightning CSS support
- **Framework:** React 19.1 with `useOptimistic` and `useActionState` hooks
- **State Management:** Zustand 5.0.2 for local/UI state
- **Server State:** TanStack Query 5.71.10 for server state management
- **Routing:** TanStack Router 1.114.3 with file-based routing
- **UI Components:** shadcn/ui (latest) with Radix UI primitives
- **Styling:** Tailwind CSS v4.0 with oklch() color space and CSS-first configuration
- **Forms:** React Hook Form 7.54.0 + Zod validation
- **Type Safety:** TypeScript throughout with strict mode

## Modern Design Philosophy

### Updated Core Principles
- **Mobile-First PWA:** React 19 concurrent features + Vite 7 performance
- **Modern State Architecture:** TanStack Query for server state + Zustand for local state
- **Optimistic UI:** React 19 `useOptimistic` for instant user feedback
- **shadcn/ui Design System:** Copy-paste components with full accessibility
- **CSS-First Configuration:** Tailwind v4 `@theme` directive for design tokens
- **Filipino User Context:** Localized for Philippine business practices with modern UX

### Design Language Evolution
- **Clean & Performant:** React 19 concurrent rendering for smooth interactions
- **Tropical Professional:** Modern oklch() color space for accurate tropical colors
- **Data-Driven:** TanStack Query intelligent caching with real-time updates
- **Touch-Optimized:** Large tap targets with haptic feedback considerations

## Visual Design System - Tailwind CSS v4

### Modern Color Palette (oklch() Color Space)
```css
/* Modern CSS-First Configuration using @theme directive */
@import "tailwindcss";

@theme {
  /* Primary Colors - Ocean & Beach Inspired (oklch format) */
  --color-primary: oklch(59.69% 0.156 252.77);      /* Ocean blue for primary actions */
  --color-primary-foreground: oklch(98.35% 0.007 252.77);
  
  --color-accent: oklch(64.23% 0.192 26.46);        /* Sunset coral for accents */
  --color-accent-foreground: oklch(98.35% 0.007 252.77);
  
  --color-secondary: oklch(69.07% 0.147 60.75);     /* Warm sand orange for highlights */
  --color-secondary-foreground: oklch(15.05% 0.017 252.77);
  
  --color-destructive: oklch(64.23% 0.192 26.46);   /* Coral red for alerts/warnings */
  --color-destructive-foreground: oklch(98.35% 0.007 252.77);

  /* Background and Surface Colors */
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(15.05% 0.017 252.77);
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(15.05% 0.017 252.77);
  --color-popover: oklch(100% 0 0);
  --color-popover-foreground: oklch(15.05% 0.017 252.77);
  
  /* Borders and Interactive Elements */
  --color-border: oklch(91.97% 0.007 252.77);
  --color-input: oklch(91.97% 0.007 252.77);
  --color-ring: oklch(59.69% 0.156 252.77);
  
  /* Muted Colors for Secondary Text */
  --color-muted: oklch(96.47% 0.007 252.77);
  --color-muted-foreground: oklch(64.82% 0.021 252.77);
  
  /* Status Colors */
  --color-success: oklch(69.71% 0.144 142.49);      /* Success green */
  --color-warning: oklch(77.84% 0.134 84.57);       /* Warning yellow */
  --color-info: oklch(58.12% 0.089 221.28);         /* Info blue */
  
  /* Resort-Specific Status Colors */
  --color-status-pending: oklch(77.84% 0.134 84.57);    /* Warning yellow */
  --color-status-confirmed: oklch(69.71% 0.144 142.49); /* Success green */
  --color-status-overdue: oklch(64.23% 0.192 26.46);    /* Destructive red */
  --color-status-paid: oklch(58.12% 0.089 221.28);      /* Info blue */

  /* Typography */
  --font-family-primary: 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-mono: 'JetBrains Mono Variable', 'Courier New', monospace;

  /* Spacing System (8px base unit) */
  --spacing-1: 0.25rem;    /* 4px */
  --spacing-2: 0.5rem;     /* 8px */
  --spacing-3: 0.75rem;    /* 12px */
  --spacing-4: 1rem;       /* 16px */
  --spacing-5: 1.25rem;    /* 20px */
  --spacing-6: 1.5rem;     /* 24px */
  --spacing-8: 2rem;       /* 32px */
  --spacing-10: 2.5rem;    /* 40px */
  --spacing-12: 3rem;      /* 48px */

  /* Border Radius */
  --radius: 0.75rem;
  
  /* Custom Resort Theme Properties */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
  --shadow-resort: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: oklch(15.05% 0.017 252.77);
    --color-foreground: oklch(98.35% 0.007 252.77);
    --color-card: oklch(15.05% 0.017 252.77);
    --color-card-foreground: oklch(98.35% 0.007 252.77);
    --color-popover: oklch(15.05% 0.017 252.77);
    --color-popover-foreground: oklch(98.35% 0.007 252.77);
    
    --color-muted: oklch(24.26% 0.021 252.77);
    --color-muted-foreground: oklch(70.73% 0.021 252.77);
    
    --color-border: oklch(24.26% 0.021 252.77);
    --color-input: oklch(24.26% 0.021 252.77);
  }
}

/* Resort-specific utility classes */
@layer components {
  .resort-gradient {
    background: linear-gradient(135deg, oklch(59.69% 0.156 252.77), oklch(64.23% 0.192 26.46));
  }
  
  .status-badge {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border;
  }
  
  .status-pending {
    @apply bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800;
  }
  
  .status-confirmed {
    @apply bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800;
  }
  
  .status-overdue {
    @apply bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800;
  }
  
  .status-paid {
    @apply bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800;
  }
}
```

## Modern Component Library - shadcn/ui Integration

### Installation & Configuration
```bash
# Latest shadcn/ui setup
npx shadcn@latest init

# Core components for resort management
npx shadcn@latest add button input label form card dialog sheet select calendar popover table progress badge avatar dropdown-menu toast tabs radio-group textarea separator switch
```

### Key shadcn/ui Components for Resort Management

#### Modern Navigation Components

##### Top Navigation Bar with Zustand Integration
```typescript
// src/components/layout/Navbar.tsx
"use client"

import { Bell, Settings, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import { useProjectStore } from "@/stores/projectStore"
import { ProjectSwitcher } from "./ProjectSwitcher"

export function Navbar() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const currentProject = useProjectStore((state) => state.currentProject)
  
  const handleLogout = () => {
    logout()
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="font-semibold text-lg">
            {currentProject?.name || 'Okaeri Resort'}
          </div>
          <ProjectSwitcher />
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              3
            </Badge>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder-avatar.jpg" alt="User avatar" />
                  <AvatarFallback>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
```

##### Bottom Navigation (Mobile) with React 19 Features
```typescript
// src/components/layout/MobileNav.tsx
"use client"

import { useState, useOptimistic } from 'react'
import { Home, Calendar, DollarSign, BarChart3, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useBookingStore } from "@/stores/bookingStore"

const navItems = [
  { icon: Home, label: "Home", href: "/", badge: null },
  { icon: Calendar, label: "Bookings", href: "/bookings", badge: "pending" },
  { icon: DollarSign, label: "Finance", href: "/finance", badge: null },
  { icon: BarChart3, label: "Reports", href: "/reports", badge: null },
  { icon: Settings, label: "Settings", href: "/settings", badge: null },
]

export function MobileNav() {
  const [activeTab, setActiveTab] = useState("/")
  
  // React 19: useOptimistic for instant tab switching
  const [optimisticActiveTab, addOptimisticActiveTab] = useOptimistic(
    activeTab,
    (state, newTab) => newTab
  )
  
  const pendingBookingsCount = useBookingStore((state) => state.pendingCount || 0)

  const handleTabClick = (href: string) => {
    // Optimistically update the active tab
    addOptimisticActiveTab(href)
    setActiveTab(href)
    // Navigation logic would go here
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="grid h-16 grid-cols-5">
        {navItems.map((item) => {
          const isActive = optimisticActiveTab === item.href
          const badgeCount = item.badge === "pending" ? pendingBookingsCount : null
          
          return (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-none h-full",
                isActive && "text-primary bg-primary/5"
              )}
              onClick={() => handleTabClick(item.href)}
            >
              <div className="relative">
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {badgeCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-xs"
                  >
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-xs",
                isActive ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
```

### Dashboard Components with Modern State Management

#### Enhanced Summary Cards with TanStack Query
```typescript
// src/components/dashboard/SummaryCards.tsx
"use client"

import { TrendingUp, TrendingDown, DollarSign, CalendarDays } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useDashboardMetrics } from "@/hooks/useFinancialQueries"
import { useProjectStore } from "@/stores/projectStore"

interface MetricCardProps {
  title: string
  value: string
  change?: number
  trend?: 'up' | 'down'
  icon: React.ComponentType<{ className?: string }>
  description?: string
  isLoading?: boolean
}

function MetricCard({ title, value, change, trend, icon: Icon, description, isLoading }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {change !== undefined && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span className={cn(
              "font-medium",
              trend === 'up' ? "text-green-600" : "text-red-600"
            )}>
              {Math.abs(change)}% from last month
            </span>
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function SummaryCards() {
  const currentProject = useProjectStore((state) => state.currentProject)
  const { data: metrics, isLoading } = useDashboardMetrics(currentProject?.id || '')

  const cards = [
    {
      title: "Monthly Revenue",
      value: metrics?.monthlyRevenue ? `₱${metrics.monthlyRevenue.toLocaleString()}` : "₱0",
      change: metrics?.revenueChange,
      trend: (metrics?.revenueChange || 0) >= 0 ? 'up' as const : 'down' as const,
      icon: TrendingUp,
      description: "Total bookings income"
    },
    {
      title: "Monthly Expenses", 
      value: metrics?.monthlyExpenses ? `₱${metrics.monthlyExpenses.toLocaleString()}` : "₱0",
      change: metrics?.expenseChange,
      trend: (metrics?.expenseChange || 0) <= 0 ? 'up' as const : 'down' as const,
      icon: TrendingDown,
      description: "Operational costs"
    },
    {
      title: "Net Profit",
      value: metrics?.netProfit ? `₱${metrics.netProfit.toLocaleString()}` : "₱0",
      icon: DollarSign,
      description: "Revenue minus expenses"
    },
    {
      title: "Active Bookings",
      value: metrics?.activeBookingsCount?.toString() || "0",
      icon: CalendarDays,
      description: "Current reservations"
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <MetricCard key={index} {...card} isLoading={isLoading} />
      ))}
    </div>
  )
}
```

### Form Components with React 19 + Modern State Management

#### Modern Expense Form with useOptimistic and TanStack Query
```typescript
// src/components/forms/ExpenseForm.tsx
"use client"

import { useState, useOptimistic, useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CalendarIcon, Upload, Receipt, X } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"

import { useCreateExpense, useExpenseCategories } from "@/hooks/useFinancialQueries"
import { useProjectStore } from "@/stores/projectStore"
import { cn } from "@/lib/utils"

const expenseSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine((val) => {
    const num = parseFloat(val)
    return !isNaN(num) && num > 0
  }, 'Amount must be a valid positive number'),
  categoryId: z.string().min(1, 'Category is required'),
  paymentMethod: z.enum(['cash', 'gcash', 'bank_transfer', 'card'], {
    required_error: 'Payment method is required',
  }),
  vendorName: z.string().optional(),
  expenseDate: z.date({
    required_error: 'Expense date is required',
  }),
  description: z.string().optional(),
  receiptFile: z.instanceof(File).optional(),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

interface OptimisticExpense extends ExpenseFormData {
  id: string
  status: 'pending' | 'success' | 'error'
}

export function ExpenseForm({ onSuccess }: { onSuccess?: () => void }) {
  const currentProject = useProjectStore((state) => state.currentProject)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  
  // React 19: useOptimistic for immediate UI feedback
  const [recentExpenses, addOptimisticExpense] = useOptimistic<OptimisticExpense[], OptimisticExpense>(
    [],
    (state, newExpense) => [newExpense, ...state.slice(0, 2)] // Keep only 3 most recent
  )

  const createExpenseMutation = useCreateExpense()
  const { data: categories } = useExpenseCategories(currentProject?.id || '')

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: '',
      categoryId: '',
      paymentMethod: 'cash',
      vendorName: '',
      expenseDate: new Date(),
      description: '',
    },
  })

  // React 19: useActionState for form submission
  const [submitState, submitAction, isSubmitPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      try {
        const values = form.getValues()
        
        // Create optimistic expense
        const optimisticExpense: OptimisticExpense = {
          id: `temp-${Date.now()}`,
          ...values,
          status: 'pending'
        }
        
        // Add optimistic update immediately
        addOptimisticExpense(optimisticExpense)

        const result = await createExpenseMutation.mutateAsync({
          projectId: currentProject?.id || '',
          amount: parseFloat(values.amount),
          categoryId: values.categoryId,
          paymentMethod: values.paymentMethod,
          expenseDate: values.expenseDate.toISOString(),
          description: values.description,
          vendorName: values.vendorName,
          receiptFile: values.receiptFile,
        })

        toast.success('Expense recorded successfully!')
        form.reset()
        setReceiptPreview(null)
        onSuccess?.()
        
        return { success: true, expense: result }
      } catch (error: any) {
        toast.error(error.message || 'Failed to create expense')
        return { success: false, error: error.message }
      }
    },
    { success: null }
  )

  const handleReceiptUpload = (file: File | null) => {
    if (file) {
      const url = URL.createObjectURL(file)
      setReceiptPreview(url)
      form.setValue('receiptFile', file)
    } else {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview)
      setReceiptPreview(null)
      form.setValue('receiptFile', undefined)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Log New Expense
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form action={submitAction} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Amount Field */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground text-lg">₱</span>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-8 text-lg font-semibold"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category Field */}
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select expense category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: category.colorCode }}
                                />
                                {category.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date Field */}
                <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date('1900-01-01')
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Vendor Field */}
                <FormField
                  control={form.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor/Store</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter vendor name" />
                      </FormControl>
                      <FormDescription>
                        Where you made this purchase (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Payment Method */}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cash" id="cash" />
                          <Label htmlFor="cash" className="flex items-center gap-2">
                            💵 Cash
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gcash" id="gcash" />
                          <Label htmlFor="gcash" className="flex items-center gap-2">
                            📱 GCash
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                          <Label htmlFor="bank_transfer" className="flex items-center gap-2">
                            🏦 Bank Transfer
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="card" id="card" />
                          <Label htmlFor="card" className="flex items-center gap-2">
                            💳 Card
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Receipt Upload */}
              <FormField
                control={form.control}
                name="receiptFile"
                render={({ field: { onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Receipt (Optional)</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                          <Label
                            htmlFor="receipt-upload"
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                              <p className="mb-2 text-sm text-muted-foreground">
                                <span className="font-semibold">Click to upload</span> receipt
                              </p>
                              <p className="text-xs text-muted-foreground">PNG, JPG or PDF (MAX 5MB)</p>
                            </div>
                            <Input
                              {...field}
                              id="receipt-upload"
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                handleReceiptUpload(file || null)
                              }}
                            />
                          </Label>
                        </div>

                        {receiptPreview && (
                          <div className="relative">
                            <img
                              src={receiptPreview}
                              alt="Receipt preview"
                              className="max-w-full h-auto rounded-lg border max-h-48"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => handleReceiptUpload(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Upload a photo of your receipt for record keeping
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter expense description..."
                        className="resize-none"
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Additional details about this expense (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Form Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  className="flex-1"
                >
                  Clear Form
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitPending || createExpenseMutation.isPending}
                  className="flex-1"
                >
                  {isSubmitPending || createExpenseMutation.isPending ? (
                    'Saving Expense...'
                  ) : (
                    'Save Expense'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Recent Expenses with Optimistic Updates */}
      {recentExpenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      expense.status === 'pending' && "bg-yellow-500 animate-pulse",
                      expense.status === 'success' && "bg-green-500",
                      expense.status === 'error' && "bg-red-500"
                    )} />
                    <span className="text-sm font-medium">₱{parseFloat(expense.amount).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">
                      {expense.vendorName || 'No vendor'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {format(expense.expenseDate, 'MMM d')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

## Modern Responsive Design - Tailwind CSS v4

### Mobile-First Breakpoints
```css
/* Tailwind CSS v4 Responsive Design */
@theme {
  /* Custom breakpoints for resort management */
  --breakpoint-xs: 475px;    /* Small phones */
  --breakpoint-sm: 640px;    /* Large phones */
  --breakpoint-md: 768px;    /* Tablets */
  --breakpoint-lg: 1024px;   /* Laptops */
  --breakpoint-xl: 1280px;   /* Desktops */
  --breakpoint-2xl: 1536px;  /* Large screens */
  --breakpoint-3xl: 1920px;  /* Ultra-wide screens */
}

/* Container Query Support */
@layer utilities {
  .container-query {
    container-type: inline-size;
  }
  
  @container (min-width: 768px) {
    .cq-md\:grid-cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
```

### Performance Optimizations

#### Optimized Component Loading
```typescript
// src/components/OptimizedComponents.tsx
import { lazy, Suspense } from 'react'
import { Skeleton } from "@/components/ui/skeleton"

// React 19: Enhanced lazy loading with better error boundaries
const BookingList = lazy(() => import('./booking/BookingList'))
const ExpenseForm = lazy(() => import('./forms/ExpenseForm'))
const ReportsGenerator = lazy(() => import('./reports/ReportsGenerator'))

export function OptimizedBookingList() {
  return (
    <Suspense fallback={<BookingListSkeleton />}>
      <BookingList />
    </Suspense>
  )
}

function BookingListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-3 w-24 mb-1" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  )
}
```

## Accessibility Implementation (WCAG 2.1 AA+)

### Enhanced Accessibility Features
```typescript
// Enhanced accessibility with shadcn/ui components
export function AccessibleComponents() {
  return (
    <>
      {/* Screen reader announcements for state changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {/* Dynamic announcements for optimistic updates */}
      </div>
      
      {/* Keyboard navigation support */}
      <div className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {/* Interactive elements */}
      </div>
      
      {/* High contrast mode support */}
      <div className="contrast-more:border-2 contrast-more:border-solid">
        {/* Content with enhanced contrast */}
      </div>
      
      {/* Reduced motion support */}
      <div className="motion-reduce:transition-none motion-reduce:animate-none">
        {/* Animated content */}
      </div>
    </>
  )
}
```

### Modern PWA Features

#### Progressive Web App Configuration
```typescript
// vite.config.ts - PWA Configuration
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Okaeri Resort Management',
        short_name: 'Okaeri',
        description: 'Complete resort management system',
        theme_color: '#2E86AB', // Primary blue
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['business', 'productivity']
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 5 * 60 // 5 minutes
              }
            }
          },
          {
            urlPattern: /.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          }
        ]
      }
    })
  ],
})
```

## Performance & Developer Experience

### Core Web Vitals Optimization
- **Largest Contentful Paint (LCP):** < 2.5s with Vite 7 Lightning CSS
- **First Input Delay (FID):** < 100ms with React 19 concurrent features
- **Cumulative Layout Shift (CLS):** < 0.1 with proper skeleton loading
- **Time to Interactive (TTI):** < 3s on 3G with code splitting

### Modern Development Tools
```bash
# Development setup
npm create vite@latest okaeri-resort --template react-ts
cd okaeri-resort
npm install

# Install latest stack
npm install @reduxjs/toolkit react-redux @tanstack/react-query
npm install tailwindcss@latest @tailwindcss/vite@latest
npm install react-hook-form @hookform/resolvers zod
npm install lucide-react date-fns
npm install @radix-ui/react-accordion @radix-ui/react-avatar # ... other shadcn deps

# shadcn/ui setup
npx shadcn@latest init
npx shadcn@latest add button input label form card dialog sheet select calendar popover table progress badge avatar dropdown-menu toast tabs radio-group textarea separator switch
```

## Key Benefits of 2025 Stack

### Performance Advantages
- **Vite 7 Lightning CSS:** 100x faster CSS processing than traditional PostCSS
- **React 19 Concurrent Features:** Automatic batching and concurrent rendering
- **RTK Query Intelligent Caching:** Background refetching with optimistic updates
- **shadcn/ui Radix Primitives:** Optimized accessibility and performance

### Developer Experience Improvements
- **CSS-First Configuration:** No more JavaScript config files with Tailwind v4
- **Type-Safe State Management:** RTK Query auto-generates typed hooks
- **Copy-Paste Components:** shadcn/ui components with full customization
- **Modern React Patterns:** useOptimistic and useActionState for better UX

### User Experience Enhancements
- **Optimistic Updates:** Instant feedback with automatic error handling
- **Offline-First PWA:** Service worker with intelligent caching
- **Accessibility by Default:** WCAG 2.1 AA compliance built-in
- **Mobile-Optimized:** Touch-friendly interfaces with haptic considerations

---

*This modernized UI/UX design plan leverages the cutting-edge 2025 technology stack to deliver a professional, accessible, and performant resort management system that feels native on all devices while providing enterprise-level capabilities for family business operations.*****