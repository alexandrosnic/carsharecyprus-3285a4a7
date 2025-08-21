import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    // Get request data and validate
    const body = await req.json();
    const { bookingId, amount, description } = body;

    // Server-side validation
    if (!bookingId || typeof bookingId !== 'string') {
      throw new Error('Invalid booking ID');
    }
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount');
    }

    // Create Supabase service client to validate booking
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Validate booking exists and belongs to the authenticated user
    const { data: booking, error: bookingError } = await supabaseService
      .from("bookings")
      .select(`
        *,
        rides!inner(price_per_seat, driver_id)
      `)
      .eq("id", bookingId)
      .eq("passenger_id", user.id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found or access denied');
    }

    // Validate the payment amount matches the booking
    const expectedAmount = booking.total_amount;
    if (Math.abs(amount - expectedAmount) > 0.01) {
      throw new Error(`Payment amount mismatch. Expected: ${expectedAmount}, received: ${amount}`);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if a Stripe customer record exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create a one-time payment session with validated data
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { 
              name: description || `Carpool Ride: ${booking.rides.driver_id}`,
              description: `Booking ID: ${bookingId}`
            },
            unit_amount: Math.round(expectedAmount * 100), // Use validated amount
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/my-trips?payment=success`,
      cancel_url: `${req.headers.get("origin")}/book-ride/${bookingId}?payment=canceled`,
      metadata: {
        booking_id: bookingId,
        user_id: user.id,
        validated_amount: expectedAmount.toString(),
      },
    });

    // Update booking with Stripe session ID (service client already created above)
    await supabaseService
      .from("bookings")
      .update({ 
        stripe_payment_intent_id: session.id,
        status: "pending_payment"
      })
      .eq("id", bookingId);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});