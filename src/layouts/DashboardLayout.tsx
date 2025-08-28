import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUser } from "@/stores/authStore";
import { useUIStore, useSidebar } from "@/stores/uiStore";
import { ResortBreadcrumb } from "@/components/ui/breadcrumb";
import {
  MobileMenu,
  UserProfileDropdown,
  UserProfileButton,
  ProjectSwitcher,
  NotificationBell,
  SearchBar,
} from "@/components/navigation";
import {
  Home,
  Calendar,
  DollarSign,
  Building,
  FileText,
  Settings,
  Users,
  Menu,
  X,
  Plus,
  Waves,
  MapPin,
  Wifi,
} from "lucide-react";

export function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUser();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const isMobile = useUIStore((state) => state.isMobile);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home, description: "Overview & Analytics" },
    {
      name: "Bookings",
      href: "/bookings",
      icon: Calendar,
      description: "Reservations & Check-ins",
    },
    { name: "Expenses", href: "/expenses", icon: DollarSign, description: "Financial Tracking" },
    { name: "Properties", href: "/properties", icon: Building, description: "Rooms & Amenities" },
    { name: "Reports", href: "/reports", icon: FileText, description: "Business Intelligence" },
    { name: "Team", href: "/team", icon: Users, description: "Staff Management" },
    { name: "Settings", href: "/settings", icon: Settings, description: "Resort Configuration" },
  ];

  useEffect(() => {
    // Close sidebar on mobile when route changes
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile, setSidebarOpen]);

  return (
    <div className="from-sand-50 to-ocean-50 dark:to-ocean-950 flex h-screen overflow-hidden bg-gradient-to-br via-white dark:from-gray-950 dark:via-gray-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="border-sand-200 flex w-64 flex-col border-r bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/95">
          {/* Resort Header */}
          <div className="border-sand-200 from-ocean-500 to-ocean-600 border-b bg-gradient-to-r p-4 text-white dark:border-gray-700">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Waves className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Okaeri Resort</h1>
                <p className="text-ocean-100 flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3" />
                  Philippines
                </p>
              </div>
            </div>

            {/* Project selector */}
            <ProjectSwitcher variant="full" />
          </div>

          {/* Navigation */}
          <nav className="to-sand-50/50 flex-1 space-y-1 overflow-y-auto bg-gradient-to-b from-transparent p-4 dark:to-gray-900/50">
            {navigation.map((item) => {
              const isActive =
                location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "from-ocean-100 to-coral-100 text-ocean-800 border-ocean-200 dark:from-ocean-900/30 dark:to-coral-900/30 dark:text-ocean-200 dark:border-ocean-700 border bg-gradient-to-r shadow-md"
                      : "hover:from-sand-100 hover:to-coral-50 text-gray-700 hover:bg-gradient-to-r hover:shadow-sm dark:text-gray-300 dark:hover:from-gray-800 dark:hover:to-gray-700"
                  } `}
                  title={item.description}
                >
                  <Icon
                    className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                      isActive
                        ? "text-ocean-600 dark:text-ocean-300"
                        : "group-hover:text-ocean-600 dark:group-hover:text-ocean-400 text-gray-500"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    {isActive && (
                      <div className="mt-0.5 text-xs opacity-75">{item.description}</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-sand-200 from-sand-50 to-coral-50 border-t bg-gradient-to-r p-4 dark:border-gray-700 dark:from-gray-800 dark:to-gray-700">
            <UserProfileDropdown />
          </div>
        </div>
      </aside>

      {/* Mobile Menu */}
      <MobileMenu isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-sand-200 flex h-16 items-center justify-between border-b bg-white/80 px-4 shadow-sm backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/80">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-sand-100 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 transition-all duration-200 lg:hidden dark:hover:bg-gray-700"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {/* Project switcher for mobile */}
            <div className="lg:hidden">
              <ProjectSwitcher variant="compact" />
            </div>

            {/* Search */}
            <div className="hidden max-w-md flex-1 sm:block">
              <SearchBar variant="button" placeholder="Search resorts, bookings..." />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className="hidden items-center gap-2 text-xs md:flex">
              <div className="text-palm-600 dark:text-palm-400 flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                <span>Online</span>
              </div>
            </div>

            {/* Notifications */}
            <NotificationBell />

            {/* User profile - mobile */}
            <div className="lg:hidden">
              <UserProfileButton />
            </div>

            {/* Quick add */}
            <button
              onClick={() => {
                navigate({ to: "/bookings" });
              }}
              className="from-ocean-500 to-coral-500 hover:from-ocean-600 hover:to-coral-600 flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
              aria-label="Create new booking"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Booking</span>
              <span className="sm:hidden">Book</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="from-sand-25 to-ocean-25 dark:to-ocean-950 flex-1 overflow-y-auto bg-gradient-to-br via-white dark:from-gray-950 dark:via-gray-900">
          <div className="container mx-auto max-w-7xl px-4 py-6">
            <ResortBreadcrumb />
            {children}
          </div>
        </main>
      </div>

      {/* Global Search Modal - handled by SearchBar component */}
      {/* The SearchBar component includes modal functionality when variant="button" */}
    </div>
  );
}
