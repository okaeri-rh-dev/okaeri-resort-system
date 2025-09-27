# ⚙️ Workflow Engine

## Overview

The `/src/workflow/` directory contains the workflow engine configuration for automated business processes in the Okaeri Resort System. This module is designed for Phase 3-4 features but has foundational components in place.

## 📁 Directory Structure

```
workflow/
├── config.ts    # Workflow configuration (1KB)
├── engine.ts    # Workflow execution engine (2.2KB)
└── README.md    # This file
```

## 📦 Module Documentation

### `config.ts` - Workflow Configuration
**Purpose**: Define workflow rules and transitions

```typescript
export interface WorkflowConfig {
  name: string
  description: string
  steps: WorkflowStep[]
  transitions: WorkflowTransition[]
  triggers: WorkflowTrigger[]
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'manual' | 'automatic' | 'conditional'
  handler?: (context: WorkflowContext) => Promise<void>
  timeout?: number
}

export interface WorkflowTransition {
  from: string
  to: string
  condition?: (context: WorkflowContext) => boolean
  action?: (context: WorkflowContext) => Promise<void>
}
```

### `engine.ts` - Workflow Execution
**Purpose**: Execute workflows based on configuration

```typescript
export class WorkflowEngine {
  private workflows: Map<string, WorkflowConfig> = new Map()
  private activeInstances: Map<string, WorkflowInstance> = new Map()

  register(workflow: WorkflowConfig): void {
    this.workflows.set(workflow.name, workflow)
  }

  async start(
    workflowName: string,
    context: WorkflowContext
  ): Promise<WorkflowInstance> {
    const workflow = this.workflows.get(workflowName)
    if (!workflow) {
      throw new Error(`Workflow ${workflowName} not found`)
    }

    const instance = new WorkflowInstance(workflow, context)
    this.activeInstances.set(instance.id, instance)

    await instance.start()
    return instance
  }

  async transition(
    instanceId: string,
    toStep: string
  ): Promise<void> {
    const instance = this.activeInstances.get(instanceId)
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`)
    }

    await instance.transitionTo(toStep)
  }
}
```

## 🔄 Workflow Examples

### Booking Approval Workflow
```typescript
const bookingApprovalWorkflow: WorkflowConfig = {
  name: 'booking-approval',
  description: 'Automated booking approval process',

  steps: [
    {
      id: 'submitted',
      name: 'Booking Submitted',
      type: 'automatic',
      handler: async (context) => {
        await notifyAdmin(context.booking)
      },
    },
    {
      id: 'review',
      name: 'Under Review',
      type: 'manual',
      timeout: 24 * 60 * 60 * 1000, // 24 hours
    },
    {
      id: 'payment_pending',
      name: 'Awaiting Payment',
      type: 'automatic',
      handler: async (context) => {
        await sendPaymentReminder(context.guest)
      },
    },
    {
      id: 'confirmed',
      name: 'Booking Confirmed',
      type: 'automatic',
      handler: async (context) => {
        await sendConfirmationEmail(context)
        await updateCalendar(context.booking)
      },
    },
    {
      id: 'cancelled',
      name: 'Booking Cancelled',
      type: 'manual',
    },
  ],

  transitions: [
    {
      from: 'submitted',
      to: 'review',
      condition: (ctx) => ctx.booking.requiresApproval,
    },
    {
      from: 'submitted',
      to: 'payment_pending',
      condition: (ctx) => !ctx.booking.requiresApproval,
    },
    {
      from: 'review',
      to: 'payment_pending',
      action: async (ctx) => {
        await notifyGuestApproved(ctx.guest)
      },
    },
    {
      from: 'review',
      to: 'cancelled',
      action: async (ctx) => {
        await notifyGuestRejected(ctx.guest)
      },
    },
    {
      from: 'payment_pending',
      to: 'confirmed',
      condition: (ctx) => ctx.payment.status === 'completed',
    },
    {
      from: '*',
      to: 'cancelled',
      action: async (ctx) => {
        await handleCancellation(ctx)
      },
    },
  ],

  triggers: [
    {
      event: 'payment.received',
      action: async (context, engine) => {
        await engine.transition(context.instanceId, 'confirmed')
      },
    },
    {
      event: 'booking.timeout',
      action: async (context, engine) => {
        await engine.transition(context.instanceId, 'cancelled')
      },
    },
  ],
}
```

### Expense Approval Workflow
```typescript
const expenseApprovalWorkflow: WorkflowConfig = {
  name: 'expense-approval',
  description: 'Expense approval based on amount',

  steps: [
    {
      id: 'submitted',
      name: 'Expense Submitted',
      type: 'automatic',
    },
    {
      id: 'auto_approved',
      name: 'Auto-Approved',
      type: 'automatic',
      handler: async (ctx) => {
        await processExpensePayment(ctx.expense)
      },
    },
    {
      id: 'manager_review',
      name: 'Manager Review',
      type: 'manual',
      timeout: 48 * 60 * 60 * 1000, // 48 hours
    },
    {
      id: 'director_review',
      name: 'Director Review',
      type: 'manual',
      timeout: 72 * 60 * 60 * 1000, // 72 hours
    },
    {
      id: 'approved',
      name: 'Approved',
      type: 'automatic',
    },
    {
      id: 'rejected',
      name: 'Rejected',
      type: 'manual',
    },
  ],

  transitions: [
    {
      from: 'submitted',
      to: 'auto_approved',
      condition: (ctx) => ctx.expense.amount < 1000,
    },
    {
      from: 'submitted',
      to: 'manager_review',
      condition: (ctx) =>
        ctx.expense.amount >= 1000 && ctx.expense.amount < 10000,
    },
    {
      from: 'submitted',
      to: 'director_review',
      condition: (ctx) => ctx.expense.amount >= 10000,
    },
    {
      from: 'manager_review',
      to: 'approved',
    },
    {
      from: 'director_review',
      to: 'approved',
    },
    {
      from: ['manager_review', 'director_review'],
      to: 'rejected',
    },
  ],
}
```

## 🎯 Workflow Patterns

### State Machine Pattern
```typescript
class WorkflowStateMachine {
  private currentState: string
  private states: Map<string, State> = new Map()
  private transitions: Map<string, Transition[]> = new Map()

  async transition(event: WorkflowEvent): Promise<void> {
    const possibleTransitions = this.transitions.get(this.currentState) || []

    for (const transition of possibleTransitions) {
      if (await transition.canExecute(event)) {
        await transition.execute(event)
        this.currentState = transition.targetState
        break
      }
    }
  }
}
```

### Activity Pattern
```typescript
interface Activity {
  id: string
  execute(context: WorkflowContext): Promise<ActivityResult>
  compensate?(context: WorkflowContext): Promise<void>
  retry?: RetryConfig
}

class EmailActivity implements Activity {
  id = 'send-email'

  async execute(context: WorkflowContext): Promise<ActivityResult> {
    try {
      await sendEmail(context.email)
      return { success: true }
    } catch (error) {
      return { success: false, error }
    }
  }

  async compensate(context: WorkflowContext): Promise<void> {
    // Compensating action if needed
    await markEmailAsFailed(context.email)
  }
}
```

## 🔧 Workflow Runtime

### Workflow Instance
```typescript
export class WorkflowInstance {
  readonly id: string = generateId()
  private state: WorkflowState
  private history: WorkflowEvent[] = []

  constructor(
    private workflow: WorkflowConfig,
    private context: WorkflowContext
  ) {
    this.state = {
      currentStep: workflow.steps[0].id,
      startedAt: new Date(),
      status: 'running',
    }
  }

  async transitionTo(stepId: string): Promise<void> {
    // Validate transition
    const isValid = this.validateTransition(this.state.currentStep, stepId)
    if (!isValid) {
      throw new Error('Invalid transition')
    }

    // Execute transition
    const transition = this.findTransition(this.state.currentStep, stepId)
    if (transition?.action) {
      await transition.action(this.context)
    }

    // Update state
    this.state.currentStep = stepId
    this.addEvent({
      type: 'transition',
      from: this.state.currentStep,
      to: stepId,
      timestamp: new Date(),
    })
  }

  private addEvent(event: WorkflowEvent): void {
    this.history.push(event)
    // Persist event for audit
    persistWorkflowEvent(this.id, event)
  }
}
```

## 📊 Workflow Monitoring

### Metrics & Tracking
```typescript
interface WorkflowMetrics {
  totalInstances: number
  activeInstances: number
  completedInstances: number
  failedInstances: number
  averageDuration: number
  stepMetrics: Map<string, StepMetrics>
}

interface StepMetrics {
  totalExecutions: number
  averageDuration: number
  failureRate: number
  timeouts: number
}

// Collect metrics
const collectWorkflowMetrics = async (
  workflowName: string
): Promise<WorkflowMetrics> => {
  const instances = await getWorkflowInstances(workflowName)

  return {
    totalInstances: instances.length,
    activeInstances: instances.filter(i => i.status === 'running').length,
    completedInstances: instances.filter(i => i.status === 'completed').length,
    failedInstances: instances.filter(i => i.status === 'failed').length,
    averageDuration: calculateAverageDuration(instances),
    stepMetrics: calculateStepMetrics(instances),
  }
}
```

## 🧪 Testing Workflows

```typescript
describe('BookingApprovalWorkflow', () => {
  let engine: WorkflowEngine

  beforeEach(() => {
    engine = new WorkflowEngine()
    engine.register(bookingApprovalWorkflow)
  })

  it('auto-approves bookings under threshold', async () => {
    const instance = await engine.start('booking-approval', {
      booking: { amount: 5000, requiresApproval: false },
    })

    expect(instance.getCurrentStep()).toBe('payment_pending')
  })

  it('routes high-value bookings for review', async () => {
    const instance = await engine.start('booking-approval', {
      booking: { amount: 50000, requiresApproval: true },
    })

    expect(instance.getCurrentStep()).toBe('review')
  })
})
```

## 🚀 Phase 3-4 Features

**Planned Enhancements**:
1. Visual workflow designer
2. Workflow versioning
3. Parallel execution branches
4. Conditional branching
5. External service integration
6. Workflow templates
7. Real-time monitoring dashboard
8. SLA tracking
9. Automated compensations
10. Workflow migrations

## 📚 Best Practices

1. **Keep Workflows Simple**: Avoid complex nested conditions
2. **Handle Timeouts**: Always define timeout behavior
3. **Log Everything**: Maintain audit trail
4. **Test Thoroughly**: Unit test all transitions
5. **Version Control**: Track workflow changes
6. **Monitor Performance**: Track execution metrics
7. **Handle Failures**: Define compensation logic

## 🔧 Configuration

```typescript
export const workflowConfig = {
  maxConcurrentInstances: 100,
  defaultTimeout: 24 * 60 * 60 * 1000, // 24 hours
  retryPolicy: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
  },
  persistenceEnabled: true,
  metricsEnabled: true,
}
```