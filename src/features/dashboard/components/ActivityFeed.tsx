/**
 * ActivityFeed Component
 * Phase 2.1 - GREEN Phase: Real-time activity feed with virtualization for Okaeri Resort
 *
 * @description Displays real-time resort operations, guest activities, financial events,
 * and compliance alerts with virtualized scrolling and mobile touch gestures
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { DashboardActivity, ActivityCategory, ActivityFeedState } from "../types";

interface ActivityFeedProps {
  activities?: DashboardActivity[];
  loading?: boolean;
  error?: string | null;
  isMobile?: boolean;
  realtimeEnabled?: boolean;
  pageSize?: number;
  onActivityUpdate?: (activity: DashboardActivity) => void;
  onActivityDismiss?: (activity: { activityId: string }) => void;
}

interface VirtualScrollProps {
  items: DashboardActivity[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (activity: DashboardActivity, index: number) => React.ReactNode;
}

const VirtualScroller: React.FC<VirtualScrollProps> = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  const visibleItems = items.slice(visibleStart, visibleEnd);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  return (
    <div
      data-testid="virtual-scroller"
      ref={containerRef}
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((activity, index) => renderItem(activity, visibleStart + index))}
        </div>
      </div>
    </div>
  );
};

const formatActivityTime = (timestamp: Date): { formatted: string; ariaLabel: string } => {
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / 60000);

  if (diffInMinutes < 1) {
    return { formatted: "Just now", ariaLabel: "Just now" };
  } else if (diffInMinutes < 60) {
    return {
      formatted: `${diffInMinutes}m ago`,
      ariaLabel: `${diffInMinutes} minutes ago`,
    };
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return {
      formatted: `${hours}h ago`,
      ariaLabel: `${hours} hours ago`,
    };
  } else {
    return {
      formatted: timestamp.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      ariaLabel: timestamp.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }
};

const getActivityIcon = (category: ActivityCategory): string => {
  switch (category) {
    case "booking":
      return "icon-booking";
    case "financial":
      return "icon-financial";
    case "operational":
      return "icon-operational";
    case "guest_service":
      return "icon-guest";
    case "system":
      return "icon-system";
    case "compliance":
      return "icon-compliance";
    case "emergency":
      return "icon-emergency";
    default:
      return "icon-activity";
  }
};

const getActivityIconLabel = (category: ActivityCategory): string => {
  return `${category.charAt(0).toUpperCase() + category.slice(1)} activity`;
};

const getPriorityBadgeColor = (
  priority: string
): "default" | "secondary" | "destructive" | "outline" => {
  switch (priority) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "outline";
  }
};

const getActivityBackgroundColor = (activity: DashboardActivity): string => {
  if (activity.priority === "critical") {
    return "bg-red-200 border-red-600 animate-pulse";
  }

  switch (activity.category) {
    case "booking":
      if ("type" in activity && activity.type === "booking_cancelled") return "bg-yellow-50";
      if ("type" in activity && activity.type === "no_show") return "bg-red-50";
      return "bg-blue-50";
    case "financial":
      if ("type" in activity && activity.type === "revenue_milestone") return "bg-green-50";
      return "bg-green-50";
    case "emergency":
      return "bg-red-200 border-red-600 animate-pulse";
    case "compliance":
      if (activity.status === "overdue") return "bg-red-100 border-red-500";
      return "bg-yellow-50";
    default:
      return "bg-gray-50";
  }
};

const formatPhilippineCurrency = (amount: number): string => {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
};

interface ActivityItemProps {
  activity: DashboardActivity;
  index: number;
  isMobile?: boolean;
  onDismiss?: (activityId: string) => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity, index, isMobile, onDismiss }) => {
  const timeInfo = formatActivityTime(activity.timestamp);
  const backgroundColor = getActivityBackgroundColor(activity);
  const iconLabel = getActivityIconLabel(activity.category);

  // Handle swipe to dismiss on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || !onDismiss) return;

    const touch = e.touches[0];
    const startX = touch.clientX;
    let currentX = startX;

    const handleTouchMove = (e: TouchEvent) => {
      currentX = e.touches[0].clientX;
      const deltaX = startX - currentX;

      if (deltaX > 150) {
        // Swipe threshold
        onDismiss(activity.id);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  };

  return (
    <div
      data-testid={`activity-item-${index}`}
      data-timestamp={activity.timestamp.toISOString()}
      className={`rounded-lg border p-3 ${backgroundColor} ${isMobile ? "mobile-layout" : ""}`}
      tabIndex={0}
      onTouchStart={handleTouchStart}
    >
      <div className="flex items-start space-x-3">
        {/* Activity Icon */}
        {!isMobile && (
          <div
            data-testid={getActivityIcon(activity.category)}
            aria-label={iconLabel}
            className="text-muted-foreground mt-1 flex-shrink-0"
          >
            {activity.category === "booking" && "📋"}
            {activity.category === "financial" && "💰"}
            {activity.category === "operational" && "🔧"}
            {activity.category === "guest_service" && "👤"}
            {activity.category === "system" && "⚙️"}
            {activity.category === "compliance" && "📄"}
            {activity.category === "emergency" && "🚨"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {/* Activity Content */}
          <div className="flex items-start justify-between">
            <p className="text-foreground text-sm font-medium">{activity.displayText}</p>
            <div className="ml-2 flex items-center space-x-2">
              {/* Priority Badge */}
              <Badge
                variant={getPriorityBadgeColor(activity.priority)}
                data-testid={`activity-priority-${activity.priority}`}
                className="text-xs"
              >
                {activity.priority}
              </Badge>
            </div>
          </div>

          {/* Activity Details */}
          <div className="text-muted-foreground mt-1 flex items-center space-x-3 text-xs">
            <time
              data-testid="activity-time"
              dateTime={activity.timestamp.toISOString()}
              aria-label={timeInfo.ariaLabel}
              className={isMobile ? "compact-timestamp" : ""}
            >
              {isMobile ? (
                <span data-testid="compact-timestamp">{timeInfo.formatted}</span>
              ) : (
                timeInfo.formatted
              )}
            </time>

            <span className="capitalize">{activity.category.replace("_", " ")}</span>

            {activity.actorName !== "system" && <span>by {activity.actorName}</span>}
          </div>

          {/* Specific Activity Details */}
          {activity.category === "booking" && "details" in activity && (
            <div className="text-muted-foreground mt-2 text-xs">
              {activity.details.bookingId && (
                <span className="font-mono">{activity.details.bookingId}</span>
              )}
            </div>
          )}

          {activity.category === "financial" && "details" in activity && (
            <div className="mt-2 text-xs">
              {activity.details.amount && (
                <span className="font-mono font-semibold">
                  {formatPhilippineCurrency(activity.details.amount.amount / 100)}
                </span>
              )}
              {activity.details.paymentMethod && (
                <span className="text-muted-foreground ml-2">
                  via{" "}
                  {activity.details.paymentMethod === "gcash"
                    ? "GCash"
                    : activity.details.paymentMethod === "maya"
                      ? "Maya"
                      : activity.details.paymentMethod}
                </span>
              )}
              {activity.details.transactionId && (
                <span className="text-muted-foreground ml-2 font-mono">
                  {activity.details.transactionId}
                </span>
              )}
            </div>
          )}

          {activity.category === "operational" && "details" in activity && (
            <div className="text-muted-foreground mt-2 text-xs">
              {activity.details.roomNumber && <span>Room {activity.details.roomNumber}</span>}
              {activity.details.assignedStaff && activity.details.assignedStaff.length > 0 && (
                <span className="ml-2">by {activity.details.assignedStaff.join(", ")}</span>
              )}
              {activity.details.actualDuration && (
                <span className="ml-2">{activity.details.actualDuration} minutes</span>
              )}
              {activity.details.qualityCheck?.score && (
                <span
                  data-testid={`quality-score-${activity.details.qualityCheck.score}`}
                  className="ml-2"
                >
                  ⭐ {activity.details.qualityCheck.score}/5
                </span>
              )}
            </div>
          )}

          {activity.category === "compliance" && "details" in activity && (
            <div className="mt-2">
              {activity.details.dueDate && (
                <div className="text-muted-foreground text-xs">
                  Due:{" "}
                  {new Date(activity.details.dueDate).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              )}
              {activity.details.status === "overdue" && activity.details.daysOverdue && (
                <div className="text-xs font-semibold text-red-600">
                  {activity.details.daysOverdue} days overdue
                </div>
              )}
              {activity.details.penaltyRisk && (
                <div className="text-xs text-red-600">
                  Penalty: {formatPhilippineCurrency(activity.details.penaltyRisk.amount / 100)}
                </div>
              )}
            </div>
          )}

          {activity.category === "emergency" && "details" in activity && (
            <div className="mt-2 space-y-1">
              <div className="text-xs font-semibold text-red-700">{activity.details.location}</div>
              {activity.details.firstResponders && (
                <div className="text-muted-foreground text-xs">
                  Response team: {activity.details.firstResponders.join(", ")}
                </div>
              )}
              {activity.details.guestsEvacuated && (
                <div className="text-xs font-semibold">
                  {activity.details.guestsEvacuated} guests evacuated
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = [],
  loading = false,
  error = null,
  isMobile = false,
  realtimeEnabled = false,
  pageSize = 10,
  onActivityUpdate,
  onActivityDismiss,
}) => {
  const [displayedActivities, setDisplayedActivities] = useState<DashboardActivity[]>([]);
  const [filters, setFilters] = useState<{
    categories: ActivityCategory[];
    priorities: string[];
    searchQuery: string;
  }>({
    categories: [],
    priorities: [],
    searchQuery: "",
  });
  const [loadMoreCount, setLoadMoreCount] = useState(1);
  const [announcement, setAnnouncement] = useState<string>("");

  // Sort activities chronologically (newest first)
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [activities]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = sortedActivities;

    if (filters.categories.length > 0) {
      filtered = filtered.filter((activity) => filters.categories.includes(activity.category));
    }

    if (filters.priorities.length > 0) {
      filtered = filtered.filter((activity) => filters.priorities.includes(activity.priority));
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (activity) =>
          activity.displayText.toLowerCase().includes(query) ||
          activity.actorName.toLowerCase().includes(query) ||
          ("guestName" in activity && activity.guestName?.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [sortedActivities, filters]);

  // Update displayed activities based on pagination
  useEffect(() => {
    const endIndex = loadMoreCount * pageSize;
    setDisplayedActivities(filteredActivities.slice(0, endIndex));
  }, [filteredActivities, loadMoreCount, pageSize]);

  // Handle real-time activity updates
  useEffect(() => {
    const handleNewActivity = () => {
      if (onActivityUpdate && displayedActivities.length > 0) {
        const latestActivity = displayedActivities[0];
        setAnnouncement(`New activity: ${latestActivity.displayText}`);
        setTimeout(() => setAnnouncement(""), 5000);
      }
    };

    if (realtimeEnabled) {
      handleNewActivity();
    }
  }, [displayedActivities, realtimeEnabled, onActivityUpdate]);

  const handleCategoryFilter = useCallback((category: ActivityCategory, checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      categories: checked
        ? [...prev.categories, category]
        : prev.categories.filter((c) => c !== category),
    }));
  }, []);

  const handlePriorityFilter = useCallback((priorities: string[]) => {
    setFilters((prev) => ({ ...prev, priorities }));
  }, []);

  const handleSearch = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const handleLoadMore = useCallback(() => {
    setLoadMoreCount((prev) => prev + 1);
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop <= clientHeight + 10) {
        handleLoadMore();
      }
    },
    [handleLoadMore]
  );

  const handleActivityDismiss = useCallback(
    (activityId: string) => {
      if (onActivityDismiss) {
        onActivityDismiss({ activityId });
      }
    },
    [onActivityDismiss]
  );

  const renderActivityItem = useCallback(
    (activity: DashboardActivity, index: number) => (
      <ActivityItem
        key={activity.id}
        activity={activity}
        index={index}
        isMobile={isMobile}
        onDismiss={handleActivityDismiss}
      />
    ),
    [isMobile, handleActivityDismiss]
  );

  if (loading) {
    return (
      <Card
        data-testid="activity-feed"
        role="feed"
        aria-label="Recent resort activities"
        className={isMobile ? "mobile-layout" : ""}
      >
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="activity-feed" role="feed" aria-label="Recent resort activities">
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            <p>Error loading activities: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      data-testid="activity-feed"
      role="feed"
      aria-label="Recent resort activities"
      className={isMobile ? "mobile-layout" : ""}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Activities</CardTitle>
          {realtimeEnabled && (
            <div data-testid="live-indicator" className="flex items-center space-x-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
              <span className="animate-pulse text-xs text-green-600">Live</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Live region for screen reader announcements */}
        {announcement && (
          <div role="status" className="sr-only">
            {announcement}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["booking", "financial", "operational"] as ActivityCategory[]).map((category) => (
              <label key={category} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={(e) => handleCategoryFilter(category, e.target.checked)}
                  className="rounded"
                />
                <span className="capitalize">{category}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <select
              aria-label="Priority filter"
              multiple
              value={filters.priorities}
              onChange={(e) =>
                handlePriorityFilter(Array.from(e.target.selectedOptions, (option) => option.value))
              }
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <input
              type="search"
              placeholder="Search activities..."
              aria-label="Search activities"
              value={filters.searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>

        <Separator />

        {/* Activity List */}
        <div className="mt-4">
          {displayedActivities.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <p>No activities found</p>
            </div>
          ) : displayedActivities.length > 100 ? (
            <VirtualScroller
              items={displayedActivities}
              itemHeight={80}
              containerHeight={500}
              renderItem={renderActivityItem}
            />
          ) : (
            <div
              className="max-h-96 space-y-3 overflow-y-auto"
              onScroll={handleScroll}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  const current = e.target as HTMLElement;
                  const next = current.nextElementSibling as HTMLElement;
                  if (next) next.focus();
                }
                if (e.key === "ArrowUp") {
                  const current = e.target as HTMLElement;
                  const prev = current.previousElementSibling as HTMLElement;
                  if (prev) prev.focus();
                }
              }}
            >
              {displayedActivities.map((activity, index) => renderActivityItem(activity, index))}
            </div>
          )}

          {/* Load More Button */}
          {filteredActivities.length > displayedActivities.length && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                aria-label={`Load more activities (${filteredActivities.length - displayedActivities.length} remaining)`}
              >
                Load more ({filteredActivities.length - displayedActivities.length} more)
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
