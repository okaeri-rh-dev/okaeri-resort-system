import { Link } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { Building2, Calendar, DollarSign, FileText, Users, Shield } from "lucide-react";

export function HomePage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">Okaeri Resort</span>
            </div>
            <nav className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl dark:text-white">
              Manage Your Resort
              <span className="block text-blue-600">Like Never Before</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-300">
              All-in-one resort management system for bookings, expenses, properties, and team
              collaboration. Built for modern hospitality businesses.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Start Free Trial
                  </Link>
                  <Link
                    to="/demo"
                    className="text-sm leading-6 font-semibold text-gray-900 dark:text-white"
                  >
                    View Demo <span aria-hidden="true">�</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Everything You Need
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Comprehensive tools designed specifically for resort and hospitality management
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.name} className="flex flex-col">
                  <dt className="text-base leading-7 font-semibold text-gray-900 dark:text-white">
                    <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                      <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    {feature.name}
                  </dt>
                  <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            � 2024 Okaeri Resort Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    name: "Booking Management",
    description:
      "Streamline reservations with real-time availability, automated confirmations, and integrated calendar views.",
    icon: Calendar,
  },
  {
    name: "Financial Tracking",
    description:
      "Track expenses, generate receipts, manage budgets, and get detailed financial reports for better decision making.",
    icon: DollarSign,
  },
  {
    name: "Property Management",
    description:
      "Manage multiple properties, track maintenance schedules, and monitor occupancy rates from a single dashboard.",
    icon: Building2,
  },
  {
    name: "Team Collaboration",
    description:
      "Coordinate with your staff, assign tasks, manage permissions, and keep everyone on the same page.",
    icon: Users,
  },
  {
    name: "Advanced Analytics",
    description:
      "Get insights with comprehensive reports on revenue, occupancy, guest satisfaction, and operational efficiency.",
    icon: FileText,
  },
  {
    name: "Secure & Compliant",
    description:
      "Enterprise-grade security with role-based access control, data encryption, and compliance with industry standards.",
    icon: Shield,
  },
];
