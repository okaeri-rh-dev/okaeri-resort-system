# Implementation Instructions: Chunk 011

## Overview

This guide walks you through implementing the admin booking queue with intelligent urgency scoring. All code is copy-pasteable and production-ready.

**Estimated Time**: 90 minutes total

- Step 1: Urgency scoring utility (15 min)
- Step 2: Queue component (30 min)
- Step 3: API endpoint (20 min)
- Step 4: Routes and navigation (10 min)
- Step 5: Testing and verification (15 min)

---

## Step 1: Create Urgency Scoring Utility (15 minutes)

Create the TypeScript utility for calculating urgency scores.

### Create File: `src/lib/urgency-scoring.ts`

```bash
touch src/lib/urgency-scoring.ts
```

### Copy Complete File Content

```typescript
/**
 * Urgency Scoring System for Admin Booking Queue
 *
 * Calculates 0-100 urgency score based on 4 factors:
 * 1. Hours to check-in (max 50 points)
 * 2. Days pending (max 20 points)
 * 3. Booking value (max 15 points)
 * 4. Unit count (max 15 points)
 *
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 24-148
 */

// ============================================
// Types
// ============================================

export type UrgencyLevel = "critical" | "high" | "medium" | "low";

export interface UrgencyScoreParams {
  check_in_date: string;
  created_at: string;
  total_amount: number;
  requested_unit_count: number;
}

export interface UrgencyResult {
  score: number;
  level: UrgencyLevel;
  badge_variant: "destructive" | "warning" | "default" | "secondary";
}

// ============================================
// SLO Thresholds
// ============================================

export const URGENCY_THRESHOLDS = {
  CRITICAL: 75,
  HIGH: 50,
  MEDIUM: 25,
} as const;

export const SLO_TARGETS = {
  critical: "1 hour",
  high: "4 hours",
  medium: "12 hours",
  low: "24 hours",
} as const;

// ============================================
// Core Scoring Function
// ============================================

/**
 * Calculates urgency score (0-100) for a booking
 *
 * @param params - Booking parameters for scoring
 * @returns Urgency score (0-100)
 *
 * @example
 * const score = calculateUrgencyScore({
 *   check_in_date: '2025-10-25T15:00:00Z',
 *   created_at: '2025-10-23T10:00:00Z',
 *   total_amount: 45000,
 *   requested_unit_count: 3
 * });
 * // Returns 75 (Critical - check-in in 24h, 2 days pending, mid-value, 3 units)
 */
export function calculateUrgencyScore(params: UrgencyScoreParams): number {
  const { check_in_date, created_at, total_amount, requested_unit_count } = params;

  let score = 0;
  const now = new Date();

  // ============================================
  // Factor 1: Hours to Check-In (max 50 points)
  // ============================================
  const checkIn = new Date(check_in_date);
  const hoursToCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursToCheckIn < 0) {
    // Already past check-in - CRITICAL!
    return 100;
  } else if (hoursToCheckIn < 24) {
    score += 50;
  } else if (hoursToCheckIn < 48) {
    score += 35;
  } else if (hoursToCheckIn < 72) {
    score += 20;
  } else {
    score += 10;
  }

  // ============================================
  // Factor 2: Days Pending (max 20 points)
  // ============================================
  const createdAt = new Date(created_at);
  const daysPending = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysPending > 3) {
    score += 20;
  } else if (daysPending > 2) {
    score += 15;
  } else if (daysPending > 1) {
    score += 10;
  } else {
    score += 5;
  }

  // ============================================
  // Factor 3: Booking Value (max 15 points)
  // ============================================
  if (total_amount > 50000) {
    score += 15;
  } else if (total_amount > 30000) {
    score += 10;
  } else if (total_amount > 15000) {
    score += 5;
  } else {
    score += 2;
  }

  // ============================================
  // Factor 4: Unit Count (max 15 points)
  // ============================================
  if (requested_unit_count > 5) {
    score += 15;
  } else if (requested_unit_count >= 3) {
    score += 10;
  } else if (requested_unit_count === 2) {
    score += 5;
  } else {
    score += 2;
  }

  return Math.min(100, score);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Determines urgency level from score
 *
 * @param score - Urgency score (0-100)
 * @returns Urgency level (critical/high/medium/low)
 */
export function getUrgencyLevel(score: number): UrgencyLevel {
  if (score >= URGENCY_THRESHOLDS.CRITICAL) return "critical";
  if (score >= URGENCY_THRESHOLDS.HIGH) return "high";
  if (score >= URGENCY_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

/**
 * Gets urgency result with level and badge variant
 *
 * @param params - Booking parameters for scoring
 * @returns Complete urgency result
 */
export function getUrgencyResult(params: UrgencyScoreParams): UrgencyResult {
  const score = calculateUrgencyScore(params);
  const level = getUrgencyLevel(score);

  const badgeVariantMap: Record<UrgencyLevel, UrgencyResult["badge_variant"]> = {
    critical: "destructive",
    high: "warning",
    medium: "default",
    low: "secondary",
  };

  return {
    score,
    level,
    badge_variant: badgeVariantMap[level],
  };
}

/**
 * Formats urgency level as display text
 *
 * @param level - Urgency level
 * @returns Display text (Critical/High/Medium/Low)
 */
export function formatUrgencyLevel(level: UrgencyLevel): string {
  const displayMap: Record<UrgencyLevel, string> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return displayMap[level];
}
```

### Verification

```bash
# Type check
npm run type-check

# Should show no errors in urgency-scoring.ts
```

**Expected**: No TypeScript errors

---

## Step 2: Create Queue Component (30 minutes)

Create the React component for the pending bookings queue.

### Create File: `src/components/admin/PendingBookingsQueue.tsx`

```bash
mkdir -p src/components/admin
touch src/components/admin/PendingBookingsQueue.tsx
```

### Copy Complete Component Code

```typescript
/**
 * Pending Bookings Queue Component
 *
 * Displays all pending multi-unit bookings sorted by urgency
 * Features:
 * - Real-time updates (30s refresh)
 * - Color-coded urgency badges
 * - Filter controls (date, urgency, search)
 * - Mobile responsive design
 *
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 190-283
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import type { UrgencyLevel } from '@/lib/urgency-scoring';
import { formatUrgencyLevel } from '@/lib/urgency-scoring';

// ============================================
// Types
// ============================================

interface PendingBooking {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  guest_contact: string;
  check_in_date: string;
  check_out_date: string;
  requested_unit_count: number;
  total_amount: number;
  payment_status: 'Pending' | 'Verified' | 'Rejected';
  urgency_score: number;
  urgency_level: UrgencyLevel;
  created_at: string;
}

interface QueueFilters {
  searchQuery: string;
  urgencyLevel: UrgencyLevel | 'all';
  dateRange: 'all' | 'today' | 'week' | 'month';
}

// ============================================
// Component
// ============================================

export function PendingBookingsQueue() {
  const [filters, setFilters] = useState<QueueFilters>({
    searchQuery: '',
    urgencyLevel: 'all',
    dateRange: 'all',
  });

  // Fetch pending bookings with urgency scoring
  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['pending-multi-unit-bookings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/pending-bookings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending bookings');
      }

      const data = await response.json();
      return data.bookings as PendingBooking[];
    },
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 25000, // Consider stale after 25s
  });

  // ============================================
  // Filtering Logic
  // ============================================

  const filteredBookings = bookings?.filter((booking) => {
    // Search filter (booking reference or guest name)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesSearch =
        booking.booking_reference.toLowerCase().includes(query) ||
        booking.guest_name.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Urgency level filter
    if (filters.urgencyLevel !== 'all' && booking.urgency_level !== filters.urgencyLevel) {
      return false;
    }

    // Date range filter (check-in date)
    if (filters.dateRange !== 'all') {
      const checkIn = new Date(booking.check_in_date);
      const now = new Date();

      if (filters.dateRange === 'today') {
        const isToday = checkIn.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (filters.dateRange === 'week') {
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (checkIn > weekFromNow) return false;
      } else if (filters.dateRange === 'month') {
        const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (checkIn > monthFromNow) return false;
      }
    }

    return true;
  });

  // ============================================
  // Badge Helpers
  // ============================================

  const getUrgencyBadge = (level: UrgencyLevel, score: number) => {
    const variantMap: Record<UrgencyLevel, 'destructive' | 'warning' | 'default' | 'secondary'> = {
      critical: 'destructive',
      high: 'warning',
      medium: 'default',
      low: 'secondary',
    };

    return (
      <div className="flex items-center gap-2">
        <Badge variant={variantMap[level]}>
          {formatUrgencyLevel(level)}
        </Badge>
        <span className="text-sm text-muted-foreground font-mono">{score}</span>
      </div>
    );
  };

  const getPaymentBadge = (status: PendingBooking['payment_status']) => {
    const variantMap = {
      Verified: 'default' as const,
      Pending: 'secondary' as const,
      Rejected: 'destructive' as const,
    };
    return <Badge variant={variantMap[status]}>{status}</Badge>;
  };

  // ============================================
  // Loading & Error States
  // ============================================

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Bookings Queue</CardTitle>
          <CardDescription>Loading pending multi-unit bookings...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Bookings Queue</CardTitle>
          <CardDescription className="text-destructive">
            Error loading bookings: {error.message}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pending Bookings Queue</CardTitle>
            <CardDescription>
              {filteredBookings?.length || 0} pending multi-unit bookings
              {filters.urgencyLevel !== 'all' && ` (${formatUrgencyLevel(filters.urgencyLevel)} priority)`}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            Auto-refresh: 30s
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference or guest name..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="pl-10"
            />
          </div>

          {/* Urgency Filter */}
          <Select
            value={filters.urgencyLevel}
            onValueChange={(value) =>
              setFilters({ ...filters, urgencyLevel: value as QueueFilters['urgencyLevel'] })
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <Select
            value={filters.dateRange}
            onValueChange={(value) =>
              setFilters({ ...filters, dateRange: value as QueueFilters['dateRange'] })
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Check-in Today</SelectItem>
              <SelectItem value="week">Next 7 Days</SelectItem>
              <SelectItem value="month">Next 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Queue Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Urgency</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No pending bookings found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings?.map((booking) => (
                  <TableRow key={booking.booking_id}>
                    <TableCell>
                      {getUrgencyBadge(booking.urgency_level, booking.urgency_score)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {booking.booking_reference}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{booking.guest_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {booking.guest_contact}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(booking.check_in_date)}</TableCell>
                    <TableCell className="text-center">{booking.requested_unit_count}</TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(booking.total_amount)}
                    </TableCell>
                    <TableCell>{getPaymentBadge(booking.payment_status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(booking.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() =>
                          (window.location.href = `/admin/assign-units/${booking.booking_id}`)
                        }
                      >
                        Assign Units
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Verification

```bash
# Type check
npm run type-check

# Should show no errors in PendingBookingsQueue.tsx
```

**Expected**: Component compiles without errors

---

## Step 3: Create Admin API Endpoint (20 minutes)

Create the Cloudflare Worker endpoint for fetching pending bookings.

### Create File: `functions/api/admin/pending-bookings.ts`

```bash
mkdir -p functions/api/admin
touch functions/api/admin/pending-bookings.ts
```

### Copy Complete Endpoint Code

```typescript
/**
 * Admin API: Pending Bookings Queue
 *
 * GET /api/admin/pending-bookings
 *
 * Fetches all pending multi-unit bookings with urgency scoring
 *
 * Authentication: JWT required (admin role)
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 150-167
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { calculateUrgencyScore, getUrgencyLevel } from "../../../src/lib/urgency-scoring";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================
// Main Handler
// ============================================

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ============================================
    // Authentication Check
    // ============================================
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - Missing or invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);

    // Create Supabase client with service role
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    // Verify JWT and extract user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role (assuming role stored in user metadata)
    const userRole = user.user_metadata?.role || user.app_metadata?.role;
    if (userRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // Fetch Pending Bookings
    // ============================================
    const { data: bookings, error: queryError } = await supabase
      .from("bookings")
      .select(
        `
        booking_id,
        booking_reference,
        guest_name,
        guest_contact,
        check_in_date,
        check_out_date,
        total_amount,
        payment_status,
        created_at,
        guest_booking_unit_requests (
          id,
          guests_per_unit
        )
      `
      )
      .eq("is_multi_unit", true)
      .eq("is_guest_booking", true)
      .eq("unit_assignment_status", "pending")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Database query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bookings", details: queryError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // Apply Urgency Scoring
    // ============================================
    const bookingsWithUrgency = (bookings || []).map((booking) => {
      const requested_unit_count = booking.guest_booking_unit_requests?.length || 0;

      const urgency_score = calculateUrgencyScore({
        check_in_date: booking.check_in_date,
        created_at: booking.created_at,
        total_amount: booking.total_amount,
        requested_unit_count,
      });

      const urgency_level = getUrgencyLevel(urgency_score);

      return {
        booking_id: booking.booking_id,
        booking_reference: booking.booking_reference,
        guest_name: booking.guest_name,
        guest_contact: booking.guest_contact,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        requested_unit_count,
        total_amount: booking.total_amount,
        payment_status: booking.payment_status,
        urgency_score,
        urgency_level,
        created_at: booking.created_at,
      };
    });

    // Sort by urgency score (highest first)
    bookingsWithUrgency.sort((a, b) => b.urgency_score - a.urgency_score);

    // ============================================
    // Return Response
    // ============================================
    return new Response(
      JSON.stringify({
        bookings: bookingsWithUrgency,
        count: bookingsWithUrgency.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
```

### Verification

Test the endpoint locally (if Wrangler dev running):

```bash
# Start local dev server (if not running)
npm run dev

# In another terminal, test endpoint
curl http://localhost:5173/api/admin/pending-bookings \
  -H "Authorization: Bearer YOUR_TEST_JWT_TOKEN"

# Expected: JSON response with bookings array and count
```

**Expected**: Returns JSON with `bookings` array and `count` field

---

## Step 4: Create Routes and Navigation (10 minutes)

### Create Admin Queue Route

Create file: `src/routes/admin/queue.tsx`

```bash
mkdir -p src/routes/admin
touch src/routes/admin/queue.tsx
```

```typescript
/**
 * Admin Queue Route
 *
 * Route: /admin/queue
 * Displays pending multi-unit bookings queue
 */

import { createFileRoute } from '@tanstack/react-router';
import { PendingBookingsQueue } from '@/components/admin/PendingBookingsQueue';

export const Route = createFileRoute('/admin/queue')({
  component: AdminQueuePage,
  beforeLoad: async ({ context }) => {
    // Authentication guard
    const { auth } = context;
    if (!auth.isAuthenticated || auth.user?.role !== 'admin') {
      throw new Error('Admin access required');
    }
  },
});

function AdminQueuePage() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Booking Queue</h1>
        <p className="text-muted-foreground">
          Manage pending multi-unit booking requests
        </p>
      </div>

      <PendingBookingsQueue />
    </div>
  );
}
```

### Update Admin Navigation

Find your admin sidebar/header component (e.g., `src/components/navigation/AdminSidebar.tsx`) and add:

```typescript
// Add to navigation links array
{
  href: '/admin/queue',
  label: 'Booking Queue',
  icon: ListChecks, // Import from lucide-react
}
```

**Note**: The exact file path depends on your existing navigation structure. Look for admin navigation components in `src/components/navigation/` or `src/components/layout/`.

---

## Step 5: Testing and Verification (15 minutes)

### Manual Testing

```bash
# 1. Start development server
npm run dev

# 2. Open browser to http://localhost:5173/admin/queue
# 3. Log in as admin user
# 4. Verify queue displays (may be empty if no test bookings)
```

### Create Test Booking (if queue empty)

Use Supabase SQL Editor to insert a test booking:

```sql
-- Insert test booking
INSERT INTO bookings (
  booking_reference,
  guest_name,
  guest_contact,
  check_in_date,
  check_out_date,
  total_amount,
  payment_status,
  is_multi_unit,
  is_guest_booking,
  requested_unit_count,
  unit_assignment_status
) VALUES (
  'TEST-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)),
  'Test Guest',
  '+63 917 123 4567',
  CURRENT_DATE + INTERVAL '2 days',
  CURRENT_DATE + INTERVAL '5 days',
  35000,
  'Pending',
  TRUE,
  TRUE,
  3,
  'pending'
) RETURNING booking_id;

-- Insert unit requests (3 units)
INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
SELECT booking_id, 2 FROM bookings WHERE booking_reference LIKE 'TEST-%' ORDER BY created_at DESC LIMIT 1
UNION ALL
SELECT booking_id, 3 FROM bookings WHERE booking_reference LIKE 'TEST-%' ORDER BY created_at DESC LIMIT 1
UNION ALL
SELECT booking_id, 2 FROM bookings WHERE booking_reference LIKE 'TEST-%' ORDER BY created_at DESC LIMIT 1;
```

Refresh the queue - you should see the test booking with urgency badge.

### Visual Checks

Verify in browser:

- [ ] Queue table displays test booking
- [ ] Urgency badge shows correct color (should be "High" or "Critical" for 2-day check-in)
- [ ] Search filter works (type "TEST")
- [ ] Urgency filter works (select "High")
- [ ] Date range filter works (select "Next 7 Days")
- [ ] Queue auto-refreshes (watch for 30s, check React Query DevTools)
- [ ] Mobile responsive (resize browser to 375px width)
- [ ] "Assign Units" button clickable (may 404 until chunk 013)

### Type Check

```bash
npm run type-check
```

**Expected**: No errors

### Lint Check

```bash
npm run lint
```

**Expected**: No warnings

---

## Done! ✅

You've successfully implemented chunk 011!

### What You Built

- ✅ Urgency scoring utility (`src/lib/urgency-scoring.ts`)
- ✅ Pending bookings queue component (`src/components/admin/PendingBookingsQueue.tsx`)
- ✅ Admin API endpoint (`functions/api/admin/pending-bookings.ts`)
- ✅ Admin queue route (`src/routes/admin/queue.tsx`)
- ✅ Navigation link to queue

### Next Steps

1. **Run checkpoint.md** - Verify all automated and manual checks pass
2. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat: complete chunk 011-admin-queue-urgency-scoring"
   ```
3. **Move to Chunk 012** - Payment Verification UI (requires this chunk to select bookings)

---

**Need help?** Check `troubleshooting.md` for common issues.
