import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@/stores/projectStore";
import { queryKeys } from "@/lib/query-client";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Users,
  Home,
  Activity,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export function DashboardPage() {
  const { currentProject } = useProjectStore();

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: queryKeys.reportsDashboard(currentProject?.id || "", "month"),
    queryFn: async () => {
      // Mock data for now
      return {
        stats: {
          totalRevenue: 125430,
          revenueChange: 12.5,
          totalBookings: 89,
          bookingsChange: -2.3,
          occupancyRate: 78.5,
          occupancyChange: 5.2,
          totalGuests: 234,
          guestsChange: 8.1,
        },
        recentBookings: [
          {
            id: "1",
            guest: "John Doe",
            property: "Villa A",
            checkIn: "2024-08-26",
            status: "confirmed",
          },
          {
            id: "2",
            guest: "Jane Smith",
            property: "Suite B",
            checkIn: "2024-08-27",
            status: "pending",
          },
          {
            id: "3",
            guest: "Bob Johnson",
            property: "Room 101",
            checkIn: "2024-08-28",
            status: "confirmed",
          },
        ],
        recentExpenses: [
          {
            id: "1",
            description: "Cleaning Supplies",
            amount: 234.5,
            category: "Maintenance",
            date: "2024-08-25",
          },
          {
            id: "2",
            description: "Electricity Bill",
            amount: 1250.0,
            category: "Utilities",
            date: "2024-08-24",
          },
          {
            id: "3",
            description: "Staff Salary",
            amount: 5000.0,
            category: "Payroll",
            date: "2024-08-23",
          },
        ],
      };
    },
    enabled: !!currentProject?.id,
  });

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">No Project Selected</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please select a project from the sidebar to view the dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const stats = dashboardData?.stats || {};
  const recentBookings = dashboardData?.recentBookings || [];
  const recentExpenses = dashboardData?.recentExpenses || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard - {currentProject.name}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Overview of your resort performance and key metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`$${stats.totalRevenue?.toLocaleString() || 0}`}
          change={stats.revenueChange}
          icon={DollarSign}
        />
        <StatCard
          title="Total Bookings"
          value={stats.totalBookings || 0}
          change={stats.bookingsChange}
          icon={Calendar}
        />
        <StatCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate || 0}%`}
          change={stats.occupancyChange}
          icon={Home}
        />
        <StatCard
          title="Total Guests"
          value={stats.totalGuests || 0}
          change={stats.guestsChange}
          icon={Users}
        />
      </div>

      {/* Charts and Tables */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Bookings</h2>
            <a
              href="/bookings"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{booking.guest}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {booking.property} " Check-in: {booking.checkIn}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    booking.status === "confirmed"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                  }`}
                >
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Expenses</h2>
            <a
              href="/expenses"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            {recentExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{expense.description}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {expense.category} " {expense.date}
                  </p>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ${expense.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Chart Placeholder */}
      <div className="mt-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue Overview</h2>
          <select className="rounded-lg border border-gray-300 px-3 py-1 text-sm dark:border-gray-600 dark:bg-gray-700">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 3 months</option>
            <option>Last year</option>
          </select>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-900">
          <Activity className="h-8 w-8 text-gray-400" />
          <span className="ml-2 text-gray-500">Chart will be implemented in Phase 2</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: any;
}) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {change !== undefined && (
            <div className="mt-2 flex items-center">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : isNegative ? (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              ) : null}
              <span
                className={`ml-1 text-sm font-medium ${
                  isPositive
                    ? "text-green-600 dark:text-green-400"
                    : isNegative
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {Math.abs(change)}%
              </span>
              <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">vs last month</span>
            </div>
          )}
        </div>
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
          <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    </div>
  );
}
