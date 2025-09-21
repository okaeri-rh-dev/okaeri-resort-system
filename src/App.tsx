import { BookingForm } from "@/components/bookings/BookingForm";
import { BookingsTable } from "@/components/bookings/BookingsTable";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GuestsTable } from "@/components/guests/GuestsTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { UnitsTable } from "@/components/units/UnitsTable";
import { MainLayout } from "@/layouts/MainLayout";
import { Dashboard } from "@/pages/Dashboard";
import { QueryProvider } from "@/providers/QueryProvider";
import { LoginForm } from "@/components/auth/LoginForm";
import { initializeTheme } from "@/stores";
import { auth } from "@/lib/auth";
import { useEffect, useState } from "react";

function App() {
  const [currentPath, setCurrentPath] = useState("/");
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Initialize theme and handle navigation
    initializeTheme();

    // Check authentication status
    const checkAuth = async () => {
      try {
        const authenticated = await auth.isAuthenticated();
        setIsAuthenticated(authenticated);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    // Simple client-side routing
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  // Render the appropriate page based on the current path
  const renderPage = () => {
    switch (currentPath) {
      case "/":
        return (
          <ErrorBoundary level="page">
            <Dashboard />
          </ErrorBoundary>
        );
      case "/bookings":
        return (
          <ErrorBoundary level="page">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
                  <p className="text-muted-foreground">
                    Manage all resort bookings and reservations
                  </p>
                </div>
                <Button onClick={() => setShowBookingForm(true)}>New Booking</Button>
              </div>
              <ErrorBoundary level="component">
                <BookingsTable />
              </ErrorBoundary>
            </div>
          </ErrorBoundary>
        );
      case "/units":
        return (
          <ErrorBoundary level="page">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Units</h1>
                <p className="text-muted-foreground">Manage resort units and availability</p>
              </div>
              <ErrorBoundary level="component">
                <UnitsTable />
              </ErrorBoundary>
            </div>
          </ErrorBoundary>
        );
      case "/guests":
        return (
          <ErrorBoundary level="page">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Guests</h1>
                <p className="text-muted-foreground">View and manage guest information</p>
              </div>
              <ErrorBoundary level="component">
                <GuestsTable />
              </ErrorBoundary>
            </div>
          </ErrorBoundary>
        );
      case "/payments":
        return (
          <ErrorBoundary level="page">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
                <p className="text-muted-foreground">Track payments and upload payment proofs</p>
              </div>
              <ErrorBoundary level="component">
                <BookingsTable />
              </ErrorBoundary>
            </div>
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary level="page">
            <Dashboard />
          </ErrorBoundary>
        );
    }
  };

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <ErrorBoundary level="app">
        <LoginForm onSuccess={() => setIsAuthenticated(true)} />
        <Toaster position="top-right" />
      </ErrorBoundary>
    );
  }

  // Show main app if authenticated
  return (
    <ErrorBoundary level="app">
      <QueryProvider>
        <MainLayout currentPath={currentPath}>{renderPage()}</MainLayout>

        {/* Booking Form Modal */}
        <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <BookingForm
                onSuccess={() => {
                  setShowBookingForm(false);
                }}
                onCancel={() => setShowBookingForm(false)}
              />
            </ErrorBoundary>
          </DialogContent>
        </Dialog>

        {/* Toast Notifications */}
        <Toaster position="top-right" />
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
