/**
 * Security Monitoring and Anomaly Detection
 * Analyzes audit logs to detect suspicious patterns and threats
 */

import { supabase } from "./supabase";

/**
 * Threat patterns that indicate suspicious activity
 */
export interface ThreatPattern {
  name: string;
  description: string;
  score: number; // Threat score contribution (0-100)
}

/**
 * Result of anomaly detection analysis
 */
export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  patterns: ThreatPattern[];
  threatScore: number; // Overall threat score (0-100)
  recommendations: string[];
  metadata: Record<string, unknown>;
}

/**
 * Detect anomalies for a specific IP address
 * Analyzes recent activity patterns to identify threats
 */
export async function detectAnomalies(
  ip: string,
  timeWindowMinutes: number = 60
): Promise<AnomalyDetectionResult> {
  const patterns: ThreatPattern[] = [];
  let threatScore = 0;
  const recommendations: string[] = [];
  const metadata: Record<string, unknown> = { ip, timeWindow: timeWindowMinutes };

  try {
    // Query recent audit logs for this IP
    const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();

    const { data: recentLogs, error } = await supabase
      .from("audit_logs")
      .select("*")
      .or(`ip_address.eq.${ip},metadata->ip_address.eq.${ip}`)
      .gte("created_at", startTime)
      .order("created_at", { ascending: false });

    if (error || !recentLogs || recentLogs.length === 0) {
      return {
        isAnomaly: false,
        patterns: [],
        threatScore: 0,
        recommendations: [],
        metadata,
      };
    }

    metadata.totalEvents = recentLogs.length;

    // Pattern 1: Multiple failed booking attempts
    const failedBookings = recentLogs.filter((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      return (
        log.action?.includes("guest_booking_failed") ||
        metadata?.action === "guest_booking_failed" ||
        log.severity === "ERROR"
      );
    });

    if (failedBookings.length > 3) {
      patterns.push({
        name: "multiple_failed_bookings",
        description: `${failedBookings.length} failed booking attempts`,
        score: Math.min(failedBookings.length * 10, 40),
      });
      threatScore += Math.min(failedBookings.length * 10, 40);
      recommendations.push("Consider blocking this IP temporarily");
    }

    // Pattern 2: Rate limit violations
    const rateLimitHits = recentLogs.filter((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      return (
        log.action?.includes("rate_limit") ||
        metadata?.ip_blocked === true ||
        metadata?.rate_limited === true
      );
    });

    if (rateLimitHits.length > 0) {
      patterns.push({
        name: "rate_limit_violation",
        description: `${rateLimitHits.length} rate limit violations`,
        score: rateLimitHits.length * 15,
      });
      threatScore += rateLimitHits.length * 15;
      recommendations.push("IP is hitting rate limits frequently");
    }

    // Pattern 3: CAPTCHA failures
    const captchaFailures = recentLogs.filter((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      return (
        log.action?.includes("captcha_failed") ||
        metadata?.turnstile_verified === false ||
        metadata?.captcha_failed === true
      );
    });

    if (captchaFailures.length > 2) {
      patterns.push({
        name: "captcha_failures",
        description: `${captchaFailures.length} CAPTCHA failures`,
        score: captchaFailures.length * 12,
      });
      threatScore += captchaFailures.length * 12;
      recommendations.push("Possible bot activity detected");
    }

    // Pattern 4: Email enumeration
    const uniqueEmails = new Set(
      recentLogs
        .filter((log) => {
          const metadata = log.metadata as Record<string, unknown> | null;
          return metadata?.guest_email || metadata?.email;
        })
        .map((log) => {
          const metadata = log.metadata as Record<string, unknown> | null;
          return (metadata?.guest_email || metadata?.email) as string;
        })
    );

    if (uniqueEmails.size > 3) {
      patterns.push({
        name: "email_enumeration",
        description: `${uniqueEmails.size} different emails attempted`,
        score: uniqueEmails.size * 8,
      });
      threatScore += uniqueEmails.size * 8;
      recommendations.push("Possible email harvesting attempt");
      metadata.uniqueEmails = Array.from(uniqueEmails);
    }

    // Pattern 5: Rapid-fire requests
    if (recentLogs.length > 50) {
      patterns.push({
        name: "rapid_requests",
        description: `${recentLogs.length} requests in ${timeWindowMinutes} minutes`,
        score: Math.min((recentLogs.length - 50) * 2, 30),
      });
      threatScore += Math.min((recentLogs.length - 50) * 2, 30);
      recommendations.push("Unusually high request volume");
    }

    // Pattern 6: File validation failures
    const uploadFailures = recentLogs.filter((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      return (
        log.action?.includes("file_validation_failed") ||
        metadata?.file_validation === false ||
        metadata?.upload_failed === true
      );
    });

    if (uploadFailures.length > 0) {
      patterns.push({
        name: "suspicious_uploads",
        description: `${uploadFailures.length} file upload failures`,
        score: uploadFailures.length * 20,
      });
      threatScore += uploadFailures.length * 20;
      recommendations.push("Potential malicious file upload attempts");
    }

    // Pattern 7: SQL injection attempts
    const sqlInjectionPatterns = recentLogs.filter((log) => {
      const data = JSON.stringify(log.metadata || {});
      const sqlPatterns = [
        /\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|EXEC)\b/i,
        /['";]/,
        /-{2,}/,
        /\/\*/,
      ];
      return sqlPatterns.some((pattern) => pattern.test(data));
    });

    if (sqlInjectionPatterns.length > 0) {
      patterns.push({
        name: "sql_injection_attempt",
        description: `${sqlInjectionPatterns.length} potential SQL injection attempts`,
        score: 50,
      });
      threatScore += 50;
      recommendations.push("CRITICAL: SQL injection attempts detected");
    }

    // Pattern 8: Different user agents (browser spoofing)
    const userAgents = new Set(
      recentLogs
        .filter((log) => {
          const metadata = log.metadata as Record<string, unknown> | null;
          return metadata?.user_agent;
        })
        .map((log) => {
          const metadata = log.metadata as Record<string, unknown> | null;
          return metadata?.user_agent as string;
        })
    );

    if (userAgents.size > 3) {
      patterns.push({
        name: "user_agent_spoofing",
        description: `${userAgents.size} different user agents`,
        score: userAgents.size * 5,
      });
      threatScore += userAgents.size * 5;
      recommendations.push("Multiple user agents suggest automated tools");
    }

    // Pattern 9: Access to restricted resources
    const unauthorizedAccess = recentLogs.filter((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      return (
        log.severity === "CRITICAL" ||
        log.action?.includes("unauthorized") ||
        metadata?.unauthorized === true
      );
    });

    if (unauthorizedAccess.length > 0) {
      patterns.push({
        name: "unauthorized_access",
        description: `${unauthorizedAccess.length} unauthorized access attempts`,
        score: unauthorizedAccess.length * 25,
      });
      threatScore += unauthorizedAccess.length * 25;
      recommendations.push("Attempting to access restricted resources");
    }

    // Cap threat score at 100
    threatScore = Math.min(threatScore, 100);

    // Add severity-based recommendations
    if (threatScore >= 75) {
      recommendations.unshift("IMMEDIATE ACTION: Block this IP immediately");
    } else if (threatScore >= 50) {
      recommendations.unshift("HIGH RISK: Monitor closely and consider blocking");
    } else if (threatScore >= 25) {
      recommendations.unshift("MODERATE RISK: Enhanced monitoring recommended");
    }

    return {
      isAnomaly: threatScore >= 50,
      patterns,
      threatScore,
      recommendations,
      metadata,
    };
  } catch (error) {
    console.error("Anomaly detection error:", error);
    return {
      isAnomaly: false,
      patterns: [],
      threatScore: 0,
      recommendations: ["Error during analysis"],
      metadata,
    };
  }
}

/**
 * Get top threat sources in the last N hours
 */
export async function getTopThreatSources(
  hoursBack: number = 24,
  limit: number = 10
): Promise<
  Array<{
    ip: string;
    eventCount: number;
    threatScore: number;
    patterns: string[];
  }>
> {
  try {
    const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    // Query audit logs grouped by IP
    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("ip_address, metadata")
      .gte("created_at", startTime)
      .in("severity", ["WARNING", "ERROR", "CRITICAL"]);

    if (error || !logs) {
      return [];
    }

    // Group by IP
    const ipMap = new Map<string, number>();
    logs.forEach((log) => {
      const metadata = log.metadata as Record<string, unknown> | null;
      // Type-safe IP extraction with proper type narrowing
      const ipFromLog = typeof log.ip_address === "string" ? log.ip_address : null;
      const ipFromMetadata = typeof metadata?.ip_address === "string" ? metadata.ip_address : null;
      const ip = ipFromLog || ipFromMetadata || "unknown";
      ipMap.set(ip, (ipMap.get(ip) || 0) + 1);
    });

    // Get threat scores for top IPs
    const threats = await Promise.all(
      Array.from(ipMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(async ([ip, count]) => {
          const anomaly = await detectAnomalies(ip, hoursBack * 60);
          return {
            ip,
            eventCount: count,
            threatScore: anomaly.threatScore,
            patterns: anomaly.patterns.map((p) => p.name),
          };
        })
    );

    return threats.sort((a, b) => b.threatScore - a.threatScore);
  } catch (error) {
    console.error("Failed to get top threat sources:", error);
    return [];
  }
}

/**
 * Log security event with threat metadata
 */
export async function logSecurityEvent(event: {
  type: "rate_limit_exceeded" | "captcha_failed" | "suspicious_pattern" | "file_validation_failed";
  ip: string;
  userAgent: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    // Calculate threat level - align with database enum values
    const threatLevel = event.type === "suspicious_pattern" ? "CRITICAL" : "WARNING";

    // Log to audit system with proper type-safe insert
    await supabase.from("audit_logs").insert({
      action: `security_${event.type}`,
      table_name: "security_events", // Required field
      severity: threatLevel as "WARNING" | "CRITICAL",
      ip_address: event.ip as unknown, // Database uses unknown type for ip_address
      description: `Security event: ${event.type.replace(/_/g, " ")}`,
      metadata: {
        ...event.metadata,
        user_agent: event.userAgent,
        threat_type: event.type,
        timestamp: new Date().toISOString(),
      } as any,
      source: "app",
    });
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
}

/**
 * Check if IP should be auto-blocked based on threat score
 */
export async function shouldAutoBlock(ip: string): Promise<{
  shouldBlock: boolean;
  reason?: string;
  threatScore?: number;
}> {
  const { threatScore, patterns } = await detectAnomalies(ip);

  if (threatScore >= 75) {
    return {
      shouldBlock: true,
      reason: `Auto-blocked due to threat score: ${threatScore}. Patterns: ${patterns
        .map((p) => p.name)
        .join(", ")}`,
      threatScore,
    };
  }

  // Check for critical patterns
  const criticalPatterns = ["sql_injection_attempt", "unauthorized_access"];
  const hasCritical = patterns.some((p) => criticalPatterns.includes(p.name));

  if (hasCritical) {
    return {
      shouldBlock: true,
      reason: `Critical security threat detected: ${patterns
        .filter((p) => criticalPatterns.includes(p.name))
        .map((p) => p.description)
        .join(", ")}`,
      threatScore,
    };
  }

  return {
    shouldBlock: false,
    threatScore,
  };
}
