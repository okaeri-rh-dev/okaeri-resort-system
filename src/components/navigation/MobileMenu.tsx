import { Fragment, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Calendar,
  DollarSign,
  Building,
  FileText,
  Settings,
  Users,
  X,
  Waves,
  MapPin,
} from "lucide-react";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home, description: "Overview & Analytics" },
  { name: "Bookings", href: "/bookings", icon: Calendar, description: "Reservations & Check-ins" },
  { name: "Expenses", href: "/expenses", icon: DollarSign, description: "Financial Tracking" },
  { name: "Properties", href: "/properties", icon: Building, description: "Rooms & Amenities" },
  { name: "Reports", href: "/reports", icon: FileText, description: "Business Intelligence" },
  { name: "Team", href: "/team", icon: Users, description: "Staff Management" },
  { name: "Settings", href: "/settings", icon: Settings, description: "Resort Configuration" },
];

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <Fragment>
      {/* Backdrop with touch support */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        onTouchStart={onClose}
        role="presentation"
        aria-label="Close mobile menu"
      />

      {/* Mobile sidebar */}
      <aside
        className={`border-sand-200 fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] transform border-r bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out dark:border-gray-800 dark:bg-gray-900/95 ${isOpen ? "translate-x-0" : "-translate-x-full"} `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-sand-200 from-ocean-500 to-ocean-600 flex items-center justify-between border-b bg-gradient-to-r p-4 text-white dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Waves className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 id="mobile-menu-title" className="text-lg font-bold tracking-tight">
                  Okaeri Resort
                </h1>
                <p className="text-ocean-100 flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3" />
                  Philippines
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 transition-colors duration-200 hover:bg-white/20"
              aria-label="Close mobile menu"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>

          {/* Navigation */}
          <nav
            className="to-sand-50/50 flex-1 space-y-1 overflow-y-auto bg-gradient-to-b from-transparent p-4 dark:to-gray-900/50"
            role="navigation"
            aria-label="Main navigation"
          >
            {navigation.map((item) => {
              const isActive =
                location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onClose} // Close menu when navigation item is selected
                  className={`group flex min-h-[56px] touch-manipulation items-center gap-4 rounded-xl px-4 py-4 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "from-ocean-100 to-coral-100 text-ocean-800 border-ocean-200 dark:from-ocean-900/30 dark:to-coral-900/30 dark:text-ocean-200 dark:border-ocean-700 border bg-gradient-to-r shadow-md"
                      : "hover:from-sand-100 hover:to-coral-50 text-gray-700 hover:bg-gradient-to-r hover:shadow-sm active:scale-95 dark:text-gray-300 dark:hover:from-gray-800 dark:hover:to-gray-700"
                  } `}
                  aria-current={isActive ? "page" : undefined}
                  title={item.description}
                >
                  <Icon
                    className={`h-6 w-6 transition-transform group-hover:scale-110 group-active:scale-95 ${
                      isActive
                        ? "text-ocean-600 dark:text-ocean-300"
                        : "group-hover:text-ocean-600 dark:group-hover:text-ocean-400 text-gray-500"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-base font-semibold">{item.name}</div>
                    <div className="mt-1 text-xs opacity-75">{item.description}</div>
                  </div>
                  {isActive && (
                    <div className="from-ocean-500 to-coral-500 h-8 w-1 rounded-full bg-gradient-to-b shadow-sm" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer info */}
          <div className="border-sand-200 from-sand-50 to-coral-50 border-t bg-gradient-to-r p-4 dark:border-gray-700 dark:from-gray-800 dark:to-gray-700">
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">Resort Management System</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                Made with ❤️ in the Philippines
              </p>
            </div>
          </div>
        </div>
      </aside>
    </Fragment>
  );
}

// Hook for managing mobile menu state with gesture support
export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(!isOpen);

  // Handle swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX || !isOpen) return;

    const touchCurrentX = e.touches[0].clientX;
    const diff = touchStartX - touchCurrentX;

    // Close menu if swiped left more than 100px
    if (diff > 100) {
      close();
      setTouchStartX(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartX(null);
  };

  return {
    isOpen,
    open,
    close,
    toggle,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
