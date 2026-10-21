import type { ContactChannel } from "@/hooks/useContactChannels";
import { cn } from "@/lib/utils";

import { contactChannelKinds, toDisplayValue, toHref, toKindLabel } from "./contact-channel";

interface ContactChannelListProps {
  channels: ContactChannel[];
  /** Placement only. */
  className?: string;
}

/**
 * The guest-facing stacked list of Contact channels: icon, kind (and label),
 * then the value as a link. Renders nothing for an empty list.
 */
export function ContactChannelList({ channels, className }: ContactChannelListProps) {
  if (channels.length === 0) return null;

  return (
    // Arbitrary grid template: a shrink-to-fit kind column beside a value column that may wrap.
    <dl className={cn("grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1", className)}>
      {channels.map((channel) => {
        const { Icon } = contactChannelKinds[channel.kind];
        const kindLabel = toKindLabel(channel);
        const displayValue = toDisplayValue(channel);
        const href = toHref(channel);
        const opensWebPage = href.startsWith("https://");

        return (
          <div key={channel.id} className="contents">
            <dt className="text-muted-foreground flex items-center gap-2 self-start">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {kindLabel}
            </dt>
            <dd className="min-w-0">
              <a
                href={href}
                aria-label={`${kindLabel}: ${displayValue}`}
                {...(opensWebPage && { target: "_blank", rel: "noopener noreferrer" })}
                className={cn(
                  "text-foreground hover:text-primary font-medium underline",
                  channel.kind === "email" ? "wrap-anywhere" : "whitespace-nowrap"
                )}
              >
                {displayValue}
              </a>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
