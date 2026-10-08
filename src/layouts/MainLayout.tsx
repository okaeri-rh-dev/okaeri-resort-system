import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Bell,
  Building2,
  Calendar,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Receipt,
  ReceiptText,
  Settings,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { InstallBanner } from "@/components/pwa/InstallBanner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditRole, clearRoleCache } from "@/lib/audit-roles";
import { auth } from "@/lib/auth";
import { hasRoleLevel } from "@/lib/route-guards";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  /** Minimum role required to see this nav item (undefined = all authenticated users) */
  requiredRole?: AuditRole;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/admin/dashboard" },
  { label: "Bookings", icon: Calendar, href: "/admin/bookings" },
  { label: "Booking Queue", icon: ListChecks, href: "/admin/bookings/queue" },
  { label: "Guests", icon: Users, href: "/admin/guests", requiredRole: AuditRole.MANAGER },
  { label: "Payments", icon: Receipt, href: "/admin/payments", requiredRole: AuditRole.MANAGER },
  { label: "Cabins", icon: Building2, href: "/admin/units", requiredRole: AuditRole.MANAGER },
  {
    label: "Expenses",
    icon: ReceiptText,
    href: "/admin/expenses",
    requiredRole: AuditRole.MANAGER,
  },
  { label: "Accounts", icon: CreditCard, href: "/admin/accounts", requiredRole: AuditRole.MANAGER },
  {
    label: "Transfers",
    icon: ArrowLeftRight,
    href: "/admin/transfers",
    requiredRole: AuditRole.MANAGER,
  },
  {
    label: "Documents",
    icon: FileText,
    href: "/admin/documents",
    requiredRole: AuditRole.MANAGER,
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/admin/settings",
    requiredRole: AuditRole.MANAGER,
  },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<AuditRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [showAuditLink, setShowAuditLink] = useState(false);
  const [showRolesLink, setShowRolesLink] = useState(false);
  const location = useLocation();

  const installDismissalState = useInstallPromptStore((s) => s.dismissalState);
  const resetInstallPrompt = useInstallPromptStore((s) => s.reset);
  const showInstallEscape =
    installDismissalState === "permanent" || installDismissalState === "snoozed";

  // Single permission check — calls getUserAuditRole() once and derives all booleans
  const checkPermissions = useEffectEvent(async () => {
    try {
      const { getUserAuditRole } = await import("@/lib/audit-roles");
      const role = await getUserAuditRole();
      setUserRole(role);
      // Owner or Admin can see audit trail
      setShowAuditLink(role === AuditRole.OWNER || role === AuditRole.ADMIN);
      // Only Admin can see user roles management
      setShowRolesLink(role === AuditRole.ADMIN);
    } finally {
      setRoleLoading(false);
    }
  });

  // Check permissions on mount and auth state changes
  useEffect(() => {
    void checkPermissions();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      clearRoleCache();
      void checkPermissions();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Filter nav items based on user's role
  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      // No role requirement = accessible to all authenticated users
      if (!item.requiredRole) return true;
      // Check if user's role meets the required level
      return hasRoleLevel(userRole, item.requiredRole);
    });
  }, [userRole]);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      // Refresh the page to trigger re-authentication check
      window.location.href = "/admin/login";
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const NavSkeletonItems = () => (
    <div className="space-y-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-3 lg:px-3 lg:py-2">
          <Skeleton className="h-5 w-5 flex-shrink-0" />
          <Skeleton className="h-4 flex-1" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </div>
      ))}
    </div>
  );

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
          "min-h-[44px] text-base lg:min-h-[36px] lg:px-3 lg:py-2 lg:text-sm",
          isActive && "bg-accent text-accent-foreground font-medium"
        )}
      >
        <Icon className="h-6 w-6 flex-shrink-0 lg:h-5 lg:w-5" />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="bg-primary text-primary-foreground ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold lg:h-5 lg:min-w-5 lg:text-[10px]">
            {item.badge}
          </span>
        )}
        {isActive && <ChevronRight className="ml-2 h-5 w-5 flex-shrink-0 lg:h-4 lg:w-4" />}
      </Link>
    );
  };

  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="bg-card hidden h-full w-64 flex-shrink-0 border-r lg:flex lg:w-72">
        <div className="flex h-full w-full flex-col overflow-hidden">
          {/* Logo */}
          <div className="border-b p-4 lg:p-6">
            <h1 className="text-xl font-bold lg:text-2xl">Okaeri Resort</h1>
            <p className="text-muted-foreground mt-1 text-xs lg:text-sm">Management System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-3 lg:p-4">
            {roleLoading ? (
              <NavSkeletonItems />
            ) : (
              <>
                {filteredNavItems.map((item) => (
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
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t p-3 lg:p-4">
            {showInstallEscape && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => resetInstallPrompt()}
                className="text-muted-foreground hover:text-foreground mb-2 h-9 w-full justify-start"
              >
                <Download className="mr-2 h-4 w-4" />
                Install app
              </Button>
            )}
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
      <header className="bg-card sticky top-0 z-50 border-b lg:hidden">
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
              <SheetContent side="left" hideClose className="w-80 max-w-[85vw] p-0">
                <div className="flex h-full flex-col">
                  {/* Mobile Menu Header */}
                  <div className="border-b p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <SheetTitle className="text-xl font-bold">Okaeri Resort</SheetTitle>
                        <SheetDescription className="mt-1">Management System</SheetDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileMenuOpen(false)}
                        className="h-11 w-11 touch-manipulation"
                        aria-label="Close navigation menu"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Navigation */}
                  <nav className="flex-1 space-y-2 overflow-y-auto p-4">
                    {roleLoading ? (
                      <NavSkeletonItems />
                    ) : (
                      <>
                        {filteredNavItems.map((item) => (
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
                      </>
                    )}
                  </nav>

                  {/* Mobile Menu Footer */}
                  <div className="border-t p-4">
                    <div className="space-y-2">
                      <Link
                        to="/admin/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-11 w-full touch-manipulation items-center justify-start rounded-md px-3 text-sm"
                      >
                        <Settings className="mr-3 h-4 w-4" />
                        Settings
                      </Link>
                      {showInstallEscape && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMobileMenuOpen(false);
                            resetInstallPrompt();
                          }}
                          className="text-muted-foreground hover:text-foreground h-11 w-full touch-manipulation justify-start"
                        >
                          <Download className="mr-3 h-4 w-4" />
                          Install app
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          void handleSignOut();
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
              asChild
              className="relative h-11 w-11 touch-manipulation"
            >
              <Link to="/admin/bookings/queue" aria-label="Booking queue">
                <Bell className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <InstallBanner />
          <div className="container mx-auto max-w-none px-2 pt-2 pb-20 md:p-4 md:pb-6 lg:p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
