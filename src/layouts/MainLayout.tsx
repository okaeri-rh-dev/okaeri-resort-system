import { useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  ArrowLeftRight,
  Building2,
  Calendar,
  CreditCard,
  Download,
  FileText,
  Home,
  ListChecks,
  LogOut,
  Receipt,
  ReceiptText,
  Settings,
  Shield,
  UserCog,
  Users,
} from "lucide-react";

import { AppShell, type ShellAction, type ShellDestination } from "@/components/patterns";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { AuditRole, clearRoleCache } from "@/lib/audit-roles";
import { auth } from "@/lib/auth";
import { hasRoleLevel } from "@/lib/route-guards";
import { supabase } from "@/lib/supabase";
import { useInstallPromptStore } from "@/stores/useInstallPromptStore";
import { useUIStore } from "@/stores/useUIStore";

interface AdminDestination extends ShellDestination {
  /** Lowest role that sees it (hierarchical); undefined = every family member */
  requiredRole?: AuditRole;
  /** Exactly these roles see it, matching their route guards */
  onlyRoles?: AuditRole[];
}

// Pinned destinations fill the compact bottom bar when a role has more than five
const destinations: AdminDestination[] = [
  { label: "Dashboard", icon: Home, to: "/admin/dashboard", pinned: true },
  { label: "Bookings", icon: Calendar, to: "/admin/bookings", pinned: true, exact: true },
  { label: "Booking Queue", icon: ListChecks, to: "/admin/bookings/queue", pinned: true },
  { label: "Guests", icon: Users, to: "/admin/guests", requiredRole: AuditRole.MANAGER },
  {
    label: "Payments",
    icon: Receipt,
    to: "/admin/payments",
    requiredRole: AuditRole.MANAGER,
    pinned: true,
  },
  { label: "Cabins", icon: Building2, to: "/admin/units", requiredRole: AuditRole.MANAGER },
  { label: "Expenses", icon: ReceiptText, to: "/admin/expenses", requiredRole: AuditRole.MANAGER },
  { label: "Accounts", icon: CreditCard, to: "/admin/accounts", requiredRole: AuditRole.MANAGER },
  {
    label: "Transfers",
    icon: ArrowLeftRight,
    to: "/admin/transfers",
    requiredRole: AuditRole.MANAGER,
  },
  { label: "Documents", icon: FileText, to: "/admin/documents", requiredRole: AuditRole.MANAGER },
  { label: "Settings", icon: Settings, to: "/admin/settings", requiredRole: AuditRole.MANAGER },
  {
    label: "Audit Trail",
    icon: Shield,
    to: "/admin/audit-logs",
    onlyRoles: [AuditRole.OWNER, AuditRole.ADMIN],
  },
  { label: "User Roles", icon: UserCog, to: "/admin/roles", onlyRoles: [AuditRole.ADMIN] },
];

function canSee(destination: AdminDestination, role: AuditRole | null): boolean {
  if (destination.onlyRoles) return role !== null && destination.onlyRoles.includes(role);
  if (destination.requiredRole) return hasRoleLevel(role, destination.requiredRole);
  return true;
}

interface MainLayoutProps {
  children: React.ReactNode;
}

/** The admin app's shell config: role-filtered destinations, Install app and Sign Out. */
export function MainLayout({ children }: MainLayoutProps) {
  const [userRole, setUserRole] = useState<AuditRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const installDismissalState = useInstallPromptStore((s) => s.dismissalState);
  const resetInstallPrompt = useInstallPromptStore((s) => s.reset);
  const showInstallEscape =
    installDismissalState === "permanent" || installDismissalState === "snoozed";

  const checkPermissions = useEffectEvent(async () => {
    try {
      const { getUserAuditRole } = await import("@/lib/audit-roles");
      setUserRole(await getUserAuditRole());
    } finally {
      setRoleLoading(false);
    }
  });

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

  const visibleDestinations = useMemo(
    () => destinations.filter((destination) => canSee(destination, userRole)),
    [userRole]
  );

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      window.location.href = "/admin/login";
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const actions: ShellAction[] = [
    ...(showInstallEscape
      ? [{ label: "Install app", icon: Download, onSelect: () => resetInstallPrompt() }]
      : []),
    { label: "Sign Out", icon: LogOut, onSelect: () => void handleSignOut() },
  ];

  return (
    <AppShell
      surface="admin"
      brand={{ name: "Okaeri Resort", tagline: "Management System", to: "/admin/dashboard" }}
      destinations={visibleDestinations}
      navLoading={roleLoading}
      actions={actions}
      theme={{ value: theme, onChange: setTheme }}
      banner={<InstallBanner />}
    >
      {children}
    </AppShell>
  );
}
