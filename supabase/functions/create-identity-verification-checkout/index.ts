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

    // Block if already verified
    const { data: profile } = await supabase
      .from("profiles")
      .select("id_verified, id_verification_status, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.id_verified) {
      return new Response(JSON.stringify({ error: "Already verified" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://carsharecyprus.lovable.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: 495, // €4.95
            product_data: {
              name: "CarShare CY — Verified Driver Badge",
              description:
                "One-time identity verification fee. Get a Verified Badge that significantly increases passenger trust and bookings.",
            },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      metadata: {
        type: "identity_verification",
        user_id: user.id,
      },
      success_url: `${origin}/verification-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/profile?verification=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("create-identity-verification-checkout error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
