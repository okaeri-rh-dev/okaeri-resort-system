/**
 * PollingService for adaptive and intelligent data polling
 * Implements exponential backoff, ETag support, and network-aware polling
 */

import { EventEmitter } from "events";

export interface PollingConfig {
  queryFn: (options?: any) => Promise<any>;
  interval?: number;
  baseInterval?: number;
  maxInterval?: number;
  enabled?: boolean;
  immediate?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  onDataChange?: (data: any) => void;
  onCleanup?: () => void;
  onIntervalChange?: (interval: number) => void;
  adaptive?: boolean;
  networkAdaptive?: boolean;
  respectDataSaver?: boolean;
  compareHash?: boolean;
  useETag?: boolean;
  compareFunction?: (prev: any, next: any) => boolean;
  jitter?: boolean;
  websocketUrl?: string;
  fallbackEnabled?: boolean;
}

export interface PollingState {
  data: any;
  error: Error | null;
  isPolling: boolean;
  isPaused: boolean;
  currentInterval: number;
}

interface NetworkInfo {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
}

export class PollingService extends EventEmitter {
  private config: PollingConfig;
  private timer: NodeJS.Timeout | null = null;
  private state: PollingState;
  private lastData: any = null;
  private lastETag: string | null = null;
  private errorCount = 0;
  private isActive = false;
  private abortController: AbortController | null = null;

  constructor(config: PollingConfig) {
    super();
    this.config = {
      interval: 1000,
      baseInterval: 1000,
      maxInterval: 60000,
      enabled: true,
      immediate: true,
      retryAttempts: 3,
      retryDelay: 500,
      adaptive: false,
      networkAdaptive: false,
      respectDataSaver: false,
      compareHash: false,
      useETag: false,
      jitter: false,
      fallbackEnabled: false,
      ...config,
    };

    this.state = {
      data: null,
      error: null,
      isPolling: false,
      isPaused: false,
      currentInterval: this.config.baseInterval || this.config.interval || 1000,
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for visibility changes
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this));
    }

    // Listen for network changes
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleNetworkChange.bind(this));
      window.addEventListener("offline", this.handleNetworkChange.bind(this));

      // Listen for WebSocket events if fallback is enabled
      if (this.config.fallbackEnabled && this.config.websocketUrl) {
        window.addEventListener("websocket:connected", this.handleWebSocketConnected.bind(this));
        window.addEventListener(
          "websocket:disconnected",
          this.handleWebSocketDisconnected.bind(this)
        );
      }
    }
  }

  async start(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    this.state.isPolling = true;
    this.emit("start");

    if (this.config.immediate) {
      await this.poll();
    }

    this.scheduleNextPoll();
  }

  stop(): void {
    this.isActive = false;
    this.state.isPolling = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.config.onCleanup) {
      this.config.onCleanup();
    }

    this.emit("stop");
  }

  private async poll(): Promise<void> {
    if (!this.isActive || this.state.isPaused) return;

    try {
      this.abortController = new AbortController();

      const options: any = {
        signal: this.abortController.signal,
      };

      // Add ETag support
      if (this.config.useETag && this.lastETag) {
        options.headers = {
          ...options.headers,
          "If-None-Match": this.lastETag,
        };
      }

      const response = await this.config.queryFn(options);

      // Handle 304 Not Modified
      if (response?.status === 304) {
        // Data hasn't changed, don't trigger updates
        return;
      }

      // Extract ETag if present
      if (this.config.useETag && response?.headers?.etag) {
        this.lastETag = response.headers.etag;
      }

      // Check if data has changed
      let hasChanged = true;
      if (this.config.compareHash && response?.hash) {
        hasChanged = this.lastData?.hash !== response.hash;
      } else if (this.config.compareFunction && this.lastData !== null) {
        hasChanged = !this.config.compareFunction(this.lastData, response);
      }

      if (hasChanged) {
        this.state.data = response;
        this.lastData = response;
        this.errorCount = 0;

        if (this.config.onDataChange) {
          this.config.onDataChange(response);
        }

        this.emit("data", response);
      }

      // Reset interval on success if using adaptive polling
      if (this.config.adaptive && this.errorCount === 0) {
        this.adjustInterval(this.config.baseInterval || this.config.interval || 1000);
      }
    } catch (error) {
      this.errorCount++;
      this.state.error = error as Error;
      this.emit("error", error);

      // Implement exponential backoff on errors
      if (this.config.adaptive) {
        const backoffInterval = Math.min(
          (this.config.baseInterval || 1000) * Math.pow(2, this.errorCount),
          this.config.maxInterval || 60000
        );
        this.adjustInterval(backoffInterval);
      }

      // Retry logic
      if (this.errorCount <= (this.config.retryAttempts || 3)) {
        await this.delay(this.config.retryDelay || 500);
        if (this.isActive) {
          await this.poll();
        }
      }
    }
  }

  private scheduleNextPoll(): void {
    if (!this.isActive) return;

    let interval = this.state.currentInterval;

    // Add jitter if enabled
    if (this.config.jitter) {
      const jitterAmount = interval * 0.1; // 10% jitter
      interval += Math.random() * jitterAmount - jitterAmount / 2;
    }

    this.timer = setTimeout(async () => {
      await this.poll();
      this.scheduleNextPoll();
    }, interval);
  }

  private adjustInterval(newInterval: number): void {
    const clampedInterval = Math.min(
      Math.max(newInterval, this.config.baseInterval || 1000),
      this.config.maxInterval || 60000
    );

    if (this.state.currentInterval !== clampedInterval) {
      this.state.currentInterval = clampedInterval;

      if (this.config.onIntervalChange) {
        this.config.onIntervalChange(clampedInterval);
      }

      this.emit("intervalChange", clampedInterval);
    }
  }

  private handleVisibilityChange(): void {
    if (!this.config.adaptive) return;

    if (document.hidden) {
      // Page is hidden, increase interval
      this.adjustInterval(this.state.currentInterval * 2);
    } else {
      // Page is visible, reset to base interval
      this.adjustInterval(this.config.baseInterval || this.config.interval || 1000);
    }
  }

  private handleNetworkChange(): void {
    if (!this.config.networkAdaptive) return;

    const connection = (navigator as any).connection as NetworkInfo | undefined;

    if (!navigator.onLine) {
      // Offline, pause polling
      this.state.isPaused = true;
      return;
    }

    this.state.isPaused = false;

    if (!connection) return;

    // Adjust based on network quality
    if (connection.effectiveType === "2g" || connection.saveData) {
      this.adjustInterval(this.state.currentInterval * 3);
    } else if (connection.effectiveType === "3g") {
      this.adjustInterval(this.state.currentInterval * 1.5);
    } else {
      this.adjustInterval(this.config.baseInterval || this.config.interval || 1000);
    }

    // Handle data saver mode
    if (this.config.respectDataSaver && connection.saveData) {
      this.state.isPaused = true;
    }
  }

  private handleWebSocketConnected(event: CustomEvent): void {
    if (!this.config.fallbackEnabled) return;

    if (event.detail?.url === this.config.websocketUrl) {
      // WebSocket connected, stop polling
      this.state.isPolling = false;
      this.stop();
    }
  }

  private handleWebSocketDisconnected(event: CustomEvent): void {
    if (!this.config.fallbackEnabled) return;

    if (event.detail?.url === this.config.websocketUrl) {
      // WebSocket disconnected, start polling as fallback
      if (!this.state.isPolling) {
        this.start();
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getState(): PollingState {
    return { ...this.state };
  }

  updateConfig(config: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...config };

    // Update current interval if base interval changed
    if (config.baseInterval || config.interval) {
      this.state.currentInterval =
        config.baseInterval || config.interval || this.state.currentInterval;
    }
  }

  cleanup(): void {
    this.stop();

    // Remove event listeners
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange.bind(this));
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleNetworkChange.bind(this));
      window.removeEventListener("offline", this.handleNetworkChange.bind(this));

      if (this.config.fallbackEnabled && this.config.websocketUrl) {
        window.removeEventListener("websocket:connected", this.handleWebSocketConnected.bind(this));
        window.removeEventListener(
          "websocket:disconnected",
          this.handleWebSocketDisconnected.bind(this)
        );
      }
    }

    this.removeAllListeners();
  }
}
