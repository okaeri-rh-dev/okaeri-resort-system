import { useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserAuditRole } from "@/lib/audit-roles";
import { auth } from "@/lib/auth";

export function PendingApprovalPage({ loginPath = "/admin/login" }: { loginPath?: string } = {}) {
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      const role = await getUserAuditRole();
      if (role !== null) {
        toast.success("Role assigned! Redirecting...");
        navigate({ to: "/admin/dashboard" });
      } else {
        toast.info("Still pending approval. Please contact your administrator.");
      }
    } catch {
      toast.error("Could not check role status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } finally {
      window.location.href = loginPath;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Account Pending Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            Your account has been created but an administrator hasn't assigned you a role yet.
            Please contact your administrator to get access.
          </p>
          <p className="text-center text-sm text-gray-500">
            Once approved, click "Check Again" below or sign in again to access the system.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={handleCheckAgain} disabled={checking} className="w-full">
              {checking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check Again
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSignOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
