# Philippine Resort Internal Operations Mock Data Generators

Comprehensive mock data generators for Okaeri Resort staff dashboard testing with authentic Philippine internal operations context.

## Overview

This module provides three main utilities:

- **`dashboard-mocks.ts`** - Dashboard metrics and activity mock data generators
- **`websocket-mocks.ts`** - Real-time WebSocket event simulation
- **`metric-helpers.ts`** - Philippine business context utilities

## Quick Start

```typescript
import { 
  DashboardMockGenerator,
  createPeakSeason,
  createCrisisScenario,
  createStableConnection
} from '@tests/utils';

// Create a peak season scenario
const peakData = createPeakSeason();

// Or use the builder pattern for custom scenarios
const customData = new DashboardMockGenerator()
  .withSeason('typhoon')
  .withOccupancy(25)
  .withRevenueTarget(15000)
  .withAlert('crisis')
  .build();

// Setup WebSocket simulation for real-time testing
const { socket, simulator } = createStableConnection('okaeri-test-001');
simulator.startEventSimulation();
```

## Dashboard Mock Data

### Pre-built Scenarios

```typescript
import { 
  createNormalOperations,    // 75% occupancy, normal revenue
  createPeakSeason,          // 95% occupancy, high revenue  
  createOffSeason,           // 40% occupancy, low revenue
  createCrisisScenario,      // 15% occupancy, typhoon conditions
  createHighPerformance      // 100% occupancy, exceptional revenue
} from '@tests/utils';

const dashboardData = createPeakSeason();
```

### Custom Builder Pattern

```typescript
import { DashboardMockGenerator } from '@tests/utils';

const mockGen = new DashboardMockGenerator()
  .withSeason('peak' | 'off' | 'typhoon')
  .withOccupancy(85) // 0-100%
  .withRevenueTarget(50000) // PHP amount
  .withAlert('normal' | 'warning' | 'crisis')
  .withTimeOfDay('morning' | 'afternoon' | 'evening' | 'night')
  .withProjectId('custom-project-001');

const data = mockGen.build(); // Returns complete DashboardState

// Or generate individual components
const bookingMetrics = mockGen.generateBookingMetrics();
const financialMetrics = mockGen.generateFinancialMetrics();
const performanceKPIs = mockGen.generatePerformanceKPIs();
```

## WebSocket Event Simulation

### Connection Scenarios

```typescript
import { 
  MockWebSocketManager,
  createStableConnection,
  createUnstableConnection,
  createTyphoonConnection,
  createPeakLoadConnection
} from '@tests/utils';

// Stable connection (normal conditions)
const { socket, simulator } = createStableConnection();

// Unstable connection (frequent disconnections)
const unstable = createUnstableConnection();

// Typhoon conditions (high latency, frequent failures)
const typhoon = createTyphoonConnection();

// Peak load conditions (server stress testing)
const peakLoad = createPeakLoadConnection();
```

### Event Simulation

```typescript
// Start automatic event generation
simulator.startEventSimulation();

// Manual event generation
simulator.simulateBookingEvent();
simulator.simulatePaymentEvent();
simulator.simulateSystemAlert('critical');
simulator.simulateActivityUpdate();

// High-frequency testing
simulator.simulateHighFrequencyUpdates(50, 30); // 50 events/sec for 30 seconds

// Network issues simulation
simulator.simulateNetworkDelay(2000); // 2 second delay
```

### Connection Management

```typescript
const manager = new MockWebSocketManager();

// Create multiple connections
const conn1 = manager.createConnection('ws://test1', 'stable');
const conn2 = manager.createConnection('ws://test2', 'unstable');

// Simulate network outage
manager.simulateNetworkOutage(30000); // 30 second outage

// Get statistics
const stats = manager.getConnectionStats();
console.log(stats.connectedSockets, stats.averageLatency);

// Cleanup
manager.cleanup();
```

## Philippine Business Context Helpers

### Currency Tracking

```typescript
import { 
  createPHPCurrency,
  trackPaymentStatus,
  formatInternalAmount
} from '@tests/utils';

// Create formatted PHP currency
const amount = createPHPCurrency(25000); 
// { amount: 2500000, currency: 'PHP', formatted: '₱25,000.00' }

// Internal payment status tracking
const paymentStatus = trackPaymentStatus('pending', 'gcash');
const formattedAmount = formatInternalAmount(100000, 'PHP');
```

### Guest Name Generation

```typescript
import { 
  generateFilipinoGuestName,
  generateInternationalGuestName,
  generatePhilippineMobile
} from '@tests/utils';

const filipinoGuest = generateFilipinoGuestName('male');
// "Juan Dela Cruz"

const internationalGuest = generateInternationalGuestName('KR');
// { name: "Min-jun Kim", country: "South Korea", code: "KR" }

const mobileNumber = generatePhilippineMobile('GLOBE');
// "+63 917 1234567"
```

### Seasonal Context

```typescript
import { 
  getTourismSeason,
  isTyphoonSeason,
  isPhilippineHoliday,
  getSeasonalPricing,
  generateTimeScenarios
} from '@tests/utils';

const season = getTourismSeason(new Date('2024-04-15')); // 'PEAK'
const isTyphoon = isTyphoonSeason(new Date('2024-08-15')); // true
const holiday = isPhilippineHoliday(new Date('2024-12-25')); 
// { isHoliday: true, holiday: { name: 'Christmas Day' } }

const pricing = getSeasonalPricing(new Date('2024-12-25')); // 1.82 (holiday premium)

// Generate test dates for different scenarios
const scenarios = generateTimeScenarios();
// { peakSummer: Date, typhoonSeason: Date, christmas: Date, ... }
```

### Revenue & Performance Calculations

```typescript
import { 
  calculateDailyRevenue,
  generateExpenseDistribution,
  generatePerformanceMetrics
} from '@tests/utils';

// Calculate realistic revenue based on occupancy and season
const revenue = calculateDailyRevenue(85, new Date('2024-04-15'));
// { baseRevenue, seasonalRevenue, breakdown: { accommodation, foodBeverage, ... } }

// Generate expense distribution
const expenses = generateExpenseDistribution(100000);
// { utilities: { budgeted, actual, variance }, staff: {...}, ... }

// Generate performance metrics by scenario
const performance = generatePerformanceMetrics('excellent');
// { guestSatisfaction: 95, averageRating: 4.8, responseTime: 5, ... }
```

## Usage in Tests

### Component Testing

```typescript
import { render, screen } from '@testing-library/react';
import { createPeakSeason } from '@tests/utils';
import DashboardOverview from '@/components/DashboardOverview';

describe('Dashboard Overview', () => {
  it('displays peak season metrics correctly', () => {
    const mockData = createPeakSeason();
    
    render(<DashboardOverview data={mockData} />);
    
    expect(screen.getByText(/95%/)).toBeInTheDocument(); // Occupancy
    expect(screen.getByText(/₱85,000/)).toBeInTheDocument(); // Revenue
  });
  
  it('handles crisis scenario appropriately', () => {
    const crisisData = createCrisisScenario();
    
    render(<DashboardOverview data={crisisData} />);
    
    // Should show typhoon warning alert
    expect(screen.getByText(/typhoon warning/i)).toBeInTheDocument();
    expect(screen.getByText(/15%/)).toBeInTheDocument(); // Low occupancy
  });
});
```

### WebSocket Integration Testing

```typescript
import { createStableConnection, WebSocketEventSimulator } from '@tests/utils';

describe('Real-time Dashboard Updates', () => {
  let mockSocket: MockWebSocket;
  let simulator: WebSocketEventSimulator;
  
  beforeEach(() => {
    const connection = createStableConnection();
    mockSocket = connection.socket;
    simulator = connection.simulator;
  });
  
  it('processes booking events correctly', async () => {
    simulator.simulateBookingEvent();
    
    // Test that UI updates appropriately
    await waitFor(() => {
      expect(screen.getByText(/new booking/i)).toBeInTheDocument();
    });
  });
  
  it('handles connection failures gracefully', () => {
    mockSocket.simulateDisconnection();
    
    // Should show offline indicator
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });
});
```

### Performance Testing

```typescript
import { MockWebSocketManager } from '@tests/utils';

describe('Dashboard Performance', () => {
  it('handles high-frequency updates without lag', async () => {
    const { simulator } = createStableConnection();
    
    // Generate 100 events per second for 10 seconds
    simulator.simulateHighFrequencyUpdates(100, 10);
    
    // Monitor performance metrics
    const startTime = performance.now();
    
    await waitFor(() => {
      expect(simulator.getQueueSize()).toBe(0); // All events processed
    });
    
    const processingTime = performance.now() - startTime;
    expect(processingTime).toBeLessThan(15000); // Should complete within 15s
  });
});
```

## Philippine Business Context

The mock data generators include authentic Philippine resort business context:

### Internal Financial Tracking Context
- **Currency Display**: Proper PHP formatting for staff interfaces
- **Payment Method Tracking**: GCash, Maya, Cash, Bank Transfer status tracking
- **Internal Reporting**: Revenue summaries for management review
- **Staff Financial Access**: Role-based visibility of financial data

### Seasonal Patterns  
- **Peak Season**: March-May (summer vacation)
- **High Season**: December-February (cool dry season) 
- **Off Season**: June-November (rainy/typhoon season)
- **Holiday Impact**: Christmas, New Year, Holy Week premium pricing

### Guest Demographics
- **70% Filipino guests**: Authentic Filipino names and mobile numbers
- **30% International**: Weighted by actual visitor statistics
- **Top Origins**: USA (25%), South Korea (20%), China (15%), Japan (12%)

### Internal Operational Realities
- **Room Types**: Standard to Penthouse with internal pricing references
- **Staff Workflows**: Booking entry, payment tracking, room status updates
- **Weather Impact**: Typhoon season operational adjustments for staff
- **Staff Operations**: Daily reconciliation, basic reporting, status tracking

This ensures your tests run with realistic data that matches actual Philippine resort operations.