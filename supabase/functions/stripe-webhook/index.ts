import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const body = await req.text()
    const signature = req.headers.get('stripe-signature') ?? ''

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
      )
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing webhook event:', event.type)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const metadata = session.metadata

      if (!metadata) {
        console.error('No metadata found in session')
        return new Response('No metadata', { status: 400, headers: corsHeaders })
      }

      const {
        ride_id,
        passenger_id,
        seats_booked,
        total_amount,
        commission_amount,
        driver_amount
      } = metadata

      console.log('Processing payment for ride booking:', {
        eventId: event.id,
        rideId: ride_id,
        passengerId: passenger_id,
        seatsBooked: seats_booked,
        totalAmount: total_amount,
        paymentIntentId: session.payment_intent
      })

      // Check for idempotency - prevent duplicate processing
      const { error: eventCheckError } = await supabaseClient
        .from('stripe_events')
        .insert({ event_id: event.id })

      if (eventCheckError) {
        if (eventCheckError.code === '23505') { // Unique constraint violation
          console.log('Event already processed, skipping:', event.id)
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } else {
          console.error('Error checking event idempotency:', eventCheckError)
          return new Response(
            JSON.stringify({ error: 'Failed to process payment' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      try {
        // Use atomic RPC to confirm booking and decrement seats
        const { data: bookingId, error: confirmError } = await supabaseClient
          .rpc('confirm_booking_and_decrement', {
            p_ride_id: ride_id,
            p_passenger_id: passenger_id,
            p_seats_booked: parseInt(seats_booked),
            p_total_amount: parseFloat(total_amount),
            p_commission_amount: parseFloat(commission_amount),
            p_driver_amount: parseFloat(driver_amount),
            p_stripe_payment_intent_id: session.payment_intent as string
          })

        if (confirmError) {
          console.error('Error confirming booking:', confirmError)
          return new Response(
            JSON.stringify({ error: 'Failed to confirm booking' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Booking confirmed successfully:', { bookingId })
      } catch (rpcError) {
        console.error('RPC error:', rpcError)
        return new Response(
          JSON.stringify({ error: 'Failed to process booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})