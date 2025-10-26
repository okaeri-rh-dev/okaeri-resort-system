# Chunk 006: Date and Unit Selection UI - Troubleshooting Guide

## Purpose

This guide helps you resolve common issues encountered during Chunk 006 implementation. Issues are organized by symptom with specific solutions.

---

## TypeScript Compilation Errors

### Symptom: "Cannot find module '@/types/guest-booking-multi-unit'"

**Cause**: Path alias not configured or file doesn't exist.

**Solution**:

1. **Verify file exists**:

   ```bash
   ls -la src/types/guest-booking-multi-unit.ts
   ```

2. **Check tsconfig.json** has path aliases:

   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

3. **Restart TypeScript server** in your editor:
   - VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
   - Or restart your editor

4. **Verify import path** in your components:

   ```typescript
   // Correct
   import type { UnitRequest } from "@/types/guest-booking-multi-unit";

   // Incorrect (missing '@')
   import type { UnitRequest } from "/types/guest-booking-multi-unit";
   ```

---

### Symptom: "Type 'StandardUnitRates' is not assignable to type 'X'"

**Cause**: API response shape doesn't match TypeScript type.

**Solution**:

1. **Check API response** matches type definition:

   ```bash
   curl https://your-domain.com/api/guest-booking/rates | jq
   ```

   Expected response:

   ```json
   {
     "success": true,
     "rates": {
       "base_rate": 2000,
       "weekend_rate": 2500,
       "extra_person_rate": 300,
       "base_occupancy": 2,
       "max_capacity_per_unit": 10,
       "downpayment_percent": 50
     }
   }
   ```

2. **Update type definition** if API changed:
   - File: `src/types/guest-booking-multi-unit.ts`
   - Match interface to actual API response

3. **Add runtime validation** with Zod (optional but recommended):

   ```typescript
   import { z } from "zod";

   const standardUnitRatesSchema = z.object({
     base_rate: z.number(),
     weekend_rate: z.number(),
     extra_person_rate: z.number(),
     base_occupancy: z.number(),
     max_capacity_per_unit: z.number(),
     downpayment_percent: z.number(),
   });

   const data = await fetchRates();
   const validated = standardUnitRatesSchema.parse(data.rates);
   ```

---

### Symptom: "Property 'guests_per_unit' does not exist on type 'UnitRequest'"

**Cause**: Type definition missing or incorrect.

**Solution**:

1. **Verify UnitRequest interface**:

   ```typescript
   // File: src/types/guest-booking-multi-unit.ts
   export interface UnitRequest {
     guests_per_unit: number; // Ensure this field exists
   }
   ```

2. **Check for typos** in property name:
   - Correct: `guests_per_unit` (snake_case)
   - Incorrect: `guestsPerUnit` (camelCase)

3. **Restart TypeScript server** after fixing

---

## ESLint / Linting Errors

### Symptom: "React Hook useEffect has missing dependency 'X'"

**Cause**: ESLint exhaustive-deps rule requires all dependencies in array.

**Solution**:

**Option 1: Add missing dependency** (recommended):

```typescript
useEffect(() => {
  async function loadRates() {
    // ...
  }
  loadRates();
}, []); // ✅ Empty array is correct if loadRates has no external deps
```

**Option 2: Disable rule for this line** (if intentional):

```typescript
useEffect(() => {
  // ...
}, []); // eslint-disable-next-line react-hooks/exhaustive-deps
```

**Option 3: Extract function outside useEffect**:

```typescript
const loadRates = useCallback(async () => {
  // ...
}, []);

useEffect(() => {
  loadRates();
}, [loadRates]); // ✅ loadRates is now a dependency
```

---

### Symptom: "Unexpected console statement"

**Cause**: ESLint no-console rule blocks console.log in production.

**Solution**:

**Option 1: Remove console.log** (production code):

```typescript
// Remove this
console.log("User clicked button");
```

**Option 2: Use proper logging** (error handling):

```typescript
// Keep for errors
console.error("[UnitRequestSelector] Failed to fetch rates:", error);
```

**Option 3: Disable for specific line** (debugging):

```typescript
// eslint-disable-next-line no-console
console.log("Debug info:", data);
```

---

## Component Test Failures

### Symptom: "fetchRates is not a function"

**Cause**: Mock not set up correctly in test file.

**Solution**:

1. **Add mock at top of test file**:

   ```typescript
   // File: __tests__/UnitRequestSelector.test.tsx
   import { vi } from "vitest";

   vi.mock("@/lib/api/guest-booking-client", () => ({
     fetchRates: vi.fn(() =>
       Promise.resolve({
         success: true,
         rates: {
           base_rate: 2000,
           weekend_rate: 2500,
           extra_person_rate: 300,
           base_occupancy: 2,
           max_capacity_per_unit: 10,
           downpayment_percent: 50,
         },
       })
     ),
   }));
   ```

2. **Verify import path** matches actual file location

3. **Clear mocks between tests**:
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```

---

### Symptom: "Unable to find element with text 'Unit #1'"

**Cause**: Component renders asynchronously or element not in DOM.

**Solution**:

1. **Use waitFor for async operations**:

   ```typescript
   import { waitFor } from '@testing-library/react';

   it('displays unit cards', async () => {
     render(<UnitRequestSelector value={[{ guests_per_unit: 2 }]} onChange={vi.fn()} />);

     await waitFor(() => {
       expect(screen.getByText('Unit #1')).toBeInTheDocument();
     });
   });
   ```

2. **Check component actually renders**:

   ```typescript
   // Debug: Print what's actually in DOM
   screen.debug();
   ```

3. **Verify test data** matches what component expects:
   ```typescript
   // Component expects array of UnitRequest objects
   const value = [{ guests_per_unit: 2 }]; // ✅ Correct
   // NOT: const value = { guests_per_unit: 2 }; // ❌ Wrong (object, not array)
   ```

---

### Symptom: "Test times out after 5000ms"

**Cause**: Async operation never resolves or component stuck loading.

**Solution**:

1. **Check mock returns resolved promise**:

   ```typescript
   vi.fn(() => Promise.resolve({ success: true, rates: {...} }))
   // NOT: vi.fn(() => new Promise(() => {})) // Never resolves
   ```

2. **Increase timeout for slow tests**:

   ```typescript
   it("test name", async () => {
     // ...
   }, 10000); // 10 second timeout
   ```

3. **Use fake timers** for debounced operations:

   ```typescript
   import { vi } from "vitest";

   beforeEach(() => {
     vi.useFakeTimers();
   });

   afterEach(() => {
     vi.useRealTimers();
   });

   it("debounces API calls", async () => {
     // Trigger debounced function
     fireEvent.change(input, { target: { value: "5" } });

     // Fast-forward timers
     vi.advanceTimersByTime(500);

     await waitFor(() => {
       expect(mockFn).toHaveBeenCalled();
     });
   });
   ```

---

## Date Picker Issues

### Symptom: Date picker calendar doesn't open

**Cause**: Missing shadcn/ui components.

**Solution**:

1. **Install required components**:

   ```bash
   npx shadcn@latest add popover
   npx shadcn@latest add calendar
   ```

2. **Verify imports** in DateRangePicker:

   ```typescript
   import { Calendar } from "@/components/ui/calendar";
   import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
   ```

3. **Check components exist**:
   ```bash
   ls src/components/ui/popover.tsx
   ls src/components/ui/calendar.tsx
   ```

---

### Symptom: Past dates are not disabled

**Cause**: Disabled prop not set correctly.

**Solution**:

1. **Verify disabled prop**:

   ```typescript
   <Calendar
     mode="range"
     disabled={(date) => date < new Date()} // ✅ Correct
     // NOT: disabled={true} // ❌ Wrong
   />
   ```

2. **Reset time for date-only comparison**:
   ```typescript
   <Calendar
     disabled={(date) => {
       const today = new Date();
       today.setHours(0, 0, 0, 0); // Reset time to midnight
       return date < today;
     }}
   />
   ```

---

### Symptom: Calendar styling looks broken (Tailwind v4)

**Cause**: Tailwind v4 CSS conflicts with date-picker styles.

**Solution**:

1. **Import date-picker CSS** in your main CSS file:

   ```css
   /* File: src/index.css or src/app.css */
   @import "react-day-picker/dist/style.css";
   ```

2. **Add custom overrides** for Tailwind v4 compatibility:

   ```css
   /* Override date-picker styles for Tailwind v4 */
   .rdp {
     --rdp-accent-color: hsl(var(--primary));
     --rdp-background-color: hsl(var(--primary) / 0.1);
   }
   ```

3. **Use shadcn/ui Calendar component** (already styled for Tailwind):
   ```bash
   npx shadcn@latest add calendar
   ```

---

## API Endpoint Errors

### Symptom: "Failed to fetch rates: 404 Not Found"

**Cause**: API endpoint not deployed or incorrect URL.

**Solution**:

1. **Verify API endpoint exists** (from Chunk 004):

   ```bash
   curl -I https://your-domain.com/api/guest-booking/rates
   # Expected: HTTP/1.1 200 OK
   ```

2. **Check API_BASE constant** matches your deployment:

   ```typescript
   // File: src/lib/api/guest-booking-client.ts
   const API_BASE = "/api/guest-booking"; // For production
   // OR
   const API_BASE = "http://localhost:8787/api/guest-booking"; // For local dev
   ```

3. **Use environment variable** for flexibility:

   ```typescript
   const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/guest-booking";
   ```

   `.env.local`:

   ```
   VITE_API_BASE_URL=http://localhost:8787/api/guest-booking
   ```

---

### Symptom: "CORS policy blocked the request"

**Cause**: API endpoint doesn't allow requests from your origin.

**Solution**:

1. **Add CORS headers** to API endpoint (Chunk 004):

   ```typescript
   // File: functions/api/guest-booking/rates.ts
   export async function onRequestGet() {
     return new Response(JSON.stringify(data), {
       headers: {
         "Content-Type": "application/json",
         "Access-Control-Allow-Origin": "*", // Or specific domain
         "Access-Control-Allow-Methods": "GET, OPTIONS",
         "Access-Control-Allow-Headers": "Content-Type",
       },
     });
   }
   ```

2. **For local development**, use proxy in vite.config.ts:
   ```typescript
   export default defineConfig({
     server: {
       proxy: {
         "/api": {
           target: "http://localhost:8787",
           changeOrigin: true,
         },
       },
     },
   });
   ```

---

### Symptom: "API returned success: false"

**Cause**: Server-side error in API endpoint.

**Solution**:

1. **Check API logs** for error details:

   ```bash
   # For Cloudflare Workers
   wrangler tail

   # Or check browser Network tab for response body
   ```

2. **Test endpoint directly**:

   ```bash
   curl https://your-domain.com/api/guest-booking/rates | jq
   ```

3. **Verify database** has pricing_config data (from Chunk 001):
   ```sql
   SELECT * FROM pricing_config WHERE id = 'default';
   ```

---

## Unit Card Issues

### Symptom: Remove button doesn't appear on cards

**Cause**: canRemove prop not set correctly.

**Solution**:

1. **Verify logic** in UnitRequestSelector:

   ```typescript
   <UnitRequestCard
     canRemove={value.length > 1} // ✅ Only show when > 1 unit
     // NOT: canRemove={true} // ❌ Always shows remove button
   />
   ```

2. **Check conditional rendering** in UnitRequestCard:
   ```typescript
   {canRemove && (
     <Button onClick={onRemove}>
       <X className="h-4 w-4" />
     </Button>
   )}
   ```

---

### Symptom: Cards don't renumber after removal

**Cause**: Using stable key prop instead of index.

**Solution**:

1. **Use index as key** (for this use case):

   ```typescript
   {value.map((request, index) => (
     <UnitRequestCard
       key={index} // ✅ Use index so cards renumber
       index={index}
       // ...
     />
   ))}
   ```

2. **Why index is OK here**: Cards are ordered and have no unique ID. Array mutation (removal) should cause renumbering.

---

### Symptom: "Add Another Unit" button doesn't appear

**Cause**: Conditional rendering logic incorrect.

**Solution**:

1. **Check condition**:

   ```typescript
   {value.length > 0 && totalUnits < maxTotalUnits && (
     <Button onClick={handleAddRequest}>Add Another Unit</Button>
   )}
   ```

2. **Verify maxTotalUnits prop** has default value:
   ```typescript
   function UnitRequestSelector({ maxTotalUnits = 10 }) {
     // If prop not passed, defaults to 10
   }
   ```

---

## Validation Errors

### Symptom: Can enter guest count above max capacity

**Cause**: Validation logic missing or incorrect.

**Solution**:

1. **Add validation in handleGuestsChange**:

   ```typescript
   const handleGuestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const value = parseInt(e.target.value) || 1;

     // Validation
     if (value >= 1 && value <= maxCapacityPerUnit) {
       onGuestsChange(value); // ✅ Only call if valid
     }
     // Else: do nothing (reject invalid input)
   };
   ```

2. **Add HTML constraints** (fallback):
   ```typescript
   <Input
     type="number"
     min="1"
     max={maxCapacityPerUnit} // Browser-level validation
     value={guestsPerUnit}
     onChange={handleGuestsChange}
   />
   ```

---

### Symptom: Extra person indicator doesn't show

**Cause**: Calculation or conditional rendering issue.

**Solution**:

1. **Verify calculation**:

   ```typescript
   const extraPersons = Math.max(0, guestsPerUnit - baseOccupancy);
   // If guestsPerUnit=5, baseOccupancy=2 → extraPersons=3 ✅
   ```

2. **Check conditional rendering**:

   ```typescript
   {extraPersons > 0 && ( // ✅ Only show if > 0
     <p className="text-yellow-600">
       Extra person fee: ₱{extraPersonRate}/night ({extraPersons} extra)
     </p>
   )}
   ```

3. **Verify props passed correctly**:
   ```typescript
   <UnitRequestCard
     guestsPerUnit={request.guests_per_unit} // ✅ From state
     baseOccupancy={unitRates.base_occupancy} // ✅ From API
     extraPersonRate={unitRates.extra_person_rate} // ✅ From API
   />
   ```

---

## Calculation Errors

### Symptom: Total guests count is incorrect

**Cause**: Reduce function incorrect.

**Solution**:

1. **Verify reduce logic**:

   ```typescript
   const totalGuests = value.reduce((sum, req) => sum + req.guests_per_unit, 0);
   // sum starts at 0, accumulates guests_per_unit from each request
   ```

2. **Test with example**:

   ```typescript
   const value = [{ guests_per_unit: 2 }, { guests_per_unit: 3 }, { guests_per_unit: 2 }];
   const total = value.reduce((sum, req) => sum + req.guests_per_unit, 0);
   console.log(total); // Should be 7
   ```

3. **Check for NaN**:
   ```typescript
   const totalGuests = value.reduce((sum, req) => {
     const guests = parseInt(req.guests_per_unit) || 0; // ✅ Parse to ensure number
     return sum + guests;
   }, 0);
   ```

---

### Symptom: Totals don't update when changing guest count

**Cause**: State not updating correctly.

**Solution**:

1. **Verify onChange callback** updates parent state:

   ```typescript
   // Parent component
   const [unitRequests, setUnitRequests] = useState<UnitRequest[]>([]);

   <UnitRequestSelector
     value={unitRequests}
     onChange={setUnitRequests} // ✅ Updates state
   />
   ```

2. **Check handleUpdateRequest** creates new array:
   ```typescript
   const handleUpdateRequest = (index: number, guests: number) => {
     const newRequests = [...value]; // ✅ Create new array (don't mutate)
     newRequests[index] = { guests_per_unit: guests };
     onChange(newRequests);
   };
   ```

---

## Responsive Design Issues

### Symptom: Horizontal scrolling on mobile

**Cause**: Fixed widths or missing container classes.

**Solution**:

1. **Add container classes**:

   ```typescript
   <div className="container mx-auto px-4">
     {/* Your components */}
   </div>
   ```

2. **Use responsive grid**:

   ```typescript
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
     {/* Collapses to 1 column on mobile */}
   </div>
   ```

3. **Remove fixed widths**:

   ```typescript
   // ❌ Bad
   <div className="w-[800px]">

   // ✅ Good
   <div className="w-full max-w-2xl">
   ```

---

### Symptom: Components not stacking correctly on mobile

**Cause**: Flex or grid layout not responsive.

**Solution**:

1. **Use responsive flex**:

   ```typescript
   <div className="flex flex-col md:flex-row gap-4">
     {/* Vertical on mobile, horizontal on desktop */}
   </div>
   ```

2. **Use responsive grid**:
   ```typescript
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
     {/* 1 column on mobile, 2 on large screens */}
   </div>
   ```

---

## Build Errors

### Symptom: "Module not found: Can't resolve '@/components/ui/X'"

**Cause**: shadcn/ui component not installed.

**Solution**:

1. **Install missing component**:

   ```bash
   npx shadcn@latest add card
   npx shadcn@latest add button
   npx shadcn@latest add input
   npx shadcn@latest add label
   npx shadcn@latest add alert
   npx shadcn@latest add skeleton
   ```

2. **Verify component files exist**:
   ```bash
   ls src/components/ui/
   ```

---

### Symptom: "Type error in production build"

**Cause**: Stricter checks in production mode.

**Solution**:

1. **Run type-check locally**:

   ```bash
   npm run type-check
   ```

2. **Fix all TypeScript errors** before building

3. **Check tsconfig.json** production settings:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true
     }
   }
   ```

---

## Still Stuck?

### Debug Checklist

Before seeking help, verify:

1. **Prerequisites completed**:
   - [ ] Chunk 004 completed (API endpoints deployed)
   - [ ] shadcn/ui installed
   - [ ] React Hook Form installed
   - [ ] TypeScript compiling without errors

2. **Code matches examples**:
   - [ ] Component file names match exactly
   - [ ] Import paths use `@/` alias
   - [ ] TypeScript types match interfaces

3. **Environment setup**:
   - [ ] Node.js version compatible (18+)
   - [ ] Dependencies installed (`npm install`)
   - [ ] Dev server running (`npm run dev`)

### Get Help

1. **Check source documentation**:
   - `03-frontend-components.md` lines 1-550
   - `09-implementation-decisions.md` lines 9-38

2. **Review related chunks**:
   - Chunk 004: API endpoints (dependencies)
   - Chunk 007: Next chunk (what you're building toward)

3. **Search error messages**:
   - Copy exact error message
   - Search in project docs
   - Search GitHub issues

4. **Escalation path**:
   - Review CHUNKING-STRATEGY.md architectural principles
   - Check ADRs in 10-architecture-decisions-record.md
   - Consult with senior developer
   - Create detailed issue with:
     - Error message
     - Steps to reproduce
     - Expected vs actual behavior
     - Code snippets
     - Screenshots

---

**Remember**: Most issues are typos, missing imports, or incorrect prop types. Double-check the basics first! 🐛
