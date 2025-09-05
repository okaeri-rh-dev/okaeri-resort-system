/**
 * WebSocketService for real-time dashboard updates
 * Implements reconnection with exponential backoff, heartbeat, and message queuing
 */

import { EventEmitter } from "events";

interface WebSocketConfig {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  headers?: Record<string, string>;
}

interface WebSocketError {
  type: string;
  code: string;
  message?: string;
  error?: unknown;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

type MessageHandler = (data: any) => void;

export class WebSocketService extends EventEmitter {
  private url: string;
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectCount = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(url: string, config: WebSocketConfig = {}) {
    super();
    this.url = url;
    this.config = {
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectInterval: config.reconnectInterval ?? 1000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      headers: config.headers ?? {},
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return Promise.resolve();
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        // Add authentication headers via query params (WebSocket doesn't support headers directly)
        const urlWithAuth = new URL(this.url);
        if (this.config.headers.Authorization) {
          urlWithAuth.searchParams.set(
            "token",
            this.config.headers.Authorization.replace("Bearer ", "")
          );
        }

        this.ws = new WebSocket(urlWithAuth.toString());

        this.ws.onopen = () => {
          this.reconnectCount = 0;
          this.isConnecting = false;
          this.emit("connect");
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          this.emit("disconnect", event);
          this.stopHeartbeat();
          this.isConnecting = false;

          if (this.reconnectCount < this.config.reconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          const wsError: WebSocketError = {
            type: "CONNECTION_FAILED",
            code: "WS_001",
            message: "Failed to connect to WebSocket",
            error,
          };
          this.emit("error", wsError);
          this.isConnecting = false;
          reject(wsError);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        const wsError: WebSocketError = {
          type: "CONNECTION_FAILED",
          code: "WS_001",
          message: "Failed to initialize WebSocket",
          error,
        };
        this.emit("error", wsError);
        this.isConnecting = false;
        reject(wsError);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.reconnectCount = this.config.reconnectAttempts; // Prevent reconnection

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.cleanup();
    this.emit("disconnect");
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  subscribe(event: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }

    this.subscriptions.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(event);
        }
      }
    };
  }

  send(message: WebSocketMessage): void {
    const data = JSON.stringify(message);

    if (this.isConnected()) {
      this.ws!.send(data);
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle ping/pong for heartbeat
      if (message.type === "pong") {
        return;
      }

      // Route to subscribers
      const handlers = this.subscriptions.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => handler(message.data));
      }

      // Wildcard subscribers
      const wildcardHandlers = this.subscriptions.get("*");
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(message));
      }
    } catch (error) {
      this.emit("error", {
        type: "PARSE_ERROR",
        code: "WS_002",
        message: "Failed to parse WebSocket message",
        error,
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping", timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, then cap at 30s
    const delay = Math.min(this.config.reconnectInterval * Math.pow(2, this.reconnectCount), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectCount++;
      this.emit("reconnect_attempt", this.reconnectCount);
      this.connect().catch(() => {
        // Ignore connection errors during reconnect
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private cleanup(): void {
    this.subscriptions.clear();
    this.messageQueue = [];
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}
