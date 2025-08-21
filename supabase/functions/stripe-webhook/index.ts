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

      console.log('Creating booking for successful payment:', {
        rideId: ride_id,
        passengerId: passenger_id,
        seatsBooked: seats_booked,
        totalAmount: total_amount
      })

      // Create booking record
      const { error: bookingError } = await supabaseClient
        .from('bookings')
        .insert({
          ride_id,
          passenger_id,
          seats_booked: parseInt(seats_booked),
          total_amount: parseFloat(total_amount),
          commission_amount: parseFloat(commission_amount),
          driver_amount: parseFloat(driver_amount),
          status: 'confirmed',
          stripe_payment_intent_id: session.payment_intent as string
        })

      if (bookingError) {
        console.error('Error creating booking:', bookingError)
        return new Response(
          JSON.stringify({ error: 'Failed to create booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update ride available seats
      const { error: updateError } = await supabaseClient
        .from('rides')
        .update({ 
          available_seats: supabaseClient.rpc('decrement_seats', { 
            ride_id, 
            seats_to_book: parseInt(seats_booked) 
          })
        })
        .eq('id', ride_id)

      if (updateError) {
        console.error('Error updating ride seats:', updateError)
      }

      console.log('Booking created successfully')
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