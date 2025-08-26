# Booking Management System - Updated Implementation Plan 2025

## Overview

The Booking Management System handles two primary booking sources: Airbnb (via
manual CSV import) and Facebook Messenger (via Google Forms integration). Built
with **Vite 7 + React 19 + Zustand + TanStack Query + TanStack Router +
shadcn/ui**, the system focuses on modern state management, optimistic UI
updates, and unified serverless data storage.

## Modern Technology Stack (2025)

### Frontend Architecture - React 19 + Zustand + TanStack Query

- **Build Tool:** Vite 7.0.0 with Lightning CSS support
- **React Framework:** React 19.1 with `useOptimistic` and `useActionState`
  hooks
- **State Management:** Zustand 5.0.2 for local/UI state
- **Server State:** TanStack Query 5.71.10 for server state management
- **Routing:** TanStack Router 1.114.3 with file-based routing
- **UI Components:** shadcn/ui with Radix UI primitives
- **Styling:** Tailwind CSS v4.0 with oklch() color space
- **Forms:** React Hook Form 7.54.0 + Zod validation
- **Type Safety:** TypeScript throughout with strict mode

### Backend Architecture - Vercel Serverless

- **API Routes:** Vercel serverless functions (Node.js 20+)
- **Database:** Neon PostgreSQL with connection pooling
- **File Storage:** Cloudflare R2 (S3-compatible)
- **Authentication:** JWT-based custom auth

## System Components

### 1. Modern State Management with Zustand

#### Booking Store Setup

```typescript
// src/stores/bookingStore.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface BookingUIState {
  selectedBookingId: string | null;
  filterStatus: string | null;
  filterSource: "all" | "airbnb" | "facebook";
  viewMode: "list" | "calendar";
  csvImportProgress: {
    isImporting: boolean;
    progress: number;
    errors: string[];
  };
  paymentModal: {
    isOpen: boolean;
    bookingId: string | null;
    paymentType: "deposit" | "balance" | null;
  };
}

interface BookingActions {
  setSelectedBooking: (id: string | null) => void;
  setFilterStatus: (status: string | null) => void;
  setFilterSource: (source: "all" | "airbnb" | "facebook") => void;
  setViewMode: (mode: "list" | "calendar") => void;
  setCsvImportProgress: (
    progress: Partial<BookingUIState["csvImportProgress"]>
  ) => void;
  openPaymentModal: (
    bookingId: string,
    paymentType: "deposit" | "balance"
  ) => void;
  closePaymentModal: () => void;
  resetFilters: () => void;
}

export const useBookingStore = create<BookingUIState & BookingActions>()(
  devtools(
    persist(
      (set) => ({
        // State
        selectedBookingId: null,
        filterStatus: null,
        filterSource: "all",
        viewMode: "list",
        csvImportProgress: {
          isImporting: false,
          progress: 0,
          errors: [],
        },
        paymentModal: {
          isOpen: false,
          bookingId: null,
          paymentType: null,
        },

        // Actions
        setSelectedBooking: (id) => set({ selectedBookingId: id }),
        setFilterStatus: (status) => set({ filterStatus: status }),
        setFilterSource: (source) => set({ filterSource: source }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setCsvImportProgress: (progress) =>
          set((state) => ({
            csvImportProgress: { ...state.csvImportProgress, ...progress },
          })),
        openPaymentModal: (bookingId, paymentType) =>
          set({
            paymentModal: {
              isOpen: true,
              bookingId,
              paymentType,
            },
          }),
        closePaymentModal: () =>
          set({
            paymentModal: {
              isOpen: false,
              bookingId: null,
              paymentType: null,
            },
          }),
        resetFilters: () =>
          set({
            filterStatus: null,
            filterSource: "all",
            selectedBookingId: null,
          }),
      }),
      {
        name: "booking-ui-storage",
        partialize: (state) => ({
          viewMode: state.viewMode,
          filterSource: state.filterSource,
        }),
      }
    ),
    {
      name: "booking-store",
    }
  )
);
```

### 2. TanStack Query for Server State

#### Query Client Configuration

```typescript
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        if (error?.status === 404 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query key factory for type-safe query keys
export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (filters: any) => [...bookingKeys.lists(), filters] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
  payments: (bookingId: string) =>
    [...bookingKeys.all, "payments", bookingId] as const,
};
```

#### Booking Queries and Mutations

```typescript
// src/hooks/useBookings.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@/stores/projectStore";
import { bookingKeys } from "@/lib/queryClient";

interface Booking {
  id: string;
  bookingReference: string;
  source: "airbnb" | "facebook";
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkinDate: string;
  checkoutDate: string;
  guestCount: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  bookingStatus:
    | "pending"
    | "deposit_requested"
    | "deposit_received"
    | "confirmed"
    | "balance_due"
    | "fully_paid"
    | "checked_in"
    | "completed";
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

// Fetch bookings with filters
export const useBookings = (filters?: {
  status?: string;
  source?: string;
  page?: number;
  limit?: number;
}) => {
  const currentProject = useProjectStore((state) => state.currentProject);

  return useQuery({
    queryKey: bookingKeys.list(filters || {}),
    queryFn: async () => {
      if (!currentProject?.id) throw new Error("No project selected");

      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.source) params.set("source", filters.source);
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());

      const response = await fetch(
        `/api/${currentProject.id}/bookings?${params}`
      );
      if (!response.ok) throw new Error("Failed to fetch bookings");
      return response.json();
    },
    enabled: !!currentProject?.id,
  });
};

// Get single booking
export const useBooking = (bookingId: string) => {
  const currentProject = useProjectStore((state) => state.currentProject);

  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: async () => {
      if (!currentProject?.id) throw new Error("No project selected");

      const response = await fetch(
        `/api/${currentProject.id}/bookings/${bookingId}`
      );
      if (!response.ok) throw new Error("Failed to fetch booking");
      return response.json();
    },
    enabled: !!currentProject?.id && !!bookingId,
  });
};

// Create booking mutation with optimistic updates
export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  const currentProject = useProjectStore((state) => state.currentProject);

  return useMutation({
    mutationFn: async (
      bookingData: Omit<Booking, "id" | "createdAt" | "updatedAt">
    ) => {
      if (!currentProject?.id) throw new Error("No project selected");

      const response = await fetch(`/api/${currentProject.id}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) throw new Error("Failed to create booking");
      return response.json();
    },
    onMutate: async (newBooking) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: bookingKeys.lists() });

      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData(bookingKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueryData(bookingKeys.lists(), (old: any) => {
        if (!old)
          return { bookings: [newBooking], pagination: { hasMore: false } };
        return {
          ...old,
          bookings: [
            { ...newBooking, id: `temp-${Date.now()}` },
            ...old.bookings,
          ],
        };
      });

      // Return a context object with the snapshotted value
      return { previousBookings };
    },
    onError: (err, newBooking, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousBookings) {
        queryClient.setQueryData(bookingKeys.lists(), context.previousBookings);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

// Update booking mutation
export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  const currentProject = useProjectStore((state) => state.currentProject);

  return useMutation({
    mutationFn: async ({
      bookingId,
      updates,
    }: {
      bookingId: string;
      updates: Partial<Booking>;
    }) => {
      if (!currentProject?.id) throw new Error("No project selected");

      const response = await fetch(
        `/api/${currentProject.id}/bookings/${bookingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) throw new Error("Failed to update booking");
      return response.json();
    },
    onMutate: async ({ bookingId, updates }) => {
      // Cancel queries for this booking
      await queryClient.cancelQueries({
        queryKey: bookingKeys.detail(bookingId),
      });

      // Snapshot the previous value
      const previousBooking = queryClient.getQueryData(
        bookingKeys.detail(bookingId)
      );

      // Optimistically update
      queryClient.setQueryData(bookingKeys.detail(bookingId), (old: any) => ({
        ...old,
        ...updates,
      }));

      return { previousBooking, bookingId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousBooking) {
        queryClient.setQueryData(
          bookingKeys.detail(context.bookingId),
          context.previousBooking
        );
      }
    },
    onSettled: (data, error, { bookingId }) => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: bookingKeys.detail(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};

// Import CSV bookings mutation
export const useImportCsvBookings = () => {
  const queryClient = useQueryClient();
  const currentProject = useProjectStore((state) => state.currentProject);
  const setCsvImportProgress = useBookingStore(
    (state) => state.setCsvImportProgress
  );

  return useMutation({
    mutationFn: async (csvData: any[]) => {
      if (!currentProject?.id) throw new Error("No project selected");

      setCsvImportProgress({ isImporting: true, progress: 0 });

      const response = await fetch(
        `/api/${currentProject.id}/bookings/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvData }),
        }
      );

      if (!response.ok) throw new Error("Failed to import bookings");
      return response.json();
    },
    onSuccess: (data) => {
      setCsvImportProgress({
        isImporting: false,
        progress: 100,
        errors: data.errors || [],
      });

      // Invalidate all booking queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
    onError: (error: any) => {
      setCsvImportProgress({
        isImporting: false,
        progress: 0,
        errors: [error.message],
      });
    },
  });
};

// Record payment mutation
export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  const currentProject = useProjectStore((state) => state.currentProject);

  return useMutation({
    mutationFn: async ({
      bookingId,
      paymentType,
      amount,
      paymentMethod,
      transactionReference,
      screenshotFile,
      notes,
    }: {
      bookingId: string;
      paymentType: "deposit" | "balance";
      amount: number;
      paymentMethod: "cash" | "gcash" | "bank_transfer";
      transactionReference?: string;
      screenshotFile?: File;
      notes?: string;
    }) => {
      if (!currentProject?.id) throw new Error("No project selected");

      const formData = new FormData();
      formData.append("paymentType", paymentType);
      formData.append("amount", amount.toString());
      formData.append("paymentMethod", paymentMethod);
      if (transactionReference)
        formData.append("transactionReference", transactionReference);
      if (screenshotFile) formData.append("screenshotFile", screenshotFile);
      if (notes) formData.append("notes", notes);

      const response = await fetch(
        `/api/${currentProject.id}/bookings/${bookingId}/payments`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Failed to record payment");
      return response.json();
    },
    onSuccess: (data, { bookingId }) => {
      // Invalidate booking and payment queries
      queryClient.invalidateQueries({
        queryKey: bookingKeys.detail(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: bookingKeys.payments(bookingId),
      });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
};
```

### 3. Airbnb CSV Import with React 19 Features

#### Modern CSV Import Component

```typescript
// src/components/booking/AirbnbCsvImport.tsx
"use client"

import { useState, useOptimistic, useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Papa from 'papaparse'
import { UploadIcon, CheckIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'

import { useImportCsvBookings } from '@/hooks/useBookings'
import { useBookingStore } from '@/stores/bookingStore'

const csvImportSchema = z.object({
  csvFile: z.instanceof(File).refine((file) => {
    return file.type === 'text/csv' || file.name.endsWith('.csv')
  }, 'File must be a CSV file'),
})

type CsvImportFormData = z.infer<typeof csvImportSchema>

interface CsvPreviewRow {
  id: string
  guestName: string
  checkinDate: string
  checkoutDate: string
  totalAmount: string
  status: 'valid' | 'warning' | 'error'
  issues: string[]
}

export function AirbnbCsvImport({ projectId }: { projectId: string }) {
  const [csvData, setCsvData] = useState<any[]>([])
  const [previewData, setPreviewData] = useState<CsvPreviewRow[]>([])
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload')

  // React 19: useOptimistic for optimistic UI updates
  const [optimisticBookings, addOptimisticBooking] = useOptimistic<CsvPreviewRow[], CsvPreviewRow[]>(
    [],
    (state, newBookings) => [...state, ...newBookings]
  )

  const importCsvMutation = useImportCsvBookings()
  const { csvImportProgress } = useBookingStore()

  const form = useForm<CsvImportFormData>({
    resolver: zodResolver(csvImportSchema),
  })

  // React 19: useActionState for async form handling
  const [importState, importAction, isImportPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      try {
        // Optimistically add bookings to UI
        addOptimisticBooking(previewData)

        const result = await importCsvMutation.mutateAsync(previewData)

        return {
          success: true,
          imported: result.imported,
          errors: result.errors,
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Import failed',
        }
      }
    },
    { success: null, imported: 0, errors: [] }
  )

  const handleFileUpload = async (file: File) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as any[])
        setStep('mapping')

        // Auto-detect common field mappings
        const headers = results.meta.fields || []
        const autoMapping: Record<string, string> = {}

        headers.forEach((header) => {
          const lowerHeader = header.toLowerCase()
          if (lowerHeader.includes('guest') || lowerHeader.includes('name')) {
            autoMapping.guestName = header
          }
          if (lowerHeader.includes('check') && lowerHeader.includes('in')) {
            autoMapping.checkinDate = header
          }
          if (lowerHeader.includes('check') && lowerHeader.includes('out')) {
            autoMapping.checkoutDate = header
          }
          if (lowerHeader.includes('total') || lowerHeader.includes('amount')) {
            autoMapping.totalAmount = header
          }
        })

        setFieldMapping(autoMapping)
      },
      error: (error) => {
        console.error('CSV parsing error:', error)
      },
    })
  }

  const validateAndPreviewData = () => {
    const preview: CsvPreviewRow[] = csvData.map((row, index) => {
      const mappedRow = {
        id: `temp-${index}`,
        guestName: row[fieldMapping.guestName] || '',
        checkinDate: row[fieldMapping.checkinDate] || '',
        checkoutDate: row[fieldMapping.checkoutDate] || '',
        totalAmount: row[fieldMapping.totalAmount] || '',
        status: 'valid' as const,
        issues: [] as string[],
      }

      // Validate each row
      const issues: string[] = []

      if (!mappedRow.guestName) issues.push('Missing guest name')
      if (!mappedRow.checkinDate) issues.push('Missing check-in date')
      if (!mappedRow.checkoutDate) issues.push('Missing check-out date')
      if (!mappedRow.totalAmount) issues.push('Missing total amount')

      // Date validation
      const checkinDate = new Date(mappedRow.checkinDate)
      const checkoutDate = new Date(mappedRow.checkoutDate)

      if (isNaN(checkinDate.getTime())) issues.push('Invalid check-in date')
      if (isNaN(checkoutDate.getTime())) issues.push('Invalid check-out date')
      if (checkoutDate <= checkinDate) issues.push('Check-out must be after check-in')

      // Amount validation
      const amount = parseFloat(mappedRow.totalAmount)
      if (isNaN(amount) || amount <= 0) issues.push('Invalid total amount')

      mappedRow.issues = issues
      mappedRow.status = issues.length === 0 ? 'valid' : issues.length < 3 ? 'warning' : 'error'

      return mappedRow
    })

    setPreviewData(preview)
    setStep('preview')
  }

  const previewColumns = [
    {
      accessorKey: 'guestName',
      header: 'Guest Name',
    },
    {
      accessorKey: 'checkinDate',
      header: 'Check-in Date',
    },
    {
      accessorKey: 'checkoutDate',
      header: 'Check-out Date',
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total Amount',
      cell: ({ row }: any) => {
        const amount = parseFloat(row.getValue('totalAmount'))
        return isNaN(amount) ? '—' : `₱${amount.toLocaleString()}`
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.getValue('status') as string
        const issues = row.original.issues as string[]

        return (
          <div className="flex items-center gap-2">
            <Badge
              variant={
                status === 'valid' ? 'default' :
                status === 'warning' ? 'secondary' : 'destructive'
              }
            >
              {status === 'valid' && <CheckIcon className="w-3 h-3 mr-1" />}
              {status === 'error' && <XIcon className="w-3 h-3 mr-1" />}
              {status}
            </Badge>
            {issues.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {issues.length} issue{issues.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="w-5 h-5" />
          Import Airbnb Bookings
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">Select CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    form.setValue('csvFile', file)
                    handleFileUpload(file)
                  }
                }}
              />
            </div>

            <Alert>
              <AlertDescription>
                Upload a CSV file exported from your Airbnb host dashboard.
                The system will automatically detect common field mappings.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'mapping' && csvData.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Map CSV Fields</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'guestName', label: 'Guest Name', required: true },
                { key: 'checkinDate', label: 'Check-in Date', required: true },
                { key: 'checkoutDate', label: 'Check-out Date', required: true },
                { key: 'totalAmount', label: 'Total Amount', required: true },
                { key: 'guestEmail', label: 'Guest Email', required: false },
                { key: 'guestPhone', label: 'Guest Phone', required: false },
              ].map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={fieldMapping[field.key] || ''}
                    onChange={(e) =>
                      setFieldMapping(prev => ({ ...prev, [field.key]: e.target.value }))
                    }
                  >
                    <option value="">Select CSV column...</option>
                    {Object.keys(csvData[0] || {}).map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button onClick={() => setStep('upload')} variant="outline">
                Back
              </Button>
              <Button onClick={validateAndPreviewData}>
                Preview Data
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preview & Validate</h3>
              <div className="text-sm text-muted-foreground">
                {previewData.filter(r => r.status === 'valid').length} valid,
                {previewData.filter(r => r.status === 'warning').length} warnings,
                {previewData.filter(r => r.status === 'error').length} errors
              </div>
            </div>

            <DataTable
              columns={previewColumns}
              data={previewData}
              pagination
            />

            <div className="flex gap-3">
              <Button onClick={() => setStep('mapping')} variant="outline">
                Back to Mapping
              </Button>
              <form action={importAction}>
                <Button
                  type="submit"
                  disabled={isImportPending || previewData.every(r => r.status === 'error')}
                >
                  {isImportPending ? 'Importing...' : `Import ${previewData.filter(r => r.status !== 'error').length} Bookings`}
                </Button>
              </form>
            </div>
          </div>
        )}

        {csvImportProgress.isImporting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Importing bookings...</span>
              <span>{csvImportProgress.progress}%</span>
            </div>
            <Progress value={csvImportProgress.progress} />
          </div>
        )}

        {importState.success === true && (
          <Alert>
            <CheckIcon className="w-4 h-4" />
            <AlertDescription>
              Successfully imported {importState.imported} bookings!
              {importState.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Issues encountered:</p>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {importState.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {importState.success === false && (
          <Alert variant="destructive">
            <XIcon className="w-4 h-4" />
            <AlertDescription>
              Import failed: {importState.error}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
```

### 4. Facebook Messenger Booking System with Modern Forms

#### Google Forms Integration Component

```typescript
// src/components/booking/FacebookMessengerBooking.tsx
"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarIcon, UserIcon, PhoneIcon, MessageSquareIcon } from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { useCreateBooking } from '@/hooks/useBookings'
import { cn } from '@/lib/utils'

const messengerBookingSchema = z.object({
  guestName: z.string().min(2, 'Guest name must be at least 2 characters'),
  guestEmail: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  guestPhone: z.string().min(10, 'Please enter a valid phone number'),
  checkinDate: z.date({
    required_error: 'Please select a check-in date',
  }),
  checkoutDate: z.date({
    required_error: 'Please select a check-out date',
  }),
  guestCount: z.number().min(1, 'At least 1 guest is required').max(20, 'Maximum 20 guests allowed'),
  specialRequests: z.string().optional(),
  messengerLink: z.string().url('Please enter a valid messenger link').optional().or(z.literal('')),
}).refine(
  (data) => data.checkoutDate > data.checkinDate,
  {
    message: 'Check-out date must be after check-in date',
    path: ['checkoutDate'],
  }
)

type MessengerBookingFormData = z.infer<typeof messengerBookingSchema>

export function FacebookMessengerBooking({
  projectId,
  onSuccess
}: {
  projectId: string
  onSuccess?: () => void
}) {
  const createBookingMutation = useCreateBooking()

  const form = useForm<MessengerBookingFormData>({
    resolver: zodResolver(messengerBookingSchema),
    defaultValues: {
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      guestCount: 2,
      specialRequests: '',
      messengerLink: '',
    },
  })

  const onSubmit = async (values: MessengerBookingFormData) => {
    try {
      // Calculate total amount (you can implement pricing logic here)
      const nights = Math.ceil((values.checkoutDate.getTime() - values.checkinDate.getTime()) / (1000 * 60 * 60 * 24))
      const baseRate = 5000 // ₱5,000 per night base rate
      const totalAmount = nights * baseRate

      await createBookingMutation.mutateAsync({
        bookingReference: `FB-${Date.now()}`,
        source: 'facebook',
        guestName: values.guestName,
        guestEmail: values.guestEmail || undefined,
        guestPhone: values.guestPhone,
        checkinDate: values.checkinDate.toISOString(),
        checkoutDate: values.checkoutDate.toISOString(),
        guestCount: values.guestCount,
        totalAmount,
        depositAmount: 0,
        balanceAmount: totalAmount,
        bookingStatus: 'pending',
        specialRequests: values.specialRequests,
      })

      form.reset()
      onSuccess?.()
    } catch (error: any) {
      console.error('Failed to create booking:', error)
    }
  }

  const watchedDates = form.watch(['checkinDate', 'checkoutDate'])
  const watchedGuestCount = form.watch('guestCount')

  const calculateNights = () => {
    if (watchedDates[0] && watchedDates[1]) {
      return Math.ceil((watchedDates[1].getTime() - watchedDates[0].getTime()) / (1000 * 60 * 60 * 24))
    }
    return 0
  }

  const estimatedTotal = calculateNights() * 5000 * watchedGuestCount

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareIcon className="w-5 h-5" />
          New Facebook Messenger Booking
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Guest Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Guest Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="guestName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guest Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Dela Cruz" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guestPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="+63 917 123 4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guestEmail"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Email Address (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="juan@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="messengerLink"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Messenger Conversation Link (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://m.me/conversation-link" {...field} />
                      </FormControl>
                      <FormDescription>
                        Link to the Messenger conversation for easy reference
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Booking Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Booking Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="checkinDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check-in Date *</FormLabel>
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
                              date < new Date() || date < new Date('1900-01-01')
                            }
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
                  name="checkoutDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check-out Date *</FormLabel>
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
                              date < new Date() || date < new Date('1900-01-01')
                            }
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
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Guests *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Booking Summary */}
              {calculateNights() > 0 && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Nights</p>
                        <p className="font-semibold">{calculateNights()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Guests</p>
                        <p className="font-semibold">{watchedGuestCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rate/Night</p>
                        <p className="font-semibold">₱5,000</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Estimated Total</p>
                        <p className="font-semibold text-lg">₱{estimatedTotal.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <FormField
                control={form.control}
                name="specialRequests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requests</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any special requests or notes from the guest..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Additional requests or information from the guest
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
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
                disabled={createBookingMutation.isPending}
                className="flex-1"
              >
                {createBookingMutation.isPending ? 'Creating Booking...' : 'Create Booking'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

### 5. Payment Tracking with Modern UI Components

#### Payment Recording Component

```typescript
// src/components/booking/PaymentRecordingModal.tsx
"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CreditCardIcon, DollarSignIcon, UploadIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { useRecordPayment } from '@/hooks/useBookings'
import { useBookingStore } from '@/stores/bookingStore'
import { useBooking } from '@/hooks/useBookings'

const paymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  paymentMethod: z.enum(['cash', 'gcash', 'bank_transfer'], {
    required_error: 'Please select a payment method',
  }),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
  screenshotFile: z.instanceof(File).optional(),
}).refine(
  (data) => {
    if (data.paymentMethod === 'gcash' || data.paymentMethod === 'bank_transfer') {
      return data.transactionReference && data.transactionReference.length > 0
    }
    return true
  },
  {
    message: 'Transaction reference is required for GCash and Bank Transfer',
    path: ['transactionReference'],
  }
)

type PaymentFormData = z.infer<typeof paymentSchema>

export function PaymentRecordingModal() {
  const { paymentModal, closePaymentModal } = useBookingStore()
  const { data: booking } = useBooking(paymentModal.bookingId || '')

  const recordPaymentMutation = useRecordPayment()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: 'cash',
      transactionReference: '',
      notes: '',
    },
  })

  const watchedPaymentMethod = form.watch('paymentMethod')

  const onSubmit = async (values: PaymentFormData) => {
    if (!paymentModal.bookingId || !paymentModal.paymentType) return

    try {
      await recordPaymentMutation.mutateAsync({
        bookingId: paymentModal.bookingId,
        paymentType: paymentModal.paymentType,
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        transactionReference: values.transactionReference,
        screenshotFile: values.screenshotFile,
        notes: values.notes,
      })

      handleClose()
    } catch (error: any) {
      console.error('Failed to record payment:', error)
    }
  }

  const handleClose = () => {
    form.reset()
    setPreviewUrl(null)
    closePaymentModal()
  }

  const handleFileChange = (file: File | undefined) => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      form.setValue('screenshotFile', file)
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      form.setValue('screenshotFile', undefined)
    }
  }

  // Calculate suggested amounts
  const suggestedAmounts = () => {
    if (!booking) return []

    if (paymentModal.paymentType === 'deposit') {
      const depositAmount = booking.totalAmount * 0.5
      return [depositAmount]
    } else {
      const remainingBalance = booking.totalAmount - booking.depositAmount
      return [remainingBalance]
    }
  }

  return (
    <Dialog open={paymentModal.isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="w-5 h-5" />
            Record {paymentModal.paymentType === 'deposit' ? 'Deposit' : 'Balance'} Payment
          </DialogTitle>
        </DialogHeader>

        {booking && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Guest</p>
                  <p className="font-semibold">{booking.guestName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-semibold">₱{booking.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Deposit Paid</p>
                  <p className="font-semibold">₱{booking.depositAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance Due</p>
                  <p className="font-semibold">₱{booking.balanceAmount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSignIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-10"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </FormControl>

                  {/* Suggested amounts */}
                  {suggestedAmounts().length > 0 && (
                    <div className="flex gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">Suggested:</span>
                      {suggestedAmounts().map((amount, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => form.setValue('amount', amount)}
                        >
                          ₱{amount.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />

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
                      className="grid grid-cols-3 gap-4"
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
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(watchedPaymentMethod === 'gcash' || watchedPaymentMethod === 'bank_transfer') && (
              <FormField
                control={form.control}
                name="transactionReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Reference *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          watchedPaymentMethod === 'gcash'
                            ? 'GCash Reference Number'
                            : 'Bank Transfer Reference'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {watchedPaymentMethod === 'gcash'
                        ? 'Enter the GCash transaction reference number'
                        : 'Enter the bank transfer reference number'
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchedPaymentMethod !== 'cash' && (
              <FormField
                control={form.control}
                name="screenshotFile"
                render={({ field: { onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Payment Screenshot</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                          <Label
                            htmlFor="screenshot-upload"
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:bg-muted/50"
                          >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <UploadIcon className="w-8 h-8 mb-4 text-muted-foreground" />
                              <p className="mb-2 text-sm text-muted-foreground">
                                <span className="font-semibold">Click to upload</span> payment screenshot
                              </p>
                              <p className="text-xs text-muted-foreground">PNG or JPG (MAX. 5MB)</p>
                            </div>
                            <Input
                              id="screenshot-upload"
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleFileChange(e.target.files?.[0])}
                            />
                          </Label>
                        </div>

                        {previewUrl && (
                          <div className="relative">
                            <img
                              src={previewUrl}
                              alt="Payment screenshot preview"
                              className="max-w-full h-auto rounded-lg border"
                              style={{ maxHeight: '200px' }}
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => handleFileChange(undefined)}
                            >
                              <XIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Upload a screenshot of the payment confirmation for your records
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this payment..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                disabled={recordPaymentMutation.isPending}
                className="flex-1"
              >
                {recordPaymentMutation.isPending ? 'Recording...' : `Record ${paymentModal.paymentType === 'deposit' ? 'Deposit' : 'Balance'}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

### 6. Booking Timeline with Visual Progress

#### Interactive Timeline Component

```typescript
// src/components/booking/BookingTimeline.tsx
"use client"

import { format } from 'date-fns'
import { CheckIcon, ClockIcon, AlertCircleIcon, CreditCardIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useBooking } from '@/hooks/useBookings'
import { useBookingStore } from '@/stores/bookingStore'

interface TimelineEvent {
  id: string
  type: 'inquiry' | 'deposit_requested' | 'deposit_received' | 'confirmed' | 'balance_due' | 'balance_paid' | 'checkin' | 'checkout'
  title: string
  description: string
  timestamp: string
  completed: boolean
  canAction?: boolean
  actionLabel?: string
}

export function BookingTimeline({
  projectId,
  bookingId
}: {
  projectId: string
  bookingId: string
}) {
  const openPaymentModal = useBookingStore((state) => state.openPaymentModal)
  const { data: booking, isLoading } = useBooking(bookingId)

  if (isLoading || !booking) {
    return <div>Loading timeline...</div>
  }

  // Generate timeline events based on booking data
  const generateTimelineEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [
      {
        id: 'inquiry',
        type: 'inquiry',
        title: 'Booking Created',
        description: `Initial inquiry received from ${booking.source === 'airbnb' ? 'Airbnb' : 'Facebook Messenger'}`,
        timestamp: booking.createdAt,
        completed: true,
      },
    ]

    // Add deposit events
    if (booking.bookingStatus !== 'pending') {
      events.push({
        id: 'deposit_requested',
        type: 'deposit_requested',
        title: 'Deposit Requested',
        description: `Deposit of ₱${(booking.totalAmount * 0.5).toLocaleString()} requested`,
        timestamp: booking.createdAt, // In real app, you'd track this separately
        completed: true,
      })
    }

    if (booking.depositAmount > 0) {
      events.push({
        id: 'deposit_received',
        type: 'deposit_received',
        title: 'Deposit Received',
        description: `₱${booking.depositAmount.toLocaleString()} deposit confirmed`,
        timestamp: booking.updatedAt, // In real app, track payment timestamp
        completed: true,
      })

      events.push({
        id: 'confirmed',
        type: 'confirmed',
        title: 'Booking Confirmed',
        description: 'Calendar blocked and guest notified',
        timestamp: booking.updatedAt,
        completed: true,
      })
    }

    // Add balance events
    const hasBalance = booking.balanceAmount > 0
    const checkinDate = new Date(booking.checkinDate)
    const isCheckinToday = format(new Date(), 'yyyy-MM-dd') === format(checkinDate, 'yyyy-MM-dd')
    const isBalanceDue = hasBalance && (isCheckinToday || new Date() >= checkinDate)

    if (hasBalance) {
      events.push({
        id: 'balance_due',
        type: 'balance_due',
        title: 'Balance Due',
        description: `Remaining balance of ₱${booking.balanceAmount.toLocaleString()} due at check-in`,
        timestamp: booking.checkinDate,
        completed: booking.balanceAmount === 0,
        canAction: isBalanceDue && booking.balanceAmount > 0,
        actionLabel: 'Record Balance Payment',
      })
    } else {
      events.push({
        id: 'balance_paid',
        type: 'balance_paid',
        title: 'Fully Paid',
        description: 'All payments received',
        timestamp: booking.updatedAt,
        completed: true,
      })
    }

    // Add check-in/out events
    events.push({
      id: 'checkin',
      type: 'checkin',
      title: 'Check-in',
      description: format(checkinDate, 'EEEE, MMMM d, yyyy - h:mm a'),
      timestamp: booking.checkinDate,
      completed: ['checked_in', 'completed'].includes(booking.bookingStatus),
    })

    events.push({
      id: 'checkout',
      type: 'checkout',
      title: 'Check-out',
      description: format(new Date(booking.checkoutDate), 'EEEE, MMMM d, yyyy - h:mm a'),
      timestamp: booking.checkoutDate,
      completed: booking.bookingStatus === 'completed',
    })

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  const timelineEvents = generateTimelineEvents()

  const getEventIcon = (event: TimelineEvent) => {
    if (event.completed) {
      return <CheckIcon className="w-4 h-4 text-green-600" />
    }

    if (event.canAction) {
      return <AlertCircleIcon className="w-4 h-4 text-amber-600" />
    }

    return <ClockIcon className="w-4 h-4 text-muted-foreground" />
  }

  const getEventStatus = (event: TimelineEvent) => {
    if (event.completed) {
      return <Badge variant="default" className="bg-green-600">Completed</Badge>
    }

    if (event.canAction) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Action Required</Badge>
    }

    return <Badge variant="outline">Pending</Badge>
  }

  const handleAction = (event: TimelineEvent) => {
    if (event.type === 'balance_due') {
      openPaymentModal(booking.id, 'balance')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          Booking Timeline
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {timelineEvents.map((event, index) => (
              <div key={event.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className={cn(
                  "relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 bg-background",
                  event.completed ? "border-green-600 bg-green-50" :
                  event.canAction ? "border-amber-600 bg-amber-50" :
                  "border-muted-foreground bg-muted"
                )}>
                  {getEventIcon(event)}
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-foreground">{event.title}</h3>
                    {getEventStatus(event)}
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    {event.description}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.timestamp), 'MMM d, yyyy - h:mm a')}
                  </p>

                  {event.canAction && (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => handleAction(event)}
                    >
                      <CreditCardIcon className="w-4 h-4 mr-2" />
                      {event.actionLabel}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

### 7. TanStack Router Integration

#### File-Based Route Definition

```typescript
// src/routes/bookings/$bookingId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { bookingKeys } from '@/lib/queryClient'

export const Route = createFileRoute('/bookings/$bookingId')({
  loader: async ({ context: { queryClient }, params }) => {
    const booking = await queryClient.ensureQueryData({
      queryKey: bookingKeys.detail(params.bookingId),
      queryFn: async () => {
        const response = await fetch(`/api/bookings/${params.bookingId}`)
        if (!response.ok) throw new Error('Failed to fetch booking')
        return response.json()
      },
    })
    return { booking }
  },
  component: BookingDetailPage,
})

function BookingDetailPage() {
  const { bookingId } = Route.useParams()
  const { booking } = Route.useLoaderData()

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Booking Details</h1>
      <BookingTimeline projectId={booking.projectId} bookingId={bookingId} />
      {/* Other booking components */}
    </div>
  )
}
```

### 8. Serverless API Routes

#### Booking API Route Implementation

```javascript
// api/[projectId]/bookings/index.js - Vercel Serverless Function
import { neon } from "@neondatabase/serverless";
import {
  authenticateUser,
  checkProjectAccess,
} from "../../../lib/auth-middleware.js";
import { validateBookingData } from "../../../lib/validations.js";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    // Authenticate user
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { projectId } = req.query;

    // Check project access
    const hasAccess = await checkProjectAccess(
      user.id,
      projectId,
      "bookings.read"
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") {
      const { page = 1, limit = 20, status, source } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT b.*, COUNT(*) OVER() as total_count
        FROM project_${projectId.replace(/[^a-z0-9_]/gi, "_")}.bookings b
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND b.booking_status = $${params.length}`;
      }

      if (source) {
        params.push(source);
        query += ` AND b.source = $${params.length}`;
      }

      params.push(limit, offset);
      query += ` ORDER BY b.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const bookings = await sql.query(query, params);
      const totalCount = bookings.length > 0 ? bookings[0].total_count : 0;

      return res.status(200).json({
        bookings: bookings.map(({ total_count, ...booking }) => booking),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: offset + bookings.length < totalCount,
        },
      });
    }

    if (req.method === "POST") {
      const hasCreateAccess = await checkProjectAccess(
        user.id,
        projectId,
        "bookings.create"
      );
      if (!hasCreateAccess) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const bookingData = validateBookingData(req.body);

      const [newBooking] = await sql`
        INSERT INTO project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, "_"))}.bookings (
          booking_reference, source, guest_name, guest_email, guest_phone,
          checkin_date, checkout_date, guest_count, total_amount,
          deposit_amount, balance_amount, booking_status, special_requests,
          created_by, created_at, updated_at
        ) VALUES (
          ${bookingData.bookingReference}, ${bookingData.source}, ${bookingData.guestName},
          ${bookingData.guestEmail}, ${bookingData.guestPhone}, ${bookingData.checkinDate},
          ${bookingData.checkoutDate}, ${bookingData.guestCount}, ${bookingData.totalAmount},
          ${bookingData.depositAmount || 0}, ${bookingData.totalAmount - (bookingData.depositAmount || 0)},
          ${bookingData.bookingStatus || "pending"}, ${bookingData.specialRequests},
          ${user.id}, NOW(), NOW()
        )
        RETURNING *
      `;

      return res.status(201).json({ booking: newBooking });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Booking API Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

## Key Benefits of Modern Stack

### Bundle Size Optimization

- **Zustand + TanStack Query**: ~25KB gzipped total
- **Optimized for minimal footprint**
- **Fast loading on mobile devices**

### Developer Experience Improvements

- **Less Boilerplate**: ~60% reduction in state management code
- **Better TypeScript**: Full type inference with TanStack Router
- **Simpler Testing**: Zustand stores provide straightforward testing patterns
- **Faster Development**: File-based routing reduces setup time

### Performance Optimizations

- **TanStack Query**: Intelligent background refetching and cache invalidation
- **React 19 useOptimistic**: Instant UI updates with automatic rollback on
  errors
- **Vite 7 Lightning CSS**: 100x faster CSS processing than traditional PostCSS
- **Serverless Edge Functions**: Global CDN distribution with <200ms response
  times

### Modern Development Features

- **Type Safety**: End-to-end TypeScript with strict mode
- **React 19 Hooks**: useActionState for async form handling, useOptimistic for
  UI
- **File-based Routing**: TanStack Router's intuitive routing system
- **Hot Module Replacement**: Instant updates during development

This modernized booking management system leverages the latest 2025 technologies
to provide enterprise-level capabilities while maintaining the simplicity needed
for family resort operations. The combination of Zustand for local state,
TanStack Query for server state, and TanStack Router for navigation creates a
powerful, performant, and developer-friendly architecture.

## Phase Verification Steps

### Phase 1: State Management Setup ✓

**Verification Checklist:**

- [ ] Zustand store created and configured with devtools
- [ ] TanStack Query client properly configured with retry logic
- [ ] Query key factory implemented for type safety
- [ ] State persistence configured for critical UI state
- [ ] HMR (Hot Module Replacement) working in development

**Testing Commands:**

```bash
# Run type checking
npm run type-check

# Test store in browser DevTools
localStorage.getItem('booking-ui-storage')

# Verify React Query DevTools
# Open browser DevTools > React Query tab
```

### Phase 2: CSV Import Implementation ✓

**Verification Checklist:**

- [ ] File upload accepts only CSV files
- [ ] Field mapping auto-detects common headers
- [ ] Data validation catches all edge cases
- [ ] Preview shows accurate validation status
- [ ] Import progress bar updates in real-time
- [ ] Error handling for malformed CSV files

**Testing Scenarios:**

1. Upload valid Airbnb CSV - should auto-map fields
2. Upload CSV with missing columns - should show warnings
3. Upload CSV with invalid dates - should show errors
4. Upload non-CSV file - should reject
5. Import 100+ bookings - should show progress

### Phase 3: Facebook Messenger Integration ✓

**Verification Checklist:**

- [ ] Form validation works for all required fields
- [ ] Date picker prevents invalid date selections
- [ ] Phone number validation for Philippine format
- [ ] Guest count limits enforced (1-20)
- [ ] Price calculation updates dynamically
- [ ] Form submission creates booking successfully

**Testing Scenarios:**

1. Submit form with all fields - should succeed
2. Submit with past check-in date - should fail
3. Submit with check-out before check-in - should fail
4. Submit without required fields - should show errors
5. Clear form button resets all fields

### Phase 4: Payment Recording System ✓

**Verification Checklist:**

- [ ] Payment modal shows correct booking details
- [ ] Payment methods switch input requirements
- [ ] GCash/Bank requires reference number
- [ ] Screenshot upload works for images
- [ ] Suggested amounts calculate correctly
- [ ] Payment updates booking status

**Testing Scenarios:**

1. Record cash payment - no reference required
2. Record GCash without reference - should fail
3. Upload screenshot > 5MB - should reject
4. Record deposit payment - status updates
5. Record final balance - booking marked fully paid

### Phase 5: Booking Timeline ✓

**Verification Checklist:**

- [ ] Timeline events in chronological order
- [ ] Completed events show green checkmark
- [ ] Pending events show clock icon
- [ ] Action buttons appear when appropriate
- [ ] Timeline updates after payment recording
- [ ] Dates formatted correctly for timezone

**Testing Scenarios:**

1. New booking - shows initial event only
2. Deposit paid - shows confirmation events
3. Check-in day - shows balance due action
4. Fully paid - all payment events completed
5. Past booking - all events completed

### Phase 6: API Integration ✓

**Verification Checklist:**

- [ ] Authentication middleware validates JWT
- [ ] Project access permissions enforced
- [ ] Database queries use parameterized statements
- [ ] Pagination works correctly
- [ ] Error responses have proper status codes
- [ ] CORS configured for frontend domain

**Testing Commands:**

```bash
# Test API endpoints
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/project-123/bookings

# Test pagination
curl "http://localhost:3000/api/project-123/bookings?page=2&limit=10"

# Test filtering
curl "http://localhost:3000/api/project-123/bookings?status=confirmed&source=airbnb"
```

### Phase 7: Performance Optimization ✓

**Verification Checklist:**

- [ ] Bundle size < 200KB gzipped
- [ ] Lighthouse score > 90 for performance
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] No memory leaks in long sessions
- [ ] Optimistic updates feel instant

**Testing Commands:**

```bash
# Build and analyze bundle
npm run build
npm run analyze

# Run Lighthouse
npx lighthouse http://localhost:5173 --view

# Check bundle size
du -sh dist/assets/*.js | sort -h
```

### Integration Testing Checklist

**End-to-End Scenarios:**

1. **Complete Booking Flow:**
   - [ ] Import CSV with 10 bookings
   - [ ] View bookings in list
   - [ ] Open booking detail
   - [ ] Record deposit payment
   - [ ] Verify timeline updates
   - [ ] Record balance payment
   - [ ] Confirm fully paid status

2. **Multi-User Scenario:**
   - [ ] User A creates booking
   - [ ] User B views same booking
   - [ ] User A records payment
   - [ ] User B sees updated status

3. **Error Recovery:**
   - [ ] Network failure during import
   - [ ] Invalid JWT token
   - [ ] Database connection timeout
   - [ ] File upload interruption

### Security Verification

**Security Checklist:**

- [ ] No sensitive data in localStorage
- [ ] API keys not exposed in frontend
- [ ] XSS protection in user inputs
- [ ] SQL injection prevention in queries
- [ ] File upload size limits enforced
- [ ] Rate limiting on API endpoints

**Security Testing Commands:**

```bash
# Check for exposed secrets
grep -r "DATABASE_URL\|JWT_SECRET\|API_KEY" src/

# Test file upload limits
curl -X POST -F "file=@large_file.csv" \
  http://localhost:3000/api/upload

# Check for XSS vulnerabilities
# Try inserting <script>alert('XSS')</script> in form fields
```

### Deployment Verification

**Pre-Deployment Checklist:**

- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] Build completes without errors
- [ ] All tests pass
- [ ] No console errors in production build
- [ ] Performance metrics meet targets

**Deployment Commands:**

```bash
# Build for production
npm run build

# Test production build locally
npm run preview

# Deploy to Vercel
vercel --prod

# Verify deployment
curl https://your-app.vercel.app/api/health
```

### Monitoring & Maintenance

**Post-Deployment Monitoring:**

- [ ] Error tracking configured (Sentry)
- [ ] Performance monitoring active
- [ ] Database query performance tracked
- [ ] User analytics implemented
- [ ] Backup strategy in place
- [ ] Incident response plan documented

This comprehensive verification ensures each phase meets quality standards
before proceeding to the next.
