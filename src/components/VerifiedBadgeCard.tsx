import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, ShieldCheck, TrendingUp, Clock, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  status: "none" | "paid" | "pending" | "verified" | "manual_review" | "failed" | string;
  verified: boolean;
}

export const VerifiedBadgeCard = ({ status, verified }: Props) => {
  const [loading, setLoading] = useState(false);

  const startVerification = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-identity-verification-checkout"
      );
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start verification");
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" />
            Verified Driver
            <Badge variant="secondary" className="ml-auto">Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your ID has been verified. Passengers see your Verified Badge across the app — this significantly improves your booking rate.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "manual_review") {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Verification under manual review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Stripe couldn't auto-verify your documents. Our team will review your photos manually within 24 hours. <strong>No need to pay again.</strong>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "pending" || status === "paid") {
    return (
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary animate-pulse" />
            Verification in progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {status === "paid"
              ? "Payment received. Continue to upload your ID."
              : "Stripe is processing your documents. You'll receive an update shortly."}
          </p>
          {status === "paid" && (
            <Button onClick={startVerification} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Continue verification
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Get your Verified Badge
          <Badge variant="outline" className="ml-auto">€4.95 one-time</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">
              <strong className="text-foreground">Verified drivers get significantly more bookings.</strong>{" "}
              <span className="text-muted-foreground">
                Passengers consistently choose verified drivers over unverified ones — it's the strongest trust signal on the platform.
              </span>
            </p>
          </div>
          <div className="flex items-start gap-2">
            <BadgeCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Your <strong className="text-foreground">Verified Badge</strong> appears on every ride card, search result, and your profile.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Quick & secure: ID check is handled by <strong className="text-foreground">Stripe Identity</strong>. Takes ~2 minutes from your phone.
            </p>
          </div>
        </div>

        <Button onClick={startVerification} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Redirecting to Stripe…
            </>
          ) : (
            <>
              <BadgeCheck className="h-4 w-4 mr-2" />
              Get Verified — €4.95
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          One-time fee. Secure payment via Stripe.
        </p>
      </CardContent>
    </Card>
  );
};

export default VerifiedBadgeCard;
