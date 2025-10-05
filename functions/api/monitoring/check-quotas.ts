/**
 * Quota Monitoring and Alert Function
 *
 * Checks various service quotas and sends alerts when thresholds are exceeded.
 * Runs periodically via cron or can be called manually.
 */

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  ALERT_WEBHOOK_URL?: string;
  ADMIN_EMAIL?: string;
  ENVIRONMENT: string;
}

interface Alert {
  type: "kv_quota" | "email_quota" | "bandwidth_quota" | "error";
  level: "info" | "warning" | "critical";
  message: string;
  value: number;
  threshold: number;
  percentage: number;
}

export async function onRequest(context: EventContext<Env, any, Record<string, unknown>>) {
  const { env, request } = context;

  // Allow both GET (for manual checks) and POST (for cron)
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const alerts: Alert[] = [];
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  try {
    // 1. Check KV writes quota (1,000/day free tier)
    const kvKeys = await env.RATE_LIMIT_KV.list({ limit: 1000 });
    const todayWrites = kvKeys.keys.filter(
      (k) => k.name.includes(today) || (k.name.includes("metric:") && k.name.includes(today))
    ).length;

    const kvPercentage = (todayWrites / 1000) * 100;

    if (kvPercentage >= 95) {
      alerts.push({
        type: "kv_quota",
        level: "critical",
        message: `KV writes critical: ${todayWrites}/1000 daily limit (${kvPercentage.toFixed(1)}%)`,
        value: todayWrites,
        threshold: 1000,
        percentage: kvPercentage,
      });
    } else if (kvPercentage >= 80) {
      alerts.push({
        type: "kv_quota",
        level: "warning",
        message: `KV writes warning: ${todayWrites}/1000 daily limit (${kvPercentage.toFixed(1)}%)`,
        value: todayWrites,
        threshold: 1000,
        percentage: kvPercentage,
      });
    }

    // 2. Check email quota (100/day with Resend free tier)
    const emailCountKey = `metric:emails:${today}`;
    const emailCount = parseInt((await env.RATE_LIMIT_KV.get(emailCountKey)) || "0");
    const emailPercentage = (emailCount / 100) * 100;

    if (emailPercentage >= 95) {
      alerts.push({
        type: "email_quota",
        level: "critical",
        message: `Email quota critical: ${emailCount}/100 daily limit (${emailPercentage}%)`,
        value: emailCount,
        threshold: 100,
        percentage: emailPercentage,
      });
    } else if (emailPercentage >= 80) {
      alerts.push({
        type: "email_quota",
        level: "warning",
        message: `Email quota warning: ${emailCount}/100 daily limit (${emailPercentage}%)`,
        value: emailCount,
        threshold: 100,
        percentage: emailPercentage,
      });
    }

    // 3. Check bandwidth quota (2GB/month with Supabase free tier)
    const bandwidthKey = `metric:bandwidth:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const bandwidthMB = parseInt((await env.RATE_LIMIT_KV.get(bandwidthKey)) || "0");
    const bandwidthGB = bandwidthMB / 1024;
    const bandwidthPercentage = (bandwidthGB / 2) * 100;

    if (bandwidthPercentage >= 95) {
      alerts.push({
        type: "bandwidth_quota",
        level: "critical",
        message: `Bandwidth critical: ${bandwidthGB.toFixed(2)}GB/2GB monthly limit (${bandwidthPercentage.toFixed(1)}%)`,
        value: bandwidthMB,
        threshold: 2048, // 2GB in MB
        percentage: bandwidthPercentage,
      });
    } else if (bandwidthPercentage >= 80) {
      alerts.push({
        type: "bandwidth_quota",
        level: "warning",
        message: `Bandwidth warning: ${bandwidthGB.toFixed(2)}GB/2GB monthly limit (${bandwidthPercentage.toFixed(1)}%)`,
        value: bandwidthMB,
        threshold: 2048,
        percentage: bandwidthPercentage,
      });
    }

    // 4. Send alerts if any
    if (alerts.length > 0) {
      // Log to KV for historical tracking
      const alertKey = `alerts:${now.toISOString()}`;
      await env.RATE_LIMIT_KV.put(alertKey, JSON.stringify(alerts), {
        expirationTtl: 86400 * 30, // Keep for 30 days
      });

      // Send webhook if configured
      if (env.ALERT_WEBHOOK_URL) {
        try {
          await fetch(env.ALERT_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              alerts,
              timestamp: now.toISOString(),
              environment: env.ENVIRONMENT,
            }),
          });
        } catch (error) {
          console.error("Failed to send webhook alert:", error);
        }
      }

      // Send email alert for critical alerts (using MailChannels)
      const criticalAlerts = alerts.filter((a) => a.level === "critical");
      if (criticalAlerts.length > 0 && env.ADMIN_EMAIL) {
        try {
          await sendEmailAlert(criticalAlerts, env.ADMIN_EMAIL);
        } catch (error) {
          console.error("Failed to send email alert:", error);
        }
      }
    }

    // 5. Return status
    return new Response(
      JSON.stringify({
        success: true,
        alerts,
        metrics: {
          kv_writes: todayWrites,
          emails_sent: emailCount,
          bandwidth_mb: bandwidthMB,
        },
        timestamp: now.toISOString(),
      }),
      {
        status: alerts.some((a) => a.level === "critical") ? 503 : 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Quota check error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        alerts: [
          {
            type: "error",
            level: "critical",
            message: `Monitoring system error: ${error instanceof Error ? error.message : "Unknown"}`,
            value: 0,
            threshold: 0,
            percentage: 0,
          },
        ],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Send email alert using MailChannels (free with Cloudflare)
 */
async function sendEmailAlert(alerts: Alert[], adminEmail: string): Promise<void> {
  const emailBody = alerts.map((a) => `⚠️ ${a.level.toUpperCase()}: ${a.message}`).join("\n\n");

  const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: adminEmail }],
        },
      ],
      from: {
        email: "alerts@okaeri-resort.com",
        name: "Okaeri Monitoring",
      },
      subject: `🚨 Critical Alert: Quota Thresholds Exceeded`,
      content: [
        {
          type: "text/plain",
          value:
            `The following critical alerts have been triggered:\n\n${emailBody}\n\n` +
            `Timestamp: ${new Date().toISOString()}\n\n` +
            `Please take immediate action to prevent service disruption.\n\n` +
            `View dashboard: https://your-domain.pages.dev/admin/monitoring`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Email send failed: ${response.status}`);
  }
}
