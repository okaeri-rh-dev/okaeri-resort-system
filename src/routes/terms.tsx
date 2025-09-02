/**
 * Terms of Service Page
 * Placeholder for Phase 1.2 - Full implementation in later phases
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "./paths";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Link to={ROUTES.register}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <CardTitle className="text-2xl">Terms of Service</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-400">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Okaeri Resort System, you agree to be bound by these Terms
              of Service and all applicable laws and regulations.
            </p>

            <h2>2. Use of Service</h2>
            <p>
              The Okaeri Resort System is designed for resort management operations. You agree to:
            </p>
            <ul>
              <li>Use the service only for lawful purposes</li>
              <li>Maintain the security of your account credentials</li>
              <li>Provide accurate and complete information</li>
              <li>Respect the privacy and data of guests and staff</li>
            </ul>

            <h2>3. Data Protection</h2>
            <p>
              We are committed to protecting your data in compliance with the Philippine Data
              Privacy Act of 2012. All personal information will be handled with strict
              confidentiality.
            </p>

            <h2>4. Limitation of Liability</h2>
            <p>
              The Okaeri Resort System is provided "as is" without warranties of any kind. We shall
              not be liable for any indirect, incidental, or consequential damages.
            </p>

            <h2>5. Philippine Law Compliance</h2>
            <p>
              This service complies with all applicable Philippine laws including but not limited to
              BIR requirements for receipt generation and tax calculations.
            </p>

            <h2>6. Contact Information</h2>
            <p>
              For questions about these Terms of Service, please contact us at:
              <br />
              Email: legal@okaeri-resort.ph
              <br />
              Address: La Union, Philippines
            </p>

            <div className="mt-8 border-t pt-8">
              <p className="text-sm text-gray-500">
                This is a placeholder document for Phase 1.2. Full legal terms will be implemented
                in Phase 5.3 during production deployment preparation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
