import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardContent className="prose prose-invert max-w-none p-8 space-y-6">
            <header>
              <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </header>

            <section>
              <h2 className="text-xl font-semibold mt-6">1. Who we are</h2>
              <p>
                Car Share Cyprus ("the platform", "we") operates a peer-to-peer
                ride-sharing marketplace for cost-sharing journeys within
                Cyprus. We are an intermediary — drivers are not our employees,
                and journeys are private agreements between driver and passenger.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">2. Eligibility</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must be at least 18 years old.</li>
                <li>You must provide accurate name, email, phone, and (for drivers) license, insurance, and vehicle details.</li>
                <li>Drivers must complete document and Stripe Connect verification before publishing rides.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">3. Pricing & commission</h2>
              <p>
                Prices are set by drivers and are inclusive of all costs. The
                platform charges a <strong>10% commission</strong> on every booking,
                deducted automatically from the total fare. The remaining 90%
                is paid to the driver after the dispute window closes.
              </p>
            </section>

            <section className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <h2 className="text-xl font-semibold mt-0 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                4. Payments, escrow & 24-hour dispute window
              </h2>
              <p>
                When you book a seat, your card is charged immediately and the
                full amount is held in escrow on the platform's Stripe balance.
                Funds are released to the driver when <strong>either</strong>:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You tap <strong>"I arrived — release payment"</strong> in My Trips, OR</li>
                <li><strong>24 hours pass</strong> after the scheduled arrival time without a dispute being filed.</li>
              </ul>
              <p className="font-semibold mt-3">
                ⚠️ Important: You have <strong>24 hours from the scheduled arrival
                time</strong> to file a dispute via "Report a Problem" on your
                booking. After this window, funds are automatically released to
                the driver and the booking is considered successfully completed.
              </p>
              <p>
                By booking a ride you expressly agree to this 24-hour dispute
                window and waive your right to chargeback for any issue not
                raised within this period through the in-app dispute system.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">5. Disputes</h2>
              <p>
                Disputes raised within the window freeze the driver's payout.
                A platform admin reviews evidence from both parties and
                resolves the dispute by:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Releasing funds to the driver, OR</li>
                <li>Issuing a full refund to the passenger, OR</li>
                <li>Splitting the amount (partial refund + partial payout).</li>
              </ul>
              <p>
                Decisions are final. Bypassing this process by initiating a
                bank chargeback may result in account suspension and recovery
                of fees.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">6. Cancellations & no-shows</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Passenger cancels &gt; 24h before departure:</strong> full refund.</li>
                <li><strong>Passenger cancels &lt; 24h before departure:</strong> no refund (driver retains full fare).</li>
                <li><strong>Driver cancels:</strong> full refund to passenger.</li>
                <li><strong>Passenger no-show:</strong> driver keeps the fare.</li>
                <li><strong>Driver no-show:</strong> passenger files a dispute for full refund.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">7. Driver responsibilities</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Hold a valid Cyprus driving licence and roadworthy vehicle.</li>
                <li>Hold valid insurance that covers paying passengers.</li>
                <li>Drive safely and lawfully; do not drive under the influence.</li>
                <li>Honour published pickup times and routes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">8. Passenger responsibilities</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Be ready at the agreed pickup point on time.</li>
                <li>Treat the driver, vehicle, and other passengers with respect.</li>
                <li>Not bring illegal items or substances.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">9. Liability</h2>
              <p>
                The platform is a marketplace and is not a party to the
                transport contract between driver and passenger. We do not own
                vehicles, employ drivers, or provide insurance. Our liability
                is limited to the commission earned on the disputed booking.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">10. Account termination</h2>
              <p>
                We may suspend or terminate accounts for fraud, abuse,
                repeated cancellations, chargebacks, or any breach of these
                terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">11. Changes to terms</h2>
              <p>
                We may update these terms. Continued use of the platform after
                changes are posted constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">12. Governing law</h2>
              <p>
                These terms are governed by the laws of the Republic of Cyprus.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-6">Contact</h2>
              <p>
                Questions? Reach us through the in-app help or via the email
                shown on the Privacy page.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
