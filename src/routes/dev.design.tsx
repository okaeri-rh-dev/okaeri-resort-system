// PROTOTYPE (throwaway, branch prototype/visual-identity, never merged).
// Three visual-identity directions for ticket #31, side by side or one at a time (?focus=<key>),
// each on Foundations / Admin dashboard / Booking form / Availability calendar (?screen=).
import { useEffect } from "react";

import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";

import {
  directions,
  scopedVars,
  type Direction,
  type Mode,
} from "./-prototype-visual-identity/directions";
import {
  AdminDashboardSlice,
  BookingFormSlice,
  CalendarSlice,
  Foundations,
} from "./-prototype-visual-identity/screens";

const screens = {
  foundations: { label: "Foundations", Component: Foundations },
  admin: { label: "Admin dashboard", Component: AdminDashboardSlice },
  booking: { label: "Booking form", Component: BookingFormSlice },
  calendar: { label: "Availability calendar", Component: CalendarSlice },
} as const;
type ScreenKey = keyof typeof screens;

interface Search {
  screen?: ScreenKey;
  focus?: string;
  dark?: string;
}

export const Route = createFileRoute("/dev/design")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    screen: (search.screen as ScreenKey) in screens ? (search.screen as ScreenKey) : undefined,
    focus: typeof search.focus === "string" ? search.focus : undefined,
    dark: typeof search.dark === "string" ? search.dark : undefined,
  }),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: DesignSandbox,
});

function useGoogleFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${directions.map((d) => d.fonts.googleQuery).join("&")}&display=swap`;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);
}

function DesignSandbox() {
  useGoogleFonts();
  const navigate = useNavigate({ from: "/dev/design" });
  const { screen = "foundations", focus, dark = "" } = Route.useSearch();
  const darkKeys = new Set(dark.split(",").filter(Boolean));
  const focused = directions.find((d) => d.key === focus);
  const shown = focused ? [focused] : directions;

  const setSearch = (next: Partial<Search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

  const toggleDark = (key: string) => {
    const next = new Set(darkKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSearch({ dark: [...next].join(",") || undefined });
  };

  const cycleFocus = (step: number) => {
    const index = focused ? directions.indexOf(focused) : -1;
    const nextIndex = (index + step + directions.length + 1) % (directions.length + 1);
    setSearch({ focus: nextIndex === directions.length ? undefined : directions[nextIndex].key });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") cycleFocus(-1);
      if (event.key === "ArrowRight") cycleFocus(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const { Component } = screens[screen];

  return (
    <div className="min-h-screen bg-neutral-200 pb-24 font-sans text-neutral-900">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-neutral-300 bg-neutral-100 px-4 py-2 text-sm">
        <strong className="mr-2">/dev/design — visual identity prototype</strong>
        {(Object.keys(screens) as ScreenKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSearch({ screen: key })}
            className={`rounded px-3 py-1 ${key === screen ? "bg-neutral-900 text-white" : "hover:bg-neutral-300"}`}
          >
            {screens[key].label}
          </button>
        ))}
      </header>

      <div className={`grid gap-4 p-4 ${focused ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-3"}`}>
        {shown.map((direction) => {
          const mode: Mode = darkKeys.has(direction.key) ? "dark" : "light";
          return (
            <DirectionColumn
              key={direction.key}
              direction={direction}
              mode={mode}
              onToggleMode={() => toggleDark(direction.key)}
              onFocus={() => setSearch({ focus: focused ? undefined : direction.key })}
              focused={Boolean(focused)}
            >
              <Component direction={direction} mode={mode} wide={Boolean(focused)} />
            </DirectionColumn>
          );
        })}
      </div>

      {import.meta.env.DEV && (
        <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-950 px-2 py-1 text-sm text-white shadow-xl">
          <button
            aria-label="Previous"
            className="rounded-full p-2 hover:bg-white/15"
            onClick={() => cycleFocus(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-48 text-center">
            {focused ? `${focused.name} (${focused.reading})` : "All directions side by side"}
          </span>
          <button
            aria-label="Next"
            className="rounded-full p-2 hover:bg-white/15"
            onClick={() => cycleFocus(1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function DirectionColumn({
  direction,
  mode,
  onToggleMode,
  onFocus,
  focused,
  children,
}: {
  direction: Direction;
  mode: Mode;
  onToggleMode: () => void;
  onFocus: () => void;
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-neutral-400 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
        <div>
          <span className="font-semibold">{direction.name}</span>{" "}
          <span className="text-neutral-600">· {direction.reading}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onFocus}
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-200"
          >
            {focused ? "Back to all" : "Focus"}
          </button>
          <button
            onClick={onToggleMode}
            className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-200"
          >
            {mode === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            {mode === "dark" ? "Dark" : "Light"}
          </button>
        </div>
      </div>
      <div
        data-direction={direction.key}
        style={scopedVars(direction, mode)}
        className="bg-background text-foreground"
      >
        {children}
      </div>
    </section>
  );
}
