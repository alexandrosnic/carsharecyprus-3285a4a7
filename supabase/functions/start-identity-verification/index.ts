// Called from /verification-success after Stripe Checkout payment confirms.
// Creates a Stripe Identity VerificationSession and returns its URL.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Invalid auth");
    const user = userData.user;

    const { checkout_session_id } = await req.json();
    if (!checkout_session_id) throw new Error("checkout_session_id required");

    // Verify the Stripe Checkout session is paid and belongs to this user
    const checkoutSession = await stripe.checkout.sessions.retrieve(checkout_session_id);
    if (checkoutSession.payment_status !== "paid")
      throw new Error("Payment not completed");
    if (checkoutSession.metadata?.user_id !== user.id)
      throw new Error("Session does not belong to user");
    if (checkoutSession.metadata?.type !== "identity_verification")
      throw new Error("Wrong session type");

    // Mark profile as paid
    const { data: profile } = await supabase
      .from("profiles")
      .select("id_verification_status, stripe_identity_session_id, id_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.id_verified) {
      return new Response(JSON.stringify({ already_verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reuse existing Identity session if still active
    let verificationSession;
    if (profile?.stripe_identity_session_id) {
      try {
        const existing = await stripe.identity.verificationSessions.retrieve(
          profile.stripe_identity_session_id
        );
        if (
          existing.status === "requires_input" ||
          existing.status === "processing"
        ) {
          verificationSession = existing;
        }
      } catch {
        // ignore, create new
      }
    }

    if (!verificationSession) {
      const origin = req.headers.get("origin") || "https://carsharecyprus.lovable.app";
      verificationSession = await stripe.identity.verificationSessions.create({
        type: "document",
        metadata: {
          user_id: user.id,
          checkout_session_id,
        },
        return_url: `${origin}/profile?verification=processing`,
      });
    }

    await supabase
      .from("profiles")
      .update({
        id_verification_status: "paid",
        id_verification_paid_at: new Date().toISOString(),
        stripe_identity_session_id: verificationSession.id,
        stripe_verification_payment_intent_id:
          (checkoutSession.payment_intent as string) ?? null,
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        url: verificationSession.url,
        client_secret: verificationSession.client_secret,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    console.error("start-identity-verification error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
