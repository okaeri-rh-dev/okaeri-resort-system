import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore, useUser } from "@/stores/authStore";
import {
  Settings,
  LogOut,
  User,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Bell,
  HelpCircle,
  Shield,
} from "lucide-react";

interface UserProfileDropdownProps {
  className?: string;
}

export function UserProfileDropdown({ className }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const user = useUser();
  const logout = useAuthStore((state) => state.logout);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate({ to: "/login" });
  };

  const menuItems = [
    {
      type: "link" as const,
      icon: User,
      label: "My Profile",
      href: "/settings/profile",
      description: "Manage your account settings",
    },
    {
      type: "link" as const,
      icon: Settings,
      label: "Account Settings",
      href: "/settings",
      description: "Preferences and configuration",
    },
    {
      type: "link" as const,
      icon: Bell,
      label: "Notifications",
      href: "/settings/notifications",
      description: "Manage your notification preferences",
    },
    {
      type: "divider" as const,
    },
    {
      type: "link" as const,
      icon: HelpCircle,
      label: "Help & Support",
      href: "/help",
      description: "Get help with resort management",
    },
    {
      type: "link" as const,
      icon: Shield,
      label: "Privacy & Security",
      href: "/settings/privacy",
      description: "Manage your privacy settings",
    },
    {
      type: "divider" as const,
    },
    {
      type: "button" as const,
      icon: LogOut,
      label: "Sign Out",
      onClick: handleLogout,
      description: "Sign out of your account",
      variant: "destructive" as const,
    },
  ];

  if (!user) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Profile Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-sand-100/70 group flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 dark:hover:bg-gray-700/70"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`User menu for ${user.name}`}
        data-testid="user-menu"
      >
        {/* Avatar */}
        <div className="relative">
          <div className="from-ocean-500 to-coral-500 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-lg transition-transform group-hover:scale-105">
            {user.name.charAt(0).toUpperCase()}
          </div>
          {/* Online status indicator */}
          <div
            className="bg-palm-400 absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white shadow-sm dark:border-gray-800"
            title="Online"
          />
        </div>

        {/* User Info */}
        <div className="min-w-0 flex-1 text-left">
          <p className="group-hover:text-ocean-700 dark:group-hover:text-ocean-300 truncate text-sm font-semibold text-gray-900 transition-colors dark:text-white">
            {user.name}
          </p>
          <p className="truncate text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
        </div>

        {/* Dropdown chevron */}
        <ChevronDown
          className={`group-hover:text-ocean-600 h-4 w-4 text-gray-400 transition-all duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="border-sand-200 absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
          role="menu"
          aria-orientation="vertical"
        >
          {/* User Header */}
          <div className="border-sand-200 from-sand-50/50 to-coral-50/50 border-b bg-gradient-to-r px-4 py-3 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="from-ocean-500 to-coral-500 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white shadow-lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-gray-900 dark:text-white">
                  {user.name}
                </p>
                <p className="truncate text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                  <span className="bg-palm-400 inline-block h-2 w-2 rounded-full"></span>
                  Online • Philippines
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item, index) => {
              if (item.type === "divider") {
                return (
                  <div
                    key={index}
                    className="border-sand-200 my-2 border-t dark:border-gray-700"
                    role="separator"
                  />
                );
              }

              const Icon = item.icon;
              const isDestructive = item.variant === "destructive";

              if (item.type === "link") {
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`hover:bg-sand-50 mx-2 flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors dark:hover:bg-gray-700 ${
                      isDestructive
                        ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        : "text-gray-700 dark:text-gray-300"
                    } `}
                    role="menuitem"
                    title={item.description}
                  >
                    <Icon
                      className={`h-5 w-5 ${isDestructive ? "text-red-500" : "text-gray-500"}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{item.label}</div>
                      <div className="mt-0.5 text-xs opacity-75">{item.description}</div>
                    </div>
                  </Link>
                );
              }

              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className={`hover:bg-sand-50 mx-2 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors dark:hover:bg-gray-700 ${
                    isDestructive
                      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      : "text-gray-700 dark:text-gray-300"
                  } `}
                  role="menuitem"
                  title={item.description}
                >
                  <Icon className={`h-5 w-5 ${isDestructive ? "text-red-500" : "text-gray-500"}`} />
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="mt-0.5 text-xs opacity-75">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for header use
export function UserProfileButton({ className }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const user = useUser();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    navigate({ to: "/login" });
  };

  if (!user) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-sand-100 group flex min-h-[44px] items-center gap-2 rounded-xl p-2 transition-colors dark:hover:bg-gray-700"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`User menu for ${user.name}`}
      >
        <div className="from-ocean-500 to-coral-500 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-sm transition-transform group-hover:scale-105">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-all duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Compact Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="border-sand-200 absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border bg-white/95 shadow-xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
          role="menu"
        >
          {/* Quick user info */}
          <div className="border-sand-200 border-b px-4 py-3 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
          </div>

          {/* Quick actions */}
          <div className="py-2">
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="hover:bg-sand-50 flex min-h-[44px] items-center gap-3 px-4 py-2 text-sm text-gray-700 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
              role="menuitem"
            >
              <Settings className="h-4 w-4 text-gray-500" />
              Account Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              role="menuitem"
            >
              <LogOut className="h-4 w-4 text-red-500" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
