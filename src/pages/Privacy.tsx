import { ArrowLeft, Shield, Database, MapPin, CreditCard, MessageSquare, Share2, Lock, UserCheck, Clock, Baby, RefreshCw, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const sections = [
  { id: "introduction", title: "1. Introduction", icon: Shield },
  { id: "information-we-collect", title: "2. Information We Collect", icon: Database },
  { id: "how-we-use", title: "3. How We Use Your Information", icon: UserCheck },
  { id: "sharing", title: "4. Information Sharing", icon: Share2 },
  { id: "security", title: "5. Data Storage & Security", icon: Lock },
  { id: "your-rights", title: "6. Your Rights", icon: UserCheck },
  { id: "retention", title: "7. Data Retention", icon: Clock },
  { id: "children", title: "8. Children's Privacy", icon: Baby },
  { id: "changes", title: "9. Changes to This Policy", icon: RefreshCw },
  { id: "contact", title: "10. Contact Us", icon: Mail },
];

const Section = ({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-20">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-xl font-semibold text-foreground m-0">{title}</h2>
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3 pl-1">
      {children}
    </div>
  </section>
);

const SubHeading = ({ icon: Icon, children }: { icon?: any; children: React.ReactNode }) => (
  <h3 className="text-base font-semibold text-foreground mt-5 mb-2 flex items-center gap-2">
    {Icon && <Icon className="h-4 w-4 text-primary" />}
    {children}
  </h3>
);

const BulletList = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="space-y-1.5 list-none pl-0">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2">
        <span className="text-primary mt-1.5 shrink-0">•</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

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

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h2>
          <p className="text-sm text-muted-foreground">
            Your privacy matters. Here's how Car Share Cyprus handles your data.
          </p>
          <p className="text-xs text-muted-foreground mt-2">Last updated: April 10, 2026</p>
        </div>

        {/* Table of contents */}
        <Card className="mb-8 border-border/60">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">On this page</h3>
            <nav className="grid sm:grid-cols-2 gap-1.5">
              {sections.map(({ id, title, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{title}</span>
                </a>
              ))}
            </nav>
          </CardContent>
        </Card>

        <div className="space-y-10">
          <Section id="introduction" icon={Shield} title="1. Introduction">
            <p>
              Car Share Cyprus ("we", "our", "us") operates the Car Share Cyprus mobile application
              and website (the "Service"). This Privacy Policy explains how we collect, use, and
              protect your personal information when you use our Service.
            </p>
          </Section>

          <Separator />

          <Section id="information-we-collect" icon={Database} title="2. Information We Collect">
            <SubHeading icon={UserCheck}>Account Information</SubHeading>
            <BulletList items={[
              "Full name and email address (required for registration)",
              "Phone number (optional, shared only with confirmed ride participants)",
              "Profile photo (optional)",
            ]} />

            <SubHeading icon={MapPin}>Ride Information</SubHeading>
            <BulletList items={[
              "Departure and arrival cities",
              "Departure times and dates",
              "Vehicle details (make, color)",
              "Ride preferences (smoking, pets, luggage)",
              "Pricing information",
            ]} />

            <SubHeading icon={MapPin}>Location Data</SubHeading>
            <BulletList items={[
              "We may request access to your device's location to show nearby rides and display maps.",
              "Location access is optional and can be denied without affecting core functionality.",
              "We do not track your location in the background.",
            ]} />

            <SubHeading icon={CreditCard}>Payment Information</SubHeading>
            <BulletList items={[
              <>Payments are processed securely by <strong className="text-foreground">Stripe</strong>. We do not store your credit card details.</>,
              "We store transaction amounts, booking references, and payment status for record-keeping.",
            ]} />

            <SubHeading icon={MessageSquare}>Communications</SubHeading>
            <BulletList items={[
              "In-app messages between ride participants are stored to facilitate ride coordination.",
            ]} />
          </Section>

          <Separator />

          <Section id="how-we-use" icon={UserCheck} title="3. How We Use Your Information">
            <BulletList items={[
              "To create and manage your account",
              "To facilitate ride matching between drivers and passengers",
              "To process payments and manage bookings",
              "To enable communication between ride participants",
              "To send notifications about your rides and bookings",
              "To calculate and display ratings and reviews",
              "To verify driver identities and documents",
              "To resolve disputes between users",
            ]} />
          </Section>

          <Separator />

          <Section id="sharing" icon={Share2} title="4. Information Sharing">
            <p>We share your information only in the following cases:</p>
            <BulletList items={[
              <><strong className="text-foreground">With ride participants:</strong> Your name, rating, and profile photo are visible to other users. Phone numbers are shared only after a booking is confirmed.</>,
              <><strong className="text-foreground">Payment processor:</strong> Stripe receives necessary payment details to process transactions.</>,
              <><strong className="text-foreground">Email provider:</strong> We use Resend to send transactional emails (booking confirmations, notifications).</>,
              <><strong className="text-foreground">Legal requirements:</strong> We may disclose information if required by law.</>,
            ]} />
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-foreground">
              We do <strong>not</strong> sell your personal data to third parties.
            </div>
          </Section>

          <Separator />

          <Section id="security" icon={Lock} title="5. Data Storage & Security">
            <BulletList items={[
              "Your data is stored securely using Supabase with row-level security policies.",
              "All data transmission is encrypted via HTTPS/TLS.",
              "Authentication tokens are stored securely on your device.",
              "Driver verification documents are stored in encrypted storage buckets.",
            ]} />
          </Section>

          <Separator />

          <Section id="your-rights" icon={UserCheck} title="6. Your Rights">
            <p>You have the right to:</p>
            <BulletList items={[
              "Access the personal data we hold about you",
              "Correct inaccurate information via your profile settings",
              "Delete your account and associated data",
              "Withdraw consent for optional data processing (e.g., location access)",
              "Export your data",
            ]} />
          </Section>

          <Separator />

          <Section id="retention" icon={Clock} title="7. Data Retention">
            <p>
              We retain your data for as long as your account is active. Ride and payment records
              are kept for a reasonable period for legal and dispute resolution purposes.
              You can request account deletion by contacting us.
            </p>
          </Section>

          <Separator />

          <Section id="children" icon={Baby} title="8. Children's Privacy">
            <p>
              Our Service is not intended for users under the age of 18. We do not knowingly
              collect personal information from children.
            </p>
          </Section>

          <Separator />

          <Section id="changes" icon={RefreshCw} title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes through the app or by email.
            </p>
          </Section>

          <Separator />

          <Section id="contact" icon={Mail} title="10. Contact Us">
            <p>
              If you have any questions about this Privacy Policy or your personal data,
              please contact us at:
            </p>
            <Card className="border-border/60 bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <a
                  href="mailto:privacy@carsharecyprus.com"
                  className="text-sm font-medium text-primary hover:underline break-all"
                >
                  privacy@carsharecyprus.com
                </a>
              </CardContent>
            </Card>
          </Section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
