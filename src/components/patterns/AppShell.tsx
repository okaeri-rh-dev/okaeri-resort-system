import { useState, type ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { CircleUser, Menu, MoreHorizontal, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { RoutePath } from "./DetailPageLayout";
import { PageHeader, type PageHeaderProps } from "./PageHeader";
import { CompactWindowContext, useCompactWindowQuery } from "./window-size";

/** The compact bottom bar holds at most this many slots, More included. */
const BAR_SLOTS = 5;

export interface ShellDestination {
  label: string;
  to: RoutePath;
  icon: LucideIcon;
  /** Keeps the destination in the compact bottom bar when the list needs a More slot. */
  pinned?: boolean;
  /** Active on this path only, not on its child routes. */
  exact?: boolean;
}

export interface ShellAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

export interface ShellBrand {
  name: string;
  tagline?: string;
  to: RoutePath;
}

export interface AppShellProps {
  /** `admin`: bottom bar, collapsed rail from medium, expanded rail from large. `guest`: top bar. */
  surface: "admin" | "guest";
  brand: ShellBrand;
  /** The nav contents, already filtered to what the viewer may reach. */
  destinations: ShellDestination[];
  /** Account-level commands such as Sign Out (admin only). */
  actions?: ShellAction[];
  /** Shows a placeholder nav while the destinations are still unknown. */
  navLoading?: boolean;
  /** Rendered above the content as the page's `h1`. */
  pageHeader?: Omit<PageHeaderProps, "surface">;
  /** Sits at the top of the content region, full width, such as an install prompt. */
  banner?: ReactNode;
  /** `form` caps the content at ~40rem, for form and reading columns. */
  width?: "page" | "form";
  children: ReactNode;
}

/**
 * The page frame: navigation, the content region and its margins, and the page header. It owns
 * every window query (DESIGN.md, Layout); panes inside it adapt to their own width.
 *
 * Admin: a bottom bar on compact windows (pinned destinations plus More, or every destination
 * when there are five or fewer), a collapsed rail from `medium` and an expanded rail with labels
 * from `large`. Guest: a top bar with inline links from `medium` and a menu sheet on compact.
 * Margins are 16px, 24px from `medium`; content caps at 1600px (admin), 1200px (guest) or ~40rem
 * (`width="form"`).
 *
 * @example
 * ```tsx
 * <AppShell
 *   surface="admin"
 *   brand={{ name: "Okaeri Resort", to: "/admin/dashboard" }}
 *   destinations={destinations}
 *   actions={[{ label: "Sign Out", icon: LogOut, onSelect: signOut }]}
 * >
 *   <Outlet />
 * </AppShell>
 * ```
 */
export function AppShell(props: AppShellProps) {
  const isCompact = useCompactWindowQuery();

  return (
    <CompactWindowContext.Provider value={isCompact}>
      {props.surface === "admin" ? <AdminShell {...props} /> : <GuestShell {...props} />}
    </CompactWindowContext.Provider>
  );
}

const pageWidth = {
  admin: "max-w-400",
  guest: "max-w-300",
} as const;

function Content({
  surface,
  width = "page",
  pageHeader,
  children,
  className,
}: Pick<AppShellProps, "surface" | "width" | "pageHeader" | "children"> & { className?: string }) {
  return (
    <div
      className={cn(
        "medium:px-6 medium:py-6 mx-auto w-full px-4 py-4",
        width === "form" ? "max-w-160" : pageWidth[surface],
        className
      )}
    >
      {pageHeader && <PageHeader {...pageHeader} surface={surface} className="mb-6" />}
      {children}
    </div>
  );
}

const railItem = cn(
  "group flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5",
  "text-sidebar-foreground text-xs font-medium transition-colors duration-150",
  "focus-visible:ring-sidebar-ring focus-visible:ring-2 focus-visible:outline-hidden",
  "large:min-h-10 large:flex-row large:justify-start large:gap-3 large:px-3 large:text-sm",
  "large:hover:bg-sidebar-accent large:data-[status=active]:bg-sidebar-primary large:data-[status=active]:text-sidebar-primary-foreground"
);

const railIndicator = cn(
  "flex h-8 w-14 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
  "group-hover:bg-sidebar-accent group-data-[status=active]:bg-sidebar-primary group-data-[status=active]:text-sidebar-primary-foreground",
  "large:h-auto large:w-auto large:bg-transparent large:group-hover:bg-transparent large:group-data-[status=active]:bg-transparent"
);

function RailIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className={railIndicator}>
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

const sheetItem = cn(
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
  "focus-visible:ring-2 focus-visible:outline-hidden"
);

function AdminShell({
  brand,
  destinations,
  actions = [],
  navLoading,
  banner,
  ...content
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const needsMore = destinations.length > BAR_SLOTS;
  const inBar = (destination: ShellDestination) => !needsMore || destination.pinned;

  return (
    <div className="bg-background medium:flex-row flex h-dvh flex-col">
      <header className="bg-card border-border medium:hidden flex h-14 shrink-0 items-center justify-between border-b px-4">
        <Link to={brand.to} className="font-display text-foreground text-lg font-bold">
          {brand.name}
        </Link>
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account menu">
                <CircleUser className="size-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map(({ label, icon: Icon, onSelect }) => (
                <DropdownMenuItem key={label} onSelect={onSelect}>
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t",
          "medium:static medium:flex medium:h-full medium:w-20 medium:shrink-0 medium:flex-col medium:border-t-0 medium:border-r",
          "large:w-72"
        )}
      >
        <div className="medium:block large:px-6 large:pt-6 large:pb-2 hidden px-2 pt-3">
          <Button
            variant="ghost"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground large:hidden mx-auto flex size-12"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <div className="large:block hidden">
            <Link to={brand.to} className="font-display text-2xl font-bold">
              {brand.name}
            </Link>
            {brand.tagline && <p className="mt-1 text-sm opacity-80">{brand.tagline}</p>}
          </div>
        </div>

        <nav aria-label="Main" className="medium:flex medium:min-h-0 medium:flex-1 medium:flex-col">
          {navLoading ? (
            <div
              role="status"
              aria-label="Loading navigation"
              className="medium:flex-1 medium:flex-col large:px-4 flex gap-2 p-2"
            >
              {Array.from({ length: BAR_SLOTS }, (_, index) => (
                <Skeleton key={index} className="bg-sidebar-accent medium:flex-none h-12 flex-1" />
              ))}
            </div>
          ) : (
            <ul className="medium:flex-1 medium:flex-col medium:overflow-y-auto medium:py-3 large:px-4 flex gap-1 px-2 py-1">
              {destinations.map((destination) => (
                <li
                  key={destination.to}
                  className={cn(
                    "medium:flex-none min-w-0 flex-1",
                    !inBar(destination) && "max-medium:hidden"
                  )}
                >
                  <Link
                    to={destination.to}
                    activeOptions={{ exact: destination.exact ?? false }}
                    className={railItem}
                  >
                    <RailIcon icon={destination.icon} />
                    <span className="large:text-left line-clamp-2 text-center">
                      {destination.label}
                    </span>
                  </Link>
                </li>
              ))}
              {needsMore && (
                <li className="medium:hidden min-w-0 flex-1">
                  <button type="button" onClick={() => setMenuOpen(true)} className={railItem}>
                    <RailIcon icon={MoreHorizontal} />
                    <span>More</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </nav>

        {actions.length > 0 && (
          <div className="border-sidebar-border medium:flex large:px-4 hidden flex-col gap-1 border-t p-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onSelect}
                className={railItem}
              >
                <RailIcon icon={action.icon} />
                <span className="large:text-left line-clamp-2 text-center">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {banner}
        <Content {...content} surface="admin" className="medium:pb-6 pb-24" />
      </main>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground border-sidebar-border w-72 gap-0 p-0"
        >
          <div className="border-sidebar-border border-b p-6">
            <SheetTitle className="font-display text-sidebar-foreground text-xl font-bold">
              {brand.name}
            </SheetTitle>
            <SheetDescription
              className={cn("text-sidebar-foreground mt-1 opacity-80", !brand.tagline && "sr-only")}
            >
              {brand.tagline ?? "Every destination"}
            </SheetDescription>
          </div>
          <nav aria-label="Menu" className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {destinations.map(({ label, to, icon: Icon, exact }) => (
                <li key={to}>
                  <SheetClose asChild>
                    <Link
                      to={to}
                      activeOptions={{ exact: exact ?? false }}
                      className={cn(
                        sheetItem,
                        "hover:bg-sidebar-accent focus-visible:ring-sidebar-ring",
                        "data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground"
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      {label}
                    </Link>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </nav>
          {actions.length > 0 && (
            <div className="border-sidebar-border space-y-1 border-t p-4">
              {actions.map(({ label, icon: Icon, onSelect }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelect();
                  }}
                  className={cn(
                    sheetItem,
                    "hover:bg-sidebar-accent focus-visible:ring-sidebar-ring"
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const topBarLink = cn(
  "text-foreground flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150",
  "hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-hidden",
  "data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
);

function GuestShell({ brand, destinations, banner, ...content }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-card border-border sticky top-0 z-40 border-b">
        <div className="medium:px-6 mx-auto flex h-14 w-full max-w-300 items-center justify-between gap-4 px-4">
          <Link to={brand.to} className="font-display text-foreground text-lg font-bold">
            {brand.name}
          </Link>
          <nav aria-label="Main" className="medium:block hidden">
            <ul className="flex items-center gap-1">
              {destinations.map(({ label, to, exact }) => (
                <li key={to}>
                  <Link to={to} activeOptions={{ exact: exact ?? false }} className={topBarLink}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="medium:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {banner}
        <Content {...content} surface="guest" />
      </main>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-72 gap-0 p-0">
          <div className="border-border border-b p-6">
            <SheetTitle className="font-display text-xl font-bold">{brand.name}</SheetTitle>
            <SheetDescription className={cn("mt-1", !brand.tagline && "sr-only")}>
              {brand.tagline ?? "Pages"}
            </SheetDescription>
          </div>
          <nav aria-label="Menu" className="p-4">
            <ul className="space-y-1">
              {destinations.map(({ label, to, icon: Icon, exact }) => (
                <li key={to}>
                  <SheetClose asChild>
                    <Link
                      to={to}
                      activeOptions={{ exact: exact ?? false }}
                      className={cn(sheetItem, topBarLink)}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      {label}
                    </Link>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
