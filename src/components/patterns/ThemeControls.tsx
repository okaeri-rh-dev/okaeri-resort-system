import { useId, useSyncExternalStore } from "react";

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

/** Light / Dark / Auto as three labelled segments. Only the expanded rail has room for it. */
export function ThemeSegments({ theme }: { theme: ShellTheme }) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-sidebar-accent flex gap-0.5 rounded-full p-1"
    >
      {segments.map(({ value, label, icon: Icon }) => {
        const checked = theme.value === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => theme.onChange(value)}
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

/**
 * One switch for wherever the nav is not wide. Turning it on or off sets an explicit theme, so it
 * also stops following the device.
 */
export function MoonSwitch({
  theme,
  orientation = "horizontal",
}: {
  theme: ShellTheme;
  orientation?: "horizontal" | "vertical";
}) {
  const shown = useShownTheme(theme.value);
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        orientation === "vertical" && "mx-auto flex-col py-2"
      )}
    >
      <Moon className="size-4" aria-hidden="true" />
      <Switch
        aria-label="Dark mode"
        checked={shown === "dark"}
        onCheckedChange={(checked) => theme.onChange(checked ? "dark" : "light")}
      />
    </div>
  );
}

function SwitchRow({
  label,
  icon: Icon,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  icon?: LucideIcon;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm font-medium">
      <span id={labelId} className={cn("flex items-center gap-3", !Icon && "pl-8")}>
        {Icon && <Icon className="size-5" aria-hidden="true" />}
        {label}
      </span>
      <Switch
        aria-labelledby={labelId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

/**
 * The menu sheets' pair: "Dark mode", and "Match my device" for the system setting. Dark mode is
 * locked while the device decides; turning matching off keeps the theme the page shows now.
 */
export function ThemeSwitchRows({ theme }: { theme: ShellTheme }) {
  const shown = useShownTheme(theme.value);
  const matchesDevice = theme.value === "system";
  return (
    <div>
      <SwitchRow
        label="Dark mode"
        icon={Moon}
        checked={shown === "dark"}
        disabled={matchesDevice}
        onCheckedChange={(checked) => theme.onChange(checked ? "dark" : "light")}
      />
      <SwitchRow
        label="Match my device"
        checked={matchesDevice}
        onCheckedChange={(checked) => theme.onChange(checked ? "system" : shown)}
      />
    </div>
  );
}
