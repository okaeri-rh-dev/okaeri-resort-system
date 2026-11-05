import type { ContactChannel } from "@/hooks/useContactChannels";
import { cn } from "@/lib/utils";

import { ContactChannelList } from "./ContactChannelList";

interface PolicyContactChannelsProps {
  /** Undefined while the channels load, so the notice does not flash before they arrive. */
  channels: ContactChannel[] | undefined;
  className?: string;
}

/** The visible Contact channels, or a notice when the resort shows none yet. */
export function PolicyContactChannels({ channels, className }: PolicyContactChannelsProps) {
  if (!channels) return null;

  if (channels.length === 0) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        Ways to reach the resort are not listed yet.
      </p>
    );
  }

  return (
    <div className={cn("text-sm", className)}>
      <ContactChannelList channels={channels} />
    </div>
  );
}
