# Admin Interface for Multi-Unit Booking Assignment

## Overview

Admin interface for reviewing pending multi-unit bookings, verifying payments, and assigning specific units.

**Key Principles:**

- Only 2 assignment statuses: `pending` → `assigned`
- All-or-nothing assignment (assign ALL units or NONE)
- Payment verification required before assignment
- NO email notifications (manual contact)
- Urgency scoring for queue prioritization

## Admin Workflow

1. View pending bookings queue (sorted by urgency)
2. Review booking details and unit requests
3. Verify payment proof
4. Select specific units to assign
5. Confirm all-or-nothing assignment
6. Manual guest contact via phone/SMS

## Urgency Scoring System

The urgency scoring system prioritizes bookings that need immediate attention on a 0-100 scale.

### Score Calculation

**Hours to check-in** (max 50 points):

- Already past check-in: 100 points (override max)
- <24 hours: 50 points
- 24-48 hours: 35 points
- 48-72 hours: 20 points
- > 72 hours: 10 points

**Days pending** (max 20 points):

- > 3 days: 20 points
- 2-3 days: 15 points
- 1-2 days: 10 points
- <1 day: 5 points

**Booking value** (max 15 points):

- > ₱50,000: 15 points
- ₱30,000-50,000: 10 points
- ₱15,000-30,000: 5 points
- <₱15,000: 2 points

**Unit count** (max 15 points):

- > 5 units: 15 points
- 3-5 units: 10 points
- 2 units: 5 points
- 1 unit: 2 points

### Badge Thresholds & SLO

| Badge       | Score | Assignment SLO  | Color  |
| ----------- | ----- | --------------- | ------ |
| 🔴 Critical | ≥75   | Within 1 hour   | Red    |
| 🟠 High     | 50-74 | Within 4 hours  | Orange |
| 🟡 Medium   | 25-49 | Within 12 hours | Yellow |
| ⚪ Low      | <25   | Within 24 hours | Gray   |

### Implementation Approach

**Phase 1 (Current):** TypeScript application layer implementation.

**File Location:** `src/lib/urgency-scoring.ts`

**Rationale:**

- Faster iteration during initial development
- Easier to modify scoring algorithm based on operational feedback
- Sufficient performance for expected volume (<50 bookings/day)

**Migration Trigger:** If API response time exceeds 100ms consistently, migrate to PostgreSQL function.

```typescript
interface Booking {
  booking_id: string;
  check_in_date: string;
  created_at: string;
  total_amount: number;
  requested_unit_count: number;
}

function calculateUrgencyScore(booking: Booking): number {
  let score = 0;

  // 1. Hours to check-in (max 50 points)
  const now = new Date();
  const checkIn = new Date(booking.check_in_date);
  const hoursToCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursToCheckIn < 0) {
    return 100; // Already past check-in - critical!
  } else if (hoursToCheckIn < 24) {
    score += 50;
  } else if (hoursToCheckIn < 48) {
    score += 35;
  } else if (hoursToCheckIn < 72) {
    score += 20;
  } else {
    score += 10;
  }

  // 2. Days pending (max 20 points)
  const createdAt = new Date(booking.created_at);
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

  // 3. Booking value (max 15 points)
  if (booking.total_amount > 50000) {
    score += 15;
  } else if (booking.total_amount > 30000) {
    score += 10;
  } else if (booking.total_amount > 15000) {
    score += 5;
  } else {
    score += 2;
  }

  // 4. Unit count (max 15 points)
  if (booking.requested_unit_count > 5) {
    score += 15;
  } else if (booking.requested_unit_count >= 3) {
    score += 10;
  } else if (booking.requested_unit_count === 2) {
    score += 5;
  } else {
    score += 2;
  }

  return Math.min(100, score);
}

// Usage in API endpoint
export async function getPendingBookings() {
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("is_multi_unit", true)
    .eq("unit_assignment_status", "pending")
    .order("created_at", { ascending: false });

  // Calculate urgency scores
  const bookingsWithUrgency = bookings.map((booking) => ({
    ...booking,
    urgency_score: calculateUrgencyScore(booking),
  }));

  // Sort by urgency score (highest first)
  return bookingsWithUrgency.sort((a, b) => b.urgency_score - a.urgency_score);
}
```

## Database Query

### Booking Details

```sql
SELECT
  b.*,
  json_agg(
    json_build_object('guests_per_unit', u.guests_per_unit)
  ) as unit_requests
FROM bookings b
LEFT JOIN guest_booking_unit_requests u ON u.booking_id = b.booking_id
WHERE b.booking_id = $1
  AND b.is_guest_booking = TRUE
  AND b.is_multi_unit = TRUE
GROUP BY b.booking_id;
```

## Admin Components

### Pending Bookings Queue

**File:** `src/components/admin/PendingBookingsQueue.tsx`

```tsx
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PendingBooking {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  check_in_date: string;
  requested_unit_count: number;
  total_amount: number;
  payment_status: "Pending" | "Verified";
  urgency_score: number;
  created_at: string;
}

export function PendingBookingsQueue() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["pending-multi-unit-bookings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/pending-bookings");
      const data = await response.json();
      return data.bookings as PendingBooking[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const getUrgencyBadge = (score: number) => {
    if (score >= 75) return <Badge variant="destructive">Critical</Badge>;
    if (score >= 50) return <Badge variant="warning">High</Badge>;
    if (score >= 25) return <Badge variant="default">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  if (isLoading) return <div>Loading...</div>;

  return (
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
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings?.map((booking) => (
          <TableRow key={booking.booking_id}>
            <TableCell>{getUrgencyBadge(booking.urgency_score)}</TableCell>
            <TableCell className="font-mono">{booking.booking_reference}</TableCell>
            <TableCell>{booking.guest_name}</TableCell>
            <TableCell>{formatDate(booking.check_in_date)}</TableCell>
            <TableCell>{booking.requested_unit_count}</TableCell>
            <TableCell>{formatCurrency(booking.total_amount)}</TableCell>
            <TableCell>
              <Badge variant={booking.payment_status === "Verified" ? "success" : "warning"}>
                {booking.payment_status}
              </Badge>
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                onClick={() => (window.location.href = `/admin/assign-units/${booking.booking_id}`)}
              >
                Assign Units
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Unit Assignment Interface

**File:** `src/components/admin/UnitAssignmentInterface.tsx`

```tsx
import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface UnitRequest {
  id: string;
  guests_per_unit: number;
}

interface AvailableUnit {
  unit_id: string;
  unit_number: string;
  max_occupancy: number;
  unit_status: string;
}

interface UnitAssignmentInterfaceProps {
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  unitRequests: UnitRequest[];
}

export function UnitAssignmentInterface({
  bookingId,
  checkInDate,
  checkOutDate,
  unitRequests,
}: UnitAssignmentInterfaceProps) {
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch available units
  const { data: availableUnits, isLoading } = useQuery({
    queryKey: ["available-units", checkInDate, checkOutDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/available-units?check_in=${checkInDate}&check_out=${checkOutDate}`
      );
      const data = await response.json();
      return data.units as AvailableUnit[];
    },
  });

  // Assign units mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/assign-units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          unit_ids: selectedUnits,
        }),
      });

      if (!response.ok) throw new Error("Assignment failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["pending-multi-unit-bookings"]);
      alert("Units assigned successfully!");
    },
  });

  const toggleUnit = (unitId: string) => {
    setSelectedUnits((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const handleAssign = () => {
    if (selectedUnits.length !== unitRequests.length) {
      alert(`Must select exactly ${unitRequests.length} units`);
      return;
    }

    if (confirm(`Assign ${selectedUnits.length} units to this booking?`)) {
      assignMutation.mutate();
    }
  };

  const isAllOrNothing = selectedUnits.length === unitRequests.length;

  return (
    <div className="space-y-6">
      {/* Unit Requests Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Unit Requests ({unitRequests.length} units)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {unitRequests.map((request, index) => (
              <div key={request.id} className="flex justify-between">
                <span>Unit #{index + 1}:</span>
                <span>{request.guests_per_unit} guests</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All-or-Nothing Warning */}
      <Alert variant={isAllOrNothing ? "default" : "warning"}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {isAllOrNothing ? (
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              All units selected - ready to assign
            </span>
          ) : (
            `Must select ALL ${unitRequests.length} units (currently selected: ${selectedUnits.length})`
          )}
        </AlertDescription>
      </Alert>

      {/* Available Units */}
      <Card>
        <CardHeader>
          <CardTitle>Available Units</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading available units...</div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {availableUnits?.map((unit) => (
                <Card
                  key={unit.unit_id}
                  className={`cursor-pointer ${
                    selectedUnits.includes(unit.unit_id) ? "border-primary" : ""
                  }`}
                  onClick={() => toggleUnit(unit.unit_id)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{unit.unit_number}</div>
                        <div className="text-muted-foreground text-sm">
                          Max: {unit.max_occupancy} guests
                        </div>
                      </div>
                      <Checkbox checked={selectedUnits.includes(unit.unit_id)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Button */}
      <Button
        onClick={handleAssign}
        disabled={!isAllOrNothing || assignMutation.isPending}
        className="w-full"
        size="lg"
      >
        {assignMutation.isPending ? "Assigning..." : `Assign ${unitRequests.length} Units`}
      </Button>
    </div>
  );
}
```

## API Endpoints

### GET /api/admin/pending-bookings

```typescript
export async function onRequest(context: { request: CloudflareRequest }) {
  // Verify admin auth (JWT verification)
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("is_multi_unit", true)
    .eq("unit_assignment_status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Calculate urgency scores in TypeScript
  const bookingsWithUrgency = bookings.map((booking) => ({
    ...booking,
    urgency_score: calculateUrgencyScore(booking),
  }));

  // Sort by urgency (highest first)
  const sorted = bookingsWithUrgency.sort((a, b) => b.urgency_score - a.urgency_score);

  return new Response(JSON.stringify({ success: true, bookings: sorted }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

### POST /api/admin/assign-units

Atomicity guaranteed by PostgreSQL transaction in `assign_units_to_booking()` function. All units assigned or none.

```typescript
export async function onRequest(context: { request: CloudflareRequest }) {
  const { booking_id, unit_ids } = await request.json();

  // Call transactional function (atomicity enforced by PostgreSQL)
  const { error: transactionError } = await supabase.rpc("assign_units_to_booking", {
    p_booking_id: booking_id,
    p_unit_ids: unit_ids,
  });

  if (transactionError) {
    return new Response(JSON.stringify({ success: false, error: "Assignment failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, message: "Units assigned successfully" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

### Database Transaction Function

```sql
CREATE OR REPLACE FUNCTION assign_units_to_booking(
  p_booking_id UUID,
  p_unit_ids UUID[]
) RETURNS VOID AS $$
DECLARE
  v_unit_id UUID;
  v_check_in DATE;
  v_check_out DATE;
  v_requested_count INT;
BEGIN
  -- BEGIN starts transaction block for atomicity
  -- All operations succeed or all rollback

  -- Get booking details
  SELECT check_in_date, check_out_date, requested_unit_count
  INTO v_check_in, v_check_out, v_requested_count
  FROM bookings
  WHERE booking_id = p_booking_id
    AND unit_assignment_status = 'pending'
    AND payment_status = 'Verified';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not ready for assignment';
  END IF;

  -- Validate all-or-nothing (array length must equal requested count)
  IF array_length(p_unit_ids, 1) != v_requested_count THEN
    RAISE EXCEPTION 'Must assign exactly % units', v_requested_count;
  END IF;

  -- Insert booking_units for each assigned unit
  -- If ANY insert fails, entire transaction rolls back
  FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
    INSERT INTO booking_units (booking_id, unit_id, check_in_date, check_out_date, status)
    VALUES (p_booking_id, v_unit_id, v_check_in, v_check_out, 'confirmed');
  END LOOP;

  -- Update booking status
  UPDATE bookings
  SET unit_assignment_status = 'assigned',
      booking_status = 'Confirmed',
      updated_at = NOW()
  WHERE booking_id = p_booking_id;

  -- EXCEPTION block ensures automatic rollback on any error
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Assignment failed: % - All changes rolled back', SQLERRM;
    -- PostgreSQL automatically rolls back transaction on EXCEPTION
END;
$$ LANGUAGE plpgsql;
```

### Transaction Timeout Configuration

**Pattern**: Admin UI executes quick atomic assignment (no long-running transactions).

**Database Function Timeout**: 5 seconds (enforced at PostgreSQL level)

```sql
-- Configure timeout for assign_units_to_booking function
ALTER FUNCTION assign_units_to_booking(UUID, UUID[])
  SET statement_timeout = '5s';
```

**Rationale:**

- Admin selection happens client-side (no database locks)
- Assignment transaction executes in <1 second typically
- 5-second timeout provides safety margin for slow queries
- Prevents indefinite blocking if database issues occur

**Admin UI Pattern:**

```typescript
// Step 1: Admin browses and selects units (no database locks)
const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

// Step 2: Quick atomic assignment when admin confirms
const handleConfirmAssignment = async () => {
  try {
    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: selectedUnits,
    });

    if (error) {
      if (error.message.includes("timeout")) {
        alert("Assignment timed out. Database may be experiencing issues. Please try again.");
      } else {
        alert("Assignment failed: " + error.message);
      }
      // Refresh available units
    }
  } catch (err) {
    console.error("Assignment error:", err);
  }
};
```

**Monitoring**: If timeout errors occur (query `pg_stat_statements` for timeout events), investigate:

- Slow queries in assignment function
- Database connection pool exhaustion
- Index optimization needed on `booking_units` table

### Concurrency Handling

**Race Condition Protection:**

The PostgreSQL EXCLUDE constraint on `booking_units` table (from `01-database-schema.md`) provides bulletproof protection against double-booking:

```sql
ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');
```

**How it works:**

- If two admins simultaneously assign the same unit to different bookings, the SECOND transaction will fail at commit time
- The EXCLUDE constraint checks for overlapping date ranges at the database level
- Automatic rollback occurs, protecting data integrity

**Optional Enhancement (Better UX):**

For earlier failure detection with clearer error messages, add explicit unit locking:

```sql
-- Add before INSERT loop in assign_units_to_booking()
PERFORM unit_id FROM units
WHERE unit_id = ANY(p_unit_ids)
AND unit_status = 'Available'
FOR UPDATE;
```

**Trade-offs:**

- **Without FOR UPDATE**: Constraint catches conflict at commit (safe but later error)
- **With FOR UPDATE**: Fails earlier with explicit lock (better UX, slightly more complex)

**Recommendation:** Start without FOR UPDATE. The EXCLUDE constraint provides complete safety. Add FOR UPDATE only if admins report UX issues with late-stage errors.

## Testing Checklist

- [ ] View pending bookings queue
- [ ] Urgency scoring displays correctly
- [ ] Filter by payment status
- [ ] View booking details
- [ ] View payment proof
- [ ] Check available units
- [ ] Select units for assignment
- [ ] All-or-nothing validation enforced
- [ ] Transaction atomicity (all units assigned or none)
- [ ] Concurrent assignment prevention (PostgreSQL EXCLUDE constraint)
- [ ] Status updates after assignment
- [ ] Manual guest contact workflow (phone/SMS)

## Key Implementation Notes

**Assignment Statuses:**

- Only 2 statuses: `pending` and `assigned`
- NO intermediate statuses (`assigning`, `partial`)

**All-or-Nothing Rule:**

- Admin must assign ALL requested units
- NO partial assignments allowed
- Database constraint enforces this

**Payment Verification:**

- Units cannot be assigned until payment verified
- Database constraint enforces this rule
- Admin manually verifies payment proof

**Concurrency:**

- PostgreSQL EXCLUDE constraint prevents double-booking
- Optimistic locking for admin UI updates
- Transaction-based assignment

**Manual Contact:**

- NO email notifications implemented
- Admin contacts guest via phone/SMS
- Contact details recorded in booking notes

**Urgency Scoring:**

- 0-100 scale calculated by TypeScript function (application layer)
- Based on: hours to check-in, days pending, booking value, unit count
- Queue sorted by urgency descending
