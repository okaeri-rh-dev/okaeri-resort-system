import { useEffect, useState } from "react";

import { logger } from "@/lib/logger";

// ============================================
// PERFORMANCE MONITORING
// ============================================

interface PerformanceMetrics {
  navigationStart: number;
  navigationEnd: number;
  skeletonDisplayTime: number;
  totalLoadTime: number;
}

export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  const startNavigation = () => {
    const start = performance.now();
    return {
      end: () => {
        const end = performance.now();
        const newMetrics: PerformanceMetrics = {
          navigationStart: start,
          navigationEnd: end,
          skeletonDisplayTime: 0,
          totalLoadTime: end - start,
        };
        setMetrics(newMetrics);

        if (process.env.NODE_ENV === "development") {
          logger.info("Navigation Performance:", { metrics: newMetrics });
        }

        return newMetrics;
      },
    };
  };

  return { metrics, startNavigation };
};

// ============================================
// ADAPTIVE LOADING STRATEGIES
// ============================================

interface NetworkCondition {
  effectiveType: "slow-2g" | "2g" | "3g" | "4g" | undefined;
  downlink: number;
  rtt: number;
}

export const useAdaptiveLoading = () => {
  const [networkCondition, setNetworkCondition] = useState<NetworkCondition>({
    effectiveType: undefined,
    downlink: 0,
    rtt: 0,
  });

  useEffect(() => {
    if ("connection" in navigator) {
      // Navigator.connection is not in standard types, needs type assertion
      const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
      if (!connection) return;

      const updateNetworkInfo = () => {
        setNetworkCondition({
          effectiveType: connection.effectiveType as NetworkCondition["effectiveType"],
          downlink: connection.downlink ?? 0,
          rtt: connection.rtt ?? 0,
        });
      };

      updateNetworkInfo();
      connection.addEventListener("change", updateNetworkInfo);

      return () => {
        connection.removeEventListener("change", updateNetworkInfo);
      };
    }
  }, []);

  const getOptimalLoadingStrategy = () => {
    const { effectiveType, downlink } = networkCondition;

    if (effectiveType === "slow-2g" || effectiveType === "2g" || downlink < 1) {
      return {
        skeletonMinDuration: 500,
        enableProgressive: true,
        reducedAnimations: true,
        priority: "essential" as const,
      };
    }

    if (effectiveType === "4g" && downlink > 10) {
      return {
        skeletonMinDuration: 100,
        enableProgressive: false,
        reducedAnimations: false,
        priority: "full" as const,
      };
    }

    return {
      skeletonMinDuration: 200,
      enableProgressive: true,
      reducedAnimations: false,
      priority: "balanced" as const,
    };
  };

  return { networkCondition, getOptimalLoadingStrategy };
};

// Network Information API types (not in standard lib)
interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}
