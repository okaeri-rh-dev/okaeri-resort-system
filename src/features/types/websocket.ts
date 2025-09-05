/**
 * WebSocket type definitions for real-time dashboard
 */

export interface WebSocketConfig {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  headers?: Record<string, string>;
  maxReconnectInterval?: number;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  id?: string;
}

export type WebSocketStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface WebSocketError {
  type: "CONNECTION_FAILED" | "PARSE_ERROR" | "AUTH_ERROR" | "TIMEOUT";
  code: string;
  message?: string;
  error?: unknown;
}

// Specific message types for dashboard updates
export interface MetricUpdateMessage extends WebSocketMessage {
  type: "metric_update";
  data: {
    metricType: string;
    value: number | string;
    previousValue?: number | string;
    timestamp: number;
  };
}

export interface BookingCreatedMessage extends WebSocketMessage {
  type: "booking_created";
  data: {
    bookingId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    roomNumber: string;
    amount: number;
  };
}

export interface PaymentReceivedMessage extends WebSocketMessage {
  type: "payment_received";
  data: {
    paymentId: string;
    bookingId: string;
    amount: number;
    method: "gcash" | "maya" | "cash" | "credit_card";
    timestamp: number;
  };
}

export interface ActivityMessage extends WebSocketMessage {
  type: "activity";
  data: {
    id: string;
    type: string;
    description: string;
    user: {
      id: string;
      name: string;
    };
    timestamp: number;
    status?: "pending" | "completed" | "failed";
  };
}

export type DashboardWebSocketMessage =
  | MetricUpdateMessage
  | BookingCreatedMessage
  | PaymentReceivedMessage
  | ActivityMessage;
