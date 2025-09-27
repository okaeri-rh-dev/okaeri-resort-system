# Serverless Booking Workflow System - Implementation Guide

## Overview

The Okaeri Resort System's serverless booking workflow engine is a
comprehensive, cost-optimized solution for automating resort booking processes.
Built for multi-tenant SaaS operations with serverless-first architecture, it
provides:

- **Automated Status Transitions**: Smart booking lifecycle management
- **Cost Monitoring**: Real-time cost tracking with configurable limits
- **Multi-tenant Support**: Complete data isolation between resorts
- **Philippine Business Compliance**: Built-in support for local regulations
- **Real-time Monitoring**: Live workflow execution tracking
- **Scalable Architecture**: Handles 1-1000+ bookings efficiently

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Application                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Booking Pages   │  │ Workflow Panel  │  │ Analytics       │ │
│  │                 │  │                 │  │ Dashboard       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Zustand Stores                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ BookingStore    │  │ WorkflowStore   │  │ Optimistic      │ │
│  │ + Workflow      │  │                 │  │ Updates         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Serverless API Routes                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ /api/workflows/ │  │ /api/workflows/ │  │ /api/workflows/ │ │
│  │ execute         │  │ batch           │  │ schedule        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Workflow Engine Core                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ State Machine   │  │ Business Rules  │  │ Cost Monitor    │ │
│  │ Engine          │  │ Engine          │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Background Processing                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Vercel Cron     │  │ Task Scheduler  │  │ Retry Logic     │ │
│  │ Jobs            │  │                 │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Workflow Engine (`src/workflow/engine.ts`)

The heart of the system, providing:

```typescript
import { createWorkflowEngine, createWorkflowContext } from "@/workflow/engine";

// Create engine instance
const engine = createWorkflowEngine();

// Execute workflow transition
const result = await engine.executeTransition(booking, transition, context);
```

**Key Features:**

- **Singleton Pattern**: Optimized for serverless environments
- **Cost Tracking**: Real-time cost calculation and monitoring
- **Error Handling**: Comprehensive error tracking with retry logic
- **Audit Trail**: Complete workflow event history
- **Prediction Engine**: ML-like heuristics for future actions

### 2. API Routes (`api/workflows/`)

#### Execute Workflow Transition

```typescript
POST /api/workflows/execute
{
  "bookingId": "BK-001",
  "fromStatus": "Pending",
  "toStatus": "Confirmed",
  "resortId": "resort-okaeri",
  "triggeredBy": "user"
}
```

#### Batch Processing

```typescript
POST /api/workflows/batch
{
  "resortId": "resort-okaeri",
  "triggerTypes": ["date", "payment"],
  "batchSize": 25
}
```

#### Workflow Status

```typescript
GET /api/workflows/status?bookingId=BK-001&resortId=resort-okaeri
```

### 3. Background Processing (`api/cron/workflow-processor.ts`)

Automated processing via Vercel Cron Jobs:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/workflow-processor",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Processing Logic:**

- Runs every 15 minutes
- Processes up to 25 bookings per execution
- Cost-limited to $0.05 per execution
- Prioritizes urgent actions (overdue check-ins/outs)

### 4. State Management (`src/stores/`)

#### Workflow Store

```typescript
import { useWorkflowStore } from "@/stores/useWorkflowStore";

const { executeTransition, workflowState, costMonitoring, executionHistory } = useWorkflowStore();
```

#### Enhanced Booking Store

```typescript
import {
  useBookingWithWorkflow,
  useUpdateBookingStatusWithWorkflow,
} from "@/stores/useBookingStore";

// Get booking with workflow state
const { booking, workflowState } = useBookingWithWorkflow(bookingId);

// Update with workflow validation
const updateStatus = useUpdateBookingStatusWithWorkflow();
```

## Implementation Steps

### Step 1: Setup Environment Variables

```bash
# .env.local
VERCEL_CRON_SECRET=your-secret-key
DATABASE_URL=your-neon-postgres-url
NEXTAUTH_SECRET=your-auth-secret
```

### Step 2: Deploy API Routes

Ensure all API routes are properly deployed:

- `/api/workflows/execute`
- `/api/workflows/batch`
- `/api/workflows/status`
- `/api/workflows/schedule`
- `/api/cron/workflow-processor`

### Step 3: Configure Workflow Rules

```typescript
import { WorkflowConfigManager } from "@/workflow/config";

// Apply preset configuration
WorkflowConfigManager.applyPreset("resort-okaeri", "boutique");

// Or customize
WorkflowConfigManager.setConfig("resort-okaeri", {
  automationSettings: {
    enableAutoCheckin: true,
    enableAutoCheckout: true,
    checkinTimeWindow: { start: "14:00", end: "18:00" },
  },
  costLimits: {
    dailyLimitUSD: 5.0,
    monthlyLimitUSD: 100.0,
  },
});
```

### Step 4: Integrate UI Components

#### Basic Workflow Status

```typescript
import { WorkflowStatusBadge } from '@/components/workflow/WorkflowStatusBadge';

<WorkflowStatusBadge
  booking={booking}
  variant="interactive"
  showActions={true}
/>
```

#### Complete Workflow Panel

```typescript
import { BookingWorkflowPanel } from '@/components/bookings/BookingWorkflowPanel';

<BookingWorkflowPanel
  booking={booking}
  onBookingUpdate={handleUpdate}
/>
```

#### Analytics Dashboard

```typescript
import { WorkflowDashboard } from '@/components/workflow/WorkflowDashboard';

<WorkflowDashboard resortId="resort-okaeri" />
```

### Step 5: Setup Monitoring

```typescript
// Cost monitoring hook
const { dailyCostUsage, costAlerts } = useWorkflowCostMonitoring(resortId);

// Workflow metrics
const metrics = useBookingWorkflowMetrics(resortId);
```

## Configuration Presets

### Boutique Resort (5-15 units)

- **Automation**: Minimal, personal service preferred
- **Cost Limit**: $2/day, $50/month
- **Features**: Payment reminders, manual check-ins

### Large Resort (50+ units)

- **Automation**: Full automation enabled
- **Cost Limit**: $20/day, $500/month
- **Features**: Auto check-in/out, multiple reminder types

### Economy Resort

- **Automation**: Basic only
- **Cost Limit**: $1/day, $25/month
- **Features**: Essential workflows only

## Business Rules

### Philippine Business Compliance

```typescript
// Built-in rules for Philippine operations
const rules = [
  "gcash_payment_verification", // GCash payment validation
  "philippine_holiday_premium", // Holiday rate handling
  "weekend_minimum_stay", // Weekend booking rules
  "maximum_occupancy_compliance", // Local occupancy limits
];
```

### Custom Rules

```typescript
// Add custom business rule
const customRule: BusinessRule = {
  ruleId: "early_checkin_fee",
  category: "booking",
  description: "Early check-in requires additional fee",
  isEnforced: true,
  violationMessage: "Early check-in fee of ₱500 required",
  validationFunction: (booking) => {
    const checkinTime = new Date(booking.check_in).getHours();
    return checkinTime >= 14 || booking.total_amount >= standardRate + 500;
  },
};
```

## Cost Optimization

### Serverless Best Practices

1. **Function Duration**: Target <1 second execution time
2. **Memory Usage**: Optimize for 512MB or less
3. **Cold Starts**: Minimize through singleton patterns
4. **Batch Processing**: Process multiple bookings together

### Cost Monitoring

```typescript
// Real-time cost tracking
const costUsage = {
  executionTimeMs: 450,
  databaseQueries: 3,
  apiCalls: 1,
  actualCostUSD: 0.0012,
};

// Alert when approaching limits
if (dailyCostUsage > dailyLimit * 0.8) {
  triggerCostAlert();
}
```

### Estimated Costs (Monthly)

| Resort Size          | Bookings/Month | Estimated Cost |
| -------------------- | -------------- | -------------- |
| Small (5-15 units)   | 50-150         | $1-3           |
| Medium (16-50 units) | 200-500        | $5-15          |
| Large (50+ units)    | 500+           | $15-50         |

## Monitoring & Analytics

### Key Metrics

- **Execution Success Rate**: Target >99%
- **Average Execution Time**: Target <500ms
- **Cost Per Booking**: Target <$0.02
- **Automation Rate**: Target >80% for eligible transitions

### Dashboard Features

- Real-time workflow execution monitoring
- Cost usage tracking and alerts
- Business rule violation reports
- Automated trigger performance
- Booking attention alerts

## Troubleshooting

### Common Issues

#### 1. Workflow Not Executing

```typescript
// Check workflow state
const { workflowState, error } = useWorkflowState(bookingId, resortId);

// Verify business rules
const violations = validateBusinessRules(booking, rules);
```

#### 2. Cost Limits Exceeded

```typescript
// Check current usage
const { dailyCostUsage, dailyLimit } = useWorkflowCostMonitoring(resortId);

// Adjust limits if needed
WorkflowConfigManager.setConfig(resortId, {
  costLimits: { dailyLimitUSD: 10.0 },
});
```

#### 3. Cron Jobs Not Running

- Verify `VERCEL_CRON_SECRET` environment variable
- Check Vercel Function logs
- Ensure proper error handling in cron endpoint

### Debug Mode

```typescript
// Enable detailed logging
const context = createWorkflowContext(resortId);
context.metadata.debug = true;
context.dryRun = true; // Test without making changes
```

## Security Considerations

### Authentication

- All API routes require valid authentication
- Resort-level data isolation enforced
- User permissions validated for workflow actions

### Data Protection

- Sensitive booking data encrypted in transit
- Audit trail for all workflow changes
- Role-based access control (RBAC)

### Rate Limiting

- API endpoints protected against abuse
- Cost limits prevent runaway executions
- Exponential backoff for failed operations

## Future Enhancements

### Planned Features

- **AI-Powered Predictions**: Machine learning for workflow optimization
- **Multi-Channel Notifications**: SMS, WhatsApp, Facebook Messenger
- **Advanced Analytics**: Predictive analytics and business insights
- **Integration APIs**: Third-party booking platform connectors
- **Mobile App Support**: PWA with offline workflow capabilities

### Scalability Roadmap

- **Event Sourcing**: Complete audit trail with event replay
- **CQRS Pattern**: Separate read/write models for performance
- **Microservices**: Split workflow engine into specialized services
- **Edge Computing**: Geo-distributed workflow processing

## Support

For implementation support or questions:

- Review example implementations in `src/examples/`
- Check component documentation in `src/components/workflow/`
- Refer to type definitions in `src/workflow/engine.ts`
- Test with provided mock data and configurations

The workflow system is designed to be incrementally adoptable - start with basic
status management and gradually enable automation features as your resort
operations scale.
