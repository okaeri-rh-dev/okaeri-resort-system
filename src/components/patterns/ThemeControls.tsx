import { useRef, useState, useSyncExternalStore } from "react";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type ThemeSetting = "light" | "dark" | "system";

export interface ShellTheme {
  value: ThemeSetting;
  onChange: (value: ThemeSetting) => void;
}

type ShownTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToDeviceTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** What the page shows now: the setting, or the device's choice when it is `system`. */
function useShownTheme(value: ThemeSetting): ShownTheme {
  const deviceIsDark = useSyncExternalStore(
    subscribeToDeviceTheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false
  );
  if (value === "system") return deviceIsDark ? "dark" : "light";
  return value;
}

/** Dark mode on or off sets an explicit theme, so it also stops following the device. */
function darkModeToggle(theme: ShellTheme, shown: ShownTheme) {
  return {
    checked: shown === "dark",
    onCheckedChange: (checked: boolean) => theme.onChange(checked ? "dark" : "light"),
  };
}

/** Turning matching off keeps the theme the page shows now. */
function matchDeviceToggle(theme: ShellTheme, shown: ShownTheme) {
  return {
    checked: theme.value === "system",
    onCheckedChange: (checked: boolean) => theme.onChange(checked ? "system" : shown),
  };
}

const segments: { value: ThemeSetting; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

const arrowSteps: Partial<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/** Light / Dark / Auto as three labelled segments. Only the expanded rail has room for it. */
export function ThemeSegments({ theme }: { theme: ShellTheme }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const selectByArrow = (event: React.KeyboardEvent, index: number) => {
    const step = arrowSteps[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + segments.length) % segments.length;
    theme.onChange(segments[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-sidebar-accent flex gap-0.5 rounded-full p-1"
    >
      {segments.map(({ value, label, icon: Icon }, index) => {
        const checked = theme.value === value;
        return (
          <button
            key={value}
            ref={(button) => {
              buttons.current[index] = button;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => theme.onChange(value)}
            onKeyDown={(event) => selectByArrow(event, index)}
            className={cn(
              "coarse:min-h-11 flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors duration-150",
              "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-hidden",
              checked
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const HOLD_MS = 500;

/** Calls `onHold` after a press of `HOLD_MS`, and swallows the click that ends that press. */
function useLongPress(onHold: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const cancel = () => window.clearTimeout(timer.current);

  return {
    onPointerDown: () => {
      held.current = false;
      cancel();
      timer.current = window.setTimeout(() => {
        held.current = true;
        onHold();
      }, HOLD_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    onClickCapture: (event: React.MouseEvent) => {
      if (!held.current) return;
      held.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

/**
 * The dark mode switch, for wherever the nav is not wide. With `holdForDeviceMatch`, a long press
 * opens "Match my device", for spots with no menu sheet to hold it.
 */
export function DarkModeSwitch({
  theme,
  orientation = "horizontal",
  holdForDeviceMatch = false,
}: {
  theme: ShellTheme;
  orientation?: "horizontal" | "vertical";
  holdForDeviceMatch?: boolean;
}) {
  const shown = useShownTheme(theme.value);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const longPress = useLongPress(() => setOptionsOpen(true));

  const control = (
    <div
      className={cn(
        "flex items-center gap-2",
        orientation === "vertical" && "mx-auto flex-col py-2",
        holdForDeviceMatch && "select-none"
      )}
      {...(holdForDeviceMatch && longPress)}
    >
      <Moon className="size-4" aria-hidden="true" />
      <Switch aria-label="Dark mode" {...darkModeToggle(theme, shown)} />
    </div>
  );

  if (!holdForDeviceMatch) return control;

  return (
    <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
      <PopoverAnchor asChild>{control}</PopoverAnchor>
      <PopoverContent align="end" aria-label="Theme options" className="w-64">
        <MatchDeviceRow theme={theme} shown={shown} tone="surface" />
      </PopoverContent>
    </Popover>
  );
}

type RowTone = "surface" | "sidebar";

const mutedText: Record<RowTone, string> = {
  surface: "text-muted-foreground",
  sidebar: "opacity-70",
};

/** `secondary` indents and mutes the row under "Dark mode". */
function MatchDeviceRow({
  theme,
  shown,
  tone,
  secondary = false,
}: {
  theme: ShellTheme;
  shown: ShownTheme;
  tone: RowTone;
  secondary?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={cn(secondary ? ["pl-8", mutedText[tone]] : "font-medium")}>
        Match my device
      </span>
      <Switch aria-label="Match my device" {...matchDeviceToggle(theme, shown)} />
    </div>
  );
}

/**
 * The menu sheets' pair: "Dark mode", and "Match my device" for the system setting. Dark mode is
 * locked while the device decides.
 */
export function ThemeSwitchRows({ theme, tone }: { theme: ShellTheme; tone: RowTone }) {
  const shown = useShownTheme(theme.value);
  return (
    <div className="space-y-3 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-sm font-medium">
        <span className="flex items-center gap-3">
          <Moon className="size-5" aria-hidden="true" />
          Dark mode
        </span>
        <Switch
          aria-label="Dark mode"
          disabled={theme.value === "system"}
          {...darkModeToggle(theme, shown)}
        />
      </div>
      <MatchDeviceRow theme={theme} shown={shown} tone={tone} secondary />
    </div>
  );
}
