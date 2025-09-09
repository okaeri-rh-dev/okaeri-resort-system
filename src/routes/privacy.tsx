/**
 * Privacy Policy Page
 * Placeholder for Phase 1.2 - Full implementation in later phases
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { ROUTES } from "./paths";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Link to={ROUTES.login}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="text-ocean-600 h-5 w-5" />
                <CardTitle className="text-2xl">Privacy Policy</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-400">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2>1. Information We Collect</h2>
            <p>The Okaeri Resort System collects information necessary for resort operations:</p>
            <ul>
              <li>Guest information (names, contact details, booking preferences)</li>
              <li>Staff account information (names, roles, contact details)</li>
              <li>Property and booking data</li>
              <li>Financial transaction records</li>
            </ul>

            <h2>2. Philippine Data Privacy Act Compliance</h2>
            <p>
              We strictly comply with the Philippine Data Privacy Act of 2012 (Republic Act 10173):
            </p>
            <ul>
              <li>All personal data is processed lawfully and fairly</li>
              <li>Data is collected for specified and legitimate purposes</li>
              <li>We ensure data accuracy and implement retention policies</li>
              <li>Appropriate security measures protect against unauthorized access</li>
            </ul>

            <h2>3. How We Use Information</h2>
            <p>Information collected is used exclusively for:</p>
            <ul>
              <li>Processing and managing resort bookings</li>
              <li>Providing customer service and support</li>
              <li>Generating required financial reports and BIR compliance</li>
              <li>Improving resort operations and guest experience</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>We implement industry-standard security measures:</p>
            <ul>
              <li>Encrypted data transmission using HTTPS</li>
              <li>Secure authentication with JWT tokens</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls and role-based permissions</li>
            </ul>

            <h2>5. Data Retention</h2>
            <p>
              Personal data is retained only as long as necessary for business and legal
              requirements. Financial records are kept for the period required by BIR regulations
              (typically 5 years).
            </p>

            <h2>6. Your Rights</h2>
            <p>Under the Data Privacy Act, you have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Object to processing in certain circumstances</li>
              <li>Request data erasure when appropriate</li>
            </ul>

            <h2>7. Contact Our Data Protection Officer</h2>
            <p>
              For privacy concerns or to exercise your rights, contact:
              <br />
              Email: dpo@okaeri-resort.ph
              <br />
              Phone: +63 (XXX) XXX-XXXX
              <br />
              Address: La Union, Philippines
            </p>

            <h2>8. Updates to This Policy</h2>
            <p>
              We may update this privacy policy to reflect changes in our practices or legal
              requirements. We will notify users of significant changes.
            </p>

            <div className="mt-8 border-t pt-8">
              <p className="text-sm text-gray-500">
                This is a placeholder document for Phase 1.2. Full privacy policy will be
                implemented in Phase 5.3 during production deployment preparation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
