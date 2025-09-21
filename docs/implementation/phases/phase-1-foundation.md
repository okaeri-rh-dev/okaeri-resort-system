# Phase 1: Foundation

## Complete Database Setup & Core Infrastructure

### 🎯 Phase Overview

**Timeline**: Week 1 (5-7 days) **Goal**: Establish complete database schema,
Zustand state management, and basic CRUD operations **Outcome**: Solid
foundation with all tables, state management, and essential API endpoints

### Success Criteria

- [ ] Complete database schema with all tables and relationships
- [ ] Zustand stores initialized for state management
- [ ] CRUD endpoints for Units, Bookings, and Guests
- [ ] File upload endpoint for payment proofs
- [ ] Basic React components with Zustand integration
- [ ] TypeScript types for all entities

---

## 📋 Implementation Steps

### Step 1: Backend Setup (Supabase Recommended)

#### Option A: Supabase (Fastest Setup)

```bash
# 1. Create project at supabase.com
# 2. Get your project URL and anon key
# 3. Install Supabase client
npm install @supabase/supabase-js
```

#### Option B: Express + PostgreSQL

```bash
# Core dependencies
npm install express cors dotenv
npm install pg @neondatabase/serverless
npm install multer # for file uploads

# Development dependencies
npm install -D nodemon
npm install -D @types/express @types/cors @types/pg
```

#### 1.3 Create Basic Express Server

```javascript
// server/index.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler.js";
import { connectDB } from "./db/connection.js";

// Routes
import unitsRouter from "./routes/units.js";
import bookingsRouter from "./routes/bookings.js";
import guestsRouter from "./routes/guests.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/v1/units", unitsRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.use("/api/v1/guests", guestsRouter);

// Health check
app.get("/api/v1/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Error handling
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
```

#### 1.4 Database Connection Setup

```javascript
// server/db/connection.js
import pg from "pg";
const { Pool } = pg;

let pool;

export const connectDB = async () => {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();

    console.log("✅ Database connected successfully");
    return pool;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
};

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
```

---

### Step 2: Complete Database Schema

#### 2.1 Create All Tables Upfront

```sql
-- Complete schema with all relationships defined
-- This prevents migration issues later

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Units table
CREATE TABLE IF NOT EXISTS units (
    unit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_name VARCHAR(100) NOT NULL UNIQUE,
    unit_code VARCHAR(10) NOT NULL UNIQUE,
    unit_type VARCHAR(20) NOT NULL CHECK (unit_type IN ('Studio', 'One Bedroom', 'Two Bedroom', 'Villa')),
    max_occupancy INTEGER NOT NULL CHECK (max_occupancy > 0),
    base_rate DECIMAL(10,2) NOT NULL CHECK (base_rate >= 0),
    weekend_rate DECIMAL(10,2) NOT NULL CHECK (weekend_rate >= 0),
    unit_status VARCHAR(20) DEFAULT 'Available' CHECK (unit_status IN ('Available', 'Occupied', 'Maintenance', 'Reserved')),
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Guests table
  CREATE TABLE IF NOT EXISTS guests (
    guest_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    total_bookings INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Bookings table with payment proof support
  CREATE TABLE IF NOT EXISTS bookings (
    booking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,
    guest_id UUID REFERENCES guests(guest_id) ON DELETE SET NULL,
    guest_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    num_guests INTEGER NOT NULL CHECK (num_guests > 0),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL CHECK (check_out > check_in),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    booking_status VARCHAR(20) DEFAULT 'Pending' CHECK (
      booking_status IN ('Pending', 'Confirmed', 'CheckedIn', 'CheckedOut', 'Cancelled')
    ),
    payment_status VARCHAR(20) DEFAULT 'Unpaid' CHECK (
      payment_status IN ('Unpaid', 'Partial', 'Paid', 'Refunded')
    ),
    payment_method VARCHAR(20),
    payment_proof_url TEXT, -- For file upload reference
    special_requests TEXT,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Payments table for tracking
  CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(booking_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    proof_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Expenses table for future use
  CREATE TABLE IF NOT EXISTS expenses (
    expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Maintenance logs for future use
  CREATE TABLE IF NOT EXISTS maintenance_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES units(unit_id) ON DELETE CASCADE,
    issue_description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending',
    priority VARCHAR(20) DEFAULT 'Medium',
    reported_date DATE DEFAULT CURRENT_DATE,
    resolved_date DATE,
    cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Indexes for performance
  CREATE INDEX idx_bookings_unit_dates ON bookings(unit_id, check_in, check_out);
  CREATE INDEX idx_bookings_status ON bookings(booking_status);
  CREATE INDEX idx_bookings_guest ON bookings(guest_id);
  CREATE INDEX idx_units_status ON units(unit_status);

  -- Updated timestamp trigger
  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

  CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`;

export const down = `
  DROP TABLE IF EXISTS bookings;
  DROP TABLE IF EXISTS guests;
  DROP TABLE IF EXISTS units;
  DROP FUNCTION IF EXISTS update_updated_at();
`;
```

#### 2.2 Run Migrations

```javascript
// server/db/migrate.js
import { connectDB, query } from "./connection.js";
import * as initialSchema from "./migrations/001_initial_schema.js";

const runMigrations = async () => {
  try {
    await connectDB();

    // Create migrations table
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Check if migration already ran
    const result = await query("SELECT * FROM migrations WHERE name = $1", [
      "001_initial_schema",
    ]);

    if (result.rows.length === 0) {
      console.log("Running migration: 001_initial_schema");
      await query(initialSchema.up);
      await query("INSERT INTO migrations (name) VALUES ($1)", [
        "001_initial_schema",
      ]);
      console.log("✅ Migration completed successfully");
    } else {
      console.log("Migration already executed");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigrations();
```

---

### Step 3: API Routes Implementation

#### 3.1 Units Routes

```javascript
// server/routes/units.js
import express from "express";
import { query } from "../db/connection.js";

const router = express.Router();

// GET all units
router.get("/", async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        unit_id,
        unit_name,
        unit_code,
        unit_type,
        max_occupancy,
        base_rate,
        weekend_rate,
        unit_status,
        amenities
      FROM units
      ORDER BY unit_code
    `);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// GET single unit
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT * FROM units WHERE unit_id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// POST create unit
router.post("/", async (req, res, next) => {
  try {
    const {
      unit_name,
      unit_code,
      unit_type,
      max_occupancy,
      base_rate,
      weekend_rate,
      amenities,
    } = req.body;

    const result = await query(
      `INSERT INTO units (
        unit_name, unit_code, unit_type, max_occupancy,
        base_rate, weekend_rate, amenities
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        unit_name,
        unit_code,
        unit_type,
        max_occupancy,
        base_rate,
        weekend_rate,
        amenities || [],
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Unit created successfully",
    });
  } catch (error) {
    next(error);
  }
});

// PUT update unit
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(", ");

    const values = [id, ...Object.values(updates)];

    const result = await query(
      `UPDATE units SET ${setClause} WHERE unit_id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: "Unit updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

#### 3.2 Bookings Routes

```javascript
// server/routes/bookings.js
import express from "express";
import { query } from "../db/connection.js";

const router = express.Router();

// Generate booking reference
const generateBookingReference = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${date}-${random}`;
};

// GET all bookings
router.get("/", async (req, res, next) => {
  try {
    const { status, unit_id, from, to } = req.query;

    let queryText = `
      SELECT
        b.*,
        u.unit_name,
        u.unit_code
      FROM bookings b
      JOIN units u ON b.unit_id = u.unit_id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCounter = 1;

    if (status) {
      queryText += ` AND b.booking_status = $${paramCounter}`;
      queryParams.push(status);
      paramCounter++;
    }

    if (unit_id) {
      queryText += ` AND b.unit_id = $${paramCounter}`;
      queryParams.push(unit_id);
      paramCounter++;
    }

    if (from) {
      queryText += ` AND b.check_in >= $${paramCounter}`;
      queryParams.push(from);
      paramCounter++;
    }

    if (to) {
      queryText += ` AND b.check_out <= $${paramCounter}`;
      queryParams.push(to);
      paramCounter++;
    }

    queryText += " ORDER BY b.check_in DESC";

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST create booking
router.post("/", async (req, res, next) => {
  try {
    const {
      unit_id,
      guest_name,
      contact_number,
      email,
      num_guests,
      check_in,
      check_out,
      total_amount,
      special_requests,
    } = req.body;

    // Check availability
    const availabilityCheck = await query(
      `SELECT COUNT(*) FROM bookings
       WHERE unit_id = $1
       AND booking_status NOT IN ('Cancelled')
       AND (
         (check_in <= $2 AND check_out > $2) OR
         (check_in < $3 AND check_out >= $3) OR
         (check_in >= $2 AND check_out <= $3)
       )`,
      [unit_id, check_in, check_out]
    );

    if (parseInt(availabilityCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: "Unit is not available for selected dates",
      });
    }

    // Check or create guest
    let guest_id = null;
    const guestCheck = await query(
      "SELECT guest_id FROM guests WHERE email = $1",
      [email]
    );

    if (guestCheck.rows.length > 0) {
      guest_id = guestCheck.rows[0].guest_id;
    } else {
      const newGuest = await query(
        `INSERT INTO guests (guest_name, email, phone_number)
         VALUES ($1, $2, $3) RETURNING guest_id`,
        [guest_name, email, contact_number]
      );
      guest_id = newGuest.rows[0].guest_id;
    }

    // Create booking
    const booking_reference = generateBookingReference();
    const result = await query(
      `INSERT INTO bookings (
        booking_reference, unit_id, guest_id, guest_name,
        contact_number, email, num_guests, check_in, check_out,
        total_amount, special_requests, booking_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Pending')
      RETURNING *`,
      [
        booking_reference,
        unit_id,
        guest_id,
        guest_name,
        contact_number,
        email,
        num_guests,
        check_in,
        check_out,
        total_amount,
        special_requests,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Booking created successfully",
    });
  } catch (error) {
    next(error);
  }
});

// GET availability
router.get("/availability", async (req, res, next) => {
  try {
    const { check_in, check_out } = req.query;

    if (!check_in || !check_out) {
      return res.status(400).json({
        success: false,
        message: "Check-in and check-out dates are required",
      });
    }

    const result = await query(
      `SELECT u.* FROM units u
       WHERE u.unit_status = 'Available'
       AND u.unit_id NOT IN (
         SELECT DISTINCT unit_id FROM bookings
         WHERE booking_status NOT IN ('Cancelled')
         AND (
           (check_in <= $1 AND check_out > $1) OR
           (check_in < $2 AND check_out >= $2) OR
           (check_in >= $1 AND check_out <= $2)
         )
       )`,
      [check_in, check_out]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

---

### Step 3: State Management Setup

#### 3.1 Install Zustand and Dependencies

```bash
npm install zustand @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
```

#### 3.2 Create Zustand Stores

```typescript
// src/stores/unitStore.ts
import { create } from "zustand";
import { Unit } from "@/types";

interface UnitStore {
  units: Unit[];
  loading: boolean;
  error: string | null;
  fetchUnits: () => Promise<void>;
  addUnit: (unit: Unit) => void;
  updateUnit: (id: string, unit: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
}

export const useUnitStore = create<UnitStore>((set) => ({
  units: [],
  loading: false,
  error: null,

  fetchUnits: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/units");
      const data = await response.json();
      set({ units: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addUnit: (unit) =>
    set((state) => ({
      units: [...state.units, unit],
    })),

  updateUnit: (id, updates) =>
    set((state) => ({
      units: state.units.map((u) =>
        u.unit_id === id ? { ...u, ...updates } : u
      ),
    })),

  deleteUnit: (id) =>
    set((state) => ({
      units: state.units.filter((u) => u.unit_id !== id),
    })),
}));
```

```typescript
// src/stores/bookingStore.ts
import { create } from "zustand";
import { Booking } from "@/types";

interface BookingStore {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  fetchBookings: () => Promise<void>;
  createBooking: (booking: Omit<Booking, "booking_id">) => Promise<void>;
  updateBookingStatus: (id: string, status: string) => Promise<void>;
  uploadPaymentProof: (bookingId: string, file: File) => Promise<void>;
}

export const useBookingStore = create<BookingStore>((set, get) => ({
  bookings: [],
  loading: false,
  error: null,

  fetchBookings: async () => {
    set({ loading: true });
    try {
      const response = await fetch("/api/bookings");
      const data = await response.json();
      set({ bookings: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createBooking: async (booking) => {
    set({ loading: true });
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking),
      });
      const newBooking = await response.json();
      set((state) => ({
        bookings: [...state.bookings, newBooking],
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  updateBookingStatus: async (id, status) => {
    // Optimistic update
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.booking_id === id ? { ...b, booking_status: status } : b
      ),
    }));

    try {
      await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_status: status }),
      });
    } catch (error) {
      // Revert on error
      get().fetchBookings();
    }
  },

  uploadPaymentProof: async (bookingId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bookingId", bookingId);

    try {
      const response = await fetch("/api/upload/payment-proof", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        get().fetchBookings(); // Refresh to show updated payment status
      }
    } catch (error) {
      set({ error: error.message });
    }
  },
}));
```

### Step 4: Frontend Integration

#### 4.1 Configure Vite Proxy

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

#### 4.2 TypeScript Types

```typescript
// src/types/index.ts
export interface Unit {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: "Studio" | "One Bedroom" | "Two Bedroom" | "Villa";
  max_occupancy: number;
  base_rate: number;
  weekend_rate: number;
  unit_status: "Available" | "Occupied" | "Maintenance" | "Reserved";
  amenities?: string[];
  created_at: string;
  updated_at: string;
}

export interface Booking {
  booking_id: string;
  booking_reference: string;
  unit_id: string;
  guest_id?: string;
  guest_name: string;
  contact_number: string;
  email: string;
  num_guests: number;
  check_in: string;
  check_out: string;
  total_amount: number;
  booking_status:
    | "Pending"
    | "Confirmed"
    | "CheckedIn"
    | "CheckedOut"
    | "Cancelled";
  payment_status: "Unpaid" | "Partial" | "Paid" | "Refunded";
  payment_method?: string;
  payment_proof_url?: string;
  special_requests?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Guest {
  guest_id: string;
  guest_name: string;
  email: string;
  phone_number: string;
  total_bookings: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  payment_id: string;
  booking_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  proof_url?: string;
  notes?: string;
  created_at: string;
}
```

#### 4.3 Create Basic React Components with Zustand

```tsx
// src/components/UnitsDisplay.tsx
import { useEffect } from "react";
import { useUnitStore } from "@/stores/unitStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function UnitsDisplay() {
  const { units, loading, error, fetchUnits } = useUnitStore();

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  if (loading) return <div>Loading units...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {units.map((unit) => (
        <Card key={unit.unit_id}>
          <CardHeader>
            <CardTitle>{unit.unit_name}</CardTitle>
            <Badge
              variant={
                unit.unit_status === "Available" ? "success" : "secondary"
              }
            >
              {unit.unit_status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>Code: {unit.unit_code}</p>
              <p>Type: {unit.unit_type}</p>
              <p>Capacity: {unit.max_occupancy} guests</p>
              <p>Rate: ₱{unit.base_rate.toLocaleString()}/night</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

```tsx
// src/components/BookingForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useBookingStore } from "@/stores/bookingStore";
import { useUnitStore } from "@/stores/unitStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const bookingSchema = z.object({
  unit_id: z.string().min(1, "Please select a unit"),
  guest_name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  contact_number: z.string().regex(/^09\d{9}$/, "Invalid phone number"),
  num_guests: z.number().min(1).max(10),
  check_in: z.string(),
  check_out: z.string(),
  total_amount: z.number().positive(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export function BookingForm() {
  const { units } = useUnitStore();
  const { createBooking, loading } = useBookingStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  });

  const onSubmit = async (data: BookingFormData) => {
    await createBooking(data);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="unit_id">Select Unit</Label>
        <select {...register("unit_id")} className="w-full">
          <option value="">Choose a unit</option>
          {units
            .filter((u) => u.unit_status === "Available")
            .map((unit) => (
              <option key={unit.unit_id} value={unit.unit_id}>
                {unit.unit_name} - ₱{unit.base_rate}/night
              </option>
            ))}
        </select>
        {errors.unit_id && (
          <p className="text-sm text-red-500">{errors.unit_id.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="guest_name">Guest Name</Label>
          <Input {...register("guest_name")} />
          {errors.guest_name && (
            <p className="text-sm text-red-500">{errors.guest_name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input type="email" {...register("email")} />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="contact_number">Contact Number</Label>
          <Input {...register("contact_number")} placeholder="09XXXXXXXXX" />
          {errors.contact_number && (
            <p className="text-sm text-red-500">
              {errors.contact_number.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="num_guests">Number of Guests</Label>
          <Input
            type="number"
            {...register("num_guests", { valueAsNumber: true })}
          />
          {errors.num_guests && (
            <p className="text-sm text-red-500">{errors.num_guests.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="check_in">Check-in Date</Label>
          <Input type="date" {...register("check_in")} />
          {errors.check_in && (
            <p className="text-sm text-red-500">{errors.check_in.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="check_out">Check-out Date</Label>
          <Input type="date" {...register("check_out")} />
          {errors.check_out && (
            <p className="text-sm text-red-500">{errors.check_out.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Creating Booking..." : "Create Booking"}
      </Button>
    </form>
  );
}
```

---

### Step 5: Environment Configuration

#### 5.1 Create Environment Files

**For Supabase:**

```bash
# .env.local
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# File storage (built into Supabase)
# No additional configuration needed
```

**For Express Backend:**

```bash
# .env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/okaeri_resort

# Server
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB
```

#### 5.2 Update package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "nodemon server/index.js",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "lint": "eslint .",
    "db:setup": "node scripts/setup-database.js",
    "db:seed": "node scripts/seed-data.js"
  }
}
```

---

### Step 6: Quick Verification

#### 6.1 Test Basic Functionality

```typescript
// src/App.tsx - Simple test component
import { UnitsDisplay } from '@/components/UnitsDisplay';
import { BookingForm } from '@/components/BookingForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function App() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Okaeri Resort System</h1>

      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="booking">New Booking</TabsTrigger>
        </TabsList>

        <TabsContent value="units">
          <UnitsDisplay />
        </TabsContent>

        <TabsContent value="booking">
          <BookingForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
```

#### 6.2 Seed Initial Data

```javascript
// server/db/seed.js
import { connectDB, query } from "./connection.js";

const seedData = async () => {
  try {
    await connectDB();

    // Insert sample units
    const units = [
      {
        unit_name: "Unit 1 - Ocean View",
        unit_code: "U1",
        unit_type: "Studio",
        max_occupancy: 2,
        base_rate: 2500,
        weekend_rate: 3000,
      },
      {
        unit_name: "Unit 2 - Garden View",
        unit_code: "U2",
        unit_type: "One Bedroom",
        max_occupancy: 4,
        base_rate: 3500,
        weekend_rate: 4000,
      },
      {
        unit_name: "Unit 3 - Poolside",
        unit_code: "U3",
        unit_type: "Two Bedroom",
        max_occupancy: 6,
        base_rate: 5000,
        weekend_rate: 6000,
      },
    ];

    for (const unit of units) {
      await query(
        `INSERT INTO units (
          unit_name, unit_code, unit_type, max_occupancy,
          base_rate, weekend_rate
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (unit_code) DO NOTHING`,
        [
          unit.unit_name,
          unit.unit_code,
          unit.unit_type,
          unit.max_occupancy,
          unit.base_rate,
          unit.weekend_rate,
        ]
      );
    }

    console.log("✅ Seed data inserted successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedData();
```

---

## ✅ Phase 1 Completion Checklist

### Required

- [ ] Complete database schema with ALL tables
- [ ] Zustand stores for Units, Bookings, Guests
- [ ] Basic CRUD endpoints working
- [ ] File upload endpoint for payment proofs
- [ ] TypeScript types for all entities
- [ ] Basic UI components with Zustand integration
- [ ] Environment variables configured
- [ ] React Hook Form + Zod validation setup

### Completed in Phase 1

- [ ] Database relationships properly defined
- [ ] State management foundation (no refactoring needed)
- [ ] Type safety throughout the application
- [ ] Basic file upload capability

---

## 🚨 Troubleshooting

### Common Issues

#### Supabase Connection Issues

- Verify your project URL and anon key
- Check if RLS (Row Level Security) is disabled for development
- Ensure tables are created in Supabase dashboard

#### Zustand Store Not Updating

- Check if you're using the store correctly with hooks
- Verify async actions are properly awaited
- Use Zustand DevTools for debugging

#### File Upload Issues

- Check file size limits (10MB default)
- Verify CORS settings for storage bucket
- Ensure proper file type validation

---

## 📚 Resources

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vite Proxy Configuration](https://vitejs.dev/config/server-options.html#server-proxy)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## ➡️ Next Steps

Once Phase 1 is complete:

1. Test all CRUD operations
2. Verify file upload works for payment proofs
3. Ensure Zustand stores are properly managing state
4. Move to [Phase 2: Core Features](./phase-2-core-features.md)
5. Add booking workflows and business logic

---

_Phase 1 Foundation - Simplified for CRUD - Last Updated: September 21, 2025_
