import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BadgeCheck, AlertCircle } from "lucide-react";

const VerificationSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("error");
      setError("Missing session ID");
      return;
    }

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "start-identity-verification",
          { body: { checkout_session_id: sessionId } }
        );
        if (fnError) throw fnError;

        if (data?.already_verified) {
          navigate("/profile?verification=already_verified");
          return;
        }

        if (data?.url) {
          setStatus("redirecting");
          window.location.href = data.url;
        } else {
          throw new Error("No verification URL returned");
        }
      } catch (e: any) {
        setStatus("error");
        setError(e.message || "Failed to start verification");
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <h1 className="text-xl font-semibold">Confirming your payment…</h1>
              <p className="text-sm text-muted-foreground">
                Just a moment while we set up your identity verification.
              </p>
            </>
          )}
          {status === "redirecting" && (
            <>
              <BadgeCheck className="h-12 w-12 mx-auto text-primary" />
              <h1 className="text-xl font-semibold">Redirecting to Stripe Identity…</h1>
              <p className="text-sm text-muted-foreground">
                You'll be asked to take a photo of your ID and a quick selfie.
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => navigate("/profile")}>Back to Profile</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificationSuccess;
