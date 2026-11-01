import { useEffect, useState } from "react";

import { RefreshCw } from "lucide-react";

import { Button, PageHeader } from "@/components/patterns";
import { cn, formatRelativeTimeShort } from "@/lib/utils";

const STALE_AFTER_MS = 10 * 60 * 1000;
const TICK_INTERVAL_MS = 30 * 1000;

interface DashboardHeaderProps {
  dataUpdatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
}

export function DashboardHeader({ dataUpdatedAt, isFetching, onRefresh }: DashboardHeaderProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const hasTimestamp = dataUpdatedAt > 0;
  const isStale = hasTimestamp && now - dataUpdatedAt > STALE_AFTER_MS;

  return (
    <PageHeader
      title="Dashboard"
      actions={
        <>
          <span
            className={cn("text-xs", isStale ? "text-warning-foreground" : "text-muted-foreground")}
          >
            {hasTimestamp ? formatRelativeTimeShort(new Date(dataUpdatedAt)) : "…"}
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
        </>
      }
    />
  );
}
