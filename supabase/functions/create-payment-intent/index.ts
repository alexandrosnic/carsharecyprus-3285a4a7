import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentRequest {
  ride_id: string;
  seats_booked: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { ride_id, seats_booked }: PaymentRequest = await req.json()

    if (!ride_id || !seats_booked || seats_booked < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get ride details
    const { data: ride, error: rideError } = await supabaseClient
      .from('rides')
      .select('*')
      .eq('id', ride_id)
      .single()

    if (rideError || !ride) {
      return new Response(
        JSON.stringify({ error: 'Ride not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check seat availability
    if (ride.available_seats < seats_booked) {
      return new Response(
        JSON.stringify({ error: 'Insufficient seats available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate amounts
    const totalAmount = Math.round(ride.price_per_seat * seats_booked * 100) // Convert to cents
    const commissionAmount = Math.round(totalAmount * 0.10) // 10% commission
    const driverAmount = totalAmount - commissionAmount

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // ESCROW MODEL: Funds are charged to the platform Stripe balance and held there.
    // They are only transferred to the driver after the ride is confirmed completed
    // (via passenger "I arrived" tap or 24h auto-release after scheduled arrival).
    // This is handled by the `release-funds` and `auto-release-funds` edge functions.
    const sessionParams: any = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Carpool: ${ride.departure_city} → ${ride.arrival_city}`,
              description: `${seats_booked} seat(s) for ${new Date(ride.departure_time).toLocaleDateString()}`,
            },
            unit_amount: Math.round(ride.price_per_seat * 100),
          },
          quantity: seats_booked,
        },
      ],
      mode: 'payment',
      success_url: `https://carsharecyprus.lovable.app/my-trips?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://carsharecyprus.lovable.app/ride/${ride_id}?payment=cancelled`,
      metadata: {
        ride_id,
        passenger_id: user.id,
        seats_booked: seats_booked.toString(),
        total_amount: (totalAmount / 100).toString(),
        commission_amount: (commissionAmount / 100).toString(),
        driver_amount: (driverAmount / 100).toString(),
      },
    }

    console.log('Escrow checkout: funds will be held on platform until ride confirmation')

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionParams)

    console.log('Payment session created:', {
      sessionId: session.id,
      rideId: ride_id,
      passengerId: user.id,
      amount: totalAmount / 100
    })

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url,
        amount: totalAmount / 100
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('Error in create-payment-intent:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})