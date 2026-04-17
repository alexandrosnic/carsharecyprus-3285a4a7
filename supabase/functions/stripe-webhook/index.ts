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

        // Mark booking as held in escrow + compute auto-release time
        // (departure + estimated travel time + 24h grace window)
        const { data: rideRow } = await supabaseClient
          .from('rides')
          .select('departure_time, departure_city, arrival_city')
          .eq('id', ride_id)
          .single()

        // Static travel time table (mirror of src/constants/travelTimes.ts) — minutes
        const travelTimes: Record<string, Record<string, number>> = {
          'Nicosia': { 'Limassol': 75, 'Larnaca': 50, 'Paphos': 150, 'Famagusta': 65, 'Kyrenia': 30, 'Protaras': 80, 'Ayia Napa': 85, 'Troodos': 75, 'Polis': 170, 'Paralimni': 75 },
          'Limassol': { 'Nicosia': 75, 'Larnaca': 70, 'Paphos': 70, 'Famagusta': 130, 'Kyrenia': 100, 'Protaras': 140, 'Ayia Napa': 145, 'Troodos': 45, 'Polis': 110, 'Paralimni': 135 },
          'Larnaca': { 'Nicosia': 50, 'Limassol': 70, 'Paphos': 140, 'Famagusta': 55, 'Kyrenia': 80, 'Protaras': 45, 'Ayia Napa': 50, 'Troodos': 100, 'Polis': 175, 'Paralimni': 40 },
          'Paphos': { 'Nicosia': 150, 'Limassol': 70, 'Larnaca': 140, 'Famagusta': 200, 'Kyrenia': 175, 'Protaras': 195, 'Ayia Napa': 200, 'Troodos': 80, 'Polis': 40, 'Paralimni': 190 },
          'Famagusta': { 'Nicosia': 65, 'Limassol': 130, 'Larnaca': 55, 'Paphos': 200, 'Kyrenia': 80, 'Protaras': 20, 'Ayia Napa': 15, 'Troodos': 130, 'Polis': 220, 'Paralimni': 15 },
          'Kyrenia': { 'Nicosia': 30, 'Limassol': 100, 'Larnaca': 80, 'Paphos': 175, 'Famagusta': 80, 'Protaras': 100, 'Ayia Napa': 105, 'Troodos': 95, 'Polis': 190, 'Paralimni': 95 },
          'Protaras': { 'Nicosia': 80, 'Limassol': 140, 'Larnaca': 45, 'Paphos': 195, 'Famagusta': 20, 'Kyrenia': 100, 'Ayia Napa': 10, 'Troodos': 140, 'Polis': 220, 'Paralimni': 5 },
          'Ayia Napa': { 'Nicosia': 85, 'Limassol': 145, 'Larnaca': 50, 'Paphos': 200, 'Famagusta': 15, 'Kyrenia': 105, 'Protaras': 10, 'Troodos': 145, 'Polis': 220, 'Paralimni': 10 },
          'Troodos': { 'Nicosia': 75, 'Limassol': 45, 'Larnaca': 100, 'Paphos': 80, 'Famagusta': 130, 'Kyrenia': 95, 'Protaras': 140, 'Ayia Napa': 145, 'Polis': 100, 'Paralimni': 135 },
          'Polis': { 'Nicosia': 170, 'Limassol': 110, 'Larnaca': 175, 'Paphos': 40, 'Famagusta': 220, 'Kyrenia': 190, 'Protaras': 220, 'Ayia Napa': 220, 'Troodos': 100, 'Paralimni': 215 },
          'Paralimni': { 'Nicosia': 75, 'Limassol': 135, 'Larnaca': 40, 'Paphos': 190, 'Famagusta': 15, 'Kyrenia': 95, 'Protaras': 5, 'Ayia Napa': 10, 'Troodos': 135, 'Polis': 215 },
        }
        const travelMinutes = travelTimes[rideRow?.departure_city ?? '']?.[rideRow?.arrival_city ?? ''] ?? 90
        const departure = new Date(rideRow?.departure_time ?? Date.now())
        const autoReleaseAt = new Date(departure.getTime() + (travelMinutes + 24 * 60) * 60 * 1000).toISOString()

        const { error: holdError } = await supabaseClient
          .from('bookings')
          .update({ payout_status: 'held', auto_release_at: autoReleaseAt })
          .eq('id', bookingId as string)

        if (holdError) {
          console.error('Error setting escrow hold:', holdError)
        }

        console.log('Booking confirmed and escrow held:', { bookingId, autoReleaseAt })
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