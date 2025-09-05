/**
 * WebSocket Mock Utilities
 * Phase 2.1 - RED Phase: Real-time event simulation for Okaeri Resort dashboard testing
 *
 * Provides WebSocket event simulators for testing real-time features:
 * - Connection state management
 * - Event queue simulation
 * - Batched updates testing
 * - Network failure scenarios
 */

import { RealtimeEvent, RealtimeEventType } from "../../src/features/dashboard/types/dashboard";
import { DashboardActivity, ActivityEvent } from "../../src/features/dashboard/types/activities";
import {
  DashboardMockGenerator,
  createPHPCurrency,
  generateBookingId,
  generatePhilippineMobile,
} from "./dashboard-mocks";

// WebSocket connection states
export type MockWebSocketState = "connecting" | "connected" | "disconnected" | "error";

// Connection scenarios for testing
export type ConnectionScenario =
  | "stable" // Normal, stable connection
  | "unstable" // Frequent disconnections and reconnections
  | "slow" // High latency, slow responses
  | "typhoon" // Simulates typhoon conditions with intermittent connection
  | "maintenance" // Planned maintenance downtime
  | "peak_load"; // High server load during peak season

/**
 * Mock WebSocket class for testing real-time functionality
 */
export class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public url: string;
  private eventListeners: Map<string, Function[]> = new Map();
  private messageQueue: any[] = [];
  private connectionState: MockWebSocketState = "connecting";
  private latency: number = 100; // Default 100ms latency
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private scenario: ConnectionScenario = "stable";

  constructor(url: string, scenario: ConnectionScenario = "stable") {
    this.url = url;
    this.scenario = scenario;

    // Simulate connection delay based on scenario
    const connectionDelay = this.getConnectionDelay();
    setTimeout(() => {
      this.simulateConnection();
    }, connectionDelay);
  }

  addEventListener(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  removeEventListener(event: string, handler: Function): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }

    // Simulate network latency
    setTimeout(() => {
      this.messageQueue.push(JSON.parse(data));
      this.processMessage(JSON.parse(data));
    }, this.latency);
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.connectionState = "disconnected";

    const closeEvent = new CustomEvent("close", {
      detail: { code, reason },
    });
    this.dispatchEvent("close", closeEvent);
  }

  // Mock methods for testing
  simulateDisconnection(): void {
    this.readyState = WebSocket.CLOSED;
    this.connectionState = "disconnected";

    const closeEvent = new CustomEvent("close", {
      detail: { code: 1006, reason: "Connection lost" },
    });
    this.dispatchEvent("close", closeEvent);

    // Attempt reconnection based on scenario
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const reconnectDelay = this.getReconnectDelay();
      setTimeout(() => {
        this.attemptReconnection();
      }, reconnectDelay);
    }
  }

  simulateReconnection(): void {
    this.connectionState = "connecting";
    this.readyState = WebSocket.CONNECTING;

    const connectionDelay = this.getConnectionDelay();
    setTimeout(() => {
      this.simulateConnection();
    }, connectionDelay);
  }

  simulateError(error: string): void {
    this.connectionState = "error";
    const errorEvent = new CustomEvent("error", {
      detail: { message: error },
    });
    this.dispatchEvent("error", errorEvent);
  }

  simulateLatency(ms: number): void {
    this.latency = ms;
  }

  getCurrentLatency(): number {
    return this.latency;
  }

  getConnectionState(): MockWebSocketState {
    return this.connectionState;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // Private helper methods
  private simulateConnection(): void {
    if (this.scenario === "typhoon" && Math.random() < 0.7) {
      // 70% chance of connection failure during typhoon
      this.simulateError("Connection failed due to weather conditions");
      return;
    }

    if (this.scenario === "peak_load" && Math.random() < 0.3) {
      // 30% chance of connection failure during peak load
      this.simulateError("Server overloaded");
      return;
    }

    this.readyState = WebSocket.OPEN;
    this.connectionState = "connected";
    this.reconnectAttempts = 0;

    const openEvent = new CustomEvent("open");
    this.dispatchEvent("open", openEvent);

    // Start scenario-specific behavior
    this.startScenarioBehavior();
  }

  private attemptReconnection(): void {
    this.reconnectAttempts++;
    this.connectionState = "connecting";
    this.readyState = WebSocket.CONNECTING;

    const connectionDelay = this.getConnectionDelay();
    setTimeout(() => {
      this.simulateConnection();
    }, connectionDelay);
  }

  private getConnectionDelay(): number {
    switch (this.scenario) {
      case "stable":
        return 100;
      case "unstable":
        return Math.random() * 2000 + 500;
      case "slow":
        return Math.random() * 5000 + 2000;
      case "typhoon":
        return Math.random() * 10000 + 3000;
      case "maintenance":
        return 30000; // 30 second delay
      case "peak_load":
        return Math.random() * 3000 + 1000;
      default:
        return 100;
    }
  }

  private getReconnectDelay(): number {
    // Exponential backoff
    const baseDelay = 1000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), 30000);
    return exponentialDelay + Math.random() * 1000;
  }

  private startScenarioBehavior(): void {
    switch (this.scenario) {
      case "unstable":
        // Disconnect randomly every 5-15 seconds
        setTimeout(
          () => {
            if (this.readyState === WebSocket.OPEN) {
              this.simulateDisconnection();
            }
          },
          Math.random() * 10000 + 5000
        );
        break;

      case "slow":
        this.latency = Math.random() * 3000 + 1000; // 1-4 second latency
        break;

      case "typhoon":
        // Very unstable connection
        this.latency = Math.random() * 5000 + 2000;
        setTimeout(
          () => {
            if (this.readyState === WebSocket.OPEN && Math.random() < 0.8) {
              this.simulateDisconnection();
            }
          },
          Math.random() * 3000 + 1000
        );
        break;

      case "peak_load":
        this.latency = Math.random() * 2000 + 500;
        break;
    }
  }

  private processMessage(message: any): void {
    // Simulate server response based on message type
    if (message.type === "subscribe") {
      this.sendSubscriptionConfirmation(message.channel);
    }
  }

  private sendSubscriptionConfirmation(channel: string): void {
    const confirmation = {
      type: "subscription_confirmed",
      channel,
      timestamp: new Date().toISOString(),
    };

    const messageEvent = new CustomEvent("message", {
      detail: { data: JSON.stringify(confirmation) },
    });

    setTimeout(() => {
      this.dispatchEvent("message", messageEvent);
    }, this.latency);
  }

  private dispatchEvent(type: string, event: Event): void {
    const handlers = this.eventListeners.get(type) || [];
    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in ${type} handler:`, error);
      }
    });
  }
}

/**
 * WebSocket event simulator for testing real-time updates
 */
export class WebSocketEventSimulator {
  private mockSocket: MockWebSocket;
  private eventQueue: RealtimeEvent[] = [];
  private isProcessing: boolean = false;
  private batchSize: number = 5;
  private batchInterval: number = 1000; // 1 second
  private mockGenerator: DashboardMockGenerator;
  private projectId: string;

  constructor(
    mockSocket: MockWebSocket,
    projectId: string = "okaeri-resort-001",
    scenario: ConnectionScenario = "stable"
  ) {
    this.mockSocket = mockSocket;
    this.projectId = projectId;
    this.mockGenerator = new DashboardMockGenerator().withProjectId(projectId);
  }

  /**
   * Start simulating real-time events
   */
  startEventSimulation(): void {
    this.simulateBookingUpdates();
    this.simulatePaymentEvents();
    this.simulateSystemAlerts();
    this.simulateActivityUpdates();
    this.startBatchProcessor();
  }

  /**
   * Stop all event simulation
   */
  stopEventSimulation(): void {
    this.isProcessing = false;
    this.eventQueue = [];
  }

  /**
   * Simulate a booking event (check-in, check-out, new booking)
   */
  simulateBookingEvent(): void {
    const eventTypes: RealtimeEventType[] = ["booking_created", "booking_updated"];
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    const event: RealtimeEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      type,
      projectId: this.projectId,
      timestamp: new Date(),
      priority: "medium",
      data: {
        bookingId: generateBookingId(),
        guestName: "Maria Santos",
        roomNumber: "203",
        action: type === "booking_created" ? "check_in" : "room_change",
      },
    };

    this.queueEvent(event);
  }

  /**
   * Simulate payment received event
   */
  simulatePaymentEvent(): void {
    const event: RealtimeEvent = {
      id: `payment-${Date.now()}-${Math.random()}`,
      type: "payment_received",
      projectId: this.projectId,
      timestamp: new Date(),
      priority: "high",
      data: {
        amount: createPHPCurrency(Math.random() * 15000 + 5000),
        paymentMethod: "gcash",
        bookingId: generateBookingId(),
        transactionId: `TXN-${Date.now()}`,
      },
    };

    this.queueEvent(event);
  }

  /**
   * Simulate system alert
   */
  simulateSystemAlert(alertType: "warning" | "error" | "critical" = "warning"): void {
    const alerts = {
      warning: {
        message: "Low occupancy detected",
        data: { occupancy: 25, threshold: 40 },
      },
      error: {
        message: "Payment processing error",
        data: { errorCode: "PAYMENT_FAILED", transactionId: "TXN-123" },
      },
      critical: {
        message: "System overload detected",
        data: { cpuUsage: 95, memoryUsage: 90 },
      },
    };

    const alertInfo = alerts[alertType];

    const event: RealtimeEvent = {
      id: `alert-${Date.now()}-${Math.random()}`,
      type: "alert_triggered",
      projectId: this.projectId,
      timestamp: new Date(),
      priority: alertType === "critical" ? "critical" : "high",
      data: {
        severity: alertType,
        message: alertInfo.message,
        ...alertInfo.data,
      },
    };

    this.queueEvent(event);
  }

  /**
   * Simulate activity feed update
   */
  simulateActivityUpdate(): void {
    const activityEvent: ActivityEvent = {
      type: "activity_created",
      projectId: this.projectId,
      timestamp: new Date(),
      activity: {
        id: `activity-${Date.now()}`,
        projectId: this.projectId,
        timestamp: new Date(),
        actorId: "staff-001",
        actorName: "Juan Reyes",
        actorType: "user",
        category: "operational",
        priority: "medium",
        status: "completed",
        type: "room_cleaned",
        details: {
          roomNumber: "105",
          taskDescription: "Room cleaning completed",
          assignedStaff: ["Juan Reyes"],
          actualDuration: 45,
          qualityCheck: {
            passed: true,
            inspector: "Maria Garcia",
            score: 5,
            issues: [],
          },
        },
        displayText: "Room 105 cleaning completed",
        icon: "clean",
        color: "green",
      } as any,
    };

    const event: RealtimeEvent = {
      id: `activity-${Date.now()}-${Math.random()}`,
      type: "activity_created",
      projectId: this.projectId,
      timestamp: new Date(),
      priority: "low",
      data: activityEvent,
    };

    this.queueEvent(event);
  }

  /**
   * Simulate metric update (occupancy, revenue, etc.)
   */
  simulateMetricUpdate(): void {
    const metrics = ["occupancy", "revenue", "guest_satisfaction", "room_status"];
    const metric = metrics[Math.floor(Math.random() * metrics.length)];

    const event: RealtimeEvent = {
      id: `metric-${Date.now()}-${Math.random()}`,
      type: "metric_update",
      projectId: this.projectId,
      timestamp: new Date(),
      priority: "medium",
      data: {
        metric,
        value: metric === "occupancy" ? Math.floor(Math.random() * 100) : Math.random() * 100000,
        previousValue:
          metric === "occupancy" ? Math.floor(Math.random() * 100) : Math.random() * 80000,
        trend: Math.random() > 0.5 ? "up" : "down",
      },
    };

    this.queueEvent(event);
  }

  /**
   * Simulate high-frequency updates for performance testing
   */
  simulateHighFrequencyUpdates(eventsPerSecond: number = 10, durationSeconds: number = 30): void {
    const interval = 1000 / eventsPerSecond;
    let count = 0;
    const maxEvents = eventsPerSecond * durationSeconds;

    const intervalId = setInterval(() => {
      if (count >= maxEvents) {
        clearInterval(intervalId);
        return;
      }

      // Mix different types of events
      const eventTypes = [
        () => this.simulateBookingEvent(),
        () => this.simulatePaymentEvent(),
        () => this.simulateActivityUpdate(),
        () => this.simulateMetricUpdate(),
      ];

      const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      randomEvent();

      count++;
    }, interval);
  }

  /**
   * Simulate network issues causing event delays
   */
  simulateNetworkDelay(delayMs: number): void {
    this.eventQueue.forEach((event) => {
      setTimeout(
        () => {
          this.sendEvent(event);
        },
        delayMs + Math.random() * 1000
      );
    });
    this.eventQueue = [];
  }

  /**
   * Get current event queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Clear event queue (for testing)
   */
  clearQueue(): void {
    this.eventQueue = [];
  }

  // Private methods
  private queueEvent(event: RealtimeEvent): void {
    this.eventQueue.push(event);

    // If queue is getting too large, process immediately
    if (this.eventQueue.length > 50) {
      this.processBatch();
    }
  }

  private startBatchProcessor(): void {
    this.isProcessing = true;

    const processInterval = setInterval(() => {
      if (!this.isProcessing) {
        clearInterval(processInterval);
        return;
      }

      if (this.eventQueue.length > 0) {
        this.processBatch();
      }
    }, this.batchInterval);
  }

  private processBatch(): void {
    const batch = this.eventQueue.splice(0, this.batchSize);

    batch.forEach((event) => {
      this.sendEvent(event);
    });
  }

  private sendEvent(event: RealtimeEvent): void {
    if (this.mockSocket.readyState === WebSocket.OPEN) {
      const message = {
        type: "realtime_event",
        event,
      };

      const messageEvent = new CustomEvent("message", {
        detail: { data: JSON.stringify(message) },
      });

      // Simulate network latency
      setTimeout(() => {
        (this.mockSocket as any).dispatchEvent("message", messageEvent);
      }, this.mockSocket.getCurrentLatency());
    }
  }

  // Periodic event generators
  private simulateBookingUpdates(): void {
    setInterval(() => {
      if (Math.random() > 0.7) {
        // 30% chance every interval
        this.simulateBookingEvent();
      }
    }, 5000); // Every 5 seconds
  }

  private simulatePaymentEvents(): void {
    setInterval(() => {
      if (Math.random() > 0.8) {
        // 20% chance every interval
        this.simulatePaymentEvent();
      }
    }, 10000); // Every 10 seconds
  }

  private simulateSystemAlerts(): void {
    setInterval(() => {
      if (Math.random() > 0.9) {
        // 10% chance every interval
        const alertTypes: ("warning" | "error" | "critical")[] = [
          "warning",
          "warning",
          "error",
          "critical",
        ];
        const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        this.simulateSystemAlert(alertType);
      }
    }, 30000); // Every 30 seconds
  }

  private simulateActivityUpdates(): void {
    setInterval(() => {
      if (Math.random() > 0.6) {
        // 40% chance every interval
        this.simulateActivityUpdate();
      }
    }, 3000); // Every 3 seconds
  }
}

/**
 * WebSocket connection manager for testing different scenarios
 */
export class MockWebSocketManager {
  private connections: Map<string, MockWebSocket> = new Map();
  private eventSimulators: Map<string, WebSocketEventSimulator> = new Map();

  /**
   * Create a new WebSocket connection with specified scenario
   */
  createConnection(
    url: string,
    scenario: ConnectionScenario = "stable",
    projectId: string = "okaeri-resort-001"
  ): { socket: MockWebSocket; simulator: WebSocketEventSimulator } {
    const socket = new MockWebSocket(url, scenario);
    const simulator = new WebSocketEventSimulator(socket, projectId, scenario);

    const connectionId = `${url}-${Date.now()}`;
    this.connections.set(connectionId, socket);
    this.eventSimulators.set(connectionId, simulator);

    return { socket, simulator };
  }

  /**
   * Simulate network outage affecting all connections
   */
  simulateNetworkOutage(durationMs: number): void {
    this.connections.forEach((socket) => {
      socket.simulateDisconnection();
    });

    setTimeout(() => {
      this.connections.forEach((socket) => {
        socket.simulateReconnection();
      });
    }, durationMs);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    connectedSockets: number;
    disconnectedSockets: number;
    averageLatency: number;
  } {
    const sockets = Array.from(this.connections.values());

    return {
      totalConnections: sockets.length,
      connectedSockets: sockets.filter((s) => s.readyState === WebSocket.OPEN).length,
      disconnectedSockets: sockets.filter((s) => s.readyState === WebSocket.CLOSED).length,
      averageLatency:
        sockets.reduce((sum, s) => sum + s.getCurrentLatency(), 0) / sockets.length || 0,
    };
  }

  /**
   * Clean up all connections
   */
  cleanup(): void {
    this.eventSimulators.forEach((simulator) => {
      simulator.stopEventSimulation();
    });

    this.connections.forEach((socket) => {
      socket.close();
    });

    this.connections.clear();
    this.eventSimulators.clear();
  }
}

// Export convenience functions for common test scenarios
export function createStableConnection(projectId?: string) {
  const manager = new MockWebSocketManager();
  return manager.createConnection("ws://localhost:3001/ws", "stable", projectId);
}

export function createUnstableConnection(projectId?: string) {
  const manager = new MockWebSocketManager();
  return manager.createConnection("ws://localhost:3001/ws", "unstable", projectId);
}

export function createTyphoonConnection(projectId?: string) {
  const manager = new MockWebSocketManager();
  return manager.createConnection("ws://localhost:3001/ws", "typhoon", projectId);
}

export function createPeakLoadConnection(projectId?: string) {
  const manager = new MockWebSocketManager();
  return manager.createConnection("ws://localhost:3001/ws", "peak_load", projectId);
}
