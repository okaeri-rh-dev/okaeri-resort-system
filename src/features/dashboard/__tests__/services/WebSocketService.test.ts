import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";

// Use existing test utilities from Phase 2.1
import { WebSocketSimulator } from "../../../../../tests/utils/websocket-mocks";
import { DashboardTestIDs } from "../../../../../tests/utils/dashboard-test-helpers";

// This service doesn't exist yet - RED phase of TDD
import { WebSocketService } from "../../../services/WebSocketService";
import type { WebSocketMessage, WebSocketConfig } from "../../../types/websocket";

describe("WebSocketService", () => {
  let wsService: WebSocketService;
  let wsSimulator: WebSocketSimulator;

  beforeEach(() => {
    wsSimulator = new WebSocketSimulator();
    wsService = new WebSocketService("ws://localhost:8080");
  });

  afterEach(() => {
    wsService.disconnect();
    wsSimulator.cleanup();
  });

  describe("Connection Management (10 tests)", () => {
    it("should establish WebSocket connection", async () => {
      const onConnect = vi.fn();
      wsService.on("connect", onConnect);

      await wsService.connect();

      await waitFor(() => {
        expect(onConnect).toHaveBeenCalled();
        expect(wsService.isConnected()).toBe(true);
      });
    });

    it("should handle connection failures gracefully", async () => {
      wsSimulator.disconnect();
      const onError = vi.fn();
      wsService.on("error", onError);

      await wsService.connect();

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CONNECTION_FAILED",
            code: "WS_001",
          })
        );
        expect(wsService.isConnected()).toBe(false);
      });
    });

    it("should implement exponential backoff for reconnection", async () => {
      const connectAttempts: number[] = [];

      wsService.on("reconnect_attempt", (attempt) => {
        connectAttempts.push(Date.now());
      });

      wsSimulator.disconnect();
      await wsService.connect();

      await waitFor(
        () => {
          expect(connectAttempts.length).toBeGreaterThan(2);
        },
        { timeout: 10000 }
      );

      // Verify exponential backoff timing
      const delays = connectAttempts.slice(1).map((time, i) => time - connectAttempts[i]);

      expect(delays[1]).toBeGreaterThan(delays[0] * 1.5);
    });

    it("should maintain connection heartbeat", async () => {
      await wsService.connect();

      const heartbeatSpy = vi.fn();
      wsSimulator.server.on("message", (data) => {
        const message = JSON.parse(data as string);
        if (message.type === "ping") {
          heartbeatSpy();
        }
      });

      await waitFor(
        () => {
          expect(heartbeatSpy).toHaveBeenCalled();
        },
        { timeout: 35000 }
      ); // Default heartbeat interval is 30s
    });

    it("should clean up resources on disconnect", async () => {
      await wsService.connect();

      const cleanupSpy = vi.spyOn(wsService, "cleanup" as any);

      wsService.disconnect();

      expect(cleanupSpy).toHaveBeenCalled();
      expect(wsService.isConnected()).toBe(false);
      expect(wsService.getActiveSubscriptions()).toHaveLength(0);
    });

    it("should handle connection timeout", async () => {
      const onTimeout = vi.fn();
      wsService.on("timeout", onTimeout);

      // Don't accept connection
      wsSimulator.server.on("connection", () => {
        // Intentionally don't respond
      });

      await wsService.connect({ timeout: 1000 });

      await waitFor(() => {
        expect(onTimeout).toHaveBeenCalled();
        expect(wsService.isConnected()).toBe(false);
      });
    });

    it("should reconnect automatically after unexpected disconnect", async () => {
      await wsService.connect({ autoReconnect: true });
      expect(wsService.isConnected()).toBe(true);

      // Simulate unexpected disconnect
      wsSimulator.disconnect();

      await waitFor(() => {
        expect(wsService.isConnected()).toBe(false);
      });

      // Create new mock server for reconnection
      wsSimulator.server = new WS("ws://localhost:8080");

      await waitFor(
        () => {
          expect(wsService.isConnected()).toBe(true);
        },
        { timeout: 5000 }
      );
    });

    it("should respect max reconnection attempts", async () => {
      const onMaxRetriesReached = vi.fn();
      wsService.on("max_retries_reached", onMaxRetriesReached);

      wsSimulator.disconnect();
      await wsService.connect({
        autoReconnect: true,
        maxReconnectAttempts: 3,
      });

      await waitFor(() => {
        expect(onMaxRetriesReached).toHaveBeenCalled();
        expect(wsService.getReconnectAttempts()).toBe(3);
      });
    });

    it("should handle network state changes", async () => {
      await wsService.connect();

      // Simulate offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));

      await waitFor(() => {
        expect(wsService.isConnected()).toBe(false);
      });

      // Simulate online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));

      await waitFor(() => {
        expect(wsService.isConnected()).toBe(true);
      });
    });

    it("should provide connection statistics", async () => {
      await wsService.connect();

      const stats = wsService.getConnectionStats();

      expect(stats).toMatchObject({
        connectedAt: expect.any(Date),
        messagesSent: expect.any(Number),
        messagesReceived: expect.any(Number),
        reconnectCount: expect.any(Number),
        latency: expect.any(Number),
      });
    });
  });

  describe("Message Handling (8 tests)", () => {
    it("should parse and route incoming messages", async () => {
      await wsService.connect();

      const messageHandlers = {
        booking: vi.fn(),
        payment: vi.fn(),
        metric: vi.fn(),
      };

      Object.entries(messageHandlers).forEach(([type, handler]) => {
        wsService.subscribe(type, handler);
      });

      // Send different message types
      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking",
          data: { id: "123", status: "confirmed" },
        })
      );

      await wsSimulator.server.send(
        JSON.stringify({
          type: "metric",
          data: { occupancyRate: 85.5 },
        })
      );

      await waitFor(() => {
        expect(messageHandlers.booking).toHaveBeenCalledWith(
          expect.objectContaining({ id: "123" })
        );
        expect(messageHandlers.metric).toHaveBeenCalledWith(
          expect.objectContaining({ occupancyRate: 85.5 })
        );
        expect(messageHandlers.payment).not.toHaveBeenCalled();
      });
    });

    it("should handle malformed messages without crashing", async () => {
      await wsService.connect();

      const errorHandler = vi.fn();
      wsService.on("error", errorHandler);

      // Send malformed JSON
      await wsSimulator.server.send("{ invalid json }");

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "PARSE_ERROR",
            code: "WS_002",
          })
        );
      });

      // Connection should remain active
      expect(wsService.isConnected()).toBe(true);
    });

    it("should queue messages during reconnection", async () => {
      await wsService.connect();

      const messageHandler = vi.fn();
      wsService.subscribe("booking", messageHandler);

      // Simulate connection loss
      wsSimulator.disconnect();

      // Try to send message while disconnected
      wsService.send({
        type: "booking_create",
        data: { roomId: "101", checkIn: "2025-02-01" },
      });

      expect(wsService.getQueueSize()).toBe(1);

      // Reconnect
      wsSimulator.server = new WS("ws://localhost:8080");
      await wsService.reconnect();

      await waitFor(() => {
        expect(wsService.getQueueSize()).toBe(0);
      });
    });

    it("should deduplicate identical messages", async () => {
      await wsService.connect();

      const handler = vi.fn();
      wsService.subscribe("metric", handler);

      // Send duplicate messages
      const message = {
        type: "metric",
        data: { occupancyRate: 85.5 },
        timestamp: Date.now(),
        messageId: "msg-123",
      };

      await wsSimulator.server.send(JSON.stringify(message));
      await wsSimulator.server.send(JSON.stringify(message));
      await wsSimulator.server.send(JSON.stringify(message));

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle binary messages for file transfers", async () => {
      await wsService.connect();

      const binaryHandler = vi.fn();
      wsService.on("binary_message", binaryHandler);

      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
      await wsSimulator.server.send(binaryData.buffer);

      await waitFor(() => {
        expect(binaryHandler).toHaveBeenCalledWith(expect.any(ArrayBuffer));
      });
    });

    it("should implement message compression", async () => {
      await wsService.connect({ compression: true });

      const largeMessage = {
        type: "bulk_update",
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: Math.random(),
        })),
      };

      const sendSpy = vi.spyOn(wsService, "send");
      wsService.send(largeMessage);

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          compressed: true,
        })
      );
    });

    it("should validate message schema before processing", async () => {
      await wsService.connect();

      const validHandler = vi.fn();
      const errorHandler = vi.fn();

      wsService.subscribe("booking", validHandler);
      wsService.on("validation_error", errorHandler);

      // Send message with invalid schema
      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking",
          // Missing required 'data' field
        })
      );

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalled();
        expect(validHandler).not.toHaveBeenCalled();
      });
    });

    it("should track message metrics", async () => {
      await wsService.connect();

      const handler = vi.fn();
      wsService.subscribe("metric", handler);

      for (let i = 0; i < 10; i++) {
        await wsSimulator.server.send(
          JSON.stringify({
            type: "metric",
            data: { value: i },
          })
        );
      }

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(10);
      });

      const metrics = wsService.getMessageMetrics();
      expect(metrics).toMatchObject({
        totalReceived: 10,
        byType: {
          metric: 10,
        },
        avgProcessingTime: expect.any(Number),
      });
    });
  });

  describe("Subscription Management (5 tests)", () => {
    it("should support multiple subscribers per message type", async () => {
      await wsService.connect();

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      wsService.subscribe("booking", handler1);
      wsService.subscribe("booking", handler2);
      wsService.subscribe("booking", handler3);

      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking",
          data: { id: "123" },
        })
      );

      await waitFor(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
        expect(handler3).toHaveBeenCalled();
      });
    });

    it("should unsubscribe handlers correctly", async () => {
      await wsService.connect();

      const handler = vi.fn();
      const unsubscribe = wsService.subscribe("booking", handler);

      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking",
          data: { id: "123" },
        })
      );

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      unsubscribe();

      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking",
          data: { id: "456" },
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should support wildcard subscriptions", async () => {
      await wsService.connect();

      const wildcardHandler = vi.fn();
      wsService.subscribe("*", wildcardHandler);

      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking",
          data: {},
        })
      );

      await wsSimulator.server.send(
        JSON.stringify({
          type: "payment",
          data: {},
        })
      );

      await wsSimulator.server.send(
        JSON.stringify({
          type: "metric",
          data: {},
        })
      );

      await waitFor(() => {
        expect(wildcardHandler).toHaveBeenCalledTimes(3);
      });
    });

    it("should support pattern-based subscriptions", async () => {
      await wsService.connect();

      const bookingHandler = vi.fn();
      wsService.subscribe("booking.*", bookingHandler);

      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking.created",
          data: {},
        })
      );

      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking.updated",
          data: {},
        })
      );

      await wsSimulator.server.send(
        JSON.stringify({
          type: "payment.received",
          data: {},
        })
      );

      await waitFor(() => {
        expect(bookingHandler).toHaveBeenCalledTimes(2);
      });
    });

    it("should clean up all subscriptions on disconnect", async () => {
      await wsService.connect();

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      wsService.subscribe("booking", handler1);
      wsService.subscribe("payment", handler2);

      expect(wsService.getActiveSubscriptions()).toHaveLength(2);

      wsService.disconnect();

      expect(wsService.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe("Cross-Tab Synchronization (10 tests)", () => {
    it("should broadcast state changes across tabs", async () => {
      const broadcastChannel = new BroadcastChannel("dashboard_sync");
      const messageHandler = vi.fn();

      broadcastChannel.addEventListener("message", messageHandler);

      await wsService.connect();

      await wsSimulator.server.send(
        JSON.stringify({
          type: "metric",
          data: { occupancyRate: 90 },
        })
      );

      await waitFor(() => {
        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: "metric",
              data: { occupancyRate: 90 },
            }),
          })
        );
      });

      broadcastChannel.close();
    });

    it("should elect leader tab for WebSocket connection", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      await tab1.connect();
      await tab2.connect();

      // Only one should be the leader
      const leaders = [tab1.isLeader(), tab2.isLeader()];
      expect(leaders.filter(Boolean)).toHaveLength(1);

      tab1.disconnect();
      tab2.disconnect();
    });

    it("should transfer leadership on leader disconnect", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      await tab1.connect();
      await tab2.connect();

      const initialLeader = tab1.isLeader() ? tab1 : tab2;
      const follower = tab1.isLeader() ? tab2 : tab1;

      initialLeader.disconnect();

      await waitFor(() => {
        expect(follower.isLeader()).toBe(true);
      });

      follower.disconnect();
    });

    it("should share WebSocket messages across all tabs", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await tab1.connect();
      await tab2.connect();

      tab1.subscribe("metric", handler1);
      tab2.subscribe("metric", handler2);

      // Send message to leader tab's connection
      await wsSimulator.server.send(
        JSON.stringify({
          type: "metric",
          data: { occupancyRate: 85 },
        })
      );

      // Both tabs should receive the message
      await waitFor(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      });

      tab1.disconnect();
      tab2.disconnect();
    });

    it("should handle tab visibility changes", async () => {
      await wsService.connect();

      const visibilityHandler = vi.fn();
      wsService.on("visibility_change", visibilityHandler);

      // Simulate tab becoming hidden
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => {
        expect(visibilityHandler).toHaveBeenCalledWith({ visible: false });
        expect(wsService.isThrottled()).toBe(true);
      });

      // Simulate tab becoming visible
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => {
        expect(visibilityHandler).toHaveBeenCalledWith({ visible: true });
        expect(wsService.isThrottled()).toBe(false);
      });
    });

    it("should prevent duplicate connections across tabs", async () => {
      const connectionSpy = vi.fn();

      // Mock server tracks connections
      wsSimulator.server.on("connection", connectionSpy);

      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");
      const tab3 = new WebSocketService("ws://localhost:8080");

      await Promise.all([tab1.connect(), tab2.connect(), tab3.connect()]);

      // Only one actual WebSocket connection should be made
      expect(connectionSpy).toHaveBeenCalledTimes(1);

      tab1.disconnect();
      tab2.disconnect();
      tab3.disconnect();
    });

    it("should synchronize connection state across tabs", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      await tab1.connect();
      await tab2.connect();

      expect(tab1.isConnected()).toBe(true);
      expect(tab2.isConnected()).toBe(true);

      // Disconnect leader
      const leader = tab1.isLeader() ? tab1 : tab2;
      leader.disconnect();

      await waitFor(() => {
        expect(tab1.isConnected()).toBe(false);
        expect(tab2.isConnected()).toBe(false);
      });

      tab1.disconnect();
      tab2.disconnect();
    });

    it("should handle concurrent tab operations", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      await Promise.all([tab1.connect(), tab2.connect()]);

      // Both tabs try to send messages simultaneously
      const promises = [
        tab1.send({ type: "test", data: { from: "tab1" } }),
        tab2.send({ type: "test", data: { from: "tab2" } }),
      ];

      await Promise.all(promises);

      // Messages should be queued and sent properly
      expect(tab1.getQueueSize() + tab2.getQueueSize()).toBe(0);

      tab1.disconnect();
      tab2.disconnect();
    });

    it("should maintain tab-specific subscriptions", async () => {
      const tab1 = new WebSocketService("ws://localhost:8080");
      const tab2 = new WebSocketService("ws://localhost:8080");

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await tab1.connect();
      await tab2.connect();

      // Different subscriptions per tab
      tab1.subscribe("booking", handler1);
      tab2.subscribe("payment", handler2);

      await wsSimulator.server.send(
        JSON.stringify({
          type: "booking",
          data: { id: "123" },
        })
      );

      await wsSimulator.server.send(
        JSON.stringify({
          type: "payment",
          data: { amount: 1000 },
        })
      );

      await waitFor(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });

      tab1.disconnect();
      tab2.disconnect();
    });

    it("should handle storage quota exceeded errors", async () => {
      const errorHandler = vi.fn();
      wsService.on("storage_error", errorHandler);

      await wsService.connect();

      // Simulate storage quota exceeded
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new DOMException("QuotaExceededError");
      };

      await wsSimulator.server.send(
        JSON.stringify({
          type: "large_data",
          data: { size: "very_large" },
        })
      );

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "STORAGE_QUOTA_EXCEEDED",
          })
        );
      });

      localStorage.setItem = originalSetItem;
    });
  });

  describe("Security & Authentication (5 tests)", () => {
    it("should include JWT token in connection headers", async () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token";

      wsService = new WebSocketService("ws://localhost:8080", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const connectSpy = vi.spyOn(wsService, "connect");
      await wsService.connect();

      expect(connectSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });

    it("should handle authentication errors", async () => {
      await wsService.connect();

      const authErrorHandler = vi.fn();
      wsService.on("auth_error", authErrorHandler);

      await wsSimulator.server.send(
        JSON.stringify({
          type: "error",
          code: "AUTH_EXPIRED",
          message: "Token expired",
        })
      );

      await waitFor(() => {
        expect(authErrorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            code: "AUTH_EXPIRED",
          })
        );
      });
    });

    it("should refresh token on expiration", async () => {
      const refreshTokenFn = vi.fn().mockResolvedValue("new.token");

      wsService = new WebSocketService("ws://localhost:8080", {
        refreshToken: refreshTokenFn,
      });

      await wsService.connect();

      await wsSimulator.server.send(
        JSON.stringify({
          type: "error",
          code: "TOKEN_EXPIRED",
        })
      );

      await waitFor(() => {
        expect(refreshTokenFn).toHaveBeenCalled();
      });
    });

    it("should validate message origin", async () => {
      await wsService.connect();

      const invalidOriginHandler = vi.fn();
      wsService.on("invalid_origin", invalidOriginHandler);

      // Simulate message from invalid origin
      const event = new MessageEvent("message", {
        data: JSON.stringify({ type: "test" }),
        origin: "http://evil.com",
      });

      wsService.handleMessage(event as any);

      expect(invalidOriginHandler).toHaveBeenCalled();
    });

    it("should implement rate limiting for outgoing messages", async () => {
      await wsService.connect();

      const rateLimitHandler = vi.fn();
      wsService.on("rate_limit", rateLimitHandler);

      // Send many messages rapidly
      for (let i = 0; i < 100; i++) {
        wsService.send({ type: "test", data: { id: i } });
      }

      await waitFor(() => {
        expect(rateLimitHandler).toHaveBeenCalled();
        expect(wsService.getQueueSize()).toBeGreaterThan(0);
      });
    });
  });
});
