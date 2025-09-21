# Phase 2: Core Features

## Business Logic & Essential Workflows

### 🎯 Phase Overview

**Timeline**: Week 2 (5-7 days) **Goal**: Implement core business logic,
workflows, and search capabilities **Outcome**: Fully functional booking system
with availability checking and payment tracking

### ⚠️ **IMPORTANT: Phase 1 Authentication Changes**

**Note for Phase 2 Implementation Team:**

During Phase 1 compliance work, basic authentication was implemented to support
Row Level Security (RLS). The following components were added:

**Added Components:**

- `src/components/auth/LoginForm.tsx` - Basic login form for admin access
- Authentication state management in `src/App.tsx`
- Login/logout flow with session handling

**Key Changes Made:**

- App now shows login form when not authenticated
- All data access requires authentication (RLS enabled)
- Simple "authenticated users get full access" policies in place
- Session state managed in App component

**For Phase 2 Authentication Enhancement:**

1. **Extend existing auth system** - Don't rebuild from scratch
2. **Current admin login works** - Build upon this foundation
3. **RLS policies already exist** - Enhance them for role-based access
4. **Consider replacing LoginForm** with more sophisticated auth UI
5. **Add user management features** - Registration, password reset, etc.

**Current Auth Flow:**

```
Unauthenticated → LoginForm → Authenticated → Main App
```

**Files to review:**

- `src/components/auth/LoginForm.tsx` (basic implementation)
- `src/App.tsx` (authentication state management)
- `src/lib/auth.ts` (auth service functions)

This provides a working foundation for Phase 2 to build upon rather than
starting from zero.

### Success Criteria

- [ ] Booking availability checker
- [ ] Payment proof upload and verification
- [ ] Booking status workflow (Pending → Confirmed → CheckedIn)
- [ ] Search and filter capabilities
- [ ] Date range views for bookings
- [ ] Basic reporting (occupancy, revenue)
- [ ] Data export functionality (CSV)

---

## 📋 Implementation Steps

### Step 1: Business Logic Implementation

#### 1.1 Availability Checking

```typescript
// src/utils/availability.ts
import { Booking, Unit } from "@/types";
import { isWithinInterval, areIntervalsOverlapping } from "date-fns";

export function checkUnitAvailability(
  unit: Unit,
  bookings: Booking[],
  checkIn: Date,
  checkOut: Date
): boolean {
  // Filter bookings for this unit
  const unitBookings = bookings.filter(
    (b) => b.unit_id === unit.unit_id && b.booking_status !== "Cancelled"
  );

  // Check for overlapping dates
  const hasConflict = unitBookings.some((booking) => {
    return areIntervalsOverlapping(
      { start: new Date(booking.check_in), end: new Date(booking.check_out) },
      { start: checkIn, end: checkOut },
      { inclusive: false }
    );
  });

  return !hasConflict && unit.unit_status === "Available";
}

export function getAvailableUnits(
  units: Unit[],
  bookings: Booking[],
  checkIn: Date,
  checkOut: Date
): Unit[] {
  return units.filter((unit) =>
    checkUnitAvailability(unit, bookings, checkIn, checkOut)
  );
}

export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateTotalAmount(
  unit: Unit,
  checkIn: Date,
  checkOut: Date
): number {
  const nights = calculateNights(checkIn, checkOut);
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 5 || day === 6; // Friday or Saturday
  };

  let total = 0;
  const current = new Date(checkIn);

  for (let i = 0; i < nights; i++) {
    total += isWeekend(current) ? unit.weekend_rate : unit.base_rate;
    current.setDate(current.getDate() + 1);
  }

  return total;
}
```

#### 1.2 Booking Status Workflow

```typescript
// src/utils/bookingWorkflow.ts
import { Booking } from "@/types";

export type BookingStatus =
  | "Pending"
  | "Confirmed"
  | "CheckedIn"
  | "CheckedOut"
  | "Cancelled";

export type PaymentStatus = "Unpaid" | "Partial" | "Paid" | "Refunded";

// Valid status transitions
const statusTransitions: Record<BookingStatus, BookingStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["CheckedIn", "Cancelled"],
  CheckedIn: ["CheckedOut"],
  CheckedOut: [], // Final state
  Cancelled: [], // Final state
};

export function canTransitionTo(
  currentStatus: BookingStatus,
  newStatus: BookingStatus
): boolean {
  return statusTransitions[currentStatus]?.includes(newStatus) || false;
}

export function getNextStatuses(currentStatus: BookingStatus): BookingStatus[] {
  return statusTransitions[currentStatus] || [];
}

export function updateBookingStatus(
  booking: Booking,
  newStatus: BookingStatus
): Booking | null {
  if (!canTransitionTo(booking.booking_status as BookingStatus, newStatus)) {
    console.error(
      `Cannot transition from ${booking.booking_status} to ${newStatus}`
    );
    return null;
  }

  return {
    ...booking,
    booking_status: newStatus,
    updated_at: new Date().toISOString(),
  };
}

export function getStatusColor(status: BookingStatus): string {
  const colors = {
    Pending: "yellow",
    Confirmed: "blue",
    CheckedIn: "green",
    CheckedOut: "gray",
    Cancelled: "red",
  };
  return colors[status] || "gray";
}

export function getPaymentStatusColor(status: PaymentStatus): string {
  const colors = {
    Unpaid: "red",
    Partial: "yellow",
    Paid: "green",
    Refunded: "purple",
  };
  return colors[status] || "gray";
}
```

### Step 2: Search and Filter Implementation

#### 2.1 Search and Filter Utilities

```typescript
// src/utils/search.ts
import { Booking, Unit, Guest } from "@/types";
import { isWithinInterval, parseISO } from "date-fns";

export interface BookingFilters {
  status?: string;
  dateRange?: { start: Date; end: Date };
  searchTerm?: string;
  unitId?: string;
  paymentStatus?: string;
}

export function filterBookings(
  bookings: Booking[],
  filters: BookingFilters
): Booking[] {
  let filtered = [...bookings];

  // Status filter
  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((b) => b.booking_status === filters.status);
  }

  // Date range filter
  if (filters.dateRange) {
    filtered = filtered.filter((b) => {
      const checkIn = parseISO(b.check_in);
      return isWithinInterval(checkIn, {
        start: filters.dateRange!.start,
        end: filters.dateRange!.end,
      });
    });
  }

  // Search term (guest name, email, phone, reference)
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.guest_name.toLowerCase().includes(term) ||
        b.email.toLowerCase().includes(term) ||
        b.contact_number.includes(term) ||
        b.booking_reference.toLowerCase().includes(term)
    );
  }

  // Unit filter
  if (filters.unitId) {
    filtered = filtered.filter((b) => b.unit_id === filters.unitId);
  }

  // Payment status filter
  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    filtered = filtered.filter(
      (b) => b.payment_status === filters.paymentStatus
    );
  }

  return filtered;
}

export function searchUnits(units: Unit[], searchTerm: string): Unit[] {
  const term = searchTerm.toLowerCase();
  return units.filter(
    (u) =>
      u.unit_name.toLowerCase().includes(term) ||
      u.unit_code.toLowerCase().includes(term) ||
      u.unit_type.toLowerCase().includes(term)
  );
}

export function sortBookings(
  bookings: Booking[],
  sortBy: "date" | "amount" | "status" = "date",
  order: "asc" | "desc" = "desc"
): Booking[] {
  const sorted = [...bookings];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "date":
        comparison =
          new Date(a.check_in).getTime() - new Date(b.check_in).getTime();
        break;
      case "amount":
        comparison = a.total_amount - b.total_amount;
        break;
      case "status":
        comparison = a.booking_status.localeCompare(b.booking_status);
        break;
    }

    return order === "asc" ? comparison : -comparison;
  });

  return sorted;
}
```

#### 2.2 Search Component

```tsx
// src/components/BookingSearch.tsx
import { useState } from "react";
import { useBookingStore } from "@/stores/bookingStore";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { filterBookings, sortBookings, BookingFilters } from "@/utils/search";

export function BookingSearch() {
  const { bookings } = useBookingStore();
  const [filters, setFilters] = useState<BookingFilters>({});
  const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");

  const filteredBookings = sortBookings(
    filterBookings(bookings, filters),
    sortBy,
    "desc"
  );

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-4">
        <Input
          placeholder="Search by name, email, phone, or reference..."
          value={filters.searchTerm || ""}
          onChange={(e) =>
            setFilters({ ...filters, searchTerm: e.target.value })
          }
          className="flex-1"
        />

        <Select
          value={filters.status || "all"}
          onValueChange={(value) => setFilters({ ...filters, status: value })}
        >
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Confirmed">Confirmed</option>
          <option value="CheckedIn">Checked In</option>
          <option value="CheckedOut">Checked Out</option>
          <option value="Cancelled">Cancelled</option>
        </Select>

        <Select
          value={filters.paymentStatus || "all"}
          onValueChange={(value) =>
            setFilters({ ...filters, paymentStatus: value })
          }
        >
          <option value="all">All Payments</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Partial">Partial</option>
          <option value="Paid">Paid</option>
          <option value="Refunded">Refunded</option>
        </Select>

        <Button variant="outline" onClick={() => setFilters({})}>
          Clear Filters
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-4">
        <Calendar className="h-4 w-4" />
        <Input
          type="date"
          onChange={(e) =>
            setFilters({
              ...filters,
              dateRange: {
                ...filters.dateRange!,
                start: new Date(e.target.value),
              },
            })
          }
        />
        <span>to</span>
        <Input
          type="date"
          onChange={(e) =>
            setFilters({
              ...filters,
              dateRange: {
                ...filters.dateRange!,
                end: new Date(e.target.value),
              },
            })
          }
        />
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Found {filteredBookings.length} bookings
      </div>

      {/* Results Table would go here */}
    </div>
  );
}
```

### Step 3: Reporting and Export

#### 3.1 Basic Reports

```typescript
// src/utils/reports.ts
import { Booking, Unit } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWithinInterval,
} from "date-fns";

export interface OccupancyReport {
  date: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  revenue: number;
}

export interface RevenueReport {
  period: string;
  bookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  occupancyRate: number;
}

export function generateOccupancyReport(
  units: Unit[],
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): OccupancyReport[] {
  const report: OccupancyReport[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  days.forEach((day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    // Count occupied units for this day
    const occupiedUnits = new Set<string>();
    let dayRevenue = 0;

    bookings.forEach((booking) => {
      if (booking.booking_status === "Cancelled") return;

      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);

      if (isWithinInterval(day, { start: checkIn, end: checkOut })) {
        occupiedUnits.add(booking.unit_id);
        // Calculate daily revenue (simplified)
        const nights = Math.ceil(
          (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
        );
        dayRevenue += booking.total_amount / nights;
      }
    });

    report.push({
      date: format(day, "yyyy-MM-dd"),
      totalUnits: units.length,
      occupiedUnits: occupiedUnits.size,
      occupancyRate: (occupiedUnits.size / units.length) * 100,
      revenue: dayRevenue,
    });
  });

  return report;
}

export function generateRevenueReport(
  bookings: Booking[],
  units: Unit[],
  year: number,
  month: number
): RevenueReport {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(new Date(year, month - 1));

  const monthBookings = bookings.filter((booking) => {
    const checkIn = new Date(booking.check_in);
    return (
      isWithinInterval(checkIn, { start: startDate, end: endDate }) &&
      booking.booking_status !== "Cancelled"
    );
  });

  const totalRevenue = monthBookings.reduce(
    (sum, b) => sum + b.total_amount,
    0
  );
  const occupancyReport = generateOccupancyReport(
    units,
    bookings,
    startDate,
    endDate
  );
  const avgOccupancy =
    occupancyReport.reduce((sum, r) => sum + r.occupancyRate, 0) /
    occupancyReport.length;

  return {
    period: format(startDate, "MMMM yyyy"),
    bookings: monthBookings.length,
    totalRevenue,
    averageBookingValue:
      monthBookings.length > 0 ? totalRevenue / monthBookings.length : 0,
    occupancyRate: avgOccupancy,
  };
}

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;

  // Get headers from first object
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape commas and quotes in values
          if (
            typeof value === "string" &&
            (value.includes(",") || value.includes('"'))
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

#### 3.2 Report Dashboard Component

```tsx
// src/components/ReportDashboard.tsx
import { useState, useEffect } from "react";
import { useBookingStore } from "@/stores/bookingStore";
import { useUnitStore } from "@/stores/unitStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  generateOccupancyReport,
  generateRevenueReport,
  exportToCSV,
} from "@/utils/reports";
import { startOfMonth, endOfMonth } from "date-fns";

export function ReportDashboard() {
  const { bookings } = useBookingStore();
  const { units } = useUnitStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [revenueReport, setRevenueReport] = useState<any>(null);
  const [occupancyData, setOccupancyData] = useState<any[]>([]);

  useEffect(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);

    const revenue = generateRevenueReport(
      bookings,
      units,
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1
    );

    const occupancy = generateOccupancyReport(units, bookings, start, end);

    setRevenueReport(revenue);
    setOccupancyData(occupancy);
  }, [selectedMonth, bookings, units]);

  const handleExportBookings = () => {
    const exportData = bookings.map((b) => ({
      Reference: b.booking_reference,
      Guest: b.guest_name,
      Unit: units.find((u) => u.unit_id === b.unit_id)?.unit_name || "Unknown",
      "Check In": b.check_in,
      "Check Out": b.check_out,
      Status: b.booking_status,
      Payment: b.payment_status,
      Amount: b.total_amount,
    }));

    exportToCSV(exportData, `bookings_${format(selectedMonth, "yyyy-MM")}.csv`);
  };

  const handleExportOccupancy = () => {
    exportToCSV(
      occupancyData,
      `occupancy_${format(selectedMonth, "yyyy-MM")}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reports Dashboard</h2>
        <div className="flex gap-2">
          <Button onClick={handleExportBookings}>Export Bookings</Button>
          <Button onClick={handleExportOccupancy}>Export Occupancy</Button>
        </div>
      </div>

      {/* Revenue Summary */}
      {revenueReport && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{revenueReport.totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{revenueReport.bookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Booking Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱{revenueReport.averageBookingValue.toFixed(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Occupancy Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueReport.occupancyRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
```

### Step 4: File Upload for Payment Proofs

#### 4.1 File Upload Component

```tsx
// src/components/PaymentProofUpload.tsx
import { useState } from 'react';
import { useBookingStore } from '@/stores/bookingStore';
import { Button } from '@/components/ui/button';
import { Upload, Check, X } from 'lucide-react';

export function PaymentProofUpload({ bookingId }: { bookingId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { uploadPaymentProof } = useBookingStore();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (!validTypes.includes(selectedFile.type)) {
        alert('Please upload a JPEG, PNG, or PDF file');
        return;
      }

      if (selectedFile.size > maxSize) {
        alert('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setUploadStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      await uploadPaymentProof(bookingId, file);
      setUploadStatus('success');
      setTimeout(() => {
        setFile(null);
        setUploadStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
          id={`payment-proof-${bookingId}`}
        />
        <label
          htmlFor={`payment-proof-${bookingId}`}
          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <Upload className="w-4 h-4" />
          Select File
        </label>

        {file && (
          <>
            <span className="text-sm text-gray-600">{file.name}</span>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              size="sm"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </>
        )}
      </div>

      {uploadStatus === 'success' && (
        <div className="flex items-center gap-2 text-green-600">
          <Check className="w-4 h-4" />
          <span className="text-sm">Payment proof uploaded successfully</span>
        </div>
      )}

      {uploadStatus === 'error' && (
        <div className="flex items-center gap-2 text-red-600">
          <X className="w-4 h-4" />
          <span className="text-sm">Upload failed. Please try again.</span>
        </div>
      )}
    </div>
  );
```

## ✅ Phase 2 Completion Checklist

### Required

- [ ] Availability checking logic implemented
- [ ] Booking status workflow (Pending → Confirmed → CheckedIn)
- [ ] Payment proof upload functionality
- [ ] Search and filter for bookings
- [ ] Basic reporting (occupancy, revenue)
- [ ] CSV export functionality
- [ ] Date range views
- [ ] Payment status tracking

### Completed in Phase 2

- [ ] All business logic in utilities
- [ ] File uploads working
- [ ] Search/filter optimized
- [ ] Basic reports generated

---

## 🚨 Troubleshooting

### Common Issues

#### File Upload Fails

- Check file size (max 10MB)
- Verify file type (JPEG, PNG, PDF only)
- For Supabase: Check storage bucket permissions
- For custom backend: Ensure upload directory exists

#### Search Not Working

- Verify Zustand store is properly connected
- Check date format in filters
- Ensure bookings are loaded before filtering

#### Reports Show Wrong Data

- Verify timezone handling in date calculations
- Check booking status filters
- Ensure cancelled bookings are excluded

---

## ➡️ Next Steps

Once Phase 2 is complete:

1. Test all search and filter combinations
2. Verify payment proof uploads work
3. Generate sample reports and verify accuracy
4. Test CSV export with different data sets
5. Move to [Phase 3: Deploy & Polish](./phase-3-production-ready.md)

---

_Phase 2 Core Features - Simplified for CRUD - Last Updated: September 21, 2025_
