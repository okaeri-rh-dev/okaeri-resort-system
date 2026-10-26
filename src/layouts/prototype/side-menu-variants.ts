/**
 * PROTOTYPE — three admin menu groupings for "Side-menu grouping" (issue 155). Throwaway: lives
 * on branch proto/side-menu-grouping only. Blocked dates has no page yet, so it opens
 * /admin/availability?view=blocks.
 */
import {
  ArrowLeftRight,
  BedDouble,
  Building2,
  Calendar,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  CreditCard,
  FileText,
  Home,
  ListChecks,
  Receipt,
  ReceiptText,
  Settings,
  Shield,
  Sun,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

import type { ShellDestination, ShellGroup } from "@/components/patterns";
import { AuditRole } from "@/lib/audit-roles";

export interface ProtoDestination extends ShellDestination {
  requiredRole?: AuditRole;
  onlyRoles?: AuditRole[];
}

export interface MenuVariant {
  key: "A" | "B" | "C";
  name: string;
  groups: ShellGroup[];
  destinations: ProtoDestination[];
}

const manager = AuditRole.MANAGER;

const item = {
  dashboard: { label: "Dashboard", icon: Home, to: "/admin/dashboard" },
  bookings: { label: "Bookings", icon: Calendar, to: "/admin/bookings", exact: true },
  queue: { label: "Booking Queue", icon: ListChecks, to: "/admin/bookings/queue" },
  payments: { label: "Payments", icon: Receipt, to: "/admin/payments", requiredRole: manager },
  guests: { label: "Guests", icon: Users, to: "/admin/guests", requiredRole: manager },
  cabins: { label: "Cabins", icon: Building2, to: "/admin/units", requiredRole: manager },
  availability: {
    label: "Availability",
    icon: CalendarRange,
    to: "/admin/availability",
    search: { view: "calendar" },
  },
  blocked: {
    label: "Blocked dates",
    icon: CalendarOff,
    to: "/admin/availability",
    search: { view: "blocks" },
  },
  expenses: { label: "Expenses", icon: ReceiptText, to: "/admin/expenses", requiredRole: manager },
  accounts: { label: "Accounts", icon: CreditCard, to: "/admin/accounts", requiredRole: manager },
  transfers: {
    label: "Transfers",
    icon: ArrowLeftRight,
    to: "/admin/transfers",
    requiredRole: manager,
  },
  documents: { label: "Documents", icon: FileText, to: "/admin/documents", requiredRole: manager },
  settings: { label: "Settings", icon: Settings, to: "/admin/settings", requiredRole: manager },
  audit: {
    label: "Audit Trail",
    icon: Shield,
    to: "/admin/audit-logs",
    onlyRoles: [AuditRole.OWNER, AuditRole.ADMIN],
  },
  roles: { label: "User Roles", icon: UserCog, to: "/admin/roles", onlyRoles: [AuditRole.ADMIN] },
} satisfies Record<string, ProtoDestination>;

const pinned = { pinned: true } as const;

export const variants: MenuVariant[] = [
  {
    key: "A",
    name: "By area, open headings",
    groups: [
      { id: "bookings", label: "Bookings", icon: Calendar },
      { id: "cabins", label: "Cabins", icon: Building2 },
      { id: "money", label: "Money", icon: Wallet },
      { id: "admin", label: "Admin", icon: Settings },
    ],
    destinations: [
      { ...item.dashboard, ...pinned },
      { ...item.bookings, ...pinned, group: "bookings" },
      { ...item.queue, ...pinned, group: "bookings" },
      { ...item.payments, ...pinned, group: "bookings" },
      { ...item.guests, group: "bookings" },
      { ...item.cabins, group: "cabins" },
      { ...item.availability, group: "cabins" },
      { ...item.blocked, group: "cabins" },
      { ...item.expenses, group: "money" },
      { ...item.accounts, group: "money" },
      { ...item.transfers, group: "money" },
      { ...item.documents, group: "money" },
      { ...item.settings, group: "admin" },
      { ...item.audit, group: "admin" },
      { ...item.roles, group: "admin" },
    ],
  },
  {
    key: "B",
    name: "Daily first, rest folded",
    groups: [
      { id: "people", label: "Guests & cabins", icon: Users, collapsible: true },
      { id: "money", label: "Money", icon: Wallet, collapsible: true },
      { id: "admin", label: "Admin", icon: Settings, collapsible: true },
    ],
    destinations: [
      { ...item.dashboard, ...pinned },
      { ...item.queue, ...pinned },
      { ...item.bookings, ...pinned },
      { ...item.payments, ...pinned },
      item.availability,
      item.blocked,
      { ...item.guests, group: "people" },
      { ...item.cabins, group: "people" },
      { ...item.expenses, group: "money" },
      { ...item.accounts, group: "money" },
      { ...item.transfers, group: "money" },
      { ...item.documents, group: "admin" },
      { ...item.settings, group: "admin" },
      { ...item.audit, group: "admin" },
      { ...item.roles, group: "admin" },
    ],
  },
  {
    key: "C",
    name: "One Calendar, five groups",
    groups: [
      { id: "today", label: "Today", icon: Sun },
      { id: "stays", label: "Stays", icon: BedDouble },
      { id: "money", label: "Money", icon: Wallet },
      { id: "records", label: "Records", icon: FileText },
      { id: "setup", label: "Setup", icon: Settings },
    ],
    destinations: [
      { ...item.dashboard, ...pinned, group: "today" },
      { ...item.queue, ...pinned, group: "today" },
      { ...item.bookings, ...pinned, group: "stays" },
      {
        label: "Calendar",
        icon: CalendarDays,
        to: "/admin/availability",
        ...pinned,
        group: "stays",
      },
      { ...item.guests, group: "stays" },
      { ...item.cabins, group: "stays" },
      { ...item.payments, group: "money" },
      { ...item.expenses, group: "money" },
      { ...item.accounts, group: "money" },
      { ...item.transfers, group: "money" },
      { ...item.documents, group: "records" },
      { ...item.audit, group: "records" },
      { ...item.settings, group: "setup" },
      { ...item.roles, group: "setup" },
    ],
  },
];
