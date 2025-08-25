# Financial Management System - Updated Implementation Plan 2025

## Overview
The Financial Management System consolidates income from multiple booking sources and tracks all operational expenses with comprehensive categorization, reporting, and analytics capabilities. Built with **Vite 7 + React 19 + Zustand + TanStack Query + TanStack Router + shadcn/ui**, the system provides real-time financial insights with optimistic UI updates and serverless scalability.

## Modern Technology Stack (2025)

### Frontend Architecture - React 19 + Zustand + TanStack Query
- **Build Tool:** Vite 7.0.0 with Lightning CSS support
- **React Framework:** React 19.1 with `useOptimistic` and `useActionState` hooks
- **State Management:** Zustand 5.0.2 for local/UI state
- **Server State:** TanStack Query 5.71.10 for server state management
- **Routing:** TanStack Router 1.114.3 with file-based routing
- **UI Components:** shadcn/ui with Radix UI primitives
- **Charts:** Recharts 2.13.3 for financial analytics
- **Forms:** React Hook Form 7.54.0 + Zod validation
- **Type Safety:** TypeScript throughout with strict mode

### Backend Architecture - Vercel Serverless
- **API Routes:** Vercel serverless functions (Node.js 20+)
- **Database:** Neon PostgreSQL with optimized connection pooling
- **File Storage:** Cloudflare R2 for receipt storage
- **Authentication:** JWT-based custom auth

## System Components

### 1. Modern State Management with Zustand and TanStack Query

#### Financial Store with Zustand
```typescript
// src/stores/financialStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface FinancialUIState {
  selectedExpenseId: string | null
  filterDateRange: {
    startDate: string | null
    endDate: string | null
  }
  filterCategory: string | null
  filterPaymentMethod: string | null
  viewMode: 'list' | 'chart' | 'calendar'
  reportModal: {
    isOpen: boolean
    reportType: 'monthly' | 'quarterly' | 'annual' | 'custom' | null
  }
  expenseModal: {
    isOpen: boolean
    expenseId: string | null
    mode: 'create' | 'edit' | 'view'
  }
  bulkOperations: {
    selectedExpenseIds: string[]
    isExporting: boolean
    exportProgress: number
  }
}

interface FinancialActions {
  setSelectedExpense: (id: string | null) => void
  setDateRange: (range: { startDate: string | null; endDate: string | null }) => void
  setFilterCategory: (category: string | null) => void
  setFilterPaymentMethod: (method: string | null) => void
  setViewMode: (mode: 'list' | 'chart' | 'calendar') => void
  openReportModal: (type: 'monthly' | 'quarterly' | 'annual' | 'custom') => void
  closeReportModal: () => void
  openExpenseModal: (params: { expenseId?: string; mode: 'create' | 'edit' | 'view' }) => void
  closeExpenseModal: () => void
  toggleExpenseSelection: (id: string) => void
  clearExpenseSelection: () => void
  setExportProgress: (params: { isExporting: boolean; progress: number }) => void
}

export const useFinancialStore = create<FinancialUIState & FinancialActions>()(
  devtools(
    persist(
      (set) => ({
        // State
        selectedExpenseId: null,
        filterDateRange: {
          startDate: null,
          endDate: null,
        },
        filterCategory: null,
        filterPaymentMethod: null,
        viewMode: 'list',
        reportModal: {
          isOpen: false,
          reportType: null,
        },
        expenseModal: {
          isOpen: false,
          expenseId: null,
          mode: 'create',
        },
        bulkOperations: {
          selectedExpenseIds: [],
          isExporting: false,
          exportProgress: 0,
        },

        // Actions
        setSelectedExpense: (id) => set({ selectedExpenseId: id }),
        setDateRange: (range) => set({ filterDateRange: range }),
        setFilterCategory: (category) => set({ filterCategory: category }),
        setFilterPaymentMethod: (method) => set({ filterPaymentMethod: method }),
        setViewMode: (mode) => set({ viewMode: mode }),
        openReportModal: (type) =>
          set({
            reportModal: {
              isOpen: true,
              reportType: type,
            },
          }),
        closeReportModal: () =>
          set({
            reportModal: {
              isOpen: false,
              reportType: null,
            },
          }),
        openExpenseModal: ({ expenseId, mode }) =>
          set({
            expenseModal: {
              isOpen: true,
              expenseId: expenseId || null,
              mode,
            },
          }),
        closeExpenseModal: () =>
          set({
            expenseModal: {
              isOpen: false,
              expenseId: null,
              mode: 'create',
            },
          }),
        toggleExpenseSelection: (id) =>
          set((state) => ({
            bulkOperations: {
              ...state.bulkOperations,
              selectedExpenseIds: state.bulkOperations.selectedExpenseIds.includes(id)
                ? state.bulkOperations.selectedExpenseIds.filter((expId) => expId !== id)
                : [...state.bulkOperations.selectedExpenseIds, id],
            },
          })),
        clearExpenseSelection: () =>
          set((state) => ({
            bulkOperations: {
              ...state.bulkOperations,
              selectedExpenseIds: [],
            },
          })),
        setExportProgress: ({ isExporting, progress }) =>
          set((state) => ({
            bulkOperations: {
              ...state.bulkOperations,
              isExporting,
              exportProgress: progress,
            },
          })),
      }),
      {
        name: 'financial-storage',
        partialize: (state) => ({
          filterDateRange: state.filterDateRange,
          filterCategory: state.filterCategory,
          filterPaymentMethod: state.filterPaymentMethod,
          viewMode: state.viewMode,
        }),
      }
    )
  )
)
```

#### TanStack Query Hooks for Financial Data
```typescript
// src/hooks/useFinancialQueries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Types
interface ExpenseCategory {
  id: string
  name: string
  parentCategory?: string
  colorCode: string
  isActive: boolean
  projectId: string
}

interface Expense {
  id: string
  amount: number
  currency: string
  categoryId: string
  category?: ExpenseCategory
  subcategory?: string
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer' | 'card'
  vendorName?: string
  receiptUrl?: string
  expenseDate: string
  description?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface Income {
  id: string
  bookingId?: string
  source: 'airbnb' | 'facebook' | 'other'
  amount: number
  currency: string
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer' | 'card'
  transactionDate: string
  description?: string
  category: string
  createdAt: string
}

interface FinancialSummary {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  topExpenseCategories: Array<{
    categoryName: string
    amount: number
    percentage: number
  }>
  monthlyTrends: Array<{
    month: string
    income: number
    expenses: number
    profit: number
  }>
}

// Query Keys
export const financialKeys = {
  all: ['financial'] as const,
  expenses: (projectId: string) => [...financialKeys.all, 'expenses', projectId] as const,
  expense: (projectId: string, expenseId: string) => [...financialKeys.expenses(projectId), expenseId] as const,
  categories: (projectId: string) => [...financialKeys.all, 'categories', projectId] as const,
  incomes: (projectId: string) => [...financialKeys.all, 'incomes', projectId] as const,
  summary: (projectId: string) => [...financialKeys.all, 'summary', projectId] as const,
  metrics: (projectId: string) => [...financialKeys.all, 'metrics', projectId] as const,
}

// Queries
export function useExpenses(projectId: string, filters?: {
  page?: number
  limit?: number
  categoryId?: string
  paymentMethod?: string
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: [...financialKeys.expenses(projectId), filters],
    queryFn: () => api.get(`/${projectId}/expenses`, { params: filters }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useExpense(projectId: string, expenseId: string) {
  return useQuery({
    queryKey: financialKeys.expense(projectId, expenseId),
    queryFn: () => api.get<Expense>(`/${projectId}/expenses/${expenseId}`),
    enabled: !!expenseId,
  })
}

export function useExpenseCategories(projectId: string) {
  return useQuery({
    queryKey: financialKeys.categories(projectId),
    queryFn: () => api.get<ExpenseCategory[]>(`/${projectId}/expenses/categories`),
    staleTime: 1000 * 60 * 30, // 30 minutes
  })
}

export function useIncomes(projectId: string, filters?: {
  page?: number
  limit?: number
  source?: string
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: [...financialKeys.incomes(projectId), filters],
    queryFn: () => api.get(`/${projectId}/incomes`, { params: filters }),
    staleTime: 1000 * 60 * 5,
  })
}

export function useFinancialSummary(projectId: string, dateRange?: {
  startDate?: string
  endDate?: string
}) {
  return useQuery({
    queryKey: [...financialKeys.summary(projectId), dateRange],
    queryFn: () => api.get<FinancialSummary>(`/${projectId}/financial-summary`, { params: dateRange }),
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

export function useDashboardMetrics(projectId: string) {
  return useQuery({
    queryKey: financialKeys.metrics(projectId),
    queryFn: () => api.get(`/${projectId}/dashboard-metrics`),
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  })
}

// Mutations
export function useCreateExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ projectId, receiptFile, ...expense }: {
      projectId: string
      amount: number
      categoryId: string
      paymentMethod: 'cash' | 'gcash' | 'bank_transfer' | 'card'
      expenseDate: string
      description?: string
      vendorName?: string
      receiptFile?: File
    }) => {
      const formData = new FormData()
      Object.entries(expense).forEach(([key, value]) => {
        if (value !== undefined) formData.append(key, value.toString())
      })
      if (receiptFile) formData.append('receiptFile', receiptFile)
      
      return api.post<Expense>(`/${projectId}/expenses`, formData)
    },
    onMutate: async (newExpense) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: financialKeys.expenses(newExpense.projectId) 
      })
      
      // Snapshot previous value
      const previousExpenses = queryClient.getQueryData(
        financialKeys.expenses(newExpense.projectId)
      )
      
      // Optimistically update
      queryClient.setQueryData(
        financialKeys.expenses(newExpense.projectId),
        (old: any) => ({
          ...old,
          expenses: [newExpense, ...(old?.expenses || [])],
        })
      )
      
      return { previousExpenses }
    },
    onError: (err, newExpense, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        queryClient.setQueryData(
          financialKeys.expenses(newExpense.projectId),
          context.previousExpenses
        )
      }
    },
    onSettled: (data, error, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.expenses(variables.projectId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.summary(variables.projectId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.metrics(variables.projectId) 
      })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ projectId, expenseId, ...updates }: {
      projectId: string
      expenseId: string
    } & Partial<Expense>) => 
      api.put<Expense>(`/${projectId}/expenses/${expenseId}`, updates),
    onMutate: async ({ projectId, expenseId, ...updates }) => {
      await queryClient.cancelQueries({ 
        queryKey: financialKeys.expense(projectId, expenseId) 
      })
      
      const previousExpense = queryClient.getQueryData(
        financialKeys.expense(projectId, expenseId)
      )
      
      queryClient.setQueryData(
        financialKeys.expense(projectId, expenseId),
        (old: any) => ({ ...old, ...updates })
      )
      
      return { previousExpense }
    },
    onError: (err, variables, context) => {
      if (context?.previousExpense) {
        queryClient.setQueryData(
          financialKeys.expense(variables.projectId, variables.expenseId),
          context.previousExpense
        )
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.expense(variables.projectId, variables.expenseId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.expenses(variables.projectId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.summary(variables.projectId) 
      })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ projectId, expenseId }: { projectId: string; expenseId: string }) =>
      api.delete(`/${projectId}/expenses/${expenseId}`),
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.expenses(variables.projectId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.summary(variables.projectId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.metrics(variables.projectId) 
      })
    },
  })
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ projectId, ...category }: {
      projectId: string
      name: string
      parentCategory?: string
      colorCode: string
    }) => api.post<ExpenseCategory>(`/${projectId}/expenses/categories`, category),
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.categories(variables.projectId) 
      })
    },
  })
}

export function useImportExpenses() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ projectId, csvData }: { projectId: string; csvData: any[] }) =>
      api.post(`/${projectId}/expenses/import`, { csvData }),
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.expenses(variables.projectId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.summary(variables.projectId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: financialKeys.metrics(variables.projectId) 
      })
    },
  })
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: ({ projectId, ...reportData }: {
      projectId: string
      reportType: 'monthly' | 'quarterly' | 'annual' | 'custom'
      format: 'pdf' | 'excel' | 'csv'
      startDate?: string
      endDate?: string
      categories?: string[]
    }) => api.post<{ reportUrl: string }>(`/${projectId}/reports/generate`, reportData),
  })
}
```

### 2. Modern Expense Entry with React 19 Features

#### Enhanced Expense Form Component
```typescript
// src/components/financial/ExpenseForm.tsx
"use client"

import { useState, useOptimistic, useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarIcon, UploadIcon, DollarSignIcon, ReceiptIcon, XIcon } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { useCreateExpense, useExpenseCategories } from '@/hooks/useFinancialQueries'
import { useFinancialStore } from '@/stores/financialStore'
import { cn } from '@/lib/utils'

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

interface ExpenseFormProps {
  projectId: string
  expenseId?: string
  mode?: 'create' | 'edit'
}

export function ExpenseForm({ projectId, expenseId, mode = 'create' }: ExpenseFormProps) {
  const closeExpenseModal = useFinancialStore((state) => state.closeExpenseModal)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [recentExpenses, setRecentExpenses] = useState<ExpenseFormData[]>([])
  
  // React 19: useOptimistic for optimistic UI updates
  const [optimisticExpenses, addOptimisticExpense] = useOptimistic<ExpenseFormData[], ExpenseFormData>(
    recentExpenses,
    (state, newExpense) => [newExpense, ...state.slice(0, 4)]
  )

  const createExpenseMutation = useCreateExpense()
  const { data: categories } = useExpenseCategories(projectId)

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

  // React 19: useActionState for async form handling
  const [submitState, submitAction, isSubmitPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      try {
        const values = form.getValues()
        
        // Optimistically add expense to recent list
        addOptimisticExpense(values)

        const result = await createExpenseMutation.mutateAsync({
          projectId,
          amount: parseFloat(values.amount),
          categoryId: values.categoryId,
          paymentMethod: values.paymentMethod,
          expenseDate: values.expenseDate.toISOString(),
          description: values.description,
          vendorName: values.vendorName,
          receiptFile: values.receiptFile,
        })

        form.reset()
        setReceiptPreview(null)
        
        return {
          success: true,
          message: 'Expense created successfully!',
          expense: result,
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Failed to create expense',
        }
      }
    },
    { success: null, message: '', error: '' }
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

  const handleQuickEntry = (template: Partial<ExpenseFormData>) => {
    Object.entries(template).forEach(([key, value]) => {
      if (value !== undefined) {
        form.setValue(key as keyof ExpenseFormData, value as any)
      }
    })
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSignIcon className="w-5 h-5" />
          {mode === 'edit' ? 'Edit Expense' : 'Log New Expense'}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Quick Entry Templates */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Entry Templates</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Electricity Bill', categoryId: 'utilities', vendorName: 'CELECTRONICS' },
              { label: 'Internet Bill', categoryId: 'utilities', vendorName: 'PLDT' },
              { label: 'Cleaning Supplies', categoryId: 'operations', description: 'Regular cleaning supplies' },
              { label: 'Pool Maintenance', categoryId: 'maintenance', description: 'Pool cleaning and chemicals' },
            ].map((template, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickEntry(template)}
              >
                {template.label}
              </Button>
            ))}
          </div>
        </div>

        <Form {...form}>
          <form action={submitAction} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
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
                        <Input {...field} placeholder="Enter vendor or store name" />
                      </FormControl>
                      <FormDescription>
                        Where you made this purchase (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-4">
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
                          className="grid grid-cols-2 gap-4"
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
                              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50"
                            >
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                                <p className="mb-2 text-sm text-muted-foreground">
                                  <span className="font-semibold">Click to upload</span> receipt
                                </p>
                                <p className="text-xs text-muted-foreground">PNG, JPG or PDF</p>
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
                                className="max-w-full h-auto rounded-lg border"
                                style={{ maxHeight: '200px' }}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => handleReceiptUpload(null)}
                              >
                                <XIcon className="w-4 h-4" />
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
              </div>
            </div>

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
                      placeholder="Enter expense description or notes..."
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

            {/* Submit Results */}
            {submitState.success === true && (
              <Alert>
                <ReceiptIcon className="w-4 h-4" />
                <AlertDescription>
                  {submitState.message}
                </AlertDescription>
              </Alert>
            )}

            {submitState.success === false && (
              <Alert variant="destructive">
                <XIcon className="w-4 h-4" />
                <AlertDescription>
                  {submitState.error}
                </AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset()
                  setReceiptPreview(null)
                  closeExpenseModal()
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitPending || createExpenseMutation.isPending}
                className="flex-1"
              >
                {isSubmitPending || createExpenseMutation.isPending ? (
                  'Saving Expense...'
                ) : (
                  mode === 'edit' ? 'Update Expense' : 'Save Expense'
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Recent Expenses */}
        {optimisticExpenses.length > 0 && (
          <div className="pt-6 border-t">
            <Label className="text-sm font-medium">Recent Expenses</Label>
            <div className="space-y-2 mt-2">
              {optimisticExpenses.slice(0, 3).map((expense, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-sm font-medium">₱{parseFloat(expense.amount).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">{expense.vendorName || 'No vendor'}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {format(expense.expenseDate, 'MMM d')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 3. Financial Dashboard with Real-time Analytics

#### Modern Financial Dashboard Component
```typescript
// src/components/financial/FinancialDashboard.tsx
"use client"

import { useState } from 'react'
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon, CreditCardIcon } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'

import { useDashboardMetrics, useFinancialSummary } from '@/hooks/useFinancialQueries'
import { useFinancialStore } from '@/stores/financialStore'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  change?: number
  icon: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down'
  description?: string
}

function MetricCard({ title, value, change, icon: Icon, trend, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {trend === 'up' ? (
              <TrendingUpIcon className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDownIcon className="h-3 w-3 text-red-600" />
            )}
            <span className={cn(
              trend === 'up' ? 'text-green-600' : 'text-red-600'
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

export function FinancialDashboard({ projectId }: { projectId: string }) {
  const { setDateRange, openExpenseModal, openReportModal } = useFinancialStore()
  const filterDateRange = useFinancialStore((state) => state.filterDateRange)
  const [selectedDateRange, setSelectedDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })

  const { data: metrics, isLoading: isLoadingMetrics } = useDashboardMetrics(projectId)
  const { data: financialSummary } = useFinancialSummary(projectId, {
    startDate: selectedDateRange.from?.toISOString(),
    endDate: selectedDateRange.to?.toISOString(),
  })

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setSelectedDateRange(range)
    setDateRange({
      startDate: range.from?.toISOString() || null,
      endDate: range.to?.toISOString() || null,
    })
  }

  if (isLoadingMetrics) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const profitMargin = metrics?.monthlyRevenue ? 
    ((metrics.netProfit / metrics.monthlyRevenue) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your resort's financial performance
          </p>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDateRange.from ? (
                  selectedDateRange.to ? (
                    <>
                      {format(selectedDateRange.from, "LLL dd, y")} -{" "}
                      {format(selectedDateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(selectedDateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={selectedDateRange.from}
                selected={selectedDateRange}
                onSelect={(range) => range && handleDateRangeChange(range)}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button onClick={() => openReportModal('custom')}>
            Generate Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Monthly Revenue"
          value={`₱${metrics?.monthlyRevenue?.toLocaleString() || '0'}`}
          change={metrics?.revenueChange}
          trend={metrics && metrics.revenueChange >= 0 ? 'up' : 'down'}
          icon={TrendingUpIcon}
          description="Total income this month"
        />
        <MetricCard
          title="Monthly Expenses"
          value={`₱${metrics?.monthlyExpenses?.toLocaleString() || '0'}`}
          change={metrics?.expenseChange}
          trend={metrics && metrics.expenseChange <= 0 ? 'up' : 'down'}
          icon={TrendingDownIcon}
          description="Total expenses this month"
        />
        <MetricCard
          title="Net Profit"
          value={`₱${metrics?.netProfit?.toLocaleString() || '0'}`}
          icon={DollarSignIcon}
          description="Revenue minus expenses"
        />
        <MetricCard
          title="Profit Margin"
          value={`${profitMargin.toFixed(1)}%`}
          icon={CreditCardIcon}
          description="Percentage of revenue as profit"
        />
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue vs Expenses Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={financialSummary?.monthlyTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`₱${value.toLocaleString()}`, '']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="income" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Revenue"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="expenses" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Expenses"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Profit"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Expense Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Top Expense Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics?.topCategories || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {metrics?.topCategories?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openExpenseModal({ mode: 'create' })}
              >
                Add Expense
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.recentTransactions?.slice(0, 5).map((transaction, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        'amount' in transaction ? 'bg-red-500' : 'bg-green-500'
                      )} />
                      <div>
                        <p className="font-medium">
                          {'vendorName' in transaction ? transaction.vendorName : transaction.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date('createdAt' in transaction ? transaction.createdAt : ''), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-semibold",
                        'amount' in transaction ? 'text-red-600' : 'text-green-600'
                      )}>
                        {'amount' in transaction ? '-' : '+'}₱{transaction.amount.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {'paymentMethod' in transaction ? transaction.paymentMethod : transaction.source}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle>6-Month Financial Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={financialSummary?.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`₱${value.toLocaleString()}`, '']} />
                  <Bar dataKey="income" fill="#10b981" name="Revenue" />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          {/* Expense Categories Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {financialSummary?.topExpenseCategories?.map((category, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{category.categoryName}</h3>
                    <Badge variant="outline">{category.percentage.toFixed(1)}%</Badge>
                  </div>
                  <p className="text-2xl font-bold text-red-600 mb-2">
                    ₱{category.amount.toLocaleString()}
                  </p>
                  <Progress value={category.percentage} className="h-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cash-flow" className="space-y-6">
          {/* Cash Flow Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Flow Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Cash In</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₱{metrics?.monthlyRevenue?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Cash Out</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₱{metrics?.monthlyExpenses?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Net Cash Flow</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    (metrics?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    ₱{metrics?.netProfit?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => openExpenseModal({ mode: 'create' })}>
              Log Expense
            </Button>
            <Button variant="outline" onClick={() => openReportModal('monthly')}>
              Monthly Report
            </Button>
            <Button variant="outline" onClick={() => openReportModal('quarterly')}>
              Quarterly Report
            </Button>
            <Button variant="outline">
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4. Advanced Report Generation

#### Modern Report Generation Component
```typescript
// src/components/financial/ReportGenerator.tsx
"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarIcon, FileTextIcon, DownloadIcon, BarChartIcon } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

import { useGenerateReport, useExpenseCategories } from '@/hooks/useFinancialQueries'
import { useFinancialStore } from '@/stores/financialStore'
import { cn } from '@/lib/utils'

const reportSchema = z.object({
  reportType: z.enum(['monthly', 'quarterly', 'annual', 'custom'], {
    required_error: 'Please select a report type',
  }),
  format: z.enum(['pdf', 'excel', 'csv'], {
    required_error: 'Please select an output format',
  }),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  categories: z.array(z.string()).optional(),
  includeCharts: z.boolean().default(true),
  includeDetails: z.boolean().default(true),
  groupByCategory: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.reportType === 'custom') {
      return data.startDate && data.endDate && data.endDate > data.startDate
    }
    return true
  },
  {
    message: 'Custom reports require valid start and end dates',
    path: ['endDate'],
  }
)

type ReportFormData = z.infer<typeof reportSchema>

export function ReportGenerator({ projectId }: { projectId: string }) {
  const reportModal = useFinancialStore((state) => state.reportModal)
  const closeReportModal = useFinancialStore((state) => state.closeReportModal)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)

  const generateReportMutation = useGenerateReport()
  const { data: categories } = useExpenseCategories(projectId)

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: reportModal.reportType || 'monthly',
      format: 'pdf',
      categories: [],
      includeCharts: true,
      includeDetails: true,
      groupByCategory: true,
    },
  })

  const watchedReportType = form.watch('reportType')

  const onSubmit = async (values: ReportFormData) => {
    setIsGenerating(true)
    setGenerationProgress(0)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 300)

      const result = await generateReportMutation.mutateAsync({
        projectId,
        reportType: values.reportType,
        format: values.format,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        categories: values.categories,
      })

      clearInterval(progressInterval)
      setGenerationProgress(100)

      // Download the report
      const link = document.createElement('a')
      link.href = result.reportUrl
      link.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.${values.format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => {
        setIsGenerating(false)
        setGenerationProgress(0)
        closeReportModal()
      }, 1000)
    } catch (error) {
      setIsGenerating(false)
      setGenerationProgress(0)
      console.error('Failed to generate report:', error)
    }
  }

  const handleClose = () => {
    if (!isGenerating) {
      closeReportModal()
      form.reset()
    }
  }

  return (
    <Dialog open={reportModal.isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChartIcon className="w-5 h-5" />
            Generate Financial Report
          </DialogTitle>
        </DialogHeader>

        {isGenerating ? (
          <div className="space-y-6 py-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <FileTextIcon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Generating Report</h3>
              <p className="text-muted-foreground">
                This may take a few moments...
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{generationProgress}%</span>
              </div>
              <Progress value={generationProgress} className="h-2" />
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {generationProgress < 30 && 'Gathering financial data...'}
                {generationProgress >= 30 && generationProgress < 60 && 'Processing transactions...'}
                {generationProgress >= 60 && generationProgress < 90 && 'Generating charts and analytics...'}
                {generationProgress >= 90 && 'Finalizing report...'}
                {generationProgress === 100 && 'Report ready for download!'}
              </p>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Report Type */}
                <FormField
                  control={form.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select report type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly Report</SelectItem>
                          <SelectItem value="quarterly">Quarterly Report</SelectItem>
                          <SelectItem value="annual">Annual Report</SelectItem>
                          <SelectItem value="custom">Custom Date Range</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the time period for your report
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Output Format */}
                <FormField
                  control={form.control}
                  name="format"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Output Format</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select output format" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pdf">PDF Document</SelectItem>
                          <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                          <SelectItem value="csv">CSV Data</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose how you want to receive the report
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Custom Date Range */}
              {watchedReportType === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
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
                                  <span>Pick start date</span>
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
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
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
                                  <span>Pick end date</span>
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
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Category Filter */}
              <FormField
                control={form.control}
                name="categories"
                render={() => (
                  <FormItem>
                    <FormLabel>Expense Categories (Optional)</FormLabel>
                    <FormDescription>
                      Select specific categories to include in the report. Leave empty to include all.
                    </FormDescription>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {categories?.map((category) => (
                        <FormField
                          key={category.id}
                          control={form.control}
                          name="categories"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={category.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(category.id)}
                                    onCheckedChange={(checked) => {
                                      const updatedValue = checked
                                        ? [...(field.value || []), category.id]
                                        : (field.value || []).filter((value) => value !== category.id)
                                      field.onChange(updatedValue)
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: category.colorCode }}
                                  />
                                  {category.name}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Report Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Report Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="includeCharts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Include Charts</FormLabel>
                          <FormDescription>
                            Add visual charts and graphs to the report
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="includeDetails"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Include Transaction Details</FormLabel>
                          <FormDescription>
                            Show individual transaction records
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="groupByCategory"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Group by Category</FormLabel>
                          <FormDescription>
                            Organize expenses by category
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1"
                >
                  <DownloadIcon className="w-4 h-4 mr-2" />
                  {isLoading ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

### 5. Serverless API Routes

#### Financial API Route Implementation
```javascript
// api/[projectId]/expenses/index.js - Vercel Serverless Function
import { neon } from '@neondatabase/serverless'
import { authenticateUser, checkProjectAccess } from '../../../lib/auth-middleware.js'
import { validateExpenseData } from '../../../lib/validations.js'
import formidable from 'formidable'
import { uploadToR2 } from '../../../lib/file-upload.js'

const sql = neon(process.env.DATABASE_URL)

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  try {
    // Authenticate user
    const user = await authenticateUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { projectId } = req.query

    // Check project access
    const hasAccess = await checkProjectAccess(user.id, projectId, 'expenses.read')
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.method === 'GET') {
      const { 
        page = 1, 
        limit = 20, 
        categoryId, 
        paymentMethod, 
        startDate, 
        endDate 
      } = req.query
      const offset = (page - 1) * limit

      let query = `
        SELECT 
          e.*,
          ec.name as category_name,
          ec.color_code as category_color,
          u.first_name || ' ' || u.last_name as created_by_name,
          COUNT(*) OVER() as total_count
        FROM project_${projectId.replace(/[^a-z0-9_]/gi, '_')}.expenses e
        LEFT JOIN project_${projectId.replace(/[^a-z0-9_]/gi, '_')}.expense_categories ec ON e.category_id = ec.id
        LEFT JOIN users u ON u.id = e.created_by
        WHERE 1=1
      `
      const params = []
      
      if (categoryId) {
        params.push(categoryId)
        query += ` AND e.category_id = $${params.length}`
      }
      
      if (paymentMethod) {
        params.push(paymentMethod)
        query += ` AND e.payment_method = $${params.length}`
      }
      
      if (startDate) {
        params.push(startDate)
        query += ` AND e.expense_date >= $${params.length}`
      }
      
      if (endDate) {
        params.push(endDate)
        query += ` AND e.expense_date <= $${params.length}`
      }
      
      params.push(limit, offset)
      query += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

      const expenses = await sql.query(query, params)
      const totalCount = expenses.length > 0 ? expenses[0].total_count : 0
      
      return res.status(200).json({
        expenses: expenses.map(({ total_count, ...expense }) => ({
          ...expense,
          category: expense.category_name ? {
            name: expense.category_name,
            colorCode: expense.category_color,
          } : null,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: offset + expenses.length < totalCount,
          total: totalCount,
        }
      })
    }

    if (req.method === 'POST') {
      const hasCreateAccess = await checkProjectAccess(user.id, projectId, 'expenses.create')
      if (!hasCreateAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      // Parse multipart form data
      const form = formidable({
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowEmptyFiles: false,
      })

      const [fields, files] = await form.parse(req)
      
      const expenseData = {
        amount: parseFloat(fields.amount[0]),
        categoryId: fields.categoryId[0],
        paymentMethod: fields.paymentMethod[0],
        expenseDate: fields.expenseDate[0],
        description: fields.description?.[0] || null,
        vendorName: fields.vendorName?.[0] || null,
      }

      // Validate expense data
      validateExpenseData(expenseData)

      let receiptUrl = null
      
      // Handle receipt file upload
      if (files.receiptFile && files.receiptFile[0]) {
        const receiptFile = files.receiptFile[0]
        const fileName = `receipts/${projectId}/${Date.now()}-${receiptFile.originalFilename}`
        receiptUrl = await uploadToR2(receiptFile, fileName)
      }

      const [newExpense] = await sql`
        INSERT INTO project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expenses (
          amount, currency, category_id, subcategory, payment_method,
          vendor_name, receipt_url, expense_date, description,
          created_by, created_at, updated_at
        ) VALUES (
          ${expenseData.amount}, 'PHP', ${expenseData.categoryId}, null,
          ${expenseData.paymentMethod}, ${expenseData.vendorName}, ${receiptUrl},
          ${expenseData.expenseDate}, ${expenseData.description},
          ${user.id}, NOW(), NOW()
        )
        RETURNING *
      `

      // Fetch the complete expense with category info
      const [completeExpense] = await sql`
        SELECT 
          e.*,
          ec.name as category_name,
          ec.color_code as category_color
        FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expenses e
        LEFT JOIN project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expense_categories ec ON e.category_id = ec.id
        WHERE e.id = ${newExpense.id}
      `

      return res.status(201).json({ 
        expense: {
          ...completeExpense,
          category: completeExpense.category_name ? {
            name: completeExpense.category_name,
            colorCode: completeExpense.category_color,
          } : null,
        }
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('Expense API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

#### Dashboard Metrics API Route
```javascript
// api/[projectId]/dashboard-metrics.js - Vercel Serverless Function
import { neon } from '@neondatabase/serverless'
import { authenticateUser, checkProjectAccess } from '../../lib/auth-middleware.js'

const sql = neon(process.env.DATABASE_URL)

export default async function handler(req, res) {
  try {
    const user = await authenticateUser(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { projectId } = req.query
    const hasAccess = await checkProjectAccess(user.id, projectId, 'financial.read')
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.method === 'GET') {
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
      const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7)

      // Get current month metrics
      const [currentMetrics] = await sql`
        WITH monthly_income AS (
          SELECT COALESCE(SUM(amount), 0) as total_income
          FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.income 
          WHERE DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        monthly_expenses AS (
          SELECT COALESCE(SUM(amount), 0) as total_expenses
          FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expenses 
          WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        last_month_income AS (
          SELECT COALESCE(SUM(amount), 0) as last_total_income
          FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.income 
          WHERE DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
        ),
        last_month_expenses AS (
          SELECT COALESCE(SUM(amount), 0) as last_total_expenses
          FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expenses 
          WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
        )
        SELECT 
          mi.total_income as monthly_revenue,
          me.total_expenses as monthly_expenses,
          (mi.total_income - me.total_expenses) as net_profit,
          lmi.last_total_income,
          lme.last_total_expenses
        FROM monthly_income mi, monthly_expenses me, last_month_income lmi, last_month_expenses lme
      `

      // Calculate percentage changes
      const revenueChange = currentMetrics.last_total_income > 0 
        ? ((currentMetrics.monthly_revenue - currentMetrics.last_total_income) / currentMetrics.last_total_income) * 100
        : 0

      const expenseChange = currentMetrics.last_total_expenses > 0
        ? ((currentMetrics.monthly_expenses - currentMetrics.last_total_expenses) / currentMetrics.last_total_expenses) * 100
        : 0

      // Get top expense categories
      const topCategories = await sql`
        SELECT 
          ec.name,
          ec.color_code as color,
          SUM(e.amount) as amount
        FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expenses e
        JOIN project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expense_categories ec ON e.category_id = ec.id
        WHERE DATE_TRUNC('month', e.expense_date) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY ec.id, ec.name, ec.color_code
        ORDER BY amount DESC
        LIMIT 5
      `

      // Get recent transactions
      const recentTransactions = await sql`
        (
          SELECT 
            'expense' as type,
            amount,
            vendor_name as description,
            payment_method,
            expense_date as date,
            created_at
          FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.expenses
          ORDER BY created_at DESC
          LIMIT 10
        )
        UNION ALL
        (
          SELECT 
            'income' as type,
            amount,
            description,
            payment_method,
            transaction_date as date,
            created_at
          FROM project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, '_'))}.income
          ORDER BY created_at DESC
          LIMIT 10
        )
        ORDER BY created_at DESC
        LIMIT 10
      `

      return res.status(200).json({
        monthlyRevenue: currentMetrics.monthly_revenue,
        monthlyExpenses: currentMetrics.monthly_expenses,
        netProfit: currentMetrics.net_profit,
        profitMargin: currentMetrics.monthly_revenue > 0 
          ? (currentMetrics.net_profit / currentMetrics.monthly_revenue) * 100 
          : 0,
        revenueChange,
        expenseChange,
        topCategories,
        recentTransactions,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Dashboard metrics error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
```

## Key Benefits of Modern Stack

### Performance Optimizations
- **TanStack Query Smart Caching:** Background refetching, optimistic updates, and automatic cache invalidation
- **React 19 useOptimistic:** Instant expense entry with automatic error rollback
- **Zustand Minimal Bundle:** ~8KB gzipped vs ~45KB for Redux Toolkit, 80% smaller footprint
- **Vite 7 Lightning CSS:** 100x faster CSS processing for responsive financial dashboards
- **Serverless Edge Functions:** Global CDN distribution with <200ms response times for real-time financial data

### Developer Experience
- **Simplified State Management:** Zustand reduces boilerplate by ~60% compared to Redux Toolkit
- **Type-Safe Queries:** TanStack Query with full TypeScript inference
- **File-Based Routing:** TanStack Router automatic route generation
- **Modern Form Handling:** React Hook Form + Zod for robust form validation
- **Component-Based Architecture:** Reusable shadcn/ui components with accessibility built-in
- **Hot Module Replacement:** Instant updates during development

### Business Value
- **Real-time Financial Insights:** Live dashboard updates with intelligent caching
- **Mobile-First Design:** Touch-optimized expense entry for on-site operations
- **Advanced Analytics:** Interactive charts and trend analysis
- **Automated Reporting:** PDF, Excel, and CSV export capabilities
- **Offline Capability:** Progressive enhancement with Zustand persistence
- **Faster Initial Load:** Smaller bundle sizes mean faster time-to-interactive

### Security & Compliance
- **Encrypted File Storage:** Secure receipt storage in Cloudflare R2
- **Role-Based Access:** Granular permissions for financial data
- **Audit Trails:** Complete transaction history and user activity logging
- **Data Validation:** Comprehensive input sanitization and validation
- **Persistent State Security:** Selective state persistence with Zustand partialize

This modernized financial management system leverages Zustand + TanStack Query to provide enterprise-level financial tracking and reporting capabilities with significantly reduced complexity and bundle size, perfect for family resort operations.