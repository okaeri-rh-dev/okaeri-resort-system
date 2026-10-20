import { useEffect, useState } from "react";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime, formatRelativeTimeShort } from "@/lib/utils";

const STALE_AFTER_MS = 10 * 60 * 1000;
const TICK_INTERVAL_MS = 30 * 1000;

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  variant: "mobile" | "desktop";
  dataUpdatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
}

export function DashboardHeader({
  title,
  subtitle,
  variant,
  dataUpdatedAt,
  isFetching,
  onRefresh,
}: DashboardHeaderProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const hasTimestamp = dataUpdatedAt > 0;
  const isStale = hasTimestamp && now - dataUpdatedAt > STALE_AFTER_MS;
  const desktopLabel = hasTimestamp
    ? `Updated ${formatRelativeTime(new Date(dataUpdatedAt))}`
    : "Loading…";
  const mobileLabel = hasTimestamp ? formatRelativeTimeShort(new Date(dataUpdatedAt)) : "…";

  if (variant === "mobile") {
    return (
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-bold tracking-tight">{title}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn("text-xs", isStale ? "text-warning-foreground" : "text-muted-foreground")}
          >
            {mobileLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label="Refresh dashboard"
            className="h-10 w-10"
          >
            <RefreshCw className={cn("h-5 w-5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={cn("text-sm", isStale ? "text-warning-foreground" : "text-muted-foreground")}
        >
          {desktopLabel}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          aria-label="Refresh dashboard"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
