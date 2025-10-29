import React, { useEffect, useMemo, useState } from "react";

import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deviceMemory = (navigator as any).deviceMemory;
      const hardwareConcurrency = navigator.hardwareConcurrency || 1;
      const isLowEndDevice = deviceMemory ? deviceMemory < 4 : hardwareConcurrency < 4;

      // Check connection type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection = (navigator as any).connection;
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
// OPTIMIZED SKELETON COMPONENTS
// ============================================

interface OptimizedSkeletonProps {
  className?: string;
  complexity?: "minimal" | "basic" | "detailed";
  animation?: "none" | "reduced" | "full";
  children?: React.ReactNode;
}

const OptimizedSkeleton: React.FC<OptimizedSkeletonProps> = ({
  className,
  complexity = "basic",
  animation = "full",
  children,
}) => {
  const animationClass = {
    none: "",
    reduced: "animate-pulse",
    full: "animate-pulse",
  }[animation];

  const baseClasses = "bg-neutral-200 rounded";

  // For minimal complexity, use solid colors instead of gradients
  const complexityClasses = {
    minimal: "bg-neutral-300",
    basic: "bg-neutral-200",
    detailed: "bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200",
  }[complexity];

  return (
    <div
      className={cn(
        baseClasses,
        complexity !== "minimal" && animationClass,
        complexityClasses,
        className
      )}
      style={{
        // Disable animations for minimal complexity
        animationDuration: complexity === "minimal" ? "0s" : undefined,
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// MOBILE CARD LOADING
// ============================================

interface MobileCardLoadingProps {
  count?: number;
  hasAvatar?: boolean;
  hasActions?: boolean;
  className?: string;
}

export const MobileCardLoading: React.FC<MobileCardLoadingProps> = ({
  count = 5,
  hasAvatar = false,
  hasActions = true,
  className,
}) => {
  const strategy = useAdaptiveLoadingStrategy();
  const [visibleItems, setVisibleItems] = useState(strategy.batchSize);

  // Progressive loading for large lists
  useEffect(() => {
    if (count <= strategy.batchSize) return;

    const timer = setInterval(() => {
      setVisibleItems((prev) => {
        const next = prev + strategy.batchSize;
        if (next >= count) {
          clearInterval(timer);
          return count;
        }
        return next;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [count, strategy.batchSize]);

  const itemsToShow = Math.min(visibleItems, count);

  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: itemsToShow }).map((_, index) => (
        <MobileCardSkeleton
          key={index}
          hasAvatar={hasAvatar}
          hasActions={hasActions}
          complexity={strategy.skeletonComplexity}
          animation={strategy.animationIntensity}
          style={{
            animationDelay:
              strategy.staggerDelay > 0 ? `${index * strategy.staggerDelay}ms` : undefined,
          }}
        />
      ))}

      {visibleItems < count && (
        <div className="py-4 text-center">
          <OptimizedSkeleton
            className="mx-auto h-4 w-32"
            complexity={strategy.skeletonComplexity}
            animation={strategy.animationIntensity}
          />
        </div>
      )}
    </div>
  );
};

interface MobileCardSkeletonProps {
  hasAvatar?: boolean;
  hasActions?: boolean;
  complexity?: "minimal" | "basic" | "detailed";
  animation?: "none" | "reduced" | "full";
  style?: React.CSSProperties;
}

const MobileCardSkeleton: React.FC<MobileCardSkeletonProps> = ({
  hasAvatar = false,
  hasActions = true,
  complexity = "basic",
  animation = "full",
  style,
}) => {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4" style={style}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex flex-1 items-center space-x-3">
          {hasAvatar && (
            <OptimizedSkeleton
              className="h-10 w-10 flex-shrink-0 rounded-full"
              complexity={complexity}
              animation={animation}
            />
          )}
          <div className="flex-1 space-y-1">
            <OptimizedSkeleton className="h-4 w-20" complexity={complexity} animation={animation} />
            <OptimizedSkeleton className="h-5 w-32" complexity={complexity} animation={animation} />
          </div>
        </div>
        <div className="flex space-x-1">
          <OptimizedSkeleton
            className="h-6 w-16 rounded"
            complexity={complexity}
            animation={animation}
          />
          {complexity !== "minimal" && (
            <OptimizedSkeleton
              className="h-6 w-16 rounded"
              complexity={complexity}
              animation={animation}
            />
          )}
        </div>
      </div>

      {/* Content rows */}
      <div className="mb-3 space-y-2">
        {Array.from({ length: complexity === "minimal" ? 2 : complexity === "basic" ? 3 : 4 }).map(
          (_, index) => (
            <div key={index} className="flex items-center justify-between">
              <OptimizedSkeleton
                className="h-3 w-16"
                complexity={complexity}
                animation={animation}
              />
              <OptimizedSkeleton
                className="h-3 w-20"
                complexity={complexity}
                animation={animation}
              />
            </div>
          )
        )}
      </div>

      {/* Actions */}
      {hasActions && (
        <div className="flex space-x-2 border-t border-neutral-100 pt-3">
          <OptimizedSkeleton
            className="h-8 flex-1 rounded"
            complexity={complexity}
            animation={animation}
          />
          {complexity !== "minimal" && (
            <OptimizedSkeleton
              className="h-8 flex-1 rounded"
              complexity={complexity}
              animation={animation}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// VIEWPORT-AWARE LOADING
// ============================================

interface ViewportLoadingProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  className?: string;
}

export const ViewportLoading: React.FC<ViewportLoadingProps> = ({
  children,
  fallback,
  rootMargin = "50px",
  threshold = 0.1,
  className,
}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [elementRef, setElementRef] = useState<HTMLDivElement | null>(null);
  const deviceInfo = useDeviceCapabilities();

  useEffect(() => {
    if (!elementRef || !deviceInfo.supportsIntersectionObserver) {
      // Fallback: render immediately if no Intersection Observer support
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { rootMargin, threshold }
    );

    observer.observe(elementRef);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, rootMargin, threshold, deviceInfo.supportsIntersectionObserver]);

  return (
    <div ref={setElementRef} className={className}>
      {isIntersecting ? children : fallback}
    </div>
  );
};

// ============================================
// TOUCH-OPTIMIZED LOADING
// ============================================

interface TouchLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  onPullToRefresh?: () => void;
  className?: string;
}

export const TouchOptimizedLoading: React.FC<TouchLoadingProps> = ({
  isLoading,
  children,
  onPullToRefresh,
  className,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const deviceInfo = useDeviceCapabilities();

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!deviceInfo.isMobile || !onPullToRefresh) return;

    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!deviceInfo.isMobile || !onPullToRefresh || isLoading) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance > 0 && window.scrollY === 0) {
      setIsPulling(true);
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = () => {
    if (!deviceInfo.isMobile || !onPullToRefresh) return;

    if (pullDistance > 50) {
      onPullToRefresh();
    }

    setIsPulling(false);
    setPullDistance(0);
    setStartY(0);
  };

  return (
    <div
      className={cn("relative", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {isPulling && (
        <div
          className="absolute top-0 right-0 left-0 flex items-center justify-center bg-blue-50 transition-all duration-200 ease-out"
          style={{ height: `${pullDistance}px` }}
        >
          <div className="text-sm text-blue-600">
            {pullDistance > 50 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="space-y-2 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
            <div className="text-sm text-neutral-600">Refreshing...</div>
          </div>
        </div>
      )}
    </div>
  );
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
