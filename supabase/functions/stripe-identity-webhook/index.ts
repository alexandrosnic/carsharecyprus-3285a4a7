// Stripe webhook for identity.verification_session.* events.
// Configure in Stripe Dashboard with endpoint:
//   https://<project>.supabase.co/functions/v1/stripe-identity-webhook
// Set the signing secret as STRIPE_IDENTITY_WEBHOOK_SECRET.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!signature || !secret || !stripeKey) {
    return new Response("Missing config", { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret);
  } catch (e: any) {
    console.error("Webhook signature verification failed:", e.message);
    return new Response(`Webhook Error: ${e.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Idempotency
  const { data: existing } = await supabase
    .from("stripe_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
    });
  }
  await supabase.from("stripe_events").insert({ event_id: event.id });

  try {
    if (
      event.type === "identity.verification_session.verified" ||
      event.type === "identity.verification_session.requires_input" ||
      event.type === "identity.verification_session.processing" ||
      event.type === "identity.verification_session.canceled"
    ) {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const userId = session.metadata?.user_id;
      if (!userId) {
        console.error("No user_id in metadata", session.id);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      if (event.type === "identity.verification_session.verified") {
        await supabase
          .from("profiles")
          .update({
            id_verified: true,
            id_verification_status: "verified",
            id_verified_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        console.log(`User ${userId} verified ✅`);
      } else if (event.type === "identity.verification_session.requires_input") {
        // Failure — driver needs to take action OR we mark for manual review
        const reason =
          session.last_error?.reason ||
          session.last_error?.code ||
          "verification_failed";

        await supabase
          .from("profiles")
          .update({ id_verification_status: "manual_review" })
          .eq("user_id", userId);

        // Insert into manual review queue
        await supabase.from("id_verification_reviews").insert({
          user_id: userId,
          stripe_identity_session_id: session.id,
          status: "pending",
          failure_reason: reason,
        });
        console.log(`User ${userId} → manual review (${reason})`);
      } else if (event.type === "identity.verification_session.processing") {
        await supabase
          .from("profiles")
          .update({ id_verification_status: "pending" })
          .eq("user_id", userId);
      } else if (event.type === "identity.verification_session.canceled") {
        // Keep as paid — they paid but cancelled the flow; they can retry
        console.log(`Verification cancelled for user ${userId}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (e: any) {
    console.error("Webhook handler error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
