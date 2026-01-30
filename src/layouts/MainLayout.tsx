import { useEffect, useEffectEvent, useState } from "react";

import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Bell,
  Building2,
  Calendar,
  ChevronRight,
  CreditCard,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Receipt,
  ReceiptText,
  Search,
  Settings,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/admin/dashboard" },
  { label: "Bookings", icon: Calendar, href: "/admin/bookings" },
  { label: "Cabins", icon: Building2, href: "/admin/units" },
  { label: "Guests", icon: Users, href: "/admin/guests" },
  { label: "Payments", icon: Receipt, href: "/admin/payments" },
  { label: "Expenses", icon: ReceiptText, href: "/admin/expenses" },
  { label: "Accounts", icon: CreditCard, href: "/admin/accounts" },
  { label: "Transfers", icon: ArrowLeftRight, href: "/admin/transfers" },
  { label: "Booking Queue", icon: ListChecks, href: "/admin/bookings/queue" },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuditLink, setShowAuditLink] = useState(false);
  const [showRolesLink, setShowRolesLink] = useState(false);
  const location = useLocation();

  // Extract async permission checks into useEffectEvent to avoid recreation
  const checkAuditAccess = useEffectEvent(async () => {
    // Lazy load audit functions to reduce main bundle size
    const { isCurrentUserOwner } = await import("@/lib/audit-logger");
    const canAccess = await isCurrentUserOwner();
    setShowAuditLink(canAccess);
  });

  const checkRolesAccess = useEffectEvent(async () => {
    // Lazy load role functions to reduce main bundle size
    const { isAdmin } = await import("@/lib/audit-roles");
    const canAccess = await isAdmin();
    setShowRolesLink(canAccess);
  });

  // Check permissions on mount and auth state changes
  useEffect(() => {
    // Initial checks
    checkAuditAccess();
    checkRolesAccess();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuditAccess();
      checkRolesAccess();
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      // Refresh the page to trigger re-authentication check
      window.location.href = "/login";
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const NavLink = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const isActive =
      location.pathname === item.href ||
      (item.href === "/admin/dashboard" &&
        (location.pathname === "/admin/dashboard" || location.pathname === "/admin"));
    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn(
          "flex touch-manipulation items-center gap-3 rounded-lg px-4 py-3 transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:outline-none",
          "min-h-[44px] text-base md:min-h-[36px] md:px-3 md:py-2 md:text-sm",
          isActive && "bg-accent text-accent-foreground font-medium"
        )}
      >
        <Icon className="h-6 w-6 flex-shrink-0 md:h-5 md:w-5" />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="bg-primary text-primary-foreground ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold md:h-5 md:min-w-5 md:text-[10px]">
            {item.badge}
          </span>
        )}
        {isActive && <ChevronRight className="ml-2 h-5 w-5 flex-shrink-0 md:h-4 md:w-4" />}
      </Link>
    );
  };

  return (
    <div className="bg-background flex min-h-screen flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="bg-card hidden w-64 border-r md:flex lg:w-72">
        <div className="flex w-full flex-col">
          {/* Logo */}
          <div className="border-b p-4 lg:p-6">
            <h1 className="text-xl font-bold lg:text-2xl">Okaeri Resort</h1>
            <p className="text-muted-foreground mt-1 text-xs lg:text-sm">Management System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3 lg:p-4">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}

            {/* Audit Trail Link - Owner/Manager Only */}
            {showAuditLink && (
              <>
                <div className="my-2 border-t pt-2" />
                <NavLink
                  item={{
                    label: "Audit Trail",
                    icon: Shield,
                    href: "/admin/audit-logs",
                  }}
                />
              </>
            )}

            {/* User Roles Link - Admin Only */}
            {showRolesLink && (
              <NavLink
                item={{
                  label: "User Roles",
                  icon: UserCog,
                  href: "/admin/roles",
                }}
              />
            )}
          </nav>

          {/* Footer */}
          <div className="border-t p-3 lg:p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground mb-2 h-9 w-full justify-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
            <div className="text-muted-foreground text-xs">
              <p>© 2024 Okaeri Resort</p>
              <p className="mt-1">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="bg-card sticky top-0 z-50 border-b md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 touch-manipulation"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 max-w-[85vw] p-0">
                <div className="flex h-full flex-col">
                  {/* Mobile Menu Header */}
                  <div className="border-b p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-xl font-bold">Okaeri Resort</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Management System</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileMenuOpen(false)}
                        className="h-9 w-9 touch-manipulation"
                        aria-label="Close navigation menu"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Navigation */}
                  <nav className="flex-1 space-y-2 p-4">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    ))}

                    {/* Audit Trail Link - Owner/Manager Only */}
                    {showAuditLink && (
                      <>
                        <div className="my-2 border-t pt-2" />
                        <NavLink
                          item={{
                            label: "Audit Trail",
                            icon: Shield,
                            href: "/admin/audit-logs",
                          }}
                          onClick={() => setMobileMenuOpen(false)}
                        />
                      </>
                    )}

                    {/* User Roles Link - Admin Only */}
                    {showRolesLink && (
                      <NavLink
                        item={{
                          label: "User Roles",
                          icon: UserCog,
                          href: "/admin/roles",
                        }}
                        onClick={() => setMobileMenuOpen(false)}
                      />
                    )}
                  </nav>

                  {/* Mobile Menu Footer */}
                  <div className="border-t p-4">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground h-11 w-full touch-manipulation justify-start"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          // Navigate to settings if needed
                        }}
                      >
                        <Settings className="mr-3 h-4 w-4" />
                        Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                        className="text-muted-foreground hover:text-foreground h-11 w-full touch-manipulation justify-start"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                    <div className="text-muted-foreground mt-4 border-t pt-4 text-xs">
                      <p>© 2024 Okaeri Resort</p>
                      <p className="mt-1">Version 1.0.0</p>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <h1 className="text-lg font-bold">Okaeri</h1>
            </div>
          </div>

          {/* Mobile Header Actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-11 w-11 touch-manipulation"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-11 w-11 touch-manipulation"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden md:overflow-auto">
        <div className="h-full overflow-auto">
          <div className="container mx-auto max-w-none p-4 pb-20 md:p-6 md:pb-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
