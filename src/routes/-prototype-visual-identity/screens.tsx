// PROTOTYPE (throwaway): representative static slices of real screens, built from the real
// shadcn primitives so the scoped tokens in directions.ts drive them. No data fetching.
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  Info,
  ListChecks,
  Receipt,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  contrastPairs,
  contrastRatio,
  type Direction,
  type Mode,
  type Palette,
} from "./directions";

interface SliceProps {
  direction: Direction;
  mode: Mode;
  wide: boolean;
}

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const cardSurface: React.CSSProperties = {
  boxShadow: "var(--proto-card-shadow)",
  borderWidth: "var(--proto-card-border)",
};

const mono: React.CSSProperties = { fontFamily: "var(--proto-mono)" };

function pill(direction: Direction) {
  return direction.key === "bahay" ? "rounded-full" : "";
}

function Display({
  direction,
  as: Tag = "h2",
  className = "",
  children,
}: {
  direction: Direction;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  children: React.ReactNode;
}) {
  const caseClass =
    direction.displayCase === "upper" ? "uppercase tracking-[0.16em]" : "tracking-tight";
  return (
    <Tag className={`${caseClass} ${className}`} style={{ fontFamily: "var(--proto-display)" }}>
      {children}
    </Tag>
  );
}

function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const style =
    tone === "neutral"
      ? { color: "var(--color-muted-foreground)", background: "var(--color-muted)" }
      : { color: `var(--proto-${tone})`, background: `var(--proto-${tone}-bg)` };
  return (
    <Badge
      variant="outline"
      className="border-transparent font-medium whitespace-nowrap"
      style={style}
    >
      {children}
    </Badge>
  );
}

const bookingTone: Record<string, Tone> = {
  Pending: "warning",
  Confirmed: "success",
  "Checked in": "info",
  "Checked out": "neutral",
  Cancelled: "danger",
};
const paymentTone: Record<string, Tone> = {
  Pending: "warning",
  Partial: "info",
  Completed: "success",
  Refunded: "neutral",
};

function mix(a: string, b: string, weightOfA: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((i) => Math.round(channel(a, i) * weightOfA + channel(b, i) * (1 - weightOfA)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function availabilityScale(p: Palette, mode: Mode) {
  const weights = mode === "light" ? [0.75, 0.42, 0.18] : [0.5, 0.3, 0.14];
  return {
    3: { bg: mix(p.brand, p.card, weights[0]), fg: p.foreground },
    2: { bg: mix(p.brand, p.card, weights[1]), fg: p.foreground },
    1: { bg: mix(p.brand, p.card, weights[2]), fg: p.foreground },
    0: { bg: p.muted, fg: p.mutedForeground },
  } as const;
}

// ───────────────────────────── Foundations ─────────────────────────────

export function Foundations({ direction, mode }: SliceProps) {
  const p = direction.palettes[mode];
  const scale = availabilityScale(p, mode);
  const pairs = [
    ...contrastPairs(p),
    { label: "Calendar: 3 left", fg: scale[3].fg, bg: scale[3].bg, min: 4.5 },
    { label: "Calendar: 1 left", fg: scale[1].fg, bg: scale[1].bg, min: 4.5 },
    { label: "Calendar: booked", fg: scale[0].fg, bg: scale[0].bg, min: 4.5 },
  ];
  const swatches: [string, string][] = [
    ["Brand sand", p.brand],
    ["Primary", p.primary],
    ["Page", p.background],
    ["Card", p.card],
    ["Muted", p.muted],
    ["Border", p.border],
    ["Muted text", p.mutedForeground],
    ["Text", p.foreground],
  ];

  return (
    <div className="space-y-6 p-5">
      <div className="space-y-2">
        <Display direction={direction} as="p" className="text-xs">
          <span style={{ color: "var(--proto-brand-text)" }}>{direction.reading}</span>
        </Display>
        <Display direction={direction} as="h1" className="text-3xl font-semibold">
          {direction.name}
        </Display>
        <p className="text-muted-foreground max-w-prose text-sm">{direction.thesis}</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Colour</h3>
        <div className="grid grid-cols-4 gap-2">
          {swatches.map(([label, hex]) => (
            <div key={label} className="text-xs">
              <div className="border-border h-10 rounded-md border" style={{ background: hex }} />
              <div className="mt-1">{label}</div>
              <div className="text-muted-foreground" style={mono}>
                {hex}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <StatusBadge tone="success">Confirmed</StatusBadge>
          <StatusBadge tone="warning">Pending</StatusBadge>
          <StatusBadge tone="info">Checked in</StatusBadge>
          <StatusBadge tone="danger">Cancelled</StatusBadge>
          <StatusBadge tone="neutral">Checked out</StatusBadge>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Type</h3>
        <Card className="space-y-3 p-4" style={cardSurface}>
          <Display direction={direction} className="text-2xl font-semibold">
            Welcome home
          </Display>
          <Display direction={direction} as="h3" className="text-base font-medium">
            Tomorrow's schedule
          </Display>
          <p className="text-sm leading-relaxed">
            Downpayment secures your booking. We assign specific cabins after the payment is
            verified, usually within 4–24 hours.
          </p>
          <p className="text-muted-foreground text-xs">Updated Oct 18, 3:45 PM</p>
          <p className="text-xl font-semibold tabular-nums" style={mono}>
            ₱36,000.00{" "}
            <span className="text-muted-foreground text-sm font-normal">· BK-2610-0042</span>
          </p>
          <p className="text-muted-foreground text-xs" style={mono}>
            {direction.fonts.display.split(",")[0]} / {direction.fonts.body.split(",")[0]} /{" "}
            {direction.fonts.mono.split(",")[0]}
          </p>
        </Card>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Radius &amp; surface</h3>
        <p className="text-muted-foreground text-xs">
          Radius {direction.radius}px. {direction.surface.rule}
        </p>
        <Card className="space-y-3 p-4" style={cardSurface}>
          <div className="flex flex-wrap gap-2">
            <Button className={pill(direction)}>Submit booking</Button>
            <Button variant="outline" className={pill(direction)}>
              Back
            </Button>
            <Button variant="ghost" className={pill(direction)}>
              Cancel
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`name-${direction.key}`}>Full name</Label>
            <Input id={`name-${direction.key}`} placeholder="Juan Dela Cruz" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`focus-${direction.key}`}>Focused field</Label>
            <Input
              id={`focus-${direction.key}`}
              defaultValue="juan@example.com"
              className="border-ring ring-ring/50 ring-[3px]"
            />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox defaultChecked /> I agree to the terms
            </label>
            <label className="flex items-center gap-2">
              <Switch defaultChecked /> Walk-in
            </label>
          </div>
        </Card>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Contrast (WCAG 2.2 AA)</h3>
        <table className="w-full text-xs">
          <tbody>
            {pairs.map((pair) => {
              const ratio = contrastRatio(pair.fg, pair.bg);
              const passes = ratio >= pair.min;
              return (
                <tr key={pair.label} className="border-border border-b last:border-0">
                  <td className="py-1.5 pr-2">
                    <span
                      className="inline-block rounded px-1.5 py-0.5"
                      style={{
                        color: pair.fg,
                        background: pair.bg,
                        outline: `1px solid ${p.border}`,
                      }}
                    >
                      Aa
                    </span>
                  </td>
                  <td className="py-1.5">{pair.label}</td>
                  <td className="py-1.5 text-right tabular-nums" style={mono}>
                    {ratio.toFixed(2)}:1
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    <StatusBadge tone={passes ? "success" : "danger"}>
                      {passes ? `≥ ${pair.min}` : `< ${pair.min}`}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ───────────────────────────── Admin dashboard ─────────────────────────────

const navItems = [
  { label: "Dashboard", icon: Home, active: true },
  { label: "Bookings", icon: CalendarIcon },
  { label: "Booking Queue", icon: ListChecks },
  { label: "Guests", icon: Users },
  { label: "Payments", icon: Receipt },
  { label: "Cabins", icon: Building2 },
  { label: "Settings", icon: Settings },
];

const recentBookings = [
  {
    guest: "Maria Santos",
    unit: "C1",
    dates: "Oct 20 – Oct 22",
    guests: 6,
    amount: "₱18,000.00",
    status: "Confirmed",
    payment: "Partial",
  },
  {
    guest: "Paolo Reyes",
    unit: "C2",
    dates: "Oct 21 – Oct 23",
    guests: 8,
    amount: "₱20,000.00",
    status: "Pending",
    payment: "Pending",
  },
  {
    guest: "Ana Lim",
    unit: "C3",
    dates: "Oct 18 – Oct 19",
    guests: 4,
    amount: "₱9,000.00",
    status: "Checked in",
    payment: "Completed",
  },
  {
    guest: "Jose Bautista",
    unit: "C1",
    dates: "Oct 14 – Oct 16",
    guests: 5,
    amount: "₱18,000.00",
    status: "Checked out",
    payment: "Completed",
  },
  {
    guest: "Liza Cruz",
    unit: "C2",
    dates: "Oct 25 – Oct 26",
    guests: 6,
    amount: "₱9,000.00",
    status: "Cancelled",
    payment: "Refunded",
  },
];

export function AdminDashboardSlice({ direction, wide }: SliceProps) {
  const darkShell = direction.palettes.light.shell !== direction.palettes.light.card;
  return (
    <div className="flex min-h-[760px]">
      <aside
        className={`${wide ? "w-60" : "w-14"} shrink-0 border-r p-2`}
        style={{
          background: "var(--proto-shell)",
          color: "var(--proto-shell-fg)",
          borderColor: darkShell ? "transparent" : "var(--color-border)",
        }}
      >
        <div
          className={`mb-4 flex items-center gap-2 px-2 py-3 ${wide ? "" : "justify-center px-0"}`}
        >
          <RoofMark />
          {wide && (
            <Display direction={direction} as="p" className="text-sm font-semibold">
              Okaeri
            </Display>
          )}
        </div>
        <nav className="space-y-1">
          {navItems.map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              title={label}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${wide ? "" : "justify-center px-0"}`}
              style={
                active
                  ? {
                      background: darkShell ? "var(--proto-brand)" : "var(--color-accent)",
                      color: darkShell ? "#1a1410" : "var(--color-foreground)",
                      fontWeight: 600,
                      boxShadow: darkShell ? undefined : "inset 2px 0 0 var(--proto-brand)",
                    }
                  : { opacity: 0.8 }
              }
            >
              <Icon className="size-4" />
              {wide && label}
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Display direction={direction} as="h1" className="text-2xl font-semibold">
              Dashboard
            </Display>
            <p className="text-muted-foreground text-sm">
              Welcome to Okaeri Resort Management System
            </p>
          </div>
          <div className="flex items-center gap-2">
            {wide && <span className="text-muted-foreground text-xs">Updated 2 minutes ago</span>}
            <Button variant="outline" size="sm" className={pill(direction)}>
              <RefreshCw /> Refresh
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className={pill(direction)}
            >
              <Bell />
            </Button>
          </div>
        </div>

        <div className={`grid gap-3 ${wide ? "grid-cols-4" : "grid-cols-2"}`}>
          {[
            ["Available Cabins", "2/3", "Cabins ready for booking"],
            ["Active Bookings", "1", "Currently checked in"],
            ["Total Bookings", "148", "All time bookings"],
            ["Total Guests", "612", "Registered guests"],
          ].map(([title, value, hint]) => (
            <Card key={title} className="p-4" style={cardSurface}>
              <p className="text-muted-foreground text-xs font-medium">{title}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums" style={mono}>
                {value}
              </p>
              <p className="text-muted-foreground text-xs">{hint}</p>
            </Card>
          ))}
        </div>

        <div className={`grid gap-3 ${wide ? "grid-cols-[1fr_2fr]" : "grid-cols-1"}`}>
          <Card style={cardSurface}>
            <CardHeader className="p-4 pb-2">
              <CardTitle>
                <Display direction={direction} as="span" className="text-base font-semibold">
                  Tomorrow's Schedule
                </Display>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Tabs defaultValue="in">
                <TabsList className="w-full">
                  <TabsTrigger value="in" className="flex-1">
                    Check-ins (2)
                  </TabsTrigger>
                  <TabsTrigger value="out" className="flex-1">
                    Check-outs (1)
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="in" className="mt-3 space-y-2">
                  {[
                    ["Maria Santos", "Cabin 1 • 6 guests", "₱18,000", "Partial"],
                    ["Paolo Reyes", "Cabin 2 • 8 guests", "₱20,000", "Pending"],
                  ].map(([name, meta, amount, payment]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-muted-foreground text-xs">{meta}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm tabular-nums" style={mono}>
                          {amount}
                        </p>
                        <StatusBadge tone={paymentTone[payment]}>{payment}</StatusBadge>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card style={cardSurface}>
            <CardHeader className="p-4 pb-2">
              <CardTitle>
                <Display direction={direction} as="span" className="text-base font-semibold">
                  All Bookings
                </Display>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Guest</TableHead>
                    <TableHead>Unit(s)</TableHead>
                    {wide && <TableHead>Dates</TableHead>}
                    {wide && <TableHead className="text-right">Amount</TableHead>}
                    <TableHead>Status</TableHead>
                    {wide && <TableHead className="pr-4">Payment</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBookings.map((booking) => (
                    <TableRow key={booking.guest}>
                      <TableCell className="pl-4 font-medium">{booking.guest}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={mono}>
                          {booking.unit}
                        </Badge>
                      </TableCell>
                      {wide && (
                        <TableCell className="text-muted-foreground">{booking.dates}</TableCell>
                      )}
                      {wide && (
                        <TableCell className="text-right tabular-nums" style={mono}>
                          {booking.amount}
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge tone={bookingTone[booking.status]}>
                          {booking.status}
                        </StatusBadge>
                      </TableCell>
                      {wide && (
                        <TableCell className="pr-4">
                          <StatusBadge tone={paymentTone[booking.payment]}>
                            {booking.payment}
                          </StatusBadge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function RoofMark() {
  return (
    <svg viewBox="0 0 64 24" className="h-5 w-12" aria-hidden>
      <g stroke="var(--proto-brand)" strokeWidth="4" strokeLinecap="butt" fill="none">
        <path d="M2 20 L22 10" />
        <path d="M14 20 L34 10" />
        <path d="M26 20 L46 6 L62 20" />
      </g>
    </svg>
  );
}

// ───────────────────────────── Booking form ─────────────────────────────

const steps = ["Dates", "Cabins", "Contact", "Payment Proof", "Review"];

export function BookingFormSlice({ direction, wide }: SliceProps) {
  const current = 1;
  return (
    <div className="space-y-6 p-5" style={{ background: "var(--color-background)" }}>
      <div className="space-y-1 text-center">
        <RoofMark />
        <Display direction={direction} as="h1" className="text-3xl font-semibold">
          Book Your Stay
        </Display>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          Complete the form below to request a booking. We'll confirm unit assignment within 24
          hours.
        </p>
      </div>

      <ol className="flex gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step} className="flex-1">
              <div
                className="h-1 rounded-full"
                style={{
                  background: done || active ? "var(--color-primary)" : "var(--color-border)",
                }}
              />
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-semibold"
                  style={
                    done || active
                      ? {
                          background: "var(--color-primary)",
                          color: "var(--color-primary-foreground)",
                          borderColor: "transparent",
                        }
                      : { color: "var(--color-muted-foreground)" }
                  }
                >
                  {done ? <Check className="size-3" /> : index + 1}
                </span>
                {(wide || active) && (
                  <span className={active ? "font-semibold" : "text-muted-foreground"}>{step}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className={`grid gap-4 ${wide ? "grid-cols-[2fr_1fr]" : "grid-cols-1"}`}>
        <Card style={cardSurface}>
          <CardHeader className="p-5 pb-3">
            <CardTitle>
              <Display direction={direction} as="span" className="text-lg font-semibold">
                Choose Cabins and Guests
              </Display>
            </CardTitle>
            <CardDescription>Select how many units you need and guests per unit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <Alert
              className="border-transparent"
              style={{ background: "var(--proto-info-bg)", color: "var(--proto-info)" }}
            >
              <Info className="size-4" style={{ color: "var(--proto-info)" }} />
              <AlertDescription style={{ color: "var(--proto-info)" }}>
                Add cabins and specify guests for each. Total: 2 cabins, 10 guests.
              </AlertDescription>
            </Alert>

            {[
              { name: "Cabin #1", guests: 6, extra: false },
              { name: "Cabin #2", guests: 4, extra: false },
            ].map((cabin, index) => (
              <div key={cabin.name} className="bg-muted/60 space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Home className="size-4" style={{ color: "var(--proto-brand-text)" }} />
                    {cabin.name}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${cabin.name}`}
                    className={pill(direction)}
                  >
                    <X />
                  </Button>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`guests-${direction.key}-${index}`}>Number of Guests</Label>
                  <Input
                    id={`guests-${direction.key}-${index}`}
                    type="number"
                    defaultValue={cabin.guests}
                    className="bg-card max-w-32"
                  />
                  <p className="text-muted-foreground text-xs">Maximum 8 guests per unit</p>
                </div>
                {index === 0 && (
                  <div
                    className="rounded-md px-3 py-2 text-xs"
                    style={{ background: "var(--proto-warning-bg)", color: "var(--proto-warning)" }}
                  >
                    Extra person fee: ₱1,000.00/night for each guest over 6.
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" className={`w-full ${pill(direction)}`}>
              Add Unit Request
            </Button>
          </CardContent>
        </Card>

        <Card style={cardSurface} className="h-fit">
          <CardHeader className="p-5 pb-3">
            <CardTitle>
              <Display direction={direction} as="span" className="text-base font-semibold">
                Booking Summary
              </Display>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-5 pt-0 text-sm">
            {[
              ["Cabins", "2"],
              ["Guests", "10"],
              ["Nights", "2 · Oct 24 – Oct 26"],
              ["Base rate", "₱9,000.00/night"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="tabular-nums" style={mono}>
                  {value}
                </span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums" style={mono}>
                ₱36,000.00
              </span>
            </div>
            <div
              className="flex justify-between font-semibold"
              style={{ color: "var(--proto-brand-text)" }}
            >
              <span>Downpayment (50%)</span>
              <span className="tabular-nums" style={mono}>
                ₱18,000.00
              </span>
            </div>
            <p className="text-muted-foreground pt-1 text-xs">
              Downpayment secures your booking. Admin assigns specific units after payment
              verification, typically within 4–24 hours.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className={pill(direction)}>
          <ArrowLeft /> Back
        </Button>
        <Button className={pill(direction)}>
          Next <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────── Availability calendar ─────────────────────────────

// October 2026 starts on a Thursday. Remaining units per day (3 cabins), today = 18.
const october = [
  3, 3, 2, 2, 3, 3, 3, 3, 1, 0, 0, 3, 3, 3, 2, 3, 1, 0, 2, 0, 0, 3, 3, 2, 0, 0, 3, 3, 3, 2, 1,
];
const today = 18;

export function CalendarSlice({ direction, mode, wide }: SliceProps) {
  const scale = availabilityScale(direction.palettes[mode], mode);
  const leading = 4;
  const legend: [keyof typeof scale, string][] = [
    [3, "3 units"],
    [2, "2 units"],
    [1, "1 unit"],
    [0, "Booked"],
  ];

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RoofMark />
          <Display direction={direction} as="h1" className="text-lg font-semibold">
            Okaeri Availability
          </Display>
        </div>
        <span className="text-muted-foreground text-sm">3 Cabins</span>
      </div>

      <Card className={`overflow-hidden ${wide ? "mx-auto max-w-3xl" : ""}`} style={cardSurface}>
        <div className="flex items-center justify-between border-b px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            className={pill(direction)}
          >
            <ChevronLeft />
          </Button>
          <Display direction={direction} as="h2" className="text-lg font-semibold">
            October 2026
          </Display>
          <Button variant="ghost" size="icon" aria-label="Next month" className={pill(direction)}>
            <ChevronRight />
          </Button>
        </div>

        <div className="space-y-3 p-3">
          <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
            {legend.map(([units, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-3 rounded-sm border"
                  style={{ background: scale[units].bg, ...(units === 0 ? hatch : {}) }}
                />
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-muted-foreground py-1 text-center text-[11px] font-medium uppercase"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: leading }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {october.map((left, i) => {
              const day = i + 1;
              const past = day < today;
              const tone = scale[left as keyof typeof scale];
              return (
                <div
                  key={day}
                  title={left === 0 ? "Fully booked" : `${left} available`}
                  className={`relative flex flex-col items-center justify-center rounded-md ${wide ? "min-h-16" : "min-h-12"}`}
                  style={
                    past
                      ? { color: "var(--color-muted-foreground)", opacity: 0.55 }
                      : {
                          background: tone.bg,
                          color: tone.fg,
                          ...(left === 0 ? hatch : {}),
                          outline: day === today ? "2px solid var(--color-ring)" : undefined,
                          outlineOffset: 2,
                        }
                  }
                >
                  <span className="text-sm font-semibold tabular-nums">{day}</span>
                  {!past && (
                    <span className="text-[10px]">{left === 0 ? "Full" : `${left} left`}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-muted-foreground border-t px-3 py-2 text-xs">
          Updated Oct 18, 3:45 PM
        </div>
      </Card>

      <div
        className={`flex items-center justify-between gap-3 rounded-lg p-4 ${wide ? "mx-auto max-w-3xl" : ""}`}
        style={{ background: "var(--color-muted)" }}
      >
        <p className="text-xs">
          <strong>View-Only:</strong> Contact us to book available dates. WhatsApp: +63 917 XXX XXXX
        </p>
      </div>
    </div>
  );
}

const hatch: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, currentColor 14%, transparent) 5px 6px)",
};
