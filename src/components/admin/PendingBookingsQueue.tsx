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

import { useState } from "react";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { multiUnitBookingKeys } from "@/lib/query-keys";
import { supabaseAuth } from "@/lib/supabase";
import { formatUrgencyLevel, type UrgencyLevel } from "@/lib/urgency-scoring";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";

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
  payment_status: "Pending" | "Verified" | "Rejected";
  urgency_score: number;
  urgency_level: UrgencyLevel;
  created_at: string;
}

interface QueueFilters {
  searchQuery: string;
  urgencyLevel: UrgencyLevel | "all";
  dateRange: "all" | "today" | "week" | "month";
}

// ============================================
// Component
// ============================================

const pendingBookingsQuery = queryOptions({
  queryKey: multiUnitBookingKeys.pending,
  queryFn: async () => {
    // Get current session token for authentication
    const {
      data: { session },
    } = await supabaseAuth.getSession();

    const response = await fetch("/api/admin/pending-bookings", {
      headers: {
        ...(session?.access_token && {
          Authorization: `Bearer ${session.access_token}`,
        }),
      },
    });

    if (!response.ok) {
      // Parse the error response for more details
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
      };
      const errorMessage = errorData.error || "Failed to fetch pending bookings";
      const hint = errorData.hint || "";
      throw new Error(hint ? `${errorMessage}. ${hint}` : errorMessage);
    }

    const data = (await response.json()) as { bookings: PendingBooking[] };
    return data.bookings;
  },
  refetchInterval: 30000, // Refresh every 30s
  staleTime: 25000, // Consider stale after 25s
});

export function PendingBookingsQueue() {
  const [filters, setFilters] = useState<QueueFilters>({
    searchQuery: "",
    urgencyLevel: "all",
    dateRange: "all",
  });

  // Fetch pending bookings with urgency scoring
  const { data: bookings, isLoading, error } = useQuery(pendingBookingsQuery);

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
    if (filters.urgencyLevel !== "all" && booking.urgency_level !== filters.urgencyLevel) {
      return false;
    }

    // Date range filter (check-in date)
    if (filters.dateRange !== "all") {
      const checkIn = new Date(booking.check_in_date);
      const now = new Date();

      if (filters.dateRange === "today") {
        const isToday = checkIn.toDateString() === now.toDateString();
        if (!isToday) return false;
      } else if (filters.dateRange === "week") {
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (checkIn > weekFromNow) return false;
      } else if (filters.dateRange === "month") {
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
    const variantMap: Record<UrgencyLevel, "destructive" | "warning" | "default" | "secondary"> = {
      critical: "destructive",
      high: "warning",
      medium: "default",
      low: "secondary",
    };

    return (
      <div className="flex items-center gap-2">
        <Badge variant={variantMap[level]}>{formatUrgencyLevel(level)}</Badge>
        <span className="text-muted-foreground font-mono text-sm">{score}</span>
      </div>
    );
  };

  const getPaymentBadge = (status: PendingBooking["payment_status"]) => {
    const variantMap = {
      Verified: "default" as const,
      Pending: "secondary" as const,
      Rejected: "destructive" as const,
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
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isMigrationError = error.message.includes("not yet configured");
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Bookings Queue</CardTitle>
          <CardDescription
            className={isMigrationError ? "text-muted-foreground" : "text-destructive"}
          >
            {isMigrationError
              ? "Multi-unit booking feature is not yet available."
              : `Error loading bookings: ${error.message}`}
          </CardDescription>
        </CardHeader>
        {isMigrationError && (
          <CardContent>
            <p className="text-muted-foreground text-sm">
              This feature requires a database migration. Contact the system administrator if you
              believe this should be enabled.
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <Card data-testid="pending-bookings-queue">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pending Bookings Queue</CardTitle>
            <CardDescription>
              {filteredBookings?.length || 0} pending multi-unit bookings
              {filters.urgencyLevel !== "all" &&
                ` (${formatUrgencyLevel(filters.urgencyLevel)} priority)`}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            Auto-refresh: 30s
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter Controls */}
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
              setFilters({ ...filters, urgencyLevel: value as QueueFilters["urgencyLevel"] })
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
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
              setFilters({ ...filters, dateRange: value as QueueFilters["dateRange"] })
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
                <TableHead>Cabins</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                    No pending bookings found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings?.map((booking) => (
                  <TableRow key={booking.booking_id}>
                    <TableCell>
                      {getUrgencyBadge(booking.urgency_level, booking.urgency_score)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{booking.booking_reference}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{booking.guest_name}</span>
                        <span className="text-muted-foreground text-xs">
                          {booking.guest_contact}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(new Date(booking.check_in_date))}</TableCell>
                    <TableCell className="text-center">{booking.requested_unit_count}</TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(booking.total_amount)}
                    </TableCell>
                    <TableCell>{getPaymentBadge(booking.payment_status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatRelativeTime(booking.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        title={
                          booking.payment_status === "Verified"
                            ? "Proceed to assign specific units for this booking"
                            : "Review payment proof and verify or reject payment"
                        }
                        onClick={() => {
                          // If payment verified, go to assignment; otherwise, review payment first
                          if (booking.payment_status === "Verified") {
                            // Navigate to unit assignment
                            window.location.href = `/admin/bookings/${booking.booking_id}/assign-units`;
                          } else {
                            // Navigate to payment review page
                            window.location.href = `/admin/verify-payment/${booking.booking_id}`;
                          }
                        }}
                      >
                        {booking.payment_status === "Verified" ? "Assign Cabins" : "Review Payment"}
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
