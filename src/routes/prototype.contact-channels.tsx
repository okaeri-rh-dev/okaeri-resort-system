/**
 * PROTOTYPE: throwaway. Lives on branch prototype/contact-channels only.
 *
 * Question: how should Contact channels read to guests on the root notice and the booking
 * confirmation Alert? Four variants via ?variant=A|B|C|D, sample data via ?data=0|1|3|6.
 * The real routes are copied here, not edited.
 */
import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { AtSign, Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react";

import { FacebookIcon, InstagramIcon, MessengerIcon } from "@/components/prototype/brand-icons";
import { PrototypeSwitcher } from "@/components/prototype/PrototypeSwitcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GuestLayout } from "@/layouts/GuestLayout";

const PublicAvailabilityCalendar = lazy(() =>
  import("@/components/calendar/PublicAvailabilityCalendar").then((mod) => ({
    default: mod.PublicAvailabilityCalendar,
  }))
);

type ChannelKind = "Mobile" | "Viber" | "WhatsApp" | "Messenger" | "Email" | "Facebook" | "Instagram";

interface ContactChannel {
  kind: ChannelKind;
  value: string;
  label?: string;
}

const dataSets: Record<string, ContactChannel[]> = {
  "0": [],
  "1": [{ kind: "WhatsApp", value: "+639171234567" }],
  "3": [
    { kind: "Viber", value: "+639171234567" },
    { kind: "Messenger", value: "okaeriresort" },
    { kind: "Mobile", value: "+639181112222", label: "Maria" },
  ],
  "6": [
    { kind: "Mobile", value: "+639171234567", label: "Maria" },
    { kind: "Viber", value: "+639171234567", label: "Maria" },
    { kind: "WhatsApp", value: "+639171234567" },
    { kind: "Messenger", value: "okaeriresort" },
    { kind: "Email", value: "reservations.and.inquiries@okaeri-beach-resort-launion.com" },
    { kind: "Facebook", value: "okaeriresortlaunion" },
    { kind: "Instagram", value: "okaeri.resort" },
    { kind: "Mobile", value: "+639285556666", label: "Ben" },
  ],
};

const variants = [
  { key: "A", name: "Inline text" },
  { key: "B", name: "Chips" },
  { key: "C", name: "Stacked list" },
  { key: "D", name: "Stacked list + icons" },
  { key: "E", name: "Minimal, words for links" },
  { key: "F", name: "Minimal, icons for links" },
];

const linkIcons = { Messenger: MessengerIcon, Facebook: FacebookIcon, Instagram: InstagramIcon };

const kindIcons: Record<ChannelKind, LucideIcon> = {
  Mobile: Phone,
  Viber: MessageCircle,
  WhatsApp: MessageCircle,
  Messenger: MessageCircle,
  Email: Mail,
  Facebook: AtSign,
  Instagram: AtSign,
};

function formatPhone(e164: string) {
  const digits = e164.replace("+63", "");
  return `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function displayValue({ kind, value }: ContactChannel) {
  if (kind === "Mobile" || kind === "Viber" || kind === "WhatsApp") return formatPhone(value);
  if (kind === "Instagram") return `@${value}`;
  return value;
}

function channelHref({ kind, value }: ContactChannel) {
  switch (kind) {
    case "Mobile":
      return `tel:${value}`;
    case "Viber":
      return `viber://chat?number=${encodeURIComponent(value)}`;
    case "WhatsApp":
      return `https://wa.me/${value.replace("+", "")}`;
    case "Messenger":
      return `https://m.me/${value}`;
    case "Facebook":
      return `https://facebook.com/${value}`;
    case "Instagram":
      return `https://instagram.com/${value}`;
    case "Email":
      return `mailto:${value}`;
  }
}

function isPhone({ kind }: ContactChannel) {
  return kind === "Mobile" || kind === "Viber" || kind === "WhatsApp";
}

function kindLabel({ kind, label }: ContactChannel) {
  return label ? `${kind} (${label})` : kind;
}

interface ChannelsProps {
  channels: ContactChannel[];
}

function InlineChannels({ channels }: ChannelsProps) {
  return (
    <>
      {channels.map((channel, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <span className="whitespace-nowrap">{kindLabel(channel)}:</span>{" "}
          <a href={channelHref(channel)} className={`font-medium underline ${isPhone(channel) ? "whitespace-nowrap" : "break-all"}`}>
            {displayValue(channel)}
          </a>
        </span>
      ))}
    </>
  );
}

function ChipChannels({ channels }: ChannelsProps) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {channels.map((channel, i) => (
        <li key={i} className="max-w-full min-w-0">
          <a
            href={channelHref(channel)}
            className="border-border bg-card text-foreground hover:bg-accent coarse:min-h-11 flex max-w-full min-w-0 items-center gap-1 rounded-full border px-3 py-1"
          >
            <span className="text-muted-foreground shrink-0">{kindLabel(channel)}</span>
            <span className="truncate font-medium">{displayValue(channel)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function StackedChannels({ channels, withIcons }: ChannelsProps & { withIcons?: boolean }) {
  return (
    // Arbitrary grid template: a shrink-to-fit kind column beside a value column that may wrap.
    <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1">
      {channels.map((channel, i) => {
        const Icon = kindIcons[channel.kind];
        return (
          <div key={i} className="contents">
            <dt className="text-muted-foreground flex items-center gap-2">
              {withIcons && <Icon className="size-4 shrink-0" aria-hidden="true" />}
              {kindLabel(channel)}
            </dt>
            <dd className="min-w-0">
              <a
                href={channelHref(channel)}
                className={`text-foreground font-medium underline ${isPhone(channel) ? "whitespace-nowrap" : "break-all"}`}
              >
                {displayValue(channel)}
              </a>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function isLink({ kind }: ContactChannel) {
  return kind === "Messenger" || kind === "Facebook" || kind === "Instagram";
}

function MinimalChannels({ channels, linkAs }: ChannelsProps & { linkAs: "word" | "icon" }) {
  return (
    <>
      {channels.map((channel, i) => {
        const separator = i > 0 && " · ";
        if (isLink(channel)) {
          const Icon = linkIcons[channel.kind as keyof typeof linkIcons];
          return (
            <span key={i}>
              {separator}
              {linkAs === "icon" ? (
                <a
                  href={channelHref(channel)}
                  aria-label={kindLabel(channel)}
                  title={kindLabel(channel)}
                  className="text-foreground hover:text-primary inline-flex size-6 items-center justify-center align-middle"
                >
                  <Icon className="size-4" />
                </a>
              ) : (
                <a href={channelHref(channel)} className="font-medium whitespace-nowrap underline">
                  {kindLabel(channel)}
                </a>
              )}
            </span>
          );
        }
        if (channel.kind === "Email") {
          return (
            <span key={i}>
              {separator}
              <a href={channelHref(channel)} className="font-medium wrap-anywhere underline">
                {channel.value}
              </a>
            </span>
          );
        }
        return (
          <span key={i}>
            {separator}
            <span className="whitespace-nowrap">{kindLabel(channel)}:</span>{" "}
            <a href={channelHref(channel)} className="font-medium whitespace-nowrap underline">
              {displayValue(channel)}
            </a>
          </span>
        );
      })}
    </>
  );
}

function Channels({ variant, channels }: ChannelsProps & { variant: string }) {
  if (variant === "B") return <ChipChannels channels={channels} />;
  if (variant === "C") return <StackedChannels channels={channels} />;
  if (variant === "D") return <StackedChannels channels={channels} withIcons />;
  if (variant === "E") return <MinimalChannels channels={channels} linkAs="word" />;
  if (variant === "F") return <MinimalChannels channels={channels} linkAs="icon" />;
  return <InlineChannels channels={channels} />;
}

export const Route = createFileRoute("/prototype/contact-channels")({
  validateSearch: (search: Record<string, unknown>) => ({
    variant: typeof search.variant === "string" ? search.variant : "A",
    data: search.data === undefined ? "3" : String(search.data),
    calendar: search.calendar === "0" || search.calendar === 0 ? "0" : "1",
  }),
  component: ContactChannelsPrototype,
});

function ContactChannelsPrototype() {
  const { variant, data, calendar } = Route.useSearch();
  const navigate = Route.useNavigate();
  const channels = dataSets[data] ?? dataSets["3"];
  const hasChannels = channels.length > 0;
  const isInline = ["A", "E", "F"].includes(variant);

  return (
    <GuestLayout>
      <section data-surface="root-notice" className="flex flex-col">
        {calendar === "1" && (
          <Suspense fallback={<div className="bg-card h-96 rounded-lg border" />}>
            <PublicAvailabilityCalendar />
          </Suspense>
        )}
        <div className="border-border bg-muted text-muted-foreground medium:text-sm mt-2 rounded border p-2 text-xs">
          <strong>View-Only:</strong> Contact us to book available dates.
          {hasChannels && isInline && (
            <>
              {" "}
              <Channels variant={variant} channels={channels} />
            </>
          )}
          {hasChannels && !isInline && <Channels variant={variant} channels={channels} />}
        </div>
      </section>

      <section data-surface="confirmation-alert" className="mx-auto mt-12 mb-24 max-w-3xl">
        <p className="text-muted-foreground mb-2 text-xs">
          Booking confirmation page, contact Alert:
        </p>
        <Alert className="no-print">
          <AlertDescription>
            If you have any questions or need to make changes to your booking, please contact us.
            {hasChannels && isInline && (
              <>
                {" "}
                <Channels variant={variant} channels={channels} />
              </>
            )}
            {hasChannels && !isInline && <Channels variant={variant} channels={channels} />}
          </AlertDescription>
        </Alert>
      </section>

      <PrototypeSwitcher
        variants={variants}
        current={variant}
        onVariantChange={(key) =>
          void navigate({ search: (prev) => ({ ...prev, variant: key }), replace: true })
        }
        dataSets={Object.keys(dataSets)}
        currentDataSet={data}
        onDataSetChange={(key) =>
          void navigate({ search: (prev) => ({ ...prev, data: key }), replace: true })
        }
      />
    </GuestLayout>
  );
}
