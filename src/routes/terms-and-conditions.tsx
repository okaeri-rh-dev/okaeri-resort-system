import { createFileRoute } from "@tanstack/react-router";

import { PolicyContactChannels } from "@/components/contact-channels/PolicyContactChannels";
import {
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@/components/patterns";
import { useActiveContactChannels } from "@/hooks/useContactChannels";
import { GuestLayout } from "@/layouts/GuestLayout";

export const Route = createFileRoute("/terms-and-conditions")({
  component: TermsAndConditionsPage,
});

function TermsAndConditionsPage() {
  const { data, isError } = useActiveContactChannels();
  const contactChannels = isError ? [] : data;

  return (
    <GuestLayout width="form">
      <div>
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold">Terms and Conditions</h1>
          <p className="text-muted-foreground">Okaeri Resort Booking Agreement</p>
          <p className="text-muted-foreground mt-1 text-sm">Effective Date: October 2025</p>
        </div>

        {/* Main Content */}
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>Welcome to Okaeri Resort</CardTitle>
            <CardDescription>
              Please read these terms and conditions carefully before making a booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 text-sm">
              {/* Introduction */}
              <Callout tone="info">
                By submitting a booking through our online system, you agree to be bound by these
                Terms and Conditions. Please ensure you have read, understood, and agreed to all
                terms before proceeding with your reservation.
              </Callout>

              <Separator />

              {/* Section 1: General Terms */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">1. General Terms</h2>
                <div className="space-y-2">
                  <p>
                    <strong>1.1 Acceptance of Terms:</strong> These Terms and Conditions constitute
                    a legally binding agreement between you (the "Guest") and Okaeri Resort (the
                    "Resort") operating in the Republic of the Philippines.
                  </p>
                  <p>
                    <strong>1.2 Modifications:</strong> The Resort reserves the right to modify
                    these terms at any time. Changes will be effective immediately upon posting on
                    our website. Your continued use of our services after modifications constitutes
                    acceptance of the updated terms.
                  </p>
                  <p>
                    <strong>1.3 Eligibility:</strong> You must be at least 18 years old to make a
                    booking. By booking, you confirm that you are of legal age and have the
                    authority to enter into this agreement.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 2: Booking Terms */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">2. Booking Terms</h2>
                <div className="space-y-2">
                  <p>
                    <strong>2.1 Reservation Process:</strong> All bookings must be made through our
                    official website or authorized booking channels. A booking is considered
                    confirmed only upon receipt of payment proof and written confirmation from the
                    Resort.
                  </p>
                  <p>
                    <strong>2.2 Booking Reference:</strong> Upon successful booking, you will
                    receive a unique booking reference number. Please keep this reference for all
                    future correspondence regarding your reservation.
                  </p>
                  <p>
                    <strong>2.3 Availability:</strong> All bookings are subject to availability. The
                    Resort reserves the right to decline or cancel bookings if units are not
                    available due to unforeseen circumstances.
                  </p>
                  <p>
                    <strong>2.4 Minimum Stay:</strong> Certain periods may require minimum stay
                    requirements, particularly during peak seasons and holidays. These requirements
                    will be communicated during the booking process.
                  </p>
                  <p>
                    <strong>2.5 Guest Capacity:</strong> Each unit has a maximum occupancy limit.
                    Exceeding this limit may result in additional charges or booking cancellation.
                    All guests must be declared at the time of booking.
                  </p>
                  <p>
                    <strong>2.6 Check-in/Check-out Times:</strong> Standard check-in time is 2:00 PM
                    and check-out time is 12:00 PM. Early check-in or late check-out may be arranged
                    subject to availability and may incur additional charges.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 3: Payment Terms */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">3. Payment Terms</h2>
                <div className="space-y-2">
                  <p>
                    <strong>3.1 Currency:</strong> All prices are quoted and payable in Philippine
                    Pesos (PHP) unless otherwise specified.
                  </p>
                  <p>
                    <strong>3.2 Payment Methods:</strong> We accept payment via bank transfer,
                    GCash, PayMaya, and other authorized payment channels. Payment proof must be
                    uploaded during the booking process.
                  </p>
                  <p>
                    <strong>3.3 Payment Verification:</strong> Bookings will be confirmed upon
                    verification of payment, typically within 24 hours during business days.
                    Unverified payments may result in booking cancellation.
                  </p>
                  <p>
                    <strong>3.4 Full Payment Required:</strong> Full payment is required at the time
                    of booking unless alternative payment arrangements have been explicitly agreed
                    upon in writing.
                  </p>
                  <p>
                    <strong>3.5 Price Changes:</strong> Rates are subject to change without notice.
                    However, once a booking is confirmed and payment is received, the agreed rate
                    will be honored.
                  </p>
                  <p>
                    <strong>3.6 Additional Charges:</strong> Guests are responsible for any
                    additional charges incurred during their stay, including but not limited to
                    damages, extra services, excess occupancy fees, and late check-out fees.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 4: Cancellation and Refund Policy */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">4. Cancellation and Refund Policy</h2>
                <div className="space-y-2">
                  <p>
                    <strong>4.1 Cancellation Notice:</strong> Cancellations must be made in writing
                    via email to our official contact address, referencing your booking reference
                    number.
                  </p>
                  <p>
                    <strong>4.2 Refund Schedule:</strong>
                  </p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>
                      Cancellation 30 days or more before check-in: 90% refund (10% processing fee)
                    </li>
                    <li>Cancellation 15-29 days before check-in: 50% refund</li>
                    <li>Cancellation 7-14 days before check-in: 25% refund</li>
                    <li>Cancellation less than 7 days before check-in: No refund</li>
                  </ul>
                  <p>
                    <strong>4.3 No-Show Policy:</strong> Failure to arrive on your scheduled
                    check-in date without prior cancellation will result in forfeiture of the entire
                    payment.
                  </p>
                  <p>
                    <strong>4.4 Early Departure:</strong> No refunds will be provided for early
                    departures or unused portions of your stay.
                  </p>
                  <p>
                    <strong>4.5 Resort-Initiated Cancellations:</strong> If the Resort must cancel
                    your booking due to unforeseen circumstances, you will receive a full refund or
                    the option to reschedule to alternative dates subject to availability.
                  </p>
                  <p>
                    <strong>4.6 Force Majeure:</strong> The Resort is not liable for cancellations
                    or modifications due to events beyond our control, including but not limited to
                    natural disasters, typhoons, government restrictions, or public health
                    emergencies. In such cases, rebooking options will be provided where possible.
                  </p>
                  <p>
                    <strong>4.7 Refund Processing:</strong> Approved refunds will be processed
                    within 14 business days to the original payment method.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 5: Guest Responsibilities */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">5. Guest Responsibilities</h2>
                <div className="space-y-2">
                  <p>
                    <strong>5.1 Property Care:</strong> Guests are expected to treat the property
                    and all furnishings with reasonable care. Any damage caused by negligence or
                    misconduct will be charged to the guest.
                  </p>
                  <p>
                    <strong>5.2 Conduct and Behavior:</strong> Guests must conduct themselves in a
                    manner that does not disturb other guests or neighbors. The Resort reserves the
                    right to terminate stays without refund for disruptive behavior.
                  </p>
                  <p>
                    <strong>5.3 Noise Policy:</strong> Quiet hours are typically from 10:00 PM to
                    7:00 AM. Excessive noise during these hours may result in warnings or
                    termination of stay.
                  </p>
                  <p>
                    <strong>5.4 Prohibited Activities:</strong> The following are strictly
                    prohibited on the premises:
                  </p>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>Illegal activities or possession of illegal substances</li>
                    <li>Smoking in non-designated areas</li>
                    <li>Bringing pets without prior approval</li>
                    <li>Exceeding maximum occupancy limits</li>
                    <li>Unauthorized commercial activities</li>
                    <li>Removal of property items</li>
                  </ul>
                  <p>
                    <strong>5.5 Valid Identification:</strong> All guests must present valid
                    government-issued identification upon check-in as required by Philippine law.
                  </p>
                  <p>
                    <strong>5.6 Compliance with Rules:</strong> Guests must comply with all property
                    rules, local ordinances, and Philippine laws during their stay.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 6: Liability and Disclaimers */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">6. Liability and Disclaimers</h2>
                <div className="space-y-2">
                  <p>
                    <strong>6.1 Personal Belongings:</strong> The Resort is not responsible for
                    loss, theft, or damage to personal belongings. Guests are advised to secure
                    their valuables and obtain appropriate travel insurance.
                  </p>
                  <p>
                    <strong>6.2 Personal Injury:</strong> Guests participate in all activities at
                    their own risk. The Resort is not liable for injuries sustained during your stay
                    except in cases of proven negligence by the Resort.
                  </p>
                  <p>
                    <strong>6.3 Weather Conditions:</strong> The Resort cannot guarantee specific
                    weather conditions and is not liable for weather-related disappointments or
                    cancellations.
                  </p>
                  <p>
                    <strong>6.4 Service Interruptions:</strong> While we strive to provide
                    uninterrupted services, the Resort is not liable for temporary interruptions of
                    utilities (water, electricity, internet) due to circumstances beyond our
                    control.
                  </p>
                  <p>
                    <strong>6.5 Third-Party Services:</strong> The Resort is not responsible for
                    services provided by third-party vendors or tour operators, even if arranged
                    through the Resort.
                  </p>
                  <p>
                    <strong>6.6 Limitation of Liability:</strong> In no event shall the Resort's
                    total liability exceed the amount paid by the guest for their accommodation.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 7: Data Privacy */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">7. Data Privacy</h2>
                <div className="space-y-2">
                  <p>
                    <strong>7.1 Privacy Policy:</strong> The Resort is committed to protecting your
                    personal information in accordance with the Data Privacy Act of 2012 (Republic
                    Act No. 10173).
                  </p>
                  <p>
                    <strong>7.2 Data Collection:</strong> We collect personal information necessary
                    to process your booking and provide our services. For detailed information about
                    how we collect, use, and protect your data, please refer to our{" "}
                    <a href="/privacy-policy" className="text-primary underline">
                      Privacy Policy
                    </a>
                    .
                  </p>
                  <p>
                    <strong>7.3 Consent:</strong> By making a booking, you consent to the collection
                    and processing of your personal information as described in our Privacy Policy
                    and as required to fulfill our contractual obligations.
                  </p>
                  <p>
                    <strong>7.4 Your Rights:</strong> You have the right to access, correct, or
                    request deletion of your personal information, subject to legal and contractual
                    requirements. Contact our Data Protection Officer for privacy-related concerns.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 8: Dispute Resolution */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">8. Dispute Resolution</h2>
                <div className="space-y-2">
                  <p>
                    <strong>8.1 Governing Law:</strong> These Terms and Conditions shall be governed
                    by and construed in accordance with the laws of the Republic of the Philippines.
                  </p>
                  <p>
                    <strong>8.2 Jurisdiction:</strong> Any disputes arising from or related to these
                    terms shall be subject to the exclusive jurisdiction of the courts of the
                    Philippines.
                  </p>
                  <p>
                    <strong>8.3 Good Faith Resolution:</strong> In the event of any dispute, both
                    parties agree to first attempt to resolve the matter through good faith
                    negotiations.
                  </p>
                  <p>
                    <strong>8.4 Mediation:</strong> If direct negotiations fail, parties agree to
                    participate in mediation before pursuing formal legal action.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Section 9: Miscellaneous */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">9. Miscellaneous</h2>
                <div className="space-y-2">
                  <p>
                    <strong>9.1 Severability:</strong> If any provision of these terms is found to
                    be invalid or unenforceable, the remaining provisions shall remain in full force
                    and effect.
                  </p>
                  <p>
                    <strong>9.2 Entire Agreement:</strong> These Terms and Conditions, together with
                    our Privacy Policy, constitute the entire agreement between you and the Resort
                    regarding your booking.
                  </p>
                  <p>
                    <strong>9.3 Waiver:</strong> Failure by the Resort to enforce any provision of
                    these terms shall not constitute a waiver of that provision or any other
                    provision.
                  </p>
                  <p>
                    <strong>9.4 Assignment:</strong> You may not assign or transfer your rights or
                    obligations under these terms without the Resort's prior written consent.
                  </p>
                </div>
              </section>

              <Separator />

              {/* Contact Information */}
              <section>
                <h2 className="mb-3 text-lg font-semibold">10. Contact Information</h2>
                <div className="space-y-2">
                  <p>For questions or concerns regarding these Terms and Conditions:</p>
                  <div className="bg-muted mt-2 rounded-md p-4">
                    <p className="font-semibold">Okaeri Resort</p>
                    <PolicyContactChannels channels={contactChannels} className="mt-2" />
                  </div>
                </div>
              </section>

              <Separator />

              {/* Footer */}
              <div className="bg-background rounded-lg border p-4 text-center">
                <p className="font-medium">Thank you for choosing Okaeri Resort</p>
                <p className="mt-2">
                  By proceeding with your booking, you acknowledge that you have read, understood,
                  and agree to be bound by these Terms and Conditions.
                </p>
                <p className="text-muted-foreground mt-4 text-xs">Last Updated: October 20, 2025</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </GuestLayout>
  );
}
