import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Privacy Policy</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-sm dark:prose-invert">
        <p className="text-muted-foreground text-sm">Last updated: April 10, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          Car Share Cyprus ("we", "our", "us") operates the Car Share Cyprus mobile application
          and website (the "Service"). This Privacy Policy explains how we collect, use, and
          protect your personal information when you use our Service.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>Account Information</h3>
        <ul>
          <li>Full name and email address (required for registration)</li>
          <li>Phone number (optional, shared only with confirmed ride participants)</li>
          <li>Profile photo (optional)</li>
        </ul>

        <h3>Ride Information</h3>
        <ul>
          <li>Departure and arrival cities</li>
          <li>Departure times and dates</li>
          <li>Vehicle details (make, color)</li>
          <li>Ride preferences (smoking, pets, luggage)</li>
          <li>Pricing information</li>
        </ul>

        <h3>Location Data</h3>
        <ul>
          <li>We may request access to your device's location to show nearby rides and display maps.</li>
          <li>Location access is optional and can be denied without affecting core functionality.</li>
          <li>We do not track your location in the background.</li>
        </ul>

        <h3>Payment Information</h3>
        <ul>
          <li>Payments are processed securely by <strong>Stripe</strong>. We do not store your credit card details.</li>
          <li>We store transaction amounts, booking references, and payment status for record-keeping.</li>
        </ul>

        <h3>Communications</h3>
        <ul>
          <li>In-app messages between ride participants are stored to facilitate ride coordination.</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To create and manage your account</li>
          <li>To facilitate ride matching between drivers and passengers</li>
          <li>To process payments and manage bookings</li>
          <li>To enable communication between ride participants</li>
          <li>To send notifications about your rides and bookings</li>
          <li>To calculate and display ratings and reviews</li>
          <li>To verify driver identities and documents</li>
          <li>To resolve disputes between users</li>
        </ul>

        <h2>4. Information Sharing</h2>
        <p>We share your information only in the following cases:</p>
        <ul>
          <li><strong>With ride participants:</strong> Your name, rating, and profile photo are visible to other users. Phone numbers are shared only after a booking is confirmed.</li>
          <li><strong>Payment processor:</strong> Stripe receives necessary payment details to process transactions.</li>
          <li><strong>Email provider:</strong> We use Resend to send transactional emails (booking confirmations, notifications).</li>
          <li><strong>Legal requirements:</strong> We may disclose information if required by law.</li>
        </ul>
        <p>We do <strong>not</strong> sell your personal data to third parties.</p>

        <h2>5. Data Storage & Security</h2>
        <ul>
          <li>Your data is stored securely using Supabase with row-level security policies.</li>
          <li>All data transmission is encrypted via HTTPS/TLS.</li>
          <li>Authentication tokens are stored securely on your device.</li>
          <li>Driver verification documents are stored in encrypted storage buckets.</li>
        </ul>

        <h2>6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate information via your profile settings</li>
          <li>Delete your account and associated data</li>
          <li>Withdraw consent for optional data processing (e.g., location access)</li>
          <li>Export your data</li>
        </ul>

        <h2>7. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. Ride and payment records
          are kept for a reasonable period for legal and dispute resolution purposes.
          You can request account deletion by contacting us.
        </p>

        <h2>8. Children's Privacy</h2>
        <p>
          Our Service is not intended for users under the age of 18. We do not knowingly
          collect personal information from children.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any
          material changes through the app or by email.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy or your personal data,
          please contact us at:
        </p>
        <ul>
          <li>Email: <a href="mailto:privacy@carsharecyprus.com">privacy@carsharecyprus.com</a></li>
        </ul>
      </main>
    </div>
  );
};

export default Privacy;
