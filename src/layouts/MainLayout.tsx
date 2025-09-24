import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Building2,
  Calendar,
  ChevronRight,
  Home,
  Menu,
  Receipt,
  ReceiptText,
  Users,
  X,
  LogOut,
  Search,
  Bell,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/dashboard" },
  { label: "Bookings", icon: Calendar, href: "/bookings" },
  { label: "Units", icon: Building2, href: "/units" },
  { label: "Guests", icon: Users, href: "/guests" },
  { label: "Payments", icon: Receipt, href: "/payments" },
  { label: "Expenses", icon: ReceiptText, href: "/expenses" },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

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
      (item.href === "/dashboard" &&
        (location.pathname === "/dashboard" || location.pathname === "/"));
    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors touch-manipulation",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "min-h-[44px] text-base md:text-sm md:min-h-[36px] md:px-3 md:py-2",
          isActive && "bg-accent text-accent-foreground font-medium"
        )}
      >
        <Icon className="h-6 w-6 md:h-5 md:w-5 flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="bg-primary text-primary-foreground ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold md:h-5 md:min-w-5 md:text-[10px]">
            {item.badge}
          </span>
        )}
        {isActive && <ChevronRight className="ml-2 h-5 w-5 md:h-4 md:w-4 flex-shrink-0" />}
      </Link>
    );
  };

  return (
    <div className="bg-background min-h-screen flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="bg-card hidden w-64 border-r md:flex lg:w-72">
        <div className="flex w-full flex-col">
          {/* Logo */}
          <div className="border-b p-4 lg:p-6">
            <h1 className="text-xl lg:text-2xl font-bold">Okaeri Resort</h1>
            <p className="text-muted-foreground mt-1 text-xs lg:text-sm">Management System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3 lg:p-4">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t p-3 lg:p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-muted-foreground hover:text-foreground mb-2 h-9"
            >
              <LogOut className="h-4 w-4 mr-2" />
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
      <header className="bg-card border-b md:hidden sticky top-0 z-50">
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
              <SheetContent side="left" className="w-80 p-0 max-w-[85vw]">
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
                  </nav>

                  {/* Mobile Menu Footer */}
                  <div className="border-t p-4">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground hover:text-foreground h-11 touch-manipulation"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          // Navigate to settings if needed
                        }}
                      >
                        <Settings className="h-4 w-4 mr-3" />
                        Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                        className="w-full justify-start text-muted-foreground hover:text-foreground h-11 touch-manipulation"
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign Out
                      </Button>
                    </div>
                    <div className="text-muted-foreground text-xs mt-4 pt-4 border-t">
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
              className="h-11 w-11 touch-manipulation relative"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 touch-manipulation relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-xs text-white flex items-center justify-center">
                3
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden md:overflow-auto">
        <div className="h-full overflow-auto">
          <div className="container mx-auto p-4 pb-20 md:p-6 md:pb-6 max-w-none">{children}</div>
        </div>
      </main>
    </div>
  );
}
