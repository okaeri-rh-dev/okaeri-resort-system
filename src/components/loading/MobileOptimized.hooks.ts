import { useEffect, useMemo, useState } from "react";

import { logger } from "@/lib/logger";

// ============================================
// MOBILE-OPTIMIZED LOADING HOOKS
// ============================================

interface DeviceInfo {
  isMobile: boolean;
  isLowEndDevice: boolean;
  supportsIntersectionObserver: boolean;
  deviceMemory?: number;
  connectionType?: string;
}

export const useDeviceCapabilities = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isLowEndDevice: false,
    supportsIntersectionObserver: false,
  });

  useEffect(() => {
    const checkDeviceCapabilities = () => {
      const isMobile =
        window.innerWidth < 768 ||
        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Check for low-end device indicators
      // Navigator.deviceMemory is not in standard types
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const hardwareConcurrency = navigator.hardwareConcurrency || 1;
      const isLowEndDevice = deviceMemory ? deviceMemory < 4 : hardwareConcurrency < 4;

      // Check connection type
      // Navigator.connection is not in standard types
      const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
      const connectionType = connection?.effectiveType;

      setDeviceInfo({
        isMobile,
        isLowEndDevice,
        supportsIntersectionObserver: "IntersectionObserver" in window,
        deviceMemory,
        connectionType,
      });
    };

    checkDeviceCapabilities();

    // Re-check on resize
    window.addEventListener("resize", checkDeviceCapabilities);
    return () => window.removeEventListener("resize", checkDeviceCapabilities);
  }, []);

  return deviceInfo;
};

// Network Information API types (not in standard lib)
interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

// ============================================
// ADAPTIVE LOADING STRATEGY
// ============================================

interface LoadingStrategy {
  shouldPreload: boolean;
  skeletonComplexity: "minimal" | "basic" | "detailed";
  animationIntensity: "none" | "reduced" | "full";
  staggerDelay: number;
  batchSize: number;
}

export const useAdaptiveLoadingStrategy = (): LoadingStrategy => {
  const deviceInfo = useDeviceCapabilities();

  const strategy = useMemo((): LoadingStrategy => {
    const { isLowEndDevice, connectionType, isMobile } = deviceInfo;

    // Low-end device or slow connection
    if (isLowEndDevice || connectionType === "slow-2g" || connectionType === "2g") {
      return {
        shouldPreload: false,
        skeletonComplexity: "minimal",
        animationIntensity: "none",
        staggerDelay: 0,
        batchSize: 3,
      };
    }

    // Mobile device with moderate specs
    if (isMobile && (connectionType === "3g" || !connectionType)) {
      return {
        shouldPreload: true,
        skeletonComplexity: "basic",
        animationIntensity: "reduced",
        staggerDelay: 50,
        batchSize: 5,
      };
    }

    // High-end device or fast connection
    return {
      shouldPreload: true,
      skeletonComplexity: "detailed",
      animationIntensity: "full",
      staggerDelay: 100,
      batchSize: 10,
    };
  }, [deviceInfo]);

  return strategy;
};

// ============================================
// PERFORMANCE HOOKS
// ============================================

export const useLoadingPerformance = () => {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    skeletonDisplayTime: 0,
    dataLoadTime: 0,
  });

  const startMeasurement = () => {
    const startTime = performance.now();

    return {
      endSkeleton: () => {
        const skeletonTime = performance.now();
        return {
          endData: () => {
            const endTime = performance.now();
            const newMetrics = {
              renderTime: skeletonTime - startTime,
              skeletonDisplayTime: endTime - skeletonTime,
              dataLoadTime: endTime - startTime,
            };

            setMetrics(newMetrics);

            // Log performance in development
            if (process.env.NODE_ENV === "development") {
              logger.info("Loading Performance:", newMetrics);
            }

            return newMetrics;
          },
        };
      },
    };
  };

  return { metrics, startMeasurement };
};
