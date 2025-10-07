# Detail & Edit Pages - TypeScript Architecture

## Overview

This document defines the TypeScript architecture for type-safe detail and edit pages, including type definitions, custom hooks, query patterns, and validation schemas.

## Type System Architecture

### Core Type Definitions

```typescript
// src/types/entity-detail.types.ts

import type { Database } from "@/types/database.types";

// Entity type mapping
export type EntityType = "booking" | "unit" | "guest" | "payment" | "expense";

// Extract row types from Supabase schema
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Unit = Database["public"]["Tables"]["units"]["Row"];
export type Guest = Database["public"]["Tables"]["guests"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];

// Detail page data with relations
export type BookingDetail = Booking & {
  unit: Unit | null;
  guest: Guest | null;
  payments: Payment[];
};

export type UnitDetail = Unit & {
  bookings: Booking[];
  current_booking: Booking | null;
};

export type GuestDetail = Guest & {
  bookings: Booking[];
  total_spent: number;
  total_bookings: number;
};

export type PaymentDetail = Payment & {
  booking: Booking | null;
};

export type ExpenseDetail = Expense & {
  unit: Unit | null;
  created_by_user: { id: string; name: string } | null;
};

// Generic detail type
export type EntityDetail<T extends EntityType> = T extends "booking"
  ? BookingDetail
  : T extends "unit"
    ? UnitDetail
    : T extends "guest"
      ? GuestDetail
      : T extends "payment"
        ? PaymentDetail
        : T extends "expense"
          ? ExpenseDetail
          : never;

// Route parameter types
export type EntityRouteParams<T extends EntityType> = {
  [K in `${T}Id`]: string;
};

// Edit form data types (what goes to the form)
export type BookingFormData = {
  guest_name: string;
  email: string;
  contact_number: string;
  check_in: Date;
  check_out: Date;
  unit_id: string;
  num_guests: number;
  payment_method: "Cash" | "GCash" | "BankTransfer" | "Card";
  payment_amount?: number;
  special_requests?: string;
};

export type UnitFormData = {
  unit_name: string;
  unit_code: string;
  unit_type: string;
  max_occupancy: number;
  base_rate: number;
  weekend_rate?: number;
  extra_person_rate?: number;
  cleaning_fee?: number;
  amenities?: string[];
};

export type GuestFormData = {
  guest_name: string;
  email: string;
  contact_number: string;
  address?: string;
  notes?: string;
};

export type PaymentFormData = {
  payment_amount: number;
  payment_method: "Cash" | "GCash" | "BankTransfer" | "Card";
  payment_proof_url?: string;
  notes?: string;
};

export type ExpenseFormData = {
  description: string;
  amount: number;
  expense_date: Date;
  category: string;
  receipt_url?: string;
  unit_id?: string;
  notes?: string;
};

// Audit trail types
export type AuditFilters = {
  entity_type: EntityType;
  entity_id: string;
  action?: string;
  user_id?: string;
  date_from?: Date;
  date_to?: Date;
};

// Loading states
export type LoadingState = "idle" | "loading" | "success" | "error";

export type EntityDetailState<T> = {
  data: T | null;
  status: LoadingState;
  error: Error | null;
};
```

### Navigation Type Definitions

```typescript
// src/types/entity-navigation.types.ts

import type { EntityType } from "./entity-detail.types";

// Navigation targets for each entity
export type NavigationTarget = {
  booking: {
    to: "/bookings/$bookingId";
    params: { bookingId: string };
  };
  unit: {
    to: "/units/$unitId";
    params: { unitId: string };
  };
  guest: {
    to: "/guests/$guestId";
    params: { guestId: string };
  };
  payment: {
    to: "/payments/$paymentId";
    params: { paymentId: string };
  };
  expense: {
    to: "/expenses/$expenseId";
    params: { expenseId: string };
  };
};

// Type-safe navigation helper
export type EntityNavigationProps<T extends EntityType> = {
  type: T;
  id: string;
  search?: Record<string, any>;
};

// Cross-entity relationships
export type EntityRelations = {
  booking: ["guest", "unit", "payment"];
  unit: ["booking"];
  guest: ["booking"];
  payment: ["booking"];
  expense: ["unit"];
};
```

## Custom Hooks

### 1. useEntityDetail Hook

**Purpose**: Generic hook for fetching entity details with audit trail.

```typescript
// src/hooks/entity/useEntityDetail.ts

import { useQuery } from "@tanstack/react-query";
import type { EntityType, EntityDetail } from "@/types/entity-detail.types";
import { db } from "@/lib/supabase";

type UseEntityDetailOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useEntityDetail<T extends EntityType>(
  entityType: T,
  entityId: string | undefined,
  options?: UseEntityDetailOptions
) {
  return useQuery({
    queryKey: [entityType, entityId],
    queryFn: async () => {
      if (!entityId) throw new Error("Entity ID is required");

      // Type-safe database fetching based on entity type
      const { data, error } = await (async () => {
        switch (entityType) {
          case "booking":
            return db.bookings.byId(entityId);
          case "unit":
            return db.units.byId(entityId);
          case "guest":
            return db.guests.byId(entityId);
          case "payment":
            return db.payments.byId(entityId);
          case "expense":
            return db.expenses.byId(entityId);
          default:
            throw new Error(`Unknown entity type: ${entityType}`);
        }
      })();

      if (error) throw new Error(error.message);
      if (!data) throw new Error(`${entityType} not found`);

      return data as EntityDetail<T>;
    },
    enabled: !!entityId && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30_000, // 30 seconds
  });
}
```

**Usage**:

```typescript
// In a component
const { data: booking, isLoading, error } = useEntityDetail("booking", bookingId);

// With options
const { data: unit } = useEntityDetail("unit", unitId, {
  enabled: !!unitId,
  staleTime: 60_000,
});
```

### 2. useEntityEdit Hook

**Purpose**: Generic hook for updating entities with optimistic updates.

```typescript
// src/hooks/entity/useEntityEdit.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EntityType } from "@/types/entity-detail.types";
import { db } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/audit-logger";
import { toast } from "sonner";

type UseEntityEditOptions<T> = {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
};

export function useEntityEdit<T extends EntityType, TData = any>(
  entityType: T,
  entityId: string,
  options?: UseEntityEditOptions<TData>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateData: TData) => {
      // Get current data for audit trail
      const previousData = queryClient.getQueryData([entityType, entityId]);

      // Type-safe update based on entity type
      const { data, error } = await (async () => {
        switch (entityType) {
          case "booking":
            return db.bookings.update(entityId, updateData);
          case "unit":
            return db.units.update(entityId, updateData);
          case "guest":
            return db.guests.update(entityId, updateData);
          case "payment":
            return db.payments.update(entityId, updateData);
          case "expense":
            return db.expenses.update(entityId, updateData);
          default:
            throw new Error(`Unknown entity type: ${entityType}`);
        }
      })();

      if (error) throw new Error(error.message);

      // Log audit event
      await logAuditEvent({
        action: `${entityType}.updated`,
        entity_type: entityType,
        entity_id: entityId,
        changes: {
          before: previousData,
          after: data,
        },
      });

      return data;
    },

    // Optimistic update
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: [entityType, entityId] });
      const previousData = queryClient.getQueryData([entityType, entityId]);

      queryClient.setQueryData([entityType, entityId], (old: any) => ({
        ...old,
        ...newData,
      }));

      return { previousData };
    },

    // Rollback on error
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData([entityType, entityId], context.previousData);
      }
      toast.error(`Failed to update ${entityType}`);
      options?.onError?.(error as Error);
    },

    // Refetch on success
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: [entityType] });
      toast.success(`${entityType} updated successfully`);
      options?.onSuccess?.(data);
    },
  });
}
```

**Usage**:

```typescript
const updateBooking = useEntityEdit("booking", bookingId, {
  onSuccess: () => navigate({ to: "/bookings/$bookingId", params: { bookingId } }),
});

const handleSubmit = (data: BookingFormData) => {
  updateBooking.mutate(data);
};
```

### 3. useEntityAudit Hook

**Purpose**: Fetch and filter audit trail for specific entity.

```typescript
// src/hooks/entity/useEntityAudit.ts

import { useQuery } from "@tanstack/react-query";
import type { EntityType, AuditFilters } from "@/types/entity-detail.types";
import { supabase } from "@/lib/supabase";

export function useEntityAudit(filters: AuditFilters) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", filters.entity_type)
        .eq("record_id", filters.entity_id)
        .order("created_at", { ascending: false });

      if (filters.action) {
        query = query.eq("action", filters.action);
      }

      if (filters.user_id) {
        query = query.eq("user_id", filters.user_id);
      }

      if (filters.date_from) {
        query = query.gte("created_at", filters.date_from.toISOString());
      }

      if (filters.date_to) {
        query = query.lte("created_at", filters.date_to.toISOString());
      }

      const { data, error } = await query.limit(50);

      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 10_000, // 10 seconds
  });
}
```

**Usage**:

```typescript
const { data: auditLogs } = useEntityAudit({
  entity_type: "booking",
  entity_id: bookingId,
});
```

### 4. useEntityNavigation Hook

**Purpose**: Type-safe programmatic navigation helper.

```typescript
// src/hooks/entity/useEntityNavigation.ts

import { useNavigate } from "@tanstack/react-router";
import type { EntityType, NavigationTarget } from "@/types/entity-navigation.types";

export function useEntityNavigation() {
  const navigate = useNavigate();

  return {
    navigateToDetail: <T extends EntityType>(
      entityType: T,
      entityId: string,
      search?: Record<string, any>
    ) => {
      const routes: Record<EntityType, any> = {
        booking: { to: "/bookings/$bookingId", params: { bookingId: entityId } },
        unit: { to: "/units/$unitId", params: { unitId: entityId } },
        guest: { to: "/guests/$guestId", params: { guestId: entityId } },
        payment: { to: "/payments/$paymentId", params: { paymentId: entityId } },
        expense: { to: "/expenses/$expenseId", params: { expenseId: entityId } },
      };

      const route = routes[entityType];
      navigate({ ...route, search });
    },

    navigateToEdit: <T extends EntityType>(entityType: T, entityId: string) => {
      const routes: Record<EntityType, any> = {
        booking: { to: "/bookings/$bookingId/edit", params: { bookingId: entityId } },
        unit: { to: "/units/$unitId/edit", params: { unitId: entityId } },
        guest: { to: "/guests/$guestId/edit", params: { guestId: entityId } },
        payment: { to: "/payments/$paymentId/edit", params: { paymentId: entityId } },
        expense: { to: "/expenses/$expenseId/edit", params: { expenseId: entityId } },
      };

      const route = routes[entityType];
      navigate(route);
    },

    navigateToList: (entityType: EntityType) => {
      const routes: Record<EntityType, string> = {
        booking: "/bookings",
        unit: "/units",
        guest: "/guests",
        payment: "/payments",
        expense: "/expenses",
      };

      navigate({ to: routes[entityType] });
    },
  };
}
```

**Usage**:

```typescript
const { navigateToDetail, navigateToEdit } = useEntityNavigation();

// Navigate to guest detail
navigateToDetail("guest", guestId);

// Navigate to booking edit
navigateToEdit("booking", bookingId);
```

### 5. useDetailPageState Hook

**Purpose**: Manage UI state for detail pages (tabs, panels, etc.).

```typescript
// src/hooks/entity/useDetailPageState.ts

import { useState, useCallback } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";

type TabValue = "details" | "payments" | "audit" | "history";

export function useDetailPageState() {
  const search = useSearch({ strict: false }) as { tab?: TabValue };
  const navigate = useNavigate();

  const activeTab = search.tab ?? "details";

  const setActiveTab = useCallback(
    (tab: TabValue) => {
      navigate({
        search: (prev: any) => ({ ...prev, tab }),
        replace: true,
      });
    },
    [navigate]
  );

  return {
    activeTab,
    setActiveTab,
  };
}
```

**Usage**:

```typescript
const { activeTab, setActiveTab } = useDetailPageState()

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="payments">Payments</TabsTrigger>
    <TabsTrigger value="audit">Audit</TabsTrigger>
  </TabsList>
</Tabs>
```

## Query Key Factory

**Purpose**: Centralized, type-safe query keys for consistent caching.

```typescript
// src/lib/query-keys.ts

import type { EntityType, AuditFilters } from "@/types/entity-detail.types";

export const queryKeys = {
  // Entity details
  entity: <T extends EntityType>(type: T, id: string) => [type, id] as const,

  // Entity lists
  entities: <T extends EntityType>(type: T) => [type] as const,

  // Filtered lists
  entitiesFiltered: <T extends EntityType>(type: T, filters: Record<string, any>) =>
    [type, "list", filters] as const,

  // Audit logs
  audit: (filters: AuditFilters) => ["audit-logs", filters] as const,

  // Related entities
  related: <T extends EntityType>(type: T, id: string, relation: string) =>
    [type, id, relation] as const,

  // Specific relations
  bookingPayments: (bookingId: string) => ["booking", bookingId, "payments"] as const,

  guestBookings: (guestId: string) => ["guest", guestId, "bookings"] as const,

  unitBookings: (unitId: string) => ["unit", unitId, "bookings"] as const,
};

// Usage
queryClient.invalidateQueries({ queryKey: queryKeys.entity("booking", bookingId) });
queryClient.prefetchQuery({
  queryKey: queryKeys.bookingPayments(bookingId),
  queryFn: () => db.payments.byBooking(bookingId),
});
```

## Validation Schemas

### Zod Schemas for Edit Forms

```typescript
// src/lib/validation/entity-schemas.ts

import { z } from "zod";
import DOMPurify from "dompurify";

// Booking edit schema
export const bookingEditSchema = z
  .object({
    guest_name: z.string().min(1, "Guest name is required"),
    email: z.string().email("Invalid email address"),
    contact_number: z.string().min(10, "Valid phone number required"),
    check_in: z.date(),
    check_out: z.date(),
    unit_id: z.string().uuid("Valid unit required"),
    num_guests: z.number().int().min(1).max(20),
    payment_method: z.enum(["Cash", "GCash", "BankTransfer", "Card"]),
    payment_amount: z.number().positive().optional(),
    special_requests: z
      .string()
      .transform((val) => DOMPurify.sanitize(val))
      .optional(),
  })
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

export type BookingEditInput = z.infer<typeof bookingEditSchema>;

// Unit edit schema
export const unitEditSchema = z.object({
  unit_name: z.string().min(1, "Unit name is required"),
  unit_code: z.string().min(1, "Unit code is required"),
  unit_type: z.string().min(1, "Unit type is required"),
  max_occupancy: z.number().int().min(1).max(20),
  base_rate: z.number().positive("Base rate must be positive"),
  weekend_rate: z.number().positive().optional(),
  extra_person_rate: z.number().positive().optional(),
  cleaning_fee: z.number().positive().optional(),
  amenities: z.array(z.string()).optional(),
});

export type UnitEditInput = z.infer<typeof unitEditSchema>;

// Guest edit schema
export const guestEditSchema = z.object({
  guest_name: z.string().min(1, "Guest name is required"),
  email: z.string().email("Invalid email address"),
  contact_number: z.string().min(10, "Valid phone number required"),
  address: z
    .string()
    .transform((val) => DOMPurify.sanitize(val))
    .optional(),
  notes: z
    .string()
    .transform((val) => DOMPurify.sanitize(val))
    .optional(),
});

export type GuestEditInput = z.infer<typeof guestEditSchema>;

// Payment edit schema
export const paymentEditSchema = z.object({
  payment_amount: z.number().positive("Amount must be positive"),
  payment_method: z.enum(["Cash", "GCash", "BankTransfer", "Card"]),
  payment_proof_url: z.string().url().optional(),
  notes: z
    .string()
    .transform((val) => DOMPurify.sanitize(val))
    .optional(),
});

export type PaymentEditInput = z.infer<typeof paymentEditSchema>;

// Expense edit schema
export const expenseEditSchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .transform((val) => DOMPurify.sanitize(val)),
  amount: z.number().positive("Amount must be positive"),
  expense_date: z.date(),
  category: z.string().min(1, "Category is required"),
  receipt_url: z.string().url().optional(),
  unit_id: z.string().uuid().optional(),
  notes: z
    .string()
    .transform((val) => DOMPurify.sanitize(val))
    .optional(),
});

export type ExpenseEditInput = z.infer<typeof expenseEditSchema>;
```

**Usage with React Hook Form**:

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bookingEditSchema, type BookingEditInput } from "@/lib/validation/entity-schemas";

const form = useForm<BookingEditInput>({
  resolver: zodResolver(bookingEditSchema),
  defaultValues: initialData,
});

const onSubmit = (data: BookingEditInput) => {
  updateBooking.mutate(data);
};
```

## Type Guards and Assertions

```typescript
// src/lib/type-guards.ts

import type {
  EntityType,
  Booking,
  Unit,
  Guest,
  Payment,
  Expense,
} from "@/types/entity-detail.types";

export function isBooking(entity: any): entity is Booking {
  return entity && typeof entity === "object" && "booking_reference" in entity;
}

export function isUnit(entity: any): entity is Unit {
  return entity && typeof entity === "object" && "unit_code" in entity;
}

export function isGuest(entity: any): entity is Guest {
  return entity && typeof entity === "object" && "guest_name" in entity;
}

export function isPayment(entity: any): entity is Payment {
  return entity && typeof entity === "object" && "payment_amount" in entity;
}

export function isExpense(entity: any): entity is Expense {
  return entity && typeof entity === "object" && "expense_date" in entity;
}

// Entity type assertion
export function assertEntityType(entityType: string): asserts entityType is EntityType {
  const validTypes: EntityType[] = ["booking", "unit", "guest", "payment", "expense"];
  if (!validTypes.includes(entityType as EntityType)) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
}
```

## Error Handling Patterns

```typescript
// src/lib/error-handling.ts

export class EntityNotFoundError extends Error {
  constructor(entityType: string, entityId: string) {
    super(`${entityType} with ID ${entityId} not found`);
    this.name = "EntityNotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(public errors: Record<string, string[]>) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

export function handleEntityError(error: unknown): string {
  if (error instanceof EntityNotFoundError) {
    return error.message;
  }

  if (error instanceof ValidationError) {
    return Object.values(error.errors).flat().join(", ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred";
}
```

## Complete Hook Integration Example

```typescript
// src/components/bookings/BookingEdit/index.tsx

import { useParams, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEntityDetail, useEntityEdit } from '@/hooks/entity'
import { bookingEditSchema, type BookingEditInput } from '@/lib/validation/entity-schemas'
import { DetailPageLayout } from '@/components/entity-detail'

export function BookingEditPage() {
  const { bookingId } = useParams({ from: '/_authenticated/bookings/$bookingId/edit' })
  const navigate = useNavigate()

  // Fetch current booking data
  const { data: booking, isLoading } = useEntityDetail('booking', bookingId)

  // Setup mutation
  const updateBooking = useEntityEdit('booking', bookingId, {
    onSuccess: () => {
      navigate({ to: '/bookings/$bookingId', params: { bookingId } })
    },
  })

  // Setup form
  const form = useForm<BookingEditInput>({
    resolver: zodResolver(bookingEditSchema),
    defaultValues: booking ? {
      guest_name: booking.guest_name,
      email: booking.email,
      contact_number: booking.contact_number,
      check_in: new Date(booking.check_in),
      check_out: new Date(booking.check_out),
      unit_id: booking.unit_id,
      num_guests: booking.num_guests,
      payment_method: booking.payment_method,
      special_requests: booking.special_requests || '',
    } : undefined,
  })

  if (isLoading) return <div>Loading...</div>
  if (!booking) return <div>Booking not found</div>

  return (
    <DetailPageLayout
      title="Edit Booking"
      subtitle={`Booking #${booking.booking_reference}`}
      breadcrumbs={[
        { label: 'Bookings', to: '/bookings' },
        { label: booking.booking_reference, to: '/bookings/$bookingId', params: { bookingId } },
        { label: 'Edit' },
      ]}
    >
      <form onSubmit={form.handleSubmit((data) => updateBooking.mutate(data))}>
        {/* Form fields */}
      </form>
    </DetailPageLayout>
  )
}
```

## Summary

This TypeScript architecture provides:

- ✅ **Type-safe entity operations** with discriminated unions
- ✅ **Generic hooks** for consistent data fetching and mutations
- ✅ **Centralized query keys** for cache management
- ✅ **Zod validation schemas** with type inference
- ✅ **Type guards** for runtime type checking
- ✅ **Error handling** patterns for all scenarios
- ✅ **Navigation helpers** with full type safety
- ✅ **Form integration** with React Hook Form + Zod

All patterns leverage TypeScript's type system to prevent runtime errors and provide excellent developer experience with autocompletion and type checking.
