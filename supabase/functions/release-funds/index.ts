import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Releases escrowed funds to the driver.
 *
 * Triggered by:
 *   1) Passenger tapping "I arrived" (auth'd user request, body: { booking_id })
 *   2) Auto-release cron job (service_role request, body: { booking_id, auto: true })
 *
 * Flow:
 *   - Verify booking is in `held` state (not frozen by a dispute, not already released)
 *   - Look up driver's connected Stripe account
 *   - Create a Stripe Transfer for the driver_amount (90% of total)
 *   - Mark booking as released via RPC
 *   - Platform retains commission_amount (10%) on its balance
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const { booking_id, auto } = body as { booking_id?: string; auto?: boolean }

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // If not an auto-release call, verify the caller is the passenger of this booking
    if (!auto) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data: { user } } = await supabaseUser.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Confirm caller owns the booking
      const { data: ownership } = await supabaseAdmin
        .from('bookings')
        .select('passenger_id')
        .eq('id', booking_id)
        .single()

      if (!ownership || ownership.passenger_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Mark passenger arrival confirmation
      await supabaseAdmin
        .from('bookings')
        .update({ passenger_confirmed_at: new Date().toISOString() })
        .eq('id', booking_id)
    }

    // Load booking details
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, ride_id, driver_amount, payout_status, stripe_payment_intent_id')
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (booking.payout_status !== 'held') {
      return new Response(JSON.stringify({
        error: `Cannot release: booking is in '${booking.payout_status}' state`
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get driver's connected Stripe account
    const { data: ride } = await supabaseAdmin
      .from('rides')
      .select('driver_id')
      .eq('id', booking.ride_id)
      .single()

    if (!ride) {
      return new Response(JSON.stringify({ error: 'Ride not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: driver } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', ride.driver_id)
      .single()

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    let transferId: string

    if (driver?.stripe_account_id && driver?.stripe_onboarding_complete) {
      // Transfer driver's share to their connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(booking.driver_amount) * 100),
        currency: 'eur',
        destination: driver.stripe_account_id,
        metadata: {
          booking_id: booking.id,
          ride_id: booking.ride_id,
          source_payment_intent: booking.stripe_payment_intent_id ?? '',
        },
        description: `Driver payout for booking ${booking.id}`,
      })
      transferId = transfer.id
      console.log('Stripe transfer created:', transferId, 'amount:', booking.driver_amount)
    } else {
      // Driver has no Connect account — funds remain on platform balance.
      // Mark released anyway with a placeholder; admin handles manual payout.
      transferId = 'manual-payout-required'
      console.warn('Driver has no Stripe Connect account — manual payout required for booking', booking.id)
    }

    // Mark booking as released
    const { error: markErr } = await supabaseAdmin.rpc('mark_booking_released', {
      p_booking_id: booking.id,
      p_stripe_transfer_id: transferId,
    })

    if (markErr) {
      console.error('Error marking booking released:', markErr)
      return new Response(JSON.stringify({ error: markErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      transfer_id: transferId,
      auto: !!auto,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('release-funds error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
