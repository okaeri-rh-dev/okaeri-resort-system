# Implementation Instructions: Chunk 013

## Overview

This guide provides step-by-step instructions for implementing the **Unit Assignment System** - the critical admin workflow for converting pending multi-unit bookings into confirmed reservations with assigned units.

**Estimated Time**: 125 minutes (includes 5 min prerequisites verification)

**Prerequisites**: Chunks 001-012 completed, PostgreSQL `btree_gist` extension enabled

---

## Step 0: Verify Prerequisites (5 minutes)

**CRITICAL**: Do not skip this step. Implementing chunk 013 without verified prerequisites will cause implementation failures and wasted debugging time.

### 0.1 Run Verification Commands (3 minutes)

Open the `README.md` file and navigate to the **"Verify Prerequisites"** section (lines 149-314). Run all 6 verification commands:

1. **Check 1**: Verify database tables exist (booking_units, guest_booking_unit_requests, pricing_config)
2. **Check 2**: Verify EXCLUDE constraint on booking_units
3. **Check 3**: Verify btree_gist extension enabled
4. **Check 4**: Verify unit_assignment_status column exists
5. **Check 5**: Verify payment verification UI component exists
6. **Check 6**: Verify audit logging system operational (optional)

**How to Run**:

```bash
# Copy each command from README.md lines 157-278 and run in terminal
# Example for Check 1:
npx supabase db execute "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('booking_units', 'guest_booking_unit_requests', 'pricing_config')
ORDER BY table_name;
"
```

**Time**: 3 minutes

---

### 0.2 Interpret Results (2 minutes)

Compare your output with the expected output documented in README.md for each check.

**Decision Matrix**:

| Result                                        | Action                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| ✅ All 6 checks pass                          | Proceed to Step 1                                                           |
| ❌ Check 1 fails (tables missing)             | Complete **Chunk 001** first                                                |
| ❌ Check 2 fails (EXCLUDE constraint missing) | Complete **Chunk 003** first                                                |
| ❌ Check 3 fails (btree_gist not enabled)     | Run: `npx supabase db execute "CREATE EXTENSION btree_gist;"` then re-check |
| ❌ Check 4 fails (column missing)             | Complete **Chunk 001** first                                                |
| ❌ Check 5 fails (component missing)          | Complete **Chunk 012** first                                                |
| ❌ Check 6 fails (audit logs missing)         | Optional - you can proceed, add TODO to implement audit logging later       |

**Common Prerequisites Issues**:

**Issue**: Check 1 fails - Tables do not exist

- **Cause**: Chunk 001 (Database Schema Setup) not completed
- **Solution**: Complete chunk 001 before proceeding with chunk 013
- **Impact**: Step 1 will fail when creating PostgreSQL function (cannot reference non-existent tables)

**Issue**: Check 2 fails - EXCLUDE constraint missing

- **Cause**: Chunk 003 (Security, RLS, and Constraints) not completed
- **Solution**: Complete chunk 003 before proceeding
- **Impact**: System will allow double-booking of units (CRITICAL BUG)

**Issue**: Check 3 fails - btree_gist extension not enabled

- **Cause**: Extension not installed (one-time setup)
- **Solution**: Run `npx supabase db execute "CREATE EXTENSION btree_gist;"`
- **Impact**: EXCLUDE constraint cannot be created (double-booking prevention won't work)

**Issue**: Check 4 fails - unit_assignment_status column missing

- **Cause**: Chunk 001 migration not applied completely
- **Solution**: Re-run chunk 001 migrations
- **Impact**: Cannot track assignment status (booking workflow broken)

**Issue**: Check 5 fails - Payment verification component missing

- **Cause**: Chunk 012 (Payment Verification UI) not completed
- **Solution**: Complete chunk 012 first
- **Impact**: Cannot verify payments before assignment (workflow incomplete)

**Issue**: Check 6 fails - Audit logs not set up

- **Cause**: Audit logging system not implemented yet
- **Solution**: You can proceed with chunk 013, but add a TODO to implement audit logging
- **Impact**: No audit trail for unit assignments (non-critical for development)

**Time**: 2 minutes

---

### 0.3 Document Verification Status

Record your verification results:

```markdown
## Prerequisites Verification Results

Date: **\*\***\_\_\_**\*\***
Verified by: **\*\***\_\_\_**\*\***

- [ ] Check 1: Database tables exist (PASS/FAIL)
- [ ] Check 2: EXCLUDE constraint configured (PASS/FAIL)
- [ ] Check 3: btree_gist extension enabled (PASS/FAIL)
- [ ] Check 4: unit_assignment_status column exists (PASS/FAIL)
- [ ] Check 5: Payment verification UI exists (PASS/FAIL)
- [ ] Check 6: Audit logging operational (PASS/FAIL - optional)

**Overall Status**: READY / NOT READY

**Issues Encountered**: [List any failed checks and resolution steps taken]
```

**Checkpoint**: ✅ All prerequisites verified (or documented as optional)

**If NOT READY**: Stop here. Complete missing prerequisites before continuing to Step 1.

**If READY**: Proceed to Step 1 with confidence that all dependencies are in place.

---

## Step 1: Create PostgreSQL Assignment Function (25 minutes)

### 1.1 Create Migration File

```bash
# Create migration file with timestamp
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_assign_units_function.sql
```

**Time**: 1 minute

### 1.2 Write PostgreSQL Function

Open the migration file and add the following function:

```sql
-- ============================================================================
-- Function: assign_units_to_booking
-- Purpose: Atomically assign units to a multi-unit booking
-- Guarantees: All-or-nothing (all units assigned or none)
-- Security: Payment verification required, prevents double-booking
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_units_to_booking(
  p_booking_id UUID,
  p_unit_ids UUID[]
) RETURNS VOID AS $$
DECLARE
  v_unit_id UUID;
  v_check_in DATE;
  v_check_out DATE;
  v_requested_count INT;
  v_payment_status TEXT;
BEGIN
  -- ============================================================================
  -- STEP 1: Validate Booking Eligibility
  -- ============================================================================

  -- Fetch booking details and validate state
  SELECT
    check_in_date,
    check_out_date,
    (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE booking_id = p_booking_id),
    payment_status
  INTO
    v_check_in,
    v_check_out,
    v_requested_count,
    v_payment_status
  FROM bookings
  WHERE booking_id = p_booking_id
    AND unit_assignment_status = 'pending';

  -- Check if booking exists and is in valid state
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found or not in pending state', p_booking_id;
  END IF;

  -- Enforce payment-before-assignment rule
  IF v_payment_status != 'Verified' THEN
    RAISE EXCEPTION 'Payment must be verified before unit assignment. Current status: %', v_payment_status;
  END IF;

  -- ============================================================================
  -- STEP 2: Validate All-or-Nothing Rule
  -- ============================================================================

  -- Array length must exactly match requested unit count
  IF array_length(p_unit_ids, 1) != v_requested_count THEN
    RAISE EXCEPTION 'All-or-nothing violation: Must assign exactly % units (received % units)',
      v_requested_count,
      array_length(p_unit_ids, 1);
  END IF;

  -- ============================================================================
  -- STEP 3: Assign Units (Atomic Loop)
  -- ============================================================================

  -- Insert booking_units for each assigned unit
  -- If ANY insert fails (e.g., EXCLUDE constraint violation), entire transaction rolls back
  FOREACH v_unit_id IN ARRAY p_unit_ids LOOP
    INSERT INTO booking_units (
      booking_id,
      unit_id,
      check_in_date,
      check_out_date,
      status
    )
    VALUES (
      p_booking_id,
      v_unit_id,
      v_check_in,
      v_check_out,
      'confirmed'
    );
    -- Note: EXCLUDE constraint on booking_units prevents double-booking
    -- If this unit is already booked for overlapping dates, INSERT will fail
    -- and trigger EXCEPTION block below
  END LOOP;

  -- ============================================================================
  -- STEP 4: Update Booking Status
  -- ============================================================================

  -- Mark booking as confirmed and assigned
  UPDATE bookings
  SET
    unit_assignment_status = 'assigned',
    booking_status = 'Confirmed',
    updated_at = NOW()
  WHERE booking_id = p_booking_id;

  -- Success: Transaction commits automatically

EXCEPTION
  -- ============================================================================
  -- AUTOMATIC ROLLBACK: All changes are undone on any error
  -- ============================================================================
  WHEN OTHERS THEN
    -- Log error details
    RAISE EXCEPTION 'Unit assignment failed for booking %: % - All changes rolled back',
      p_booking_id,
      SQLERRM;
    -- PostgreSQL automatically rolls back transaction on EXCEPTION
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Configure Statement Timeout (Safety Measure)
-- ============================================================================

-- Prevent long-running transactions that could block other operations
ALTER FUNCTION assign_units_to_booking(UUID, UUID[])
  SET statement_timeout = '5s';

-- ============================================================================
-- Grant Execute Permission to Authenticated Users
-- ============================================================================

-- Admin users will call this via Supabase RPC
GRANT EXECUTE ON FUNCTION assign_units_to_booking(UUID, UUID[]) TO authenticated;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON FUNCTION assign_units_to_booking IS 'Atomically assigns units to a multi-unit booking. Enforces all-or-nothing rule and payment verification. Automatic rollback on any error.';
```

**Why this approach?**

- **EXCEPTION block**: Automatically rolls back ALL changes if ANY error occurs
- **FOREACH loop**: Inserts each unit individually, allowing EXCLUDE constraint to catch conflicts
- **Statement timeout**: Prevents indefinite blocking if database issues occur
- **Validation first**: Checks all conditions before making changes

**Time**: 20 minutes

### 1.3 Apply Migration

```bash
# Apply migration to local Supabase instance
npx supabase db push

# Verify function exists
npx supabase db execute "SELECT proname FROM pg_proc WHERE proname = 'assign_units_to_booking';"
```

**Expected Output**: Function name appears in result

**Time**: 2 minutes

### 1.4 Test Function Manually

```sql
-- Test with mock data (use Supabase SQL editor)

-- 1. Create test booking (if needed)
INSERT INTO bookings (
  booking_id,
  check_in_date,
  check_out_date,
  payment_status,
  unit_assignment_status
) VALUES (
  gen_random_uuid(),
  '2025-12-01',
  '2025-12-05',
  'Verified',
  'pending'
) RETURNING booking_id;

-- 2. Create unit requests (replace booking_id with above)
INSERT INTO guest_booking_unit_requests (booking_id, guests_per_unit)
VALUES
  ('YOUR_BOOKING_ID', 2),
  ('YOUR_BOOKING_ID', 3);

-- 3. Get available unit IDs
SELECT unit_id FROM units WHERE unit_status = 'Available' LIMIT 2;

-- 4. Call function (replace with actual UUIDs)
SELECT assign_units_to_booking(
  'YOUR_BOOKING_ID'::UUID,
  ARRAY['UNIT_ID_1'::UUID, 'UNIT_ID_2'::UUID]
);

-- 5. Verify assignment
SELECT * FROM booking_units WHERE booking_id = 'YOUR_BOOKING_ID';
SELECT booking_status, unit_assignment_status FROM bookings WHERE booking_id = 'YOUR_BOOKING_ID';
```

**Expected Results**:

- 2 rows in `booking_units` table
- `booking_status` = 'Confirmed'
- `unit_assignment_status` = 'assigned'

**Time**: 2 minutes

**Checkpoint**: PostgreSQL function created and tested ✅

---

## Step 2: Create Available Units API Endpoint (15 minutes)

### 2.1 Create API File

```bash
# Create API endpoint file
mkdir -p functions/api/admin
touch functions/api/admin/available-units.ts
```

**Time**: 1 minute

### 2.2 Write Endpoint Handler

Open `functions/api/admin/available-units.ts` and add:

```typescript
/**
 * GET /api/admin/available-units
 * Returns units available for a given date range (not booked/assigned)
 * Query params: check_in_date, check_out_date
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ========================================================================
    // STEP 1: Extract and Validate Query Parameters
    // ========================================================================

    const url = new URL(request.url);
    const check_in_date = url.searchParams.get("check_in_date");
    const check_out_date = url.searchParams.get("check_out_date");

    if (!check_in_date || !check_out_date) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters: check_in_date, check_out_date",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(check_in_date) || !dateRegex.test(check_out_date)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid date format. Use YYYY-MM-DD",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 2: Verify JWT Authentication
    // ========================================================================

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Initialize Supabase client with service role
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify JWT and get user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin role (check user metadata or profiles table)
    // TODO: Implement role checking based on your auth system
    // Example: if (user.user_metadata?.role !== 'admin') { return 403; }

    // ========================================================================
    // STEP 3: Query Available Units
    // ========================================================================

    // Get all units with status = 'Available'
    const { data: allUnits, error: unitsError } = await supabase
      .from("units")
      .select("unit_id, unit_name, unit_number, max_occupancy")
      .eq("unit_status", "Available")
      .order("unit_number");

    if (unitsError) {
      throw new Error(`Failed to fetch units: ${unitsError.message}`);
    }

    // Get booking_units that overlap with requested date range
    // Exclude constraint: daterange(check_in_date, check_out_date, '[]') WITH &&
    // This finds units that are BOOKED during the requested dates
    const { data: bookedUnits, error: bookedError } = await supabase
      .from("booking_units")
      .select("unit_id")
      .eq("status", "confirmed")
      .gte("check_out_date", check_in_date) // Checkout after or on check-in
      .lte("check_in_date", check_out_date); // Check-in before or on checkout

    if (bookedError) {
      throw new Error(`Failed to fetch booked units: ${bookedError.message}`);
    }

    // Extract booked unit IDs
    const bookedUnitIds = new Set(bookedUnits?.map((b) => b.unit_id) || []);

    // Filter out booked units from all units
    const availableUnits = allUnits?.filter((unit) => !bookedUnitIds.has(unit.unit_id)) || [];

    // ========================================================================
    // STEP 4: Return Available Units
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        available_units: availableUnits,
        count: availableUnits.length,
        date_range: {
          check_in: check_in_date,
          check_out: check_out_date,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[AVAILABLE_UNITS_ERROR]", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

**Key points**:

- **Date range overlap detection**: Uses `>=` and `<=` logic to find conflicts
- **Exclusion logic**: Returns units NOT in booked set
- **JWT verification**: Admin authentication required
- **CORS support**: Allows frontend to call endpoint

**Time**: 12 minutes

### 2.3 Test Endpoint

```bash
# Start dev server
npm run dev

# In another terminal, test endpoint
curl "http://localhost:5173/api/admin/available-units?check_in_date=2025-12-01&check_out_date=2025-12-05" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  | jq .
```

**Expected Output**:

```json
{
  "success": true,
  "available_units": [
    {
      "unit_id": "uuid-here",
      "unit_name": "Unit A",
      "unit_number": "101",
      "max_occupancy": 10
    }
  ],
  "count": 8,
  "date_range": {
    "check_in": "2025-12-01",
    "check_out": "2025-12-05"
  }
}
```

**Time**: 2 minutes

**Checkpoint**: Available units API endpoint created and tested ✅

---

## Step 3: Create Assign Units API Endpoint (20 minutes)

### 3.1 Create API File

```bash
touch functions/api/admin/assign-units.ts
```

**Time**: 1 minute

### 3.2 Write Endpoint Handler

Open `functions/api/admin/assign-units.ts` and add:

```typescript
/**
 * POST /api/admin/assign-units
 * Assigns units to a multi-unit booking atomically
 * Body: { booking_id: UUID, unit_ids: UUID[] }
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface AssignUnitsRequest {
  booking_id: string;
  unit_ids: string[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ========================================================================
    // STEP 1: Verify JWT Authentication
    // ========================================================================

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Verify admin role
    // if (user.user_metadata?.role !== 'admin') { return 403; }

    // ========================================================================
    // STEP 2: Parse and Validate Request Body
    // ========================================================================

    const body: AssignUnitsRequest = await request.json();
    const { booking_id, unit_ids } = body;

    if (!booking_id || !unit_ids || !Array.isArray(unit_ids)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing or invalid required fields: booking_id, unit_ids (array)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (unit_ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "unit_ids array cannot be empty",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 3: Call PostgreSQL Assignment Function
    // ========================================================================

    // The function handles:
    // - Payment verification check
    // - All-or-nothing validation
    // - Atomic insertion of booking_units
    // - Booking status update
    // - Automatic rollback on any error
    const { data, error: rpcError } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: booking_id,
      p_unit_ids: unit_ids,
    });

    if (rpcError) {
      // Parse error message for user-friendly response
      const errorMessage = rpcError.message || "Assignment failed";

      // Common error scenarios
      if (errorMessage.includes("Payment must be verified")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Payment not verified",
            details: "Payment must be verified before assigning units",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (errorMessage.includes("All-or-nothing violation")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "All-or-nothing violation",
            details: errorMessage,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (errorMessage.includes("not found or not in pending state")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Booking not eligible for assignment",
            details: "Booking may already be assigned or cancelled",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (errorMessage.includes("conflicting key value violates exclusion constraint")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Double-booking conflict",
            details: "One or more units are already booked for these dates",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generic error
      console.error("[ASSIGN_UNITS_RPC_ERROR]", rpcError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Assignment failed",
          details: errorMessage,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 4: Log Audit Event
    // ========================================================================

    // Log assignment action
    // TODO: Integrate with audit logging system
    // await logAuditEvent({
    //   action: 'units.assigned',
    //   entity_type: 'booking',
    //   entity_id: booking_id,
    //   user_id: user.id,
    //   metadata: {
    //     unit_ids,
    //     unit_count: unit_ids.length,
    //     admin_email: user.email,
    //   },
    // });

    // ========================================================================
    // STEP 5: Return Success Response
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        message: "Units assigned successfully",
        booking_id,
        assigned_unit_count: unit_ids.length,
        booking_status: "Confirmed",
        unit_assignment_status: "assigned",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[ASSIGN_UNITS_ERROR]", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

**Key points**:

- **Calls PostgreSQL function**: `assign_units_to_booking()` handles all logic
- **Error parsing**: Provides user-friendly messages for common errors
- **Conflict detection**: Returns 409 for double-booking (EXCLUDE constraint violation)
- **Audit logging**: Placeholder for audit trail integration

**Time**: 17 minutes

### 3.3 Test Endpoint

```bash
curl -X POST http://localhost:5173/api/admin/assign-units \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "YOUR_BOOKING_ID",
    "unit_ids": ["UNIT_ID_1", "UNIT_ID_2"]
  }' \
  | jq .
```

**Expected Output**:

```json
{
  "success": true,
  "message": "Units assigned successfully",
  "booking_id": "...",
  "assigned_unit_count": 2,
  "booking_status": "Confirmed",
  "unit_assignment_status": "assigned"
}
```

**Time**: 2 minutes

**Checkpoint**: Assign units API endpoint created and tested ✅

---

## Step 4: Create Unit Assignment UI Component (40 minutes)

### 4.1 Create Component File

```bash
mkdir -p src/components/admin
touch src/components/admin/UnitAssignmentInterface.tsx
```

**Time**: 1 minute

### 4.2 Write Component

Open `src/components/admin/UnitAssignmentInterface.tsx` and add:

```typescript
/**
 * UnitAssignmentInterface
 * Admin interface for assigning units to multi-unit bookings
 * Enforces all-or-nothing rule: must select ALL requested units
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface UnitRequest {
  id: string;
  guests_per_unit: number;
}

interface AvailableUnit {
  unit_id: string;
  unit_name: string;
  unit_number: string;
  max_occupancy: number;
}

interface UnitAssignmentInterfaceProps {
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  unitRequests: UnitRequest[];
  onAssignmentSuccess: () => void;
}

export function UnitAssignmentInterface({
  bookingId,
  checkInDate,
  checkOutDate,
  unitRequests,
  onAssignmentSuccess,
}: UnitAssignmentInterfaceProps) {
  const queryClient = useQueryClient();
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // ========================================================================
  // QUERY: Fetch Available Units
  // ========================================================================

  const { data: availableUnits, isLoading: isLoadingUnits } = useQuery<AvailableUnit[]>({
    queryKey: ["available-units", checkInDate, checkOutDate],
    queryFn: async () => {
      const token = ""; // TODO: Get from auth context
      const response = await fetch(
        `/api/admin/available-units?check_in_date=${checkInDate}&check_out_date=${checkOutDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch available units");
      }

      const data = await response.json();
      return data.available_units || [];
    },
  });

  // ========================================================================
  // MUTATION: Assign Units
  // ========================================================================

  const assignMutation = useMutation({
    mutationFn: async () => {
      const token = ""; // TODO: Get from auth context
      const response = await fetch("/api/admin/assign-units", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          unit_ids: selectedUnits,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || "Assignment failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-multi-unit-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      onAssignmentSuccess();
    },
  });

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const toggleUnit = (unitId: string) => {
    setSelectedUnits((prev) =>
      prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId]
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

  // ========================================================================
  // COMPUTED VALUES
  // ========================================================================

  const isAllOrNothing = selectedUnits.length === unitRequests.length;
  const totalGuestsRequested = unitRequests.reduce(
    (sum, req) => sum + req.guests_per_unit,
    0
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Unit Requests Summary */}
      <Card>
        <CardHeader>
          <CardTitle>
            Unit Requests ({unitRequests.length} units, {totalGuestsRequested} guests)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {unitRequests.map((request, index) => (
              <div key={request.id} className="flex justify-between border-b pb-2">
                <span className="font-medium">Unit #{index + 1}:</span>
                <span className="text-muted-foreground">
                  {request.guests_per_unit} guests
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All-or-Nothing Warning/Success */}
      <Alert variant={isAllOrNothing ? "default" : "destructive"}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {isAllOrNothing ? (
            <span className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              All units selected - ready to assign
            </span>
          ) : (
            <span className="text-red-600">
              Must select ALL {unitRequests.length} units (currently selected:{" "}
              {selectedUnits.length})
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Available Units Grid */}
      <Card>
        <CardHeader>
          <CardTitle>
            Available Units for {checkInDate} to {checkOutDate}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingUnits ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading available units...</span>
            </div>
          ) : availableUnits && availableUnits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableUnits.map((unit) => {
                const isSelected = selectedUnits.includes(unit.unit_id);
                return (
                  <Card
                    key={unit.unit_id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? "border-primary border-2 bg-primary/5" : ""
                    }`}
                    onClick={() => toggleUnit(unit.unit_id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-lg">
                            {unit.unit_number}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {unit.unit_name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Max: {unit.max_occupancy} guests
                          </div>
                        </div>
                        <Checkbox checked={isSelected} readOnly />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No units available for this date range
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
        {assignMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Assigning...
          </>
        ) : (
          `Assign ${unitRequests.length} Units`
        )}
      </Button>

      {/* Error Display */}
      {assignMutation.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {assignMutation.error instanceof Error
              ? assignMutation.error.message
              : "Assignment failed. Please try again."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

**Key features**:

- **All-or-nothing UI**: Visual indicator (red/green alert) shows selection status
- **Grid layout**: Responsive 1/2/3 column grid for unit cards
- **Visual feedback**: Selected units highlighted with border + background color
- **Loading states**: Spinner during fetch and assignment
- **Error handling**: Displays mutation errors clearly

**Time**: 35 minutes

### 4.3 Add Component to Barrel Export

```typescript
// src/components/admin/index.ts (create if doesn't exist)
export { UnitAssignmentInterface } from "./UnitAssignmentInterface";
```

**Time**: 1 minute

### 4.4 Test Component (Visual Inspection)

Start dev server and navigate to component in Storybook or test route:

```bash
npm run dev
# Open browser to test route (created in next step)
```

**Time**: 3 minutes

**Checkpoint**: Unit assignment component created ✅

---

## Step 5: Create TanStack Router Route (10 minutes)

### 5.1 Create Route File

```bash
mkdir -p src/routes/admin/assign-units
touch src/routes/admin/assign-units/\$bookingId.tsx
```

**Time**: 1 minute

### 5.2 Write Route Component

Open `src/routes/admin/assign-units/$bookingId.tsx` and add:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UnitAssignmentInterface } from "@/components/admin/UnitAssignmentInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/assign-units/$bookingId")({
  component: AssignUnitsPage,
});

function AssignUnitsPage() {
  const { bookingId } = Route.useParams();

  // Fetch booking details
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      const token = ""; // TODO: Get from auth context
      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch booking");
      }

      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return <div>Booking not found</div>;
  }

  // Check payment verification
  if (booking.payment_status !== "Verified") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment Not Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Payment must be verified before assigning units.
              <br />
              Please verify payment first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if already assigned
  if (booking.unit_assignment_status === "assigned") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Already Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Units have already been assigned to this booking.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Assign Units</h1>
        <p className="text-muted-foreground">
          Booking Reference: {booking.booking_reference}
        </p>
      </div>

      <UnitAssignmentInterface
        bookingId={bookingId}
        checkInDate={booking.check_in_date}
        checkOutDate={booking.check_out_date}
        unitRequests={booking.unit_requests || []}
        onAssignmentSuccess={() => {
          alert("Units assigned successfully!");
          // Navigate back to queue
          window.location.href = "/admin/queue";
        }}
      />
    </div>
  );
}
```

**Key features**:

- **Payment guard**: Blocks assignment if payment not verified
- **Assignment guard**: Shows message if already assigned
- **Auth guard**: Can add authentication check at route level
- **Success handler**: Navigates back to queue after assignment

**Time**: 8 minutes

### 5.3 Test Route

Navigate to `/admin/assign-units/{bookingId}` in browser:

```
http://localhost:5173/admin/assign-units/YOUR_BOOKING_ID
```

**Expected behavior**:

- Booking details load
- Unit requests displayed
- Available units shown in grid
- Can select units
- All-or-nothing indicator works

**Time**: 1 minute

**Checkpoint**: Route created and tested ✅

---

## Step 6: Update Admin Queue Navigation (10 minutes)

### 6.1 Update Queue Component

Open `src/components/admin/PendingBookingsQueue.tsx` (from chunk 011) and update the button click handler:

```typescript
// Find the button in your queue component and update onClick handler:

<Button
  onClick={() => {
    if (booking.payment_status === "Verified") {
      // Navigate to assignment page
      window.location.href = `/admin/assign-units/${booking.booking_id}`;
    } else {
      // Navigate to payment verification page
      window.location.href = `/admin/verify-payment/${booking.booking_id}`;
    }
  }}
>
  {booking.payment_status === "Verified" ? "Assign Units" : "Verify Payment"}
</Button>
```

**Or** if using TanStack Router:

```typescript
import { useNavigate } from "@tanstack/react-router";

const navigate = useNavigate();

<Button
  onClick={() => {
    if (booking.payment_status === "Verified") {
      navigate({ to: "/admin/assign-units/$bookingId", params: { bookingId: booking.booking_id } });
    } else {
      navigate({ to: "/admin/verify-payment/$bookingId", params: { bookingId: booking.booking_id } });
    }
  }}
>
  {booking.payment_status === "Verified" ? "Assign Units" : "Verify Payment"}
</Button>
```

**Time**: 8 minutes

### 6.2 Test Queue Navigation

1. Go to admin queue
2. Find pending booking with verified payment
3. Click "Assign Units"
4. Should navigate to `/admin/assign-units/{bookingId}`

**Time**: 2 minutes

**Checkpoint**: Queue navigation updated ✅

---

## Step 7: Final Verification (5 minutes)

### 7.1 Run Type Check

```bash
npm run type-check
```

**Expected**: No TypeScript errors

### 7.2 Run Lint

```bash
npm run lint
```

**Expected**: No ESLint warnings

### 7.3 Build Check

```bash
npm run build
```

**Expected**: Build succeeds

### 7.4 Manual Test: End-to-End Assignment

1. Create test booking with 2 unit requests
2. Verify payment (chunk 012)
3. Navigate to assignment page from queue
4. Select 2 units
5. Click "Assign 2 Units"
6. Confirm assignment
7. Verify booking status updated to 'Confirmed'
8. Check `booking_units` table has 2 entries
9. Verify audit log entry created

**Time**: 5 minutes

---

## Done!

**Congratulations!** You've successfully implemented the Unit Assignment System.

### Summary of What You Built

✅ PostgreSQL `assign_units_to_booking()` function with transaction safety
✅ Available units API endpoint with date range filtering
✅ Assign units API endpoint with error handling
✅ Unit assignment UI component with all-or-nothing enforcement
✅ TanStack Router route with payment guards
✅ Queue navigation integration

### Next Steps

1. **Run checkpoints** - Open `checkpoint.md` and verify all tests pass
2. **Troubleshoot if needed** - See `troubleshooting.md` for common issues
3. **Commit changes** - Use commit message from `checkpoint.md`
4. **Move to Chunk 014** - Admin API Endpoints (queue, history, analytics)

**Total Time**: Should be ~120 minutes if following steps carefully

---

**Need help?** Check `troubleshooting.md` for common issues and solutions.
