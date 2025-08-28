import { Outlet } from "@tanstack/react-router";
import { Waves, Sun, MapPin, Wifi, WifiOff, Shield, Heart } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

export function AuthLayout({ children }: { children?: React.ReactNode }) {
  const theme = useUIStore((state) => state.theme);
  const isOnline = navigator.onLine;

  return (
    <div className="from-ocean-400 via-coral-400 to-sunset-500 dark:from-ocean-900 dark:via-coral-900 dark:to-sunset-900 relative min-h-screen overflow-hidden bg-gradient-to-br">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-white/20 dark:from-transparent dark:via-black/20 dark:to-black/30" />

      {/* Floating Elements */}
      <div className="animate-float absolute top-20 left-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <Waves className="h-8 w-8 text-white" />
        </div>
      </div>

      <div className="animate-float-delayed absolute top-40 right-20">
        <div className="bg-sunset-200/30 flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm">
          <Sun className="text-sunset-600 h-6 w-6" />
        </div>
      </div>

      <div className="animate-float absolute bottom-32 left-20">
        <div className="bg-coral-200/20 h-20 w-20 rounded-full backdrop-blur-sm" />
      </div>

      <div className="animate-float-delayed absolute right-10 bottom-20">
        <div className="bg-ocean-200/30 h-8 w-8 rounded-full backdrop-blur-sm" />
      </div>

      {/* Status Bar */}
      <div className="absolute top-0 right-0 left-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-white/80">
            <MapPin className="h-4 w-4" />
            <span className="text-sm font-medium">Philippines</span>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-1 text-sm ${
                isOnline ? "text-green-200" : "text-red-200"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>Offline</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 text-sm text-white/80">
              <Shield className="h-4 w-4" />
              <span>Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex min-h-screen">
        {/* Left Side - Branding */}
        <div className="hidden flex-col justify-between p-12 text-white lg:flex lg:w-1/2 xl:w-3/5">
          {/* Header */}
          <div>
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-xl backdrop-blur-sm">
                <Waves className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Okaeri Resort</h1>
                <p className="text-lg font-medium text-white/80">Management System</p>
              </div>
            </div>

            <blockquote className="mb-8 text-2xl leading-relaxed font-light lg:text-3xl">
              "Welcome to paradise management.
              <span className="font-semibold"> Streamline your resort operations</span>
              with our comprehensive platform designed for
              <span className="font-semibold"> Filipino hospitality businesses.</span>"
            </blockquote>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <h3 className="mb-4 text-xl font-semibold">Why Choose Okaeri?</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
                <div>
                  <h4 className="font-semibold">Philippine-First Design</h4>
                  <p className="text-sm text-white/80">
                    Built for Filipino resort owners with peso currency, local holidays, and GCash
                    integration.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
                <div>
                  <h4 className="font-semibold">Mobile-First Experience</h4>
                  <p className="text-sm text-white/80">
                    Manage your resort from anywhere with our responsive, touch-friendly interface.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
                <div>
                  <h4 className="font-semibold">Family Business Ready</h4>
                  <p className="text-sm text-white/80">
                    Simple enough for family members, powerful enough for professional operations.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/20 pt-8">
            <div className="text-sm text-white/60">
              © 2024 Okaeri Resort Systems. Made with{" "}
              <Heart className="inline h-4 w-4 text-red-300" /> in the Philippines.
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="flex w-full items-center justify-center p-6 lg:w-1/2 xl:w-2/5">
          <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-4 flex items-center justify-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 shadow-lg backdrop-blur-sm">
                  <Waves className="h-7 w-7 text-white" />
                </div>
                <div className="text-white">
                  <h1 className="text-2xl font-bold">Okaeri Resort</h1>
                  <p className="text-sm text-white/80">Management System</p>
                </div>
              </div>
            </div>

            {/* Auth Card */}
            <div className="rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95">
              {children || <Outlet />}
            </div>

            {/* Mobile Features */}
            <div className="mt-8 text-center lg:hidden">
              <div className="grid grid-cols-3 gap-4 text-white">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                  <p className="text-xs text-white/80">Philippine-First</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                  <p className="text-xs text-white/80">Mobile-Ready</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                  <p className="text-xs text-white/80">Family-Friendly</p>
                </div>
              </div>

              <p className="mt-4 text-xs text-white/60">
                Made with <Heart className="inline h-3 w-3 text-red-300" /> for Filipino resort
                owners
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Styles for Animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(-10px) rotate(1deg);
          }
          66% {
            transform: translateY(5px) rotate(-1deg);
          }
        }

        @keyframes float-delayed {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          33% {
            transform: translateY(5px) rotate(-1deg);
          }
          66% {
            transform: translateY(-8px) rotate(1deg);
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
