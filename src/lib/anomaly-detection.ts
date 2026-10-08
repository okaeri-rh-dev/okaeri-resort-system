/**
 * Anomaly Detection System
 *
 * Detects suspicious patterns that indicate potential attacks:
 * 1. Request spikes - 100+ requests from single IP in 10 minutes
 * 2. Credential stuffing - 20+ failed login attempts in 5 minutes
 * 3. Path scanning - 50+ 404 errors from single IP in 10 minutes
 *
 * When anomalies are detected:
 * - Log to audit trail with WARNING severity
 * - Send webhook alert (if configured)
 * - Auto-block the IP for 1 hour
 *
 * @module anomaly-detection
 */

import { toUTCDateString } from "@/lib/timezone";

import { blockInKV } from "./auto-blocking";

/**
 * Anomaly thresholds configuration
 */
export const ANOMALY_THRESHOLDS = {
  REQUEST_SPIKE: {
    count: 100,
    windowMinutes: 10,
    description: "Excessive requests from single IP",
  },
  CREDENTIAL_STUFFING: {
    count: 20,
    windowMinutes: 5,
    description: "Multiple failed login attempts",
  },
  PATH_SCANNING: {
    count: 50,
    windowMinutes: 10,
    description: "Multiple 404 errors indicating path scanning",
  },
} as const;

export type AnomalyType = keyof typeof ANOMALY_THRESHOLDS;

/**
 * Anomaly event for logging
 */
export interface AnomalyEvent {
  type: AnomalyType;
  ip: string;
  count: number;
  threshold: number;
  timestamp: string;
  userAgent?: string;
  path?: string;
}

/**
 * Get the current minute window for counter keys
 * Rounds to 10-minute windows to match anomaly thresholds
 */
function getMinuteWindow(windowMinutes: number = 10): string {
  const now = new Date();
  const minutes = Math.floor(now.getMinutes() / windowMinutes) * windowMinutes;
  const hourStr = now.getUTCHours().toString().padStart(2, "0");
  const minStr = minutes.toString().padStart(2, "0");
  const dateStr = toUTCDateString(now);
  return `${dateStr}T${hourStr}:${minStr}`;
}

/**
 * Increment and get a counter value in KV
 */
async function incrementAndGet(kv: KVNamespace, key: string, ttlSeconds: number): Promise<number> {
  const current = await kv.get(key);
  const newValue = parseInt(current || "0") + 1;

  await kv.put(key, newValue.toString(), {
    expirationTtl: ttlSeconds,
  });

  return newValue;
}

/**
 * Track a request and detect anomalies
 *
 * Call this for every incoming request to track request patterns.
 *
 * @param kv - KV namespace for tracking
 * @param ip - Client IP address
 * @param options - Additional tracking options
 * @returns Anomaly event if detected, null otherwise
 */
export async function trackRequest(
  kv: KVNamespace,
  ip: string,
  options: {
    path?: string;
    userAgent?: string;
    alertWebhookUrl?: string;
  } = {}
): Promise<AnomalyEvent | null> {
  const threshold = ANOMALY_THRESHOLDS.REQUEST_SPIKE;
  const window = getMinuteWindow(threshold.windowMinutes);
  const key = `anomaly:requests:${ip}:${window}`;

  const count = await incrementAndGet(kv, key, threshold.windowMinutes * 60);

  if (count >= threshold.count) {
    const event: AnomalyEvent = {
      type: "REQUEST_SPIKE",
      ip,
      count,
      threshold: threshold.count,
      timestamp: new Date().toISOString(),
      userAgent: options.userAgent,
      path: options.path,
    };

    await handleAnomaly(kv, event, options.alertWebhookUrl);
    return event;
  }

  return null;
}

/**
 * Track a failed login attempt and detect credential stuffing
 *
 * Call this when a login attempt fails.
 *
 * @param kv - KV namespace for tracking
 * @param ip - Client IP address
 * @param options - Additional tracking options
 * @returns Anomaly event if detected, null otherwise
 */
export async function trackFailedLogin(
  kv: KVNamespace,
  ip: string,
  options: {
    username?: string;
    userAgent?: string;
    alertWebhookUrl?: string;
  } = {}
): Promise<AnomalyEvent | null> {
  const threshold = ANOMALY_THRESHOLDS.CREDENTIAL_STUFFING;
  const window = getMinuteWindow(threshold.windowMinutes);
  const key = `anomaly:failed-login:${ip}:${window}`;

  const count = await incrementAndGet(kv, key, threshold.windowMinutes * 60);

  if (count >= threshold.count) {
    const event: AnomalyEvent = {
      type: "CREDENTIAL_STUFFING",
      ip,
      count,
      threshold: threshold.count,
      timestamp: new Date().toISOString(),
      userAgent: options.userAgent,
    };

    await handleAnomaly(kv, event, options.alertWebhookUrl);
    return event;
  }

  return null;
}

/**
 * Track a 404 error and detect path scanning
 *
 * Call this when a 404 response is returned.
 *
 * @param kv - KV namespace for tracking
 * @param ip - Client IP address
 * @param path - The path that returned 404
 * @param options - Additional tracking options
 * @returns Anomaly event if detected, null otherwise
 */
export async function track404Error(
  kv: KVNamespace,
  ip: string,
  path: string,
  options: {
    userAgent?: string;
    alertWebhookUrl?: string;
  } = {}
): Promise<AnomalyEvent | null> {
  const threshold = ANOMALY_THRESHOLDS.PATH_SCANNING;
  const window = getMinuteWindow(threshold.windowMinutes);
  const key = `anomaly:404:${ip}:${window}`;

  const count = await incrementAndGet(kv, key, threshold.windowMinutes * 60);

  if (count >= threshold.count) {
    const event: AnomalyEvent = {
      type: "PATH_SCANNING",
      ip,
      count,
      threshold: threshold.count,
      timestamp: new Date().toISOString(),
      userAgent: options.userAgent,
      path,
    };

    await handleAnomaly(kv, event, options.alertWebhookUrl);
    return event;
  }

  return null;
}

/**
 * Handle a detected anomaly
 *
 * - Logs the anomaly
 * - Sends webhook alert if configured
 * - Auto-blocks the IP for 1 hour
 */
async function handleAnomaly(
  kv: KVNamespace,
  event: AnomalyEvent,
  alertWebhookUrl?: string
): Promise<void> {
  const threshold = ANOMALY_THRESHOLDS[event.type];

  console.warn(`[Anomaly] ${threshold.description}`, {
    ip: event.ip,
    count: event.count,
    threshold: event.threshold,
    type: event.type,
  });

  // Send webhook alert if configured (non-blocking)
  if (alertWebhookUrl) {
    sendWebhookAlert(alertWebhookUrl, event).catch((error) => {
      console.error("Failed to send anomaly webhook:", error);
    });
  }

  // Auto-block the IP for 1 hour
  await blockInKV(kv, event.ip, 60 * 60, `Anomaly detected: ${threshold.description}`);
}

/**
 * Send a webhook alert for an anomaly event
 */
async function sendWebhookAlert(webhookUrl: string, event: AnomalyEvent): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "security_anomaly",
      severity: "WARNING",
      anomaly: event,
      message: `${ANOMALY_THRESHOLDS[event.type].description} from IP ${event.ip}`,
      timestamp: event.timestamp,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
  }
}

/**
 * Get anomaly statistics for an IP
 *
 * Useful for admin dashboards to see recent activity.
 */
export async function getAnomalyStats(
  kv: KVNamespace,
  ip: string
): Promise<{
  requests: number;
  failedLogins: number;
  notFoundErrors: number;
  windows: {
    requests: string;
    failedLogins: string;
    notFoundErrors: string;
  };
}> {
  const requestsWindow = getMinuteWindow(ANOMALY_THRESHOLDS.REQUEST_SPIKE.windowMinutes);
  const failedLoginsWindow = getMinuteWindow(ANOMALY_THRESHOLDS.CREDENTIAL_STUFFING.windowMinutes);
  const notFoundWindow = getMinuteWindow(ANOMALY_THRESHOLDS.PATH_SCANNING.windowMinutes);

  const [requests, failedLogins, notFoundErrors] = await Promise.all([
    kv.get(`anomaly:requests:${ip}:${requestsWindow}`),
    kv.get(`anomaly:failed-login:${ip}:${failedLoginsWindow}`),
    kv.get(`anomaly:404:${ip}:${notFoundWindow}`),
  ]);

  return {
    requests: parseInt(requests || "0"),
    failedLogins: parseInt(failedLogins || "0"),
    notFoundErrors: parseInt(notFoundErrors || "0"),
    windows: {
      requests: requestsWindow,
      failedLogins: failedLoginsWindow,
      notFoundErrors: notFoundWindow,
    },
  };
}

/**
 * Check if an IP has any active anomaly flags
 */
export async function hasActiveAnomalies(
  kv: KVNamespace,
  ip: string
): Promise<{
  hasAnomalies: boolean;
  types: AnomalyType[];
}> {
  const stats = await getAnomalyStats(kv, ip);
  const types: AnomalyType[] = [];

  if (stats.requests >= ANOMALY_THRESHOLDS.REQUEST_SPIKE.count) {
    types.push("REQUEST_SPIKE");
  }
  if (stats.failedLogins >= ANOMALY_THRESHOLDS.CREDENTIAL_STUFFING.count) {
    types.push("CREDENTIAL_STUFFING");
  }
  if (stats.notFoundErrors >= ANOMALY_THRESHOLDS.PATH_SCANNING.count) {
    types.push("PATH_SCANNING");
  }

  return {
    hasAnomalies: types.length > 0,
    types,
  };
}
