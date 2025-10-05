import { Resend } from "resend";

interface BookingConfirmationData {
  to: string;
  bookingReference: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
}

interface UploadConfirmationData {
  to: string;
  guestName: string;
  bookingReference: string;
}

/**
 * Create Resend client
 * Can accept API key directly (for Cloudflare Functions) or use env var
 */
export function createResendClient(apiKey?: string): Resend {
  const key = apiKey || import.meta.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Missing RESEND_API_KEY");
  }
  return new Resend(key);
}

/**
 * Send booking confirmation email
 * Note: No email verification - admin pre-screening handles trust
 */
export async function sendBookingConfirmation(
  resend: Resend,
  data: BookingConfirmationData
): Promise<void> {
  const { to, bookingReference, guestName, checkIn, checkOut, totalAmount } = data;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; margin-top: 0; }
        .booking-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .cta-button { display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .warning { background: #fff9c4; border-left: 4px solid #fbc02d; padding: 10px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
          <p style="margin: 0;">Reference: <strong>${bookingReference}</strong></p>
        </div>

        <div class="content">
          <p>Dear ${guestName},</p>
          <p>Thank you for your booking! We have received your reservation request and are processing your payment proof.</p>

          <div class="booking-details">
            <h3 style="margin-top: 0;">Booking Details</h3>
            <div class="detail-row">
              <span><strong>Check-in:</strong></span>
              <span>${checkIn}</span>
            </div>
            <div class="detail-row">
              <span><strong>Check-out:</strong></span>
              <span>${checkOut}</span>
            </div>
            <div class="detail-row">
              <span><strong>Total Amount:</strong></span>
              <span>₱${totalAmount.toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <span><strong>Status:</strong></span>
              <span style="color: #f57c00;">Pending Verification</span>
            </div>
          </div>

          <div class="warning">
            <strong>Important:</strong> Please upload your payment proof within 1 hour to secure your booking.
          </div>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Upload your payment proof (if not already done)</li>
            <li>Wait for payment verification (usually within 24 hours)</li>
            <li>Receive final confirmation once payment is verified</li>
          </ol>

          <p>You can check your booking status anytime using your reference number: <strong>${bookingReference}</strong></p>
        </div>

        <div class="footer">
          <p>If you have any questions, please contact us at support@okaeri-resort.com</p>
          <p>© 2025 Okaeri Resort. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const { error } = await resend.emails.send({
    from: "Okaeri Resort <bookings@okaeri-resort.com>",
    to: [to],
    subject: `Booking Confirmation - ${bookingReference}`,
    html,
  });

  if (error) {
    console.error("Failed to send booking confirmation:", error);
    throw error;
  }
}

/**
 * Send upload confirmation email
 */
export async function sendUploadConfirmation(
  resend: Resend,
  data: UploadConfirmationData
): Promise<void> {
  const { to, guestName, bookingReference } = data;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4caf50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; }
        .success-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Payment Proof Received</h2>
        </div>

        <div class="content">
          <p>Dear ${guestName},</p>

          <div class="success-box">
            <strong>✓ Success!</strong> We have received your payment proof for booking ${bookingReference}.
          </div>

          <p>Our team will verify your payment within 24 hours and send you a final confirmation.</p>

          <p><strong>What happens next:</strong></p>
          <ul>
            <li>Our admin team will review your payment proof</li>
            <li>Once verified, your booking will be confirmed</li>
            <li>You'll receive a final confirmation email with check-in details</li>
          </ul>

          <p>If you have any questions, please don't hesitate to contact us.</p>
        </div>

        <div class="footer">
          <p>Thank you for choosing Okaeri Resort!</p>
          <p>© 2025 Okaeri Resort. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const { error } = await resend.emails.send({
    from: "Okaeri Resort <bookings@okaeri-resort.com>",
    to: [to],
    subject: `Payment Proof Received - ${bookingReference}`,
    html,
  });

  if (error) {
    console.error("Failed to send upload confirmation:", error);
    throw error;
  }
}
