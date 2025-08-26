import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  Check,
  X,
  Calendar,
  DollarSign,
  AlertTriangle,
  Info,
  Star,
  Clock,
  ChevronRight,
  Settings,
} from "lucide-react";

interface Notification {
  id: string;
  type: "booking" | "payment" | "alert" | "info" | "review";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: "low" | "medium" | "high";
  actionUrl?: string;
  actionLabel?: string;
}

interface NotificationBellProps {
  className?: string;
  variant?: "default" | "compact";
}

// Mock notification data - in a real app this would come from your state management
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "booking",
    title: "New Booking Confirmed",
    message: "Maria Santos just booked Ocean View Villa for Dec 25-30",
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    read: false,
    priority: "high",
    actionUrl: "/bookings/123",
    actionLabel: "View Booking",
  },
  {
    id: "2",
    type: "payment",
    title: "Payment Received",
    message: "₱15,000 payment received from GCash - Room #101",
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    read: false,
    priority: "medium",
    actionUrl: "/expenses/456",
    actionLabel: "View Transaction",
  },
  {
    id: "3",
    type: "alert",
    title: "Maintenance Required",
    message: "Air conditioning in Room #205 needs maintenance",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    read: false,
    priority: "high",
    actionUrl: "/properties/205",
    actionLabel: "Schedule Maintenance",
  },
  {
    id: "4",
    type: "review",
    title: "New Review Received",
    message: '⭐⭐⭐⭐⭐ "Amazing beachfront resort!" - John Doe',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    read: true,
    priority: "low",
    actionUrl: "/reviews/789",
    actionLabel: "View Review",
  },
];

export function NotificationBell({ className, variant = "default" }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasHighPriority = notifications.some((n) => !n.read && n.priority === "high");

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

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "booking":
        return Calendar;
      case "payment":
        return DollarSign;
      case "alert":
        return AlertTriangle;
      case "review":
        return Star;
      default:
        return Info;
    }
  };

  const getNotificationColor = (type: Notification["type"], priority: Notification["priority"]) => {
    if (priority === "high") {
      return "text-coral-600 bg-coral-100 dark:text-coral-400 dark:bg-coral-900/20";
    }

    switch (type) {
      case "booking":
        return "text-ocean-600 bg-ocean-100 dark:text-ocean-400 dark:bg-ocean-900/20";
      case "payment":
        return "text-palm-600 bg-palm-100 dark:text-palm-400 dark:bg-palm-900/20";
      case "alert":
        return "text-sunset-600 bg-sunset-100 dark:text-sunset-400 dark:bg-sunset-900/20";
      case "review":
        return "text-coral-600 bg-coral-100 dark:text-coral-400 dark:bg-coral-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return timestamp.toLocaleDateString("en-PH");
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="hover:bg-sand-100 group relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 transition-all duration-200 dark:hover:bg-gray-700"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${unreadCount} unread notifications`}
      >
        {hasHighPriority ? (
          <BellRing className="text-coral-600 group-hover:text-coral-700 h-5 w-5 animate-pulse" />
        ) : (
          <Bell className="group-hover:text-ocean-600 dark:group-hover:text-ocean-400 h-5 w-5 text-gray-600 dark:text-gray-400" />
        )}

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg ${
              hasHighPriority ? "bg-coral-500 animate-pulse" : "bg-ocean-500"
            } `}
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="border-sand-200 absolute top-full right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white/95 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="border-sand-200 from-sand-50/50 to-coral-50/50 flex items-center justify-between border-b bg-gradient-to-r px-4 py-3 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-700/50">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 text-xs font-medium transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12">
                <Bell className="mb-3 h-12 w-12 text-gray-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  No notifications
                </p>
                <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-500">
                  You're all caught up! New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className="py-2">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const colorClass = getNotificationColor(notification.type, notification.priority);

                  return (
                    <div
                      key={notification.id}
                      className={`group hover:bg-sand-50 relative mx-2 rounded-lg transition-colors dark:hover:bg-gray-700/50 ${!notification.read ? "bg-ocean-50/30 dark:bg-ocean-900/10" : ""} `}
                    >
                      <div className="flex gap-3 p-3">
                        {/* Icon */}
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-sm font-medium ${
                                  !notification.read
                                    ? "text-gray-900 dark:text-white"
                                    : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {notification.title}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                                {notification.message}
                              </p>
                            </div>

                            {/* Timestamp */}
                            <div className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimestamp(notification.timestamp)}</span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {notification.actionUrl && (
                                <Link
                                  to={notification.actionUrl}
                                  onClick={() => {
                                    markAsRead(notification.id);
                                    setIsOpen(false);
                                  }}
                                  className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 flex items-center gap-1 text-xs font-medium transition-colors"
                                >
                                  {notification.actionLabel}
                                  <ChevronRight className="h-3 w-3" />
                                </Link>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              {!notification.read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="hover:bg-ocean-100 dark:hover:bg-ocean-900/20 rounded p-1 transition-colors"
                                  title="Mark as read"
                                >
                                  <Check className="text-ocean-600 dark:text-ocean-400 h-3 w-3" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className="rounded p-1 transition-colors hover:bg-red-100 dark:hover:bg-red-900/20"
                                title="Delete notification"
                              >
                                <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Unread indicator */}
                      {!notification.read && (
                        <div className="bg-ocean-500 absolute top-1/2 left-1 h-2 w-2 -translate-y-1/2 transform rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-sand-200 border-t dark:border-gray-700">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-ocean-600 hover:text-ocean-700 dark:text-ocean-400 dark:hover:text-ocean-300 hover:bg-sand-50 flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors dark:hover:bg-gray-700/50"
            >
              <Settings className="h-4 w-4" />
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
