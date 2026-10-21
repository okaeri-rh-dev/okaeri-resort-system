import { createFileRoute } from "@tanstack/react-router";

import {
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@/components/patterns";
import { GuestLayout } from "@/layouts/GuestLayout";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <GuestLayout width="form">
      <div>
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground">Okaeri Resort Data Privacy Policy</p>
          <p className="text-muted-foreground mt-1 text-sm">
            In compliance with the Data Privacy Act of 2012 (RA 10173)
          </p>
        </div>

        {/* Main Content */}
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>Data Privacy Notice</CardTitle>
            <CardDescription>
              Your privacy and the protection of your personal information is important to us
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 text-sm">
              {/* Introduction */}
              <Callout tone="info">
                In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), Okaeri
                Resort is committed to protecting your personal information. This Privacy Policy
                explains how we collect, use, store, and protect your personal data.
              </Callout>

              <Separator />

              {/* Section 1: Information We Collect */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">1. Information We Collect</h2>
                <p className="mb-3">
                  We collect personal information that you provide to us when you make a booking,
                  contact us, or use our services. The types of information we collect include:
                </p>
                <div className="space-y-2">
                  <div>
                    <h3 className="mb-2 font-semibold">Personal Identification Information:</h3>
                    <ul className="ml-6 list-disc space-y-1">
                      <li>Full name</li>
                      <li>Email address</li>
                      <li>Phone number</li>
                      <li>Government-issued ID (when required for check-in)</li>
                      <li>Date of birth (when required)</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Booking Information:</h3>
                    <ul className="ml-6 list-disc space-y-1">
                      <li>Check-in and check-out dates</li>
                      <li>Number of guests</li>
                      <li>Cabin preferences</li>
                      <li>Special requests and requirements</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Payment Information:</h3>
                    <ul className="ml-6 list-disc space-y-1">
                      <li>Payment proof and transaction details</li>
                      <li>Payment method used</li>
                      <li>Billing information</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Technical Information:</h3>
                    <ul className="ml-6 list-disc space-y-1">
                      <li>IP address</li>
                      <li>Browser type and version</li>
                      <li>Device information</li>
                      <li>Usage data and interactions with our website</li>
                    </ul>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Section 2: How We Use Your Information */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">2. How We Use Your Information</h2>
                <p className="mb-3">
                  We collect and process your personal information for the following purposes:
                </p>
                <div className="space-y-2">
                  <p>
                    <strong>2.1 Booking Processing and Management:</strong>
                  </p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>Process and confirm your reservations</li>
                    <li>Manage check-in and check-out procedures</li>
                    <li>Verify payment and maintain financial records</li>
                    <li>Handle booking modifications and cancellations</li>
                  </ul>

                  <p className="mt-3">
                    <strong>2.2 Communication:</strong>
                  </p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>Send booking confirmations and receipts</li>
                    <li>Provide important updates about your reservation</li>
                    <li>Respond to your inquiries and requests</li>
                    <li>Send service-related notifications</li>
                  </ul>

                  <p className="mt-3">
                    <strong>2.3 Service Improvement:</strong>
                  </p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>Analyze usage patterns to improve our services</li>
                    <li>Enhance guest experience and satisfaction</li>
                    <li>Develop new features and offerings</li>
                    <li>Conduct surveys and gather feedback</li>
                  </ul>

                  <p className="mt-3">
                    <strong>2.4 Legal and Regulatory Compliance:</strong>
                  </p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>Comply with legal obligations and regulations</li>
                    <li>Maintain records as required by Philippine law</li>
                    <li>Prevent fraud and ensure security</li>
                    <li>Resolve disputes and enforce our terms</li>
                  </ul>

                  <p className="mt-3">
                    <strong>2.5 Marketing (with your consent):</strong>
                  </p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>Send promotional offers and updates</li>
                    <li>Inform you about special packages and events</li>
                    <li>Share news and announcements</li>
                  </ul>
                  <p className="text-muted-foreground mt-2 text-xs italic">
                    Note: You can opt-out of marketing communications at any time.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 3: Legal Basis for Processing */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">
                  3. Legal Basis for Processing Your Data
                </h2>
                <p className="mb-3">
                  Under the Data Privacy Act of 2012, we process your personal information based on
                  the following legal grounds:
                </p>
                <div className="space-y-2">
                  <p>
                    <strong>3.1 Consent:</strong> You have given explicit consent for us to process
                    your personal information for specific purposes.
                  </p>
                  <p>
                    <strong>3.2 Contract:</strong> Processing is necessary to fulfill our
                    contractual obligations to you (e.g., providing accommodation services).
                  </p>
                  <p>
                    <strong>3.3 Legal Obligation:</strong> We are required by law to process certain
                    information (e.g., tax records, guest registration).
                  </p>
                  <p>
                    <strong>3.4 Legitimate Interest:</strong> Processing is necessary for our
                    legitimate business interests, such as fraud prevention and service improvement.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 4: Data Sharing and Disclosure */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">4. Data Sharing and Disclosure</h2>
                <p className="mb-3">
                  We do not sell or rent your personal information to third parties. We may share
                  your information only in the following circumstances:
                </p>
                <div className="space-y-2">
                  <p>
                    <strong>4.1 Service Providers:</strong> We may share information with trusted
                    third-party service providers who assist us in operating our business (e.g.,
                    payment processors, cloud storage providers). These providers are bound by
                    confidentiality agreements.
                  </p>
                  <p>
                    <strong>4.2 Legal Requirements:</strong> We may disclose your information when
                    required by law, court order, or government regulation.
                  </p>
                  <p>
                    <strong>4.3 Business Transfers:</strong> In the event of a merger, acquisition,
                    or sale of assets, your information may be transferred as part of that
                    transaction.
                  </p>
                  <p>
                    <strong>4.4 With Your Consent:</strong> We may share your information with other
                    parties when you have explicitly consented to such sharing.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 5: Data Protection and Security */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">5. Data Protection and Security</h2>
                <p className="mb-3">
                  We implement appropriate technical and organizational measures to protect your
                  personal information against unauthorized access, alteration, disclosure, or
                  destruction:
                </p>
                <ul className="ml-6 list-disc space-y-1">
                  <li>
                    <strong>Encryption:</strong> Data transmission and storage are encrypted using
                    industry-standard protocols (HTTPS, TLS)
                  </li>
                  <li>
                    <strong>Access Controls:</strong> Limited access to personal information on a
                    need-to-know basis
                  </li>
                  <li>
                    <strong>Regular Security Assessments:</strong> Periodic reviews and updates of
                    our security measures
                  </li>
                  <li>
                    <strong>Staff Training:</strong> Regular training on data privacy and security
                    best practices
                  </li>
                  <li>
                    <strong>Secure Storage:</strong> Personal information is stored in secure
                    databases with backup systems
                  </li>
                  <li>
                    <strong>Incident Response:</strong> Procedures in place to respond to data
                    breaches promptly
                  </li>
                </ul>
              </section>

              <Separator />

              {/* Section 6: Data Retention */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">6. Data Retention</h2>
                <p className="mb-3">
                  We retain your personal information only for as long as necessary to fulfill the
                  purposes for which it was collected and to comply with legal requirements:
                </p>
                <div className="space-y-2">
                  <p>
                    <strong>Booking Records:</strong> 5 years from the date of your last stay (for
                    customer service and legal purposes)
                  </p>
                  <p>
                    <strong>Financial Records:</strong> 10 years (as required by the Bureau of
                    Internal Revenue)
                  </p>
                  <p>
                    <strong>Marketing Communications:</strong> Until you withdraw consent or
                    unsubscribe
                  </p>
                  <p>
                    <strong>Technical Data:</strong> Typically 12-24 months, unless required for
                    longer for security purposes
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm italic">
                    After the retention period, we securely delete or anonymize your personal
                    information.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 7: Your Rights Under the Data Privacy Act */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">
                  7. Your Rights Under the Data Privacy Act of 2012
                </h2>
                <p className="mb-3">
                  As a data subject, you have the following rights regarding your personal
                  information:
                </p>
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold">7.1 Right to Be Informed</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You have the right to know how we collect, use, and process your personal
                      information.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">7.2 Right to Access</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can request copies of your personal information that we hold.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">7.3 Right to Rectification</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can request correction of inaccurate or incomplete personal information.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">7.4 Right to Erasure (Right to be Forgotten)</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can request deletion of your personal information, subject to legal and
                      contractual obligations.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">7.5 Right to Object</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can object to certain types of processing, such as direct marketing.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">7.6 Right to Data Portability</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can request to receive your personal information in a structured, commonly
                      used, and machine-readable format.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold">7.7 Right to Lodge a Complaint</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can file a complaint with the National Privacy Commission if you believe
                      your rights have been violated.
                    </p>
                  </div>
                </div>
                <div className="bg-muted mt-4 rounded-md p-4">
                  <p className="font-semibold">How to Exercise Your Rights:</p>
                  <p className="mt-2 text-sm">
                    To exercise any of these rights, please contact our Data Protection Officer
                    using the contact information provided below. We will respond to your request
                    within the timeframes required by law.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 8: Cookies and Tracking Technologies */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">8. Cookies and Tracking Technologies</h2>
                <div className="space-y-2">
                  <p>
                    We use cookies and similar tracking technologies to enhance your experience on
                    our website:
                  </p>
                  <div>
                    <h3 className="mb-1 font-semibold">Essential Cookies:</h3>
                    <p className="text-muted-foreground text-sm">
                      Required for the website to function properly (e.g., session management,
                      security).
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">Functional Cookies:</h3>
                    <p className="text-muted-foreground text-sm">
                      Remember your preferences and settings for a better experience.
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold">Analytics Cookies:</h3>
                    <p className="text-muted-foreground text-sm">
                      Help us understand how visitors interact with our website (anonymized data).
                    </p>
                  </div>
                  <p className="mt-3 text-sm">
                    You can control cookies through your browser settings. Note that disabling
                    cookies may affect website functionality.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 9: Children's Privacy */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">9. Children's Privacy</h2>
                <p>
                  Our services are not directed to children under 18 years of age. We do not
                  knowingly collect personal information from children. If you believe we have
                  collected information from a child, please contact us immediately so we can take
                  appropriate action.
                </p>
              </section>

              <Separator />

              {/* Section 10: Changes to This Privacy Policy */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">10. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time to reflect changes in our
                  practices or legal requirements. We will notify you of any material changes by:
                </p>
                <ul className="mt-2 ml-6 list-disc space-y-1">
                  <li>Posting the updated policy on our website</li>
                  <li>Updating the "Last Updated" date</li>
                  <li>Sending email notification for significant changes (when applicable)</li>
                </ul>
                <p className="mt-3">
                  We encourage you to review this Privacy Policy periodically to stay informed about
                  how we protect your information.
                </p>
              </section>

              <Separator />

              {/* Section 11: International Data Transfers */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">11. International Data Transfers</h2>
                <p>
                  Your personal information is primarily stored and processed in the Philippines. If
                  we transfer your information outside the Philippines, we will ensure appropriate
                  safeguards are in place to protect your data in accordance with the Data Privacy
                  Act of 2012.
                </p>
              </section>

              <Separator />

              {/* Contact Information */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">12. Contact Information</h2>
                <p className="mb-3">
                  For questions, concerns, or requests regarding this Privacy Policy or your
                  personal information, please contact:
                </p>
                <div className="bg-muted rounded-md p-4">
                  <p className="font-semibold">Data Protection Officer</p>
                  <p className="font-semibold">Okaeri Resort</p>
                  <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                    <p>Email: privacy@okaeriresort.com</p>
                    <p>Phone: [Resort Contact Number]</p>
                    <p>Business Hours: Monday - Sunday, 8:00 AM - 8:00 PM (Philippine Time)</p>
                  </div>
                </div>

                <div className="bg-muted mt-4 rounded-md p-4">
                  <p className="font-semibold">National Privacy Commission</p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    If you believe your privacy rights have been violated, you may file a complaint
                    with:
                  </p>
                  <div className="text-muted-foreground mt-2 space-y-1 text-sm">
                    <p>National Privacy Commission</p>
                    <p>5th Floor, Philippine International Convention Center</p>
                    <p>Vicente Sotto Street, Pasay City, Metro Manila</p>
                    <p>Email: info@privacy.gov.ph</p>
                    <p>Website: www.privacy.gov.ph</p>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Footer */}
              <div className="bg-background rounded-lg border p-4 text-center">
                <p className="font-medium">
                  Thank you for trusting Okaeri Resort with your personal information
                </p>
                <p className="mt-2">
                  We are committed to protecting your privacy and handling your data responsibly in
                  accordance with the Data Privacy Act of 2012.
                </p>
                <p className="text-muted-foreground mt-4 text-xs">Last Updated: October 20, 2025</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Effective Date: October 20, 2025
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </GuestLayout>
  );
}
