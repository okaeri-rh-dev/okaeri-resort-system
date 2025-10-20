# Guest Booking System - Optional Enhancements Detailed Plan

## Overview

This document provides comprehensive implementation plans for optional enhancements to the guest booking system. These enhancements can be implemented after core functionality is stable and operational needs are met.

## Enhancement Categories

1. **Admin Experience Enhancements** - Streamline admin workflows
2. **Guest Experience Improvements** - Better UX for guests
3. **Automation & Intelligence** - Reduce manual work
4. **Analytics & Reporting** - Business intelligence features
5. **Integration Expansions** - Third-party service integrations
6. **Security Hardening** - Advanced security features

---

## 1. Admin Experience Enhancements

### 1.1 Status Timeline Widget with Activity Feed

**Purpose:** Visual representation of booking lifecycle with detailed activity tracking.

**Implementation Plan:**

```typescript
// src/components/bookings/EnhancedTimeline.tsx
interface TimelineActivity {
  id: string;
  timestamp: string;
  actor: string; // User who performed action
  action: string;
  details: Record<string, any>;
  icon: React.ComponentType;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

const EnhancedTimeline: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  // Real-time subscription to audit logs
  const { data: activities } = useSubscription({
    channel: `booking-activity:${bookingId}`,
    event: 'activity',
  });

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      {activities.map((activity, index) => (
        <TimelineNode
          key={activity.id}
          activity={activity}
          isFirst={index === 0}
          isLast={index === activities.length - 1}
        />
      ))}
    </div>
  );
};
```

**Database Requirements:**

```sql
-- Add activity tracking table
CREATE TABLE booking_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_activities_booking_id
ON booking_activities(booking_id, created_at DESC);
```

**Real-time Updates:**

```typescript
// Supabase real-time subscription
const subscription = supabase
  .channel(`booking-activity:${bookingId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "booking_activities",
      filter: `booking_id=eq.${bookingId}`,
    },
    (payload) => {
      addActivityToTimeline(payload.new);
    }
  )
  .subscribe();
```

### 1.2 Bulk Operations for Guest Bookings

**Purpose:** Process multiple guest bookings simultaneously.

**Features:**

- Bulk confirmation
- Bulk date adjustment
- Bulk email sending
- Bulk status updates

**Implementation:**

```typescript
// src/components/bookings/BulkOperationsToolbar.tsx
interface BulkOperation {
  id: string;
  label: string;
  icon: React.ComponentType;
  action: (bookingIds: string[]) => Promise<void>;
  requiresConfirmation: boolean;
  allowedStatuses?: BookingStatus[];
}

const bulkOperations: BulkOperation[] = [
  {
    id: "confirm",
    label: "Confirm Selected",
    icon: CheckCircleIcon,
    action: async (ids) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          booking_status: "Confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: currentUser.email,
        })
        .in("id", ids);

      if (!error) {
        // Send confirmation emails in batch
        await sendBulkEmails(ids, "confirmation");
      }
    },
    requiresConfirmation: true,
    allowedStatuses: ["Pending"],
  },
  {
    id: "adjust_dates",
    label: "Adjust Dates",
    icon: CalendarIcon,
    action: async (ids) => {
      openBulkDateAdjustmentModal(ids);
    },
    requiresConfirmation: false,
    allowedStatuses: ["Pending"],
  },
];
```

**Batch Processing with Progress:**

```typescript
// src/hooks/useBulkOperation.ts
export function useBulkOperation() {
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const executeBulk = async (items: string[], operation: (id: string) => Promise<void>) => {
    setIsProcessing(true);
    setProgress({ current: 0, total: items.length });

    const results = [];
    for (let i = 0; i < items.length; i++) {
      try {
        await operation(items[i]);
        results.push({ id: items[i], success: true });
      } catch (error) {
        results.push({ id: items[i], success: false, error });
      }
      setProgress({ current: i + 1, total: items.length });
    }

    setIsProcessing(false);
    return results;
  };

  return { executeBulk, progress, isProcessing };
}
```

### 1.3 Advanced Filtering & Search

**Purpose:** Complex queries for finding specific bookings.

**Features:**

- Multi-field search
- Date range filters
- Amount range filters
- Guest history lookup
- Saved filter presets

**Implementation:**

```typescript
// src/components/bookings/AdvancedFilterPanel.tsx
interface FilterPreset {
  id: string;
  name: string;
  filters: FilterConfig;
  isDefault?: boolean;
}

interface FilterConfig {
  searchQuery?: string;
  dateRange?: { from: Date; to: Date };
  amountRange?: { min: number; max: number };
  statuses?: BookingStatus[];
  bookingTypes?: ('guest' | 'authenticated')[];
  units?: string[];
  uploadStatuses?: string[];
}

const AdvancedFilterPanel: React.FC = () => {
  const [filters, setFilters] = useState<FilterConfig>({});
  const [presets, setPresets] = useLocalStorage<FilterPreset[]>('booking-filter-presets', []);

  const applyFilters = () => {
    const query = buildSupabaseQuery(filters);
    fetchFilteredBookings(query);
  };

  const savePreset = (name: string) => {
    const newPreset: FilterPreset = {
      id: nanoid(),
      name,
      filters: { ...filters }
    };
    setPresets([...presets, newPreset]);
    toast.success('Filter preset saved');
  };

  return (
    <Collapsible>
      <CollapsibleTrigger>
        <Button variant="outline">
          <FilterIcon className="mr-2" />
          Advanced Filters
          {Object.keys(filters).length > 0 && (
            <Badge className="ml-2">{Object.keys(filters).length}</Badge>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Filter UI components */}
      </CollapsibleContent>
    </Collapsible>
  );
};
```

**Query Builder:**

```typescript
function buildSupabaseQuery(filters: FilterConfig) {
  let query = supabase.from("bookings").select("*");

  if (filters.searchQuery) {
    query = query.or(`
      booking_reference.ilike.%${filters.searchQuery}%,
      email.ilike.%${filters.searchQuery}%,
      guest_name.ilike.%${filters.searchQuery}%
    `);
  }

  if (filters.dateRange) {
    query = query
      .gte("check_in_date", filters.dateRange.from.toISOString())
      .lte("check_out_date", filters.dateRange.to.toISOString());
  }

  if (filters.amountRange) {
    query = query
      .gte("total_amount", filters.amountRange.min)
      .lte("total_amount", filters.amountRange.max);
  }

  // Additional filters...
  return query;
}
```

### 1.4 Email Template Editor

**Purpose:** Customize email templates without code changes.

**Features:**

- Visual template editor
- Variable insertion
- Preview with real data
- Multi-language support
- A/B testing capability

**Implementation:**

```typescript
// src/components/admin/EmailTemplateEditor.tsx
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  language: string;
  isActive: boolean;
}

const EmailTemplateEditor: React.FC = () => {
  const [template, setTemplate] = useState<EmailTemplate>();
  const [previewData, setPreviewData] = useState<Record<string, any>>();

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        {/* Editor */}
        <MonacoEditor
          language="handlebars"
          value={template?.body}
          onChange={handleTemplateChange}
          options={{
            minimap: { enabled: false },
            wordWrap: 'on'
          }}
        />

        {/* Variable palette */}
        <VariablePalette
          variables={availableVariables}
          onInsert={insertVariable}
        />
      </div>

      <div>
        {/* Live preview */}
        <EmailPreview
          template={template}
          data={previewData}
          mode="desktop"
        />
      </div>
    </div>
  );
};
```

**Database Schema:**

```sql
CREATE TABLE email_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  template_key TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[],
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template versions for rollback
CREATE TABLE email_template_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES email_templates(id),
  version INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Guest Experience Improvements

### 2.1 Multi-Language Support

**Purpose:** Support international guests with localized content.

**Implementation:**

```typescript
// src/i18n/config.ts
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: await import("./locales/en.json"),
  },
  fil: {
    translation: await import("./locales/fil.json"),
  },
  zh: {
    translation: await import("./locales/zh.json"),
  },
  ko: {
    translation: await import("./locales/ko.json"),
  },
  ja: {
    translation: await import("./locales/ja.json"),
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
```

**Component Usage:**

```typescript
// src/components/guest-booking/LocalizedGuestForm.tsx
import { useTranslation } from 'react-i18next';

const LocalizedGuestForm: React.FC = () => {
  const { t, i18n } = useTranslation();

  return (
    <form>
      <LanguageSelector
        current={i18n.language}
        onChange={i18n.changeLanguage}
      />

      <FormField
        label={t('booking.checkIn')}
        placeholder={t('booking.selectDate')}
      />

      <Button type="submit">
        {t('booking.submitButton')}
      </Button>
    </form>
  );
};
```

### 2.2 Progressive Web App (PWA) Features

**Purpose:** Offline capability and native app-like experience.

**Implementation:**

```typescript
// src/service-worker.ts
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/guest-booking/status"),
  new StaleWhileRevalidate({
    cacheName: "booking-status-cache",
  })
);

// Offline fallback for booking form
registerRoute(
  ({ url }) => url.pathname === "/guest-booking",
  new CacheFirst({
    cacheName: "booking-form-cache",
  })
);

// Background sync for form submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "submit-booking") {
    event.waitUntil(submitPendingBookings());
  }
});
```

**Offline Queue:**

```typescript
// src/lib/offline-queue.ts
class OfflineBookingQueue {
  private db: IDBDatabase;

  async addBooking(bookingData: GuestBookingData) {
    const tx = this.db.transaction(["pending_bookings"], "readwrite");
    await tx.objectStore("pending_bookings").add({
      ...bookingData,
      id: nanoid(),
      timestamp: Date.now(),
    });

    // Register sync event
    if ("serviceWorker" in navigator && "SyncManager" in window) {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register("submit-booking");
    }
  }

  async processPendingBookings() {
    const bookings = await this.getPendingBookings();

    for (const booking of bookings) {
      try {
        await submitBookingToAPI(booking);
        await this.removeBooking(booking.id);
      } catch (error) {
        console.error("Failed to submit booking:", booking.id);
      }
    }
  }
}
```

### 2.3 SMS Notifications

**Purpose:** Text message updates for booking status.

**Implementation:**

```typescript
// functions/api/sms-notification.ts
import { Twilio } from "twilio";

const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

export async function sendSMSNotification(
  phoneNumber: string,
  message: string,
  templateId?: string
) {
  // Validate phone number format
  const formattedNumber = formatPhilippineNumber(phoneNumber);

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: formattedNumber,
    });

    // Log to audit trail
    await logAuditEvent({
      action: "sms_sent",
      category: "notification",
      metadata: {
        recipient: formattedNumber,
        template: templateId,
        status: result.status,
      },
    });

    return result;
  } catch (error) {
    console.error("SMS send failed:", error);
    throw error;
  }
}
```

**Opt-in Management:**

```sql
CREATE TABLE sms_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id),
  phone_number TEXT NOT NULL,
  opted_in BOOLEAN DEFAULT false,
  opt_in_date TIMESTAMPTZ,
  opt_out_date TIMESTAMPTZ,
  notification_types TEXT[] DEFAULT ARRAY['booking_confirmation', 'check_in_reminder'],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Automation & Intelligence

### 3.1 AI-Powered Receipt Validation

**Purpose:** Automatically validate payment receipts using OCR and ML.

**Implementation:**

```typescript
// functions/api/validate-receipt.ts
import OpenAI from "openai";
import { createWorker } from "tesseract.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function validateReceipt(imageUrl: string, expectedAmount: number) {
  // Step 1: OCR to extract text
  const worker = await createWorker("eng");
  const {
    data: { text },
  } = await worker.recognize(imageUrl);
  await worker.terminate();

  // Step 2: Use GPT to parse receipt
  const completion = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "system",
        content:
          "Extract payment information from this receipt. Return JSON with: amount, date, reference_number, payment_method.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract payment details from this receipt" },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const extractedData = JSON.parse(completion.choices[0].message.content);

  // Step 3: Validate against booking
  const validation = {
    isValid: Math.abs(extractedData.amount - expectedAmount) < 1,
    confidence: calculateConfidence(extractedData),
    extractedData,
    issues: [],
  };

  if (extractedData.amount !== expectedAmount) {
    validation.issues.push(
      `Amount mismatch: Expected ${expectedAmount}, found ${extractedData.amount}`
    );
  }

  return validation;
}
```

**Confidence Scoring:**

```typescript
function calculateConfidence(data: ExtractedReceipt): number {
  let confidence = 0;

  // Check for required fields
  if (data.amount) confidence += 0.3;
  if (data.date) confidence += 0.2;
  if (data.reference_number) confidence += 0.3;
  if (data.payment_method) confidence += 0.2;

  // Adjust for data quality
  if (isValidPhilippineReceipt(data)) confidence += 0.2;

  return Math.min(confidence, 1.0);
}
```

### 3.2 Smart Availability Suggestions

**Purpose:** AI-powered alternative date suggestions when requested dates unavailable.

**Implementation:**

```typescript
// src/lib/availability-ai.ts
interface AvailabilitySuggestion {
  dates: { checkIn: Date; checkOut: Date };
  score: number;
  reason: string;
  priceComparison: "lower" | "same" | "higher";
}

export async function suggestAlternativeDates(
  unitId: string,
  requestedCheckIn: Date,
  requestedCheckOut: Date,
  preferences?: {
    flexibleDates?: boolean;
    maxPriceDifference?: number;
    preferWeekends?: boolean;
  }
): Promise<AvailabilitySuggestion[]> {
  const suggestions: AvailabilitySuggestion[] = [];

  // Strategy 1: Shift dates by 1-3 days
  for (let shift = -3; shift <= 3; shift++) {
    if (shift === 0) continue;

    const shiftedCheckIn = addDays(requestedCheckIn, shift);
    const shiftedCheckOut = addDays(requestedCheckOut, shift);

    if (await checkAvailability(unitId, shiftedCheckIn, shiftedCheckOut)) {
      suggestions.push({
        dates: { checkIn: shiftedCheckIn, checkOut: shiftedCheckOut },
        score: 1 - Math.abs(shift) * 0.2,
        reason: `Available ${Math.abs(shift)} day(s) ${shift > 0 ? "later" : "earlier"}`,
        priceComparison: calculatePriceDifference(shift),
      });
    }
  }

  // Strategy 2: Shorter stay options
  const nights = differenceInDays(requestedCheckOut, requestedCheckIn);
  if (nights > 2) {
    for (let reduction = 1; reduction <= 2; reduction++) {
      const shorterCheckOut = addDays(requestedCheckOut, -reduction);
      if (await checkAvailability(unitId, requestedCheckIn, shorterCheckOut)) {
        suggestions.push({
          dates: { checkIn: requestedCheckIn, checkOut: shorterCheckOut },
          score: 0.7 - reduction * 0.1,
          reason: `${nights - reduction} nights instead of ${nights}`,
          priceComparison: "lower",
        });
      }
    }
  }

  // Sort by score
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
}
```

**UI Component:**

```typescript
// src/components/bookings/AlternativeDatesSuggestion.tsx
const AlternativeDatesSuggestion: React.FC<{
  suggestions: AvailabilitySuggestion[];
  onSelect: (suggestion: AvailabilitySuggestion) => void;
}> = ({ suggestions, onSelect }) => {
  return (
    <Alert>
      <AlertTitle>
        Selected dates unavailable - try these alternatives:
      </AlertTitle>
      <div className="mt-4 space-y-2">
        {suggestions.map((suggestion, index) => (
          <Card
            key={index}
            className="cursor-pointer hover:border-primary"
            onClick={() => onSelect(suggestion)}
          >
            <CardContent className="flex justify-between items-center p-3">
              <div>
                <p className="font-medium">
                  {format(suggestion.dates.checkIn, 'MMM d')} -
                  {format(suggestion.dates.checkOut, 'MMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {suggestion.reason}
                </p>
              </div>
              <Badge variant={
                suggestion.priceComparison === 'lower' ? 'success' :
                suggestion.priceComparison === 'higher' ? 'warning' :
                'default'
              }>
                {suggestion.priceComparison === 'lower' ? 'Lower price' :
                 suggestion.priceComparison === 'higher' ? 'Higher price' :
                 'Same price'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </Alert>
  );
};
```

### 3.3 Automated Follow-ups

**Purpose:** Automated email/SMS for abandoned bookings and confirmations.

**Implementation:**

```typescript
// functions/cron/booking-follow-ups.ts
export async function processBookingFollowUps() {
  // 1. Abandoned cart recovery (started but not completed)
  const abandonedBookings = await supabase
    .from("bookings")
    .select("*")
    .eq("is_guest_booking", true)
    .eq("upload_status", "pending")
    .lt("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // 2 hours old
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Less than 24 hours
    .is("follow_up_sent", null);

  for (const booking of abandonedBookings.data || []) {
    await sendFollowUpEmail(booking, "abandoned_cart");
    await markFollowUpSent(booking.id, "abandoned_cart");
  }

  // 2. Check-in reminders (24 hours before)
  const upcomingCheckIns = await supabase
    .from("bookings")
    .select("*")
    .eq("booking_status", "Confirmed")
    .gte("check_in_date", new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString())
    .lte("check_in_date", new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString())
    .is("check_in_reminder_sent", null);

  for (const booking of upcomingCheckIns.data || []) {
    await sendCheckInReminder(booking);
    await markReminderSent(booking.id, "check_in");
  }

  // 3. Post-stay feedback request (1 day after checkout)
  const completedStays = await supabase
    .from("bookings")
    .select("*")
    .eq("booking_status", "CheckedOut")
    .gte("check_out_date", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
    .lte("check_out_date", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .is("feedback_request_sent", null);

  for (const booking of completedStays.data || []) {
    await sendFeedbackRequest(booking);
    await markFeedbackRequestSent(booking.id);
  }
}
```

**Follow-up Tracking Schema:**

```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS follow_ups JSONB DEFAULT '[]';

-- Example follow_ups structure:
-- [
--   {
--     "type": "abandoned_cart",
--     "sent_at": "2025-01-20T10:00:00Z",
--     "channel": "email",
--     "template": "abandoned_cart_v1"
--   }
-- ]
```

---

## 4. Analytics & Reporting

### 4.1 Conversion Funnel Analytics

**Purpose:** Track guest booking conversion rates and identify drop-off points.

**Implementation:**

```typescript
// src/components/analytics/ConversionFunnel.tsx
interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  avgTimeToNext: number; // minutes
}

const ConversionFunnel: React.FC = () => {
  const { data: funnelData } = useQuery({
    queryKey: ['conversionFunnel'],
    queryFn: async () => {
      const stages = await calculateFunnelStages();
      return stages;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest Booking Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="count" data={funnelData} isAnimationActive>
              <LabelList position="center" fill="#fff" stroke="none" fontSize={14} />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>

        <div className="mt-4 space-y-2">
          {funnelData?.map((stage, index) => (
            <div key={stage.name} className="flex justify-between">
              <span>{stage.name}</span>
              <div className="flex gap-4">
                <Badge>{stage.count} users</Badge>
                <Badge variant="outline">{stage.percentage}%</Badge>
                {index > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Avg: {stage.avgTimeToNext}min
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
```

**Funnel Calculation:**

```sql
-- Analytics query for funnel stages
WITH funnel_stages AS (
  SELECT
    'Form Viewed' as stage,
    COUNT(DISTINCT session_id) as count,
    1 as stage_order
  FROM page_views
  WHERE path = '/guest-booking'
    AND created_at >= NOW() - INTERVAL '30 days'

  UNION ALL

  SELECT
    'Form Started' as stage,
    COUNT(DISTINCT session_id) as count,
    2 as stage_order
  FROM form_interactions
  WHERE form_name = 'guest_booking'
    AND created_at >= NOW() - INTERVAL '30 days'

  UNION ALL

  SELECT
    'Booking Created' as stage,
    COUNT(DISTINCT email) as count,
    3 as stage_order
  FROM bookings
  WHERE is_guest_booking = true
    AND created_at >= NOW() - INTERVAL '30 days'

  UNION ALL

  SELECT
    'Payment Uploaded' as stage,
    COUNT(DISTINCT email) as count,
    4 as stage_order
  FROM bookings
  WHERE is_guest_booking = true
    AND upload_status IN ('uploaded', 'verified')
    AND created_at >= NOW() - INTERVAL '30 days'

  UNION ALL

  SELECT
    'Booking Confirmed' as stage,
    COUNT(DISTINCT email) as count,
    5 as stage_order
  FROM bookings
  WHERE is_guest_booking = true
    AND booking_status = 'Confirmed'
    AND created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  stage,
  count,
  ROUND(100.0 * count / FIRST_VALUE(count) OVER (ORDER BY stage_order), 2) as percentage
FROM funnel_stages
ORDER BY stage_order;
```

### 4.2 Revenue Analytics Dashboard

**Purpose:** Track financial metrics for guest bookings.

**Implementation:**

```typescript
// src/components/analytics/RevenueMetrics.tsx
interface RevenueMetrics {
  totalRevenue: number;
  averageBookingValue: number;
  revenueByUnit: Record<string, number>;
  revenueByMonth: Array<{ month: string; amount: number }>;
  projectedRevenue: number;
}

const RevenueMetricsDashboard: React.FC = () => {
  const { data: metrics } = useRevenueMetrics();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Revenue (MTD)"
        value={formatCurrency(metrics.totalRevenue)}
        change={calculateChange(metrics.totalRevenue, metrics.lastMonthRevenue)}
        icon={DollarSignIcon}
      />

      <MetricCard
        title="Average Booking Value"
        value={formatCurrency(metrics.averageBookingValue)}
        subtitle="Guest bookings only"
        icon={TrendingUpIcon}
      />

      <MetricCard
        title="Projected Monthly"
        value={formatCurrency(metrics.projectedRevenue)}
        subtitle="Based on current trend"
        icon={TargetIcon}
      />

      <MetricCard
        title="Conversion Rate"
        value={`${metrics.conversionRate}%`}
        change={metrics.conversionRateChange}
        icon={PercentIcon}
      />
    </div>
  );
};
```

### 4.3 Guest Behavior Analytics

**Purpose:** Understand guest booking patterns and preferences.

**Implementation:**

```typescript
// src/lib/analytics/guest-behavior.ts
interface GuestBehaviorInsights {
  peakBookingHours: Array<{ hour: number; count: number }>;
  averageLeadTime: number; // Days between booking and check-in
  popularUnits: Array<{ unitId: string; bookings: number }>;
  repeatGuestRate: number;
  averageStayDuration: number;
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
}

export async function analyzeGuestBehavior(dateRange: {
  from: Date;
  to: Date;
}): Promise<GuestBehaviorInsights> {
  const bookings = await fetchGuestBookings(dateRange);

  return {
    peakBookingHours: calculatePeakHours(bookings),
    averageLeadTime: calculateAverageLeadTime(bookings),
    popularUnits: getPopularUnits(bookings),
    repeatGuestRate: calculateRepeatRate(bookings),
    averageStayDuration: calculateAverageStay(bookings),
    deviceBreakdown: analyzeDeviceUsage(bookings),
  };
}
```

---

## 5. Integration Expansions

### 5.1 Channel Manager Integration

**Purpose:** Sync availability with OTAs (Booking.com, Agoda, Airbnb).

**Implementation:**

```typescript
// src/lib/channel-manager/sync.ts
interface ChannelSyncConfig {
  platform: "booking" | "agoda" | "airbnb";
  apiKey: string;
  propertyId: string;
  syncInterval: number; // minutes
}

class ChannelManager {
  private channels: Map<string, ChannelSyncConfig> = new Map();

  async syncAvailability(unitId: string) {
    const availability = await getUnitAvailability(unitId);

    const syncPromises = Array.from(this.channels.values()).map((channel) =>
      this.pushToChannel(channel, unitId, availability)
    );

    const results = await Promise.allSettled(syncPromises);

    // Log sync results
    results.forEach((result, index) => {
      const channel = Array.from(this.channels.values())[index];
      if (result.status === "rejected") {
        console.error(`Sync failed for ${channel.platform}:`, result.reason);
      }
    });
  }

  private async pushToChannel(
    channel: ChannelSyncConfig,
    unitId: string,
    availability: AvailabilityData
  ) {
    switch (channel.platform) {
      case "booking":
        return this.syncToBookingCom(channel, unitId, availability);
      case "airbnb":
        return this.syncToAirbnb(channel, unitId, availability);
      case "agoda":
        return this.syncToAgoda(channel, unitId, availability);
    }
  }
}
```

### 5.2 Payment Gateway Integration

**Purpose:** Direct payment processing without manual uploads.

**Supported Gateways:**

- PayMongo (Philippines)
- GCash
- Maya (PayMaya)
- Stripe

**Implementation:**

```typescript
// src/lib/payment/gateway.ts
interface PaymentGateway {
  processPayment(amount: number, currency: string): Promise<PaymentResult>;
  verifyWebhook(payload: any, signature: string): boolean;
  refund(transactionId: string, amount?: number): Promise<RefundResult>;
}

class PayMongoGateway implements PaymentGateway {
  async processPayment(amount: number, currency: string = "PHP") {
    const paymentIntent = await paymongo.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency,
      payment_method_allowed: ["card", "gcash", "paymaya"],
      description: "Resort Booking Payment",
      statement_descriptor: "OKAERI_RESORT",
    });

    return {
      id: paymentIntent.id,
      clientKey: paymentIntent.attributes.client_key,
      status: paymentIntent.attributes.status,
    };
  }

  async verifyWebhook(payload: any, signature: string): boolean {
    const expectedSignature = this.calculateSignature(payload);
    return signature === expectedSignature;
  }
}
```

**Webhook Handler:**

```typescript
// functions/api/webhooks/payment.ts
export async function handlePaymentWebhook(request: Request) {
  const signature = request.headers.get("paymongo-signature");
  const payload = await request.json();

  if (!verifyWebhookSignature(payload, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const { type, data } = payload;

  switch (type) {
    case "payment.paid":
      await handlePaymentSuccess(data);
      break;
    case "payment.failed":
      await handlePaymentFailure(data);
      break;
  }

  return new Response("OK", { status: 200 });
}
```

---

## 6. Security Hardening

### 6.1 Advanced Fraud Detection

**Purpose:** Identify and prevent fraudulent bookings.

**Implementation:**

```typescript
// src/lib/security/fraud-detection.ts
interface FraudIndicators {
  riskScore: number; // 0-100
  flags: string[];
  recommendation: "allow" | "review" | "block";
}

export async function assessFraudRisk(
  bookingData: GuestBookingData,
  clientInfo: ClientInfo
): Promise<FraudIndicators> {
  const indicators: string[] = [];
  let riskScore = 0;

  // 1. Email reputation check
  if (await isDisposableEmail(bookingData.email)) {
    indicators.push("disposable_email");
    riskScore += 30;
  }

  // 2. Velocity checks
  const recentBookings = await getRecentBookingsByIP(clientInfo.ip, 24);
  if (recentBookings > 3) {
    indicators.push("high_velocity");
    riskScore += 25;
  }

  // 3. Geographic anomaly
  const geoLocation = await getGeoLocation(clientInfo.ip);
  if (geoLocation.country !== "PH" && !bookingData.internationalGuest) {
    indicators.push("geographic_anomaly");
    riskScore += 15;
  }

  // 4. Payment amount anomaly
  const avgBookingValue = await getAverageBookingValue();
  const deviation = Math.abs(bookingData.totalAmount - avgBookingValue) / avgBookingValue;
  if (deviation > 3) {
    indicators.push("amount_anomaly");
    riskScore += 20;
  }

  // 5. Time-based patterns
  const hour = new Date().getHours();
  if (hour >= 2 && hour <= 5) {
    indicators.push("unusual_hour");
    riskScore += 10;
  }

  return {
    riskScore: Math.min(riskScore, 100),
    flags: indicators,
    recommendation: riskScore >= 70 ? "block" : riskScore >= 40 ? "review" : "allow",
  };
}
```

### 6.2 Enhanced Rate Limiting

**Purpose:** Sophisticated rate limiting with multiple strategies.

**Implementation:**

```typescript
// src/lib/security/enhanced-rate-limit.ts
class EnhancedRateLimiter {
  private strategies: RateLimitStrategy[] = [
    new IPRateLimit(),
    new EmailRateLimit(),
    new FingerprintRateLimit(),
    new BehaviorRateLimit(),
  ];

  async checkLimit(request: Request): Promise<RateLimitResult> {
    const results = await Promise.all(this.strategies.map((strategy) => strategy.check(request)));

    // Combine results with weighted scoring
    const totalScore = results.reduce((sum, result) => sum + result.score * result.weight, 0);

    const blocked = results.some((r) => r.blocked);
    const retryAfter = Math.max(...results.map((r) => r.retryAfter || 0));

    return {
      blocked,
      score: totalScore,
      retryAfter,
      appliedStrategies: results.map((r) => r.strategy),
    };
  }
}

class BehaviorRateLimit implements RateLimitStrategy {
  async check(request: Request): Promise<StrategyResult> {
    const behavior = await analyzeBehavior(request);

    // Suspicious patterns
    if (behavior.rapidFormFilling < 5) {
      // Less than 5 seconds
      return { blocked: true, score: 100, strategy: "behavior" };
    }

    if (behavior.mouseMovements === 0) {
      // No mouse movement detected
      return { blocked: false, score: 50, strategy: "behavior" };
    }

    return { blocked: false, score: 0, strategy: "behavior" };
  }
}
```

### 6.3 End-to-End Encryption for Sensitive Data

**Purpose:** Encrypt payment information and personal data at rest.

**Implementation:**

```typescript
// src/lib/security/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

class FieldEncryption {
  private algorithm = "aes-256-gcm";
  private key: Buffer;

  constructor() {
    this.key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  }

  encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

// Usage in database operations
const encryptor = new FieldEncryption();

// Encrypt before storing
const encryptedPhone = encryptor.encrypt(guestData.phoneNumber);
const encryptedAddress = encryptor.encrypt(guestData.address);

// Decrypt when reading
const phoneNumber = encryptor.decrypt(booking.encrypted_phone);
```

---

## Implementation Timeline

### Priority 1: Quick Wins (1-2 days each)

1. Dashboard widget for pending bookings
2. Basic bulk operations
3. Email template variables
4. Guest booking badges in UI

### Priority 2: High Impact (3-5 days each)

1. Advanced filtering and search
2. Status timeline widget
3. SMS notifications (basic)
4. Conversion funnel analytics

### Priority 3: Advanced Features (1-2 weeks each)

1. AI receipt validation
2. Payment gateway integration
3. Channel manager sync
4. PWA implementation

### Priority 4: Nice to Have (varies)

1. Multi-language support
2. Advanced fraud detection
3. End-to-end encryption
4. Behavioral analytics

## Resource Requirements

### Development Resources

- Frontend Developer: 2-3 weeks for UI enhancements
- Backend Developer: 3-4 weeks for API and integrations
- DevOps: 1 week for infrastructure setup
- QA Engineer: 1-2 weeks for testing

### Third-Party Services

- OpenAI API: ~$50/month for receipt validation
- Twilio: ~$0.05/SMS
- PayMongo: 2.5-3.5% transaction fee
- Monitoring tools: ~$100/month

### Infrastructure

- Additional Supabase storage: ~$25/month if exceeding free tier
- Cloudflare Workers Paid: $5/month for additional compute
- Redis for advanced caching: ~$30/month

## Success Metrics

### Key Performance Indicators

1. **Conversion Rate**: Target 10% improvement
2. **Admin Processing Time**: Reduce by 50%
3. **Guest Satisfaction**: NPS score > 8
4. **Revenue Impact**: 15% increase in guest bookings
5. **Support Tickets**: 30% reduction

### Monitoring Dashboard

```typescript
// src/components/admin/EnhancementMetrics.tsx
const EnhancementMetricsDashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Features Adopted"
        value="12/20"
        subtitle="60% implementation"
      />
      <MetricCard
        title="Time Saved"
        value="4.5 hrs/week"
        subtitle="Admin efficiency"
      />
      <MetricCard
        title="ROI"
        value="280%"
        subtitle="Based on revenue increase"
      />
      <MetricCard
        title="User Satisfaction"
        value="8.7/10"
        subtitle="NPS Score"
      />
    </div>
  );
};
```

---

_Document Version: 1.0.0_
_Created: October 2025_
_Last Updated: October 2025_
_Status: Planning Phase_
