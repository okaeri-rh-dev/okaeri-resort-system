/**
 * WebSocketSimulator for testing WebSocketService
 * Provides a mock WebSocket implementation for unit testing
 */

import { vi } from "vitest";

export class WebSocketSimulator {
  private mockWebSocket: any;
  public server: {
    on: (event: string, handler: Function) => void;
    emit: (event: string, data: any) => void;
    handlers: Map<string, Function[]>;
  };
  private connectionState: "connected" | "disconnected" | "error" = "connected";

  constructor() {
    this.server = {
      handlers: new Map(),
      on: (event: string, handler: Function) => {
        if (!this.server.handlers.has(event)) {
          this.server.handlers.set(event, []);
        }
        this.server.handlers.get(event)?.push(handler);
      },
      emit: (event: string, data: any) => {
        const handlers = this.server.handlers.get(event) || [];
        handlers.forEach((handler) => handler(data));
      },
    };

    // Mock global WebSocket
    const MockWebSocket = vi.fn().mockImplementation((url: string) => {
      this.mockWebSocket = {
        url,
        readyState: WebSocket.CONNECTING,
        onopen: null as Function | null,
        onclose: null as Function | null,
        onerror: null as Function | null,
        onmessage: null as Function | null,

        send: vi.fn((data: string) => {
          // Simulate server receiving message
          this.server.emit("message", data);

          // Echo back for ping/pong
          const message = JSON.parse(data);
          if (message.type === "ping") {
            setTimeout(() => {
              if (this.mockWebSocket.onmessage) {
                this.mockWebSocket.onmessage({
                  data: JSON.stringify({ type: "pong" }),
                });
              }
            }, 10);
          }
        }),

        close: vi.fn(() => {
          this.mockWebSocket.readyState = WebSocket.CLOSED;
          if (this.mockWebSocket.onclose) {
            this.mockWebSocket.onclose({ code: 1000, reason: "Normal closure" });
          }
        }),
      };

      // Simulate connection based on state
      setTimeout(() => {
        if (this.connectionState === "connected") {
          this.mockWebSocket.readyState = WebSocket.OPEN;
          if (this.mockWebSocket.onopen) {
            this.mockWebSocket.onopen();
          }
        } else if (this.connectionState === "error") {
          if (this.mockWebSocket.onerror) {
            this.mockWebSocket.onerror(new Error("Connection failed"));
          }
          if (this.mockWebSocket.onclose) {
            this.mockWebSocket.onclose({ code: 1006, reason: "Connection failed" });
          }
        }
      }, 10);

      return this.mockWebSocket;
    });

    // Replace global WebSocket
    global.WebSocket = MockWebSocket as any;
  }

  connect(): void {
    this.connectionState = "connected";
    if (this.mockWebSocket && this.mockWebSocket.readyState === WebSocket.CLOSED) {
      this.mockWebSocket.readyState = WebSocket.OPEN;
      if (this.mockWebSocket.onopen) {
        this.mockWebSocket.onopen();
      }
    }
  }

  disconnect(): void {
    this.connectionState = "disconnected";
    if (this.mockWebSocket && this.mockWebSocket.readyState === WebSocket.OPEN) {
      this.mockWebSocket.readyState = WebSocket.CLOSED;
      if (this.mockWebSocket.onclose) {
        this.mockWebSocket.onclose({ code: 1000, reason: "Normal closure" });
      }
    }
  }

  simulateError(): void {
    this.connectionState = "error";
    if (this.mockWebSocket && this.mockWebSocket.onerror) {
      this.mockWebSocket.onerror(new Error("Connection error"));
    }
  }

  simulateMessage(message: any): void {
    if (this.mockWebSocket && this.mockWebSocket.onmessage) {
      this.mockWebSocket.onmessage({
        data: JSON.stringify(message),
      });
    }
  }

  cleanup(): void {
    // Reset WebSocket mock
    if (this.mockWebSocket) {
      this.mockWebSocket.close();
    }
    this.server.handlers.clear();
  }
}
