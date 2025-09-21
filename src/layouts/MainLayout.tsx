import { useState } from "react";
import { Home, Calendar, Users, Building2, Receipt, Menu, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Home, href: "/" },
  { label: "Bookings", icon: Calendar, href: "/bookings" },
  { label: "Units", icon: Building2, href: "/units" },
  { label: "Guests", icon: Users, href: "/guests" },
  { label: "Payments", icon: Receipt, href: "/payments" },
];

interface MainLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export function MainLayout({ children, currentPath = "/" }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavLink = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const isActive = currentPath === item.href;
    const Icon = item.icon;

    return (
      <a
        href={item.href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-accent text-accent-foreground font-medium"
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{item.label}</span>
        {item.badge && (
          <span className="bg-primary text-primary-foreground ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {item.badge}
          </span>
        )}
        {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
      </a>
    );
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="bg-card hidden w-64 border-r md:flex">
        <div className="flex w-full flex-col">
          {/* Logo */}
          <div className="border-b p-6">
            <h1 className="text-2xl font-bold">Okaeri Resort</h1>
            <p className="text-muted-foreground mt-1 text-sm">Management System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="text-muted-foreground text-xs">
              <p>© 2024 Okaeri Resort</p>
              <p className="mt-1">Version 1.0.0</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="bg-card border-b md:hidden">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-xl font-bold">Okaeri Resort</h1>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-full flex-col">
                <div className="border-b p-6">
                  <h1 className="text-2xl font-bold">Okaeri Resort</h1>
                  <p className="text-muted-foreground mt-1 text-sm">Management System</p>
                </div>
                <nav className="flex-1 space-y-1 p-4">
                  {navItems.map((item) => (
                    <NavLink key={item.href} item={item} onClick={() => setMobileMenuOpen(false)} />
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="md:ml-64">
        <div className="container mx-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
