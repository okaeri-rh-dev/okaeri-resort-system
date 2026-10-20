import type { ReactNode } from "react";

import { CalendarDays, Search } from "lucide-react";

import { AppShell, type AppShellProps, type ShellDestination } from "@/components/patterns";
import { useUIStore } from "@/stores/useUIStore";

const destinations: ShellDestination[] = [
  { label: "Availability", icon: CalendarDays, to: "/", exact: true },
  { label: "Check a booking", icon: Search, to: "/booking/check-status" },
];

interface GuestLayoutProps {
  pageHeader?: AppShellProps["pageHeader"];
  width?: AppShellProps["width"];
  children: ReactNode;
}

/**
 * The public and guest pages' shell config. The booking form isn't linked: guests reach it from
 * the link the family sends after a chat (see routes/index.tsx).
 */
export function GuestLayout({ pageHeader, width, children }: GuestLayoutProps) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <AppShell
      surface="guest"
      brand={{ name: "Okaeri Resort", to: "/" }}
      destinations={destinations}
      theme={{ value: theme, onChange: setTheme }}
      pageHeader={pageHeader}
      width={width}
    >
      {children}
    </AppShell>
  );
}
