import { useRef, useSyncExternalStore } from "react";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type ThemeSetting = "light" | "dark" | "system";

export interface ShellTheme {
  value: ThemeSetting;
  onChange: (value: ThemeSetting) => void;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToDeviceTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** What the page shows now: the setting, or the device's choice when it is `system`. */
function useShownTheme(value: ThemeSetting): "light" | "dark" {
  const deviceIsDark = useSyncExternalStore(
    subscribeToDeviceTheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false
  );
  if (value === "system") return deviceIsDark ? "dark" : "light";
  return value;
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

const segmentTone = {
  sidebar: {
    track: "bg-sidebar-accent",
    ring: "focus-visible:ring-sidebar-ring",
    checked: "bg-sidebar-primary text-sidebar-primary-foreground",
    unchecked: "text-sidebar-foreground hover:bg-sidebar",
  },
  surface: {
    track: "bg-secondary",
    ring: "focus-visible:ring-ring",
    checked: "bg-card text-foreground shadow-card",
    unchecked: "text-muted-foreground hover:text-foreground",
  },
};

/**
 * Light / Dark / Auto as three segments of one pill. `labelled` shows the words, `icons` shows
 * icons only, and `rail` stacks icons in the narrow rail and shows the words once it is wide.
 */
export function ThemeSegments({
  theme,
  tone,
  form,
}: {
  theme: ShellTheme;
  tone: keyof typeof segmentTone;
  form: "labelled" | "icons" | "rail";
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const colors = segmentTone[tone];

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
      className={cn(
        "flex gap-0.5 rounded-full p-1",
        colors.track,
        form === "labelled" && "w-full",
        form === "icons" && "w-fit",
        form === "rail" && "large:w-full large:flex-row mx-auto w-fit flex-col"
      )}
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
            aria-label={form === "labelled" ? undefined : label}
            tabIndex={checked ? 0 : -1}
            onClick={() => theme.onChange(value)}
            onKeyDown={(event) => selectByArrow(event, index)}
            className={cn(
              "coarse:min-h-11 coarse:min-w-11 flex min-h-8 min-w-8 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:outline-hidden",
              colors.ring,
              checked ? colors.checked : colors.unchecked
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {form === "labelled" && label}
            {form === "rail" && (
              <span className="large:inline hidden" aria-hidden="true">
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** One-tap dark mode for the compact bars. It sets an explicit theme, so it stops following the device. */
export function DarkModeSwitch({ theme }: { theme: ShellTheme }) {
  const shown = useShownTheme(theme.value);
  return (
    <div className="flex items-center gap-2">
      <Moon className="size-4" aria-hidden="true" />
      <Switch
        aria-label="Dark mode"
        checked={shown === "dark"}
        onCheckedChange={(checked) => theme.onChange(checked ? "dark" : "light")}
      />
    </div>
  );
}
