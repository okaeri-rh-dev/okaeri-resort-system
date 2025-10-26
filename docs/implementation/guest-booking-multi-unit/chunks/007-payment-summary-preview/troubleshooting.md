# Chunk 007: Payment Summary with Preview - Troubleshooting Guide

## Purpose

This guide helps you resolve common issues encountered during Chunk 007 implementation. Issues are organized by symptom with specific solutions.

---

## TypeScript Compilation Errors

### Symptom: "Cannot find type 'PricingPreview'"

**Cause**: Type not exported or file not found.

**Solution**:

1. **Verify type exists and is exported**:

   ```bash
   grep -A 15 "export interface PricingPreview" src/types/guest-booking-multi-unit.ts
   ```

2. **Check import statement** in PaymentSummary.tsx:

   ```typescript
   // Correct
   // Incorrect (missing 'type' keyword)
   import { PricingPreview, type PricingPreview } from "@/types/guest-booking-multi-unit";
   ```

3. **Restart TypeScript server** in your editor

---

### Symptom: "Property 'discount' is possibly undefined"

**Cause**: TypeScript strict null checking on optional property.

**Solution**:

This is expected behavior - `discount` is optional in PricingPreview.

**Option 1: Optional chaining** (recommended):

```typescript
// Correct
{
  pricing.discount?.percent;
}
{
  pricing.discount?.amount;
}

// Incorrect (will cause error)
{
  pricing.discount.percent;
}
```

**Option 2: Conditional rendering**:

```typescript
{pricing.discount && (
  <div>
    Discount: {pricing.discount.percent}%
  </div>
)}
```

---

### Symptom: "Type 'Date | undefined' is not assignable to type 'Date'"

**Cause**: checkIn/checkOut props may be undefined.

**Solution**:

Update useEffect to handle undefined dates:

```typescript
useEffect(() => {
  // Early return if missing required data
  if (unitRequests.length === 0 || !checkIn || !checkOut) {
    setPricing(null);
    return; // ✅ Handles undefined dates
  }

  // ... rest of code
}, [unitRequests, checkIn, checkOut]);
```

---

## API Endpoint Errors

### Symptom: "Failed to fetch pricing preview: 404 Not Found"

**Cause**: Preview endpoint not deployed or incorrect URL.

**Solution**:

1. **Verify endpoint exists** (from Chunk 004):

   ```bash
   curl -X POST https://your-domain.com/api/guest-booking/preview-pricing \
     -H "Content-Type: application/json" \
     -d '{"unit_requests":[{"guests_per_unit":2}],"check_in":"2025-02-01T00:00:00Z","check_out":"2025-02-08T00:00:00Z"}'
   ```

   Expected: HTTP 200 with pricing data

2. **Check API_BASE constant** in guest-booking-client.ts:

   ```typescript
   // For production
   const API_BASE = "/api/guest-booking";

   // For local development (adjust port)
   const API_BASE = "http://localhost:8787/api/guest-booking";
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

### Symptom: "Failed to fetch pricing preview: 500 Internal Server Error"

**Cause**: Server-side error in PostgreSQL function or endpoint.

**Solution**:

1. **Check server logs** for detailed error:

   ```bash
   # For Cloudflare Workers
   wrangler tail

   # Or check browser Network tab → Response
   ```

2. **Test PostgreSQL function directly**:

   ```sql
   SELECT calculate_booking_pricing(
     ARRAY[ROW(2)::guest_unit_request],
     '2025-02-01'::DATE,
     '2025-02-08'::DATE
   );
   ```

   If function errors, see Chunk 002 troubleshooting.

3. **Verify pricing_config data exists**:

   ```sql
   SELECT * FROM pricing_config WHERE id = 'default';
   ```

   If no row, insert default data (see Chunk 001).

---

### Symptom: "CORS policy blocked the request"

**Cause**: API endpoint doesn't allow requests from frontend origin.

**Solution**:

1. **Add CORS headers** in preview endpoint (Chunk 004):

   ```typescript
   // File: functions/api/guest-booking/preview-pricing.ts
   const corsHeaders = {
     "Access-Control-Allow-Origin": "*", // Or specific domain
     "Access-Control-Allow-Methods": "POST, OPTIONS",
     "Access-Control-Allow-Headers": "Content-Type",
   };

   if (request.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }

   // Include in response
   return new Response(JSON.stringify(data), {
     headers: { ...corsHeaders, "Content-Type": "application/json" },
   });
   ```

2. **For local development**, add proxy in vite.config.ts:
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

## Component Rendering Issues

### Symptom: PaymentSummary doesn't appear

**Cause**: Props not passed correctly or component not imported.

**Solution**:

1. **Verify component imported** in parent:

   ```typescript
   import { PaymentSummary } from "@/components/guest-booking/PaymentSummary";
   ```

2. **Check props passed** correctly:

   ```typescript
   <PaymentSummary
     unitRequests={unitRequests}  // Must be UnitRequest[] array
     checkIn={checkIn}             // Must be Date object (or undefined)
     checkOut={checkOut}           // Must be Date object (or undefined)
   />
   ```

3. **Debug props in parent component**:

   ```typescript
   console.log("PaymentSummary props:", {
     unitRequests,
     checkIn,
     checkOut,
   });
   ```

4. **Check browser console** for errors

---

### Symptom: Component shows "Add units to see pricing" even when units selected

**Cause**: unitRequests array empty or not passed correctly.

**Solution**:

1. **Verify unitRequests is array**:

   ```typescript
   // Correct
   const unitRequests: UnitRequest[] = [{ guests_per_unit: 2 }];

   // Incorrect (object, not array)
   const unitRequests = { guests_per_unit: 2 };
   ```

2. **Check state updates** in parent:

   ```typescript
   const [unitRequests, setUnitRequests] = useState<UnitRequest[]>([]);

   // Ensure UnitRequestSelector updates state
   <UnitRequestSelector
     value={unitRequests}
     onChange={setUnitRequests} // ✅ Must be setState function
   />
   ```

---

## Pricing Update Issues

### Symptom: Pricing doesn't update when form changes

**Cause**: useEffect dependencies missing or incorrect.

**Solution**:

1. **Verify dependencies array**:

   ```typescript
   useEffect(() => {
     // ...
   }, [unitRequests, checkIn, checkOut]); // ✅ All 3 required
   ```

2. **Check state immutability**:

   ```typescript
   // Correct (creates new array)
   setUnitRequests([...unitRequests, newUnit]);

   // Incorrect (mutates array, React won't detect change)
   unitRequests.push(newUnit);
   setUnitRequests(unitRequests);
   ```

3. **Debug useEffect trigger**:
   ```typescript
   useEffect(() => {
     console.log("useEffect triggered:", { unitRequests, checkIn, checkOut });
     // ...
   }, [unitRequests, checkIn, checkOut]);
   ```

---

### Symptom: Pricing updates too frequently (API called on every keystroke)

**Cause**: Debouncing not working correctly.

**Solution**:

1. **Verify debounce structure**:

   ```typescript
   useEffect(() => {
     const timer = setTimeout(() => {
       fetchPricing(); // ✅ Only called after 500ms
     }, 500);

     return () => clearTimeout(timer); // ✅ Cleanup required
   }, [unitRequests, checkIn, checkOut]);
   ```

2. **Check cleanup function** returns clearTimeout:

   ```typescript
   return () => clearTimeout(timer); // Must be arrow function
   ```

3. **Test debouncing** in Network tab:
   - Rapidly change guest count 5 times
   - Should see only 1 API call after 500ms

---

## Debouncing Not Working

### Symptom: Multiple API calls on rapid changes

**Cause**: Debounce timer not being cleared properly.

**Solution**:

1. **Verify useEffect cleanup**:

   ```typescript
   useEffect(() => {
     const timer = setTimeout(() => {
       fetchPricing();
     }, 500);

     // ✅ Cleanup function must return clearTimeout
     return () => clearTimeout(timer);
   }, [unitRequests, checkIn, checkOut]);
   ```

2. **Don't use async useEffect**:

   ```typescript
   // ❌ Wrong (async useEffect breaks cleanup)
   useEffect(async () => {
     await fetchPricing();
   }, []);

   // ✅ Correct (async inside setTimeout)
   useEffect(() => {
     const timer = setTimeout(() => {
       async function fetchPricing() {
         // ...
       }
       fetchPricing();
     }, 500);

     return () => clearTimeout(timer);
   }, [unitRequests, checkIn, checkOut]);
   ```

---

### Symptom: No debouncing (instant API calls)

**Cause**: setTimeout not set or delay value incorrect.

**Solution**:

1. **Verify setTimeout delay**:

   ```typescript
   setTimeout(() => {
     fetchPricing();
   }, 500); // ✅ 500ms delay
   ```

2. **Check no conflicting useEffect**:

   ```typescript
   // ❌ Wrong (second useEffect bypasses debounce)
   useEffect(() => {
     fetchPricing(); // Instant call
   }, [unitRequests]);

   useEffect(() => {
     const timer = setTimeout(() => fetchPricing(), 500);
     return () => clearTimeout(timer);
   }, [unitRequests]);

   // ✅ Correct (only one useEffect)
   useEffect(() => {
     const timer = setTimeout(() => fetchPricing(), 500);
     return () => clearTimeout(timer);
   }, [unitRequests]);
   ```

---

## Discount Display Issues

### Symptom: Discount exists in API response but not shown in UI

**Cause**: Conditional rendering incorrect or property path wrong.

**Solution**:

1. **Verify API response** has discount:

   ```javascript
   // In browser console (DevTools → Network → Response)
   {
     "pricing": {
       "discount": {
         "percent": 5,
         "amount": 750,
         "rule_name": "7-Night Discount"
       }
     }
   }
   ```

2. **Check conditional rendering**:

   ```typescript
   {pricing.discount && ( // ✅ Correct
     <div>Discount: {pricing.discount.percent}%</div>
   )}

   {pricing.discount ? ( // ✅ Also correct
     <div>Discount</div>
   ) : null}
   ```

3. **Verify property names** match exactly:

   ```typescript
   // Correct
   pricing.discount.percent;
   pricing.discount.amount;
   pricing.discount.rule_name;

   // Incorrect (typos)
   pricing.discount.percentage;
   pricing.discount.value;
   ```

---

### Symptom: Wrong discount rule applied

**Cause**: Server-side logic issue (PostgreSQL function).

**Solution**:

This is NOT a frontend issue - discount calculation happens server-side.

1. **Test PostgreSQL function** directly:

   ```sql
   SELECT calculate_booking_pricing(
     ARRAY[ROW(2)::guest_unit_request],
     '2025-02-01'::DATE,
     '2025-02-15'::DATE  -- 14 nights
   );
   ```

2. **Verify discount_rules table**:

   ```sql
   SELECT * FROM discount_rules WHERE is_active = true ORDER BY priority DESC;
   ```

3. **Check best-of policy** (highest discount wins):
   - If multiple rules match, only highest discount applied
   - See Chunk 002 for discount evaluation logic

**Solution**: See Chunk 002 troubleshooting for PostgreSQL function issues.

---

## Weekend Surcharge Incorrect

### Symptom: Weekend surcharge shows wrong amount

**Cause**: Server-side calculation issue (not frontend).

**Solution**:

1. **Verify pricing_config**:

   ```sql
   SELECT base_rate, weekend_rate FROM pricing_config WHERE id = 'default';
   ```

2. **Test weekend detection**:

   ```sql
   -- Check if Friday/Saturday detected correctly
   SELECT EXTRACT(DOW FROM '2025-02-07'::DATE); -- 5 = Friday, 6 = Saturday
   ```

3. **Calculate expected surcharge manually**:

   ```
   Weekend Rate - Base Rate = Surcharge per night
   ₱2,500 - ₱2,000 = ₱500

   Number of weekend nights in stay = N
   Expected surcharge = ₱500 × N
   ```

4. **If calculation wrong**, see Chunk 002 for PostgreSQL function debugging.

---

## Extra Person Fees Incorrect

### Symptom: Extra person fees show wrong amount

**Cause**: Server-side calculation issue.

**Solution**:

1. **Verify pricing_config**:

   ```sql
   SELECT base_occupancy, extra_person_rate FROM pricing_config WHERE id = 'default';
   ```

2. **Calculate expected fees manually**:

   ```
   Extra persons = Guests - Base Occupancy
   Extra persons = 5 - 2 = 3

   Fee per extra person per night = ₱300
   Nights = 7

   Expected fees = 3 × ₱300 × 7 = ₱6,300
   ```

3. **Test with different guest counts**:
   - At base occupancy (2 guests): Fees should be ₱0
   - Above base (5 guests): Fees should be positive

4. **If calculation wrong**, see Chunk 002 for PostgreSQL function debugging.

---

## Loading and Error States

### Symptom: Loading state never appears

**Cause**: API call too fast to see loading state.

**Solution**:

This is actually GOOD behavior (fast API).

**To test loading state**:

1. Open DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Change form data
4. Should see "Calculating Pricing..." for several seconds

**If never shows even on slow network**:

```typescript
// Verify setLoading(true) called before fetch
setLoading(true);
try {
  const response = await previewPricing(...);
  // ...
} finally {
  setLoading(false); // ✅ Always called
}
```

---

### Symptom: Error state doesn't clear after successful retry

**Cause**: Error state not reset before new fetch.

**Solution**:

```typescript
async function fetchPricing() {
  setLoading(true);
  setError(null); // ✅ Reset error before fetching

  try {
    const response = await previewPricing(...);
    setPricing(response.pricing);
  } catch (err) {
    setError('Unable to calculate pricing');
  } finally {
    setLoading(false);
  }
}
```

---

### Symptom: Component crashes on API error

**Cause**: Missing error handling or try/catch.

**Solution**:

1. **Wrap API call in try/catch**:

   ```typescript
   try {
     const response = await previewPricing(...);
     setPricing(response.pricing);
   } catch (err) {
     console.error('[PaymentSummary] Error:', err);
     setError('Unable to calculate pricing');
     // Component continues to function
   }
   ```

2. **Add error boundary** (optional, for production):

   ```typescript
   import { ErrorBoundary } from 'react-error-boundary';

   <ErrorBoundary fallback={<div>Something went wrong</div>}>
     <PaymentSummary {...props} />
   </ErrorBoundary>
   ```

---

## Preview Warning Missing

### Symptom: Warning banner doesn't appear

**Cause**: Component structure incorrect or conditional rendering hiding it.

**Solution**:

1. **Verify banner rendered** before pricing card:

   ```typescript
   return (
     <div className="space-y-4">
       {/* ✅ Warning BEFORE card */}
       <Alert variant="warning">
         <AlertTriangle className="h-4 w-4" />
         <AlertDescription>
           <strong>Preview Only</strong> - Final pricing calculated...
         </AlertDescription>
       </Alert>

       {/* Pricing card */}
       <Card>...</Card>
     </div>
   );
   ```

2. **Check Alert variant** exists:

   ```bash
   # Verify Alert component supports variant="warning"
   grep "variant.*warning" src/components/ui/alert.tsx
   ```

3. **Add custom variant** if needed:
   ```typescript
   // In alert.tsx
   const alertVariants = cva("...", {
     variants: {
       variant: {
         default: "...",
         destructive: "...",
         warning: "bg-yellow-50 text-yellow-900 border-yellow-200", // Add this
       },
     },
   });
   ```

---

## Responsive Design Issues

### Symptom: Line items wrap awkwardly on mobile

**Cause**: Insufficient space for long text + amounts.

**Solution**:

1. **Use flex with proper justify**:

   ```typescript
   <div className="flex justify-between">
     <span className="text-sm">Base Total:</span>
     <span className="text-sm font-medium">₱{pricing.base_total.toLocaleString()}</span>
   </div>
   ```

2. **Add truncate for long labels**:

   ```typescript
   <span className="text-sm truncate">Very Long Label Name:</span>
   ```

3. **Stack on very small screens**:
   ```typescript
   <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
     <span>Label:</span>
     <span>Amount</span>
   </div>
   ```

---

### Symptom: Badge overflows on narrow screens

**Cause**: Badge text too long for container.

**Solution**:

1. **Truncate badge text**:

   ```typescript
   <Badge variant="secondary" className="text-xs max-w-[150px] truncate">
     {pricing.discount.rule_name}
   </Badge>
   ```

2. **Stack badge on mobile**:
   ```typescript
   <div className="flex flex-col sm:flex-row sm:items-center gap-2">
     <span>Discount ({pricing.discount.percent}%)</span>
     <Badge variant="secondary">{pricing.discount.rule_name}</Badge>
   </div>
   ```

---

## Test Failures

### Symptom: "previewPricing is not a function"

**Cause**: Mock not set up correctly.

**Solution**:

1. **Verify mock at top of test file**:

   ```typescript
   vi.mock("@/lib/api/guest-booking-client", () => ({
     previewPricing: vi.fn(() =>
       Promise.resolve({
         success: true,
         pricing: {
           /* ... */
         },
       })
     ),
   }));
   ```

2. **Check import path** matches:

   ```typescript
   // Test file
   vi.mock('@/lib/api/guest-booking-client', ...);

   // Component file
   import { previewPricing } from '@/lib/api/guest-booking-client';
   ```

---

### Symptom: "Test times out after 5000ms"

**Cause**: Mock returns unresolved promise.

**Solution**:

1. **Ensure mock returns resolved Promise**:

   ```typescript
   vi.fn(() => Promise.resolve({...})) // ✅ Resolves
   // NOT: vi.fn(() => new Promise(() => {})) // ❌ Never resolves
   ```

2. **Use fake timers** for debounce tests:

   ```typescript
   beforeEach(() => {
     vi.useFakeTimers();
   });

   afterEach(() => {
     vi.useRealTimers();
   });

   it("debounces", () => {
     // ...
     vi.advanceTimersByTime(500);
     // ...
   });
   ```

---

## Still Stuck?

### Debug Checklist

Before seeking help, verify:

1. **Prerequisites completed**:
   - [ ] Chunk 002 completed (PostgreSQL function deployed)
   - [ ] Chunk 004 completed (preview endpoint operational)
   - [ ] Chunk 006 completed (form state exists)

2. **Code matches examples**:
   - [ ] Component code matches instructions exactly
   - [ ] Import paths use `@/` alias
   - [ ] TypeScript types imported correctly

3. **API endpoint working**:
   - [ ] curl test returns HTTP 200
   - [ ] Response shape matches PricingPreview interface
   - [ ] No CORS errors in browser console

### Get Help

1. **Check source documentation**:
   - `03-frontend-components.md` lines 555-754
   - `02-api-specification.md` lines 645-737

2. **Review related chunks**:
   - Chunk 002: PostgreSQL pricing function (server-side logic)
   - Chunk 004: API endpoints (preview endpoint)
   - Chunk 006: Form state (data source)

3. **Escalation path**:
   - Review CHUNKING-STRATEGY.md architectural principles
   - Check ADR-005 (server-side pricing authority)
   - Consult with senior developer
   - Create detailed issue with:
     - API response (from Network tab)
     - Component props (console.log)
     - Expected vs actual behavior
     - Code snippets
     - Screenshots

---

**Remember**: Most pricing issues are server-side (PostgreSQL function), not frontend. If calculations are wrong, check Chunk 002 first! 🐛
