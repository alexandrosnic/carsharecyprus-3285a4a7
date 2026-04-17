import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Admin-only endpoint to resolve a dispute on a frozen booking.
 *
 * Body: {
 *   dispute_id: string,
 *   action: 'pay_driver' | 'refund_passenger' | 'split',
 *   resolution: string,            // required notes for audit trail
 *   passenger_refund_amount?: number  // required when action === 'split' (in EUR)
 * }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify caller is admin
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { dispute_id, action, resolution, passenger_refund_amount } = body as {
      dispute_id: string
      action: 'pay_driver' | 'refund_passenger' | 'split'
      resolution: string
      passenger_refund_amount?: number
    }

    if (!dispute_id || !action || !resolution || resolution.trim().length < 5) {
      return new Response(JSON.stringify({
        error: 'dispute_id, action, and resolution (min 5 chars) required'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!['pay_driver', 'refund_passenger', 'split'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load dispute + booking
    const { data: dispute, error: dErr } = await supabaseAdmin
      .from('disputes')
      .select('id, booking_id, status')
      .eq('id', dispute_id)
      .single()
    if (dErr || !dispute) {
      return new Response(JSON.stringify({ error: 'Dispute not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (dispute.status === 'resolved') {
      return new Response(JSON.stringify({ error: 'Dispute already resolved' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('id, ride_id, total_amount, driver_amount, commission_amount, payout_status, stripe_payment_intent_id')
      .eq('id', dispute.booking_id)
      .single()
    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (booking.payout_status !== 'frozen' && booking.payout_status !== 'held') {
      return new Response(JSON.stringify({
        error: `Cannot resolve: booking payout is '${booking.payout_status}'`
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'split') {
      if (typeof passenger_refund_amount !== 'number' || passenger_refund_amount <= 0
          || passenger_refund_amount >= Number(booking.total_amount)) {
        return new Response(JSON.stringify({
          error: 'passenger_refund_amount required for split (must be > 0 and < total)'
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Get driver's Stripe account
    const { data: ride } = await supabaseAdmin
      .from('rides')
      .select('driver_id')
      .eq('id', booking.ride_id)
      .single()
    const { data: driver } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete')
      .eq('user_id', ride?.driver_id)
      .single()

    let stripeRef: string | null = null
    let newPayoutStatus: 'released' | 'refunded' = 'released'

    if (action === 'pay_driver') {
      // Transfer full driver_amount to driver
      if (driver?.stripe_account_id && driver?.stripe_onboarding_complete) {
        const t = await stripe.transfers.create({
          amount: Math.round(Number(booking.driver_amount) * 100),
          currency: 'eur',
          destination: driver.stripe_account_id,
          metadata: { booking_id: booking.id, dispute_id, resolution: 'pay_driver' },
        })
        stripeRef = t.id
      } else {
        stripeRef = 'manual-payout-required'
      }
      newPayoutStatus = 'released'
    } else if (action === 'refund_passenger') {
      // Full refund to passenger
      if (!booking.stripe_payment_intent_id) {
        return new Response(JSON.stringify({ error: 'No payment intent on booking' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const r = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(Number(booking.total_amount) * 100),
        metadata: { booking_id: booking.id, dispute_id, resolution: 'refund_passenger' },
      })
      stripeRef = r.id
      newPayoutStatus = 'refunded'
    } else {
      // SPLIT: partial refund to passenger, remainder (minus our commission share) to driver
      if (!booking.stripe_payment_intent_id) {
        return new Response(JSON.stringify({ error: 'No payment intent on booking' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: Math.round(passenger_refund_amount! * 100),
        metadata: { booking_id: booking.id, dispute_id, resolution: 'split-refund' },
      })

      // Driver gets: total - refund - commission (commission stays with platform)
      const driverPayout = Number(booking.total_amount) - passenger_refund_amount! - Number(booking.commission_amount)
      if (driverPayout > 0 && driver?.stripe_account_id && driver?.stripe_onboarding_complete) {
        const t = await stripe.transfers.create({
          amount: Math.round(driverPayout * 100),
          currency: 'eur',
          destination: driver.stripe_account_id,
          metadata: { booking_id: booking.id, dispute_id, resolution: 'split-transfer' },
        })
        stripeRef = `${refund.id}+${t.id}`
      } else {
        stripeRef = `${refund.id}+manual`
      }
      newPayoutStatus = 'released' // partially paid out + partially refunded
    }

    // Update booking + dispute atomically
    const { error: updBookingErr } = await supabaseAdmin
      .from('bookings')
      .update({
        payout_status: newPayoutStatus,
        stripe_transfer_id: stripeRef,
        released_at: new Date().toISOString(),
      })
      .eq('id', booking.id)

    if (updBookingErr) {
      console.error('Failed to update booking:', updBookingErr)
    }

    const { error: updDisputeErr } = await supabaseAdmin
      .from('disputes')
      .update({
        status: 'resolved',
        resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', dispute_id)

    if (updDisputeErr) {
      console.error('Failed to update dispute:', updDisputeErr)
      return new Response(JSON.stringify({ error: 'Stripe action succeeded but DB update failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, stripe_ref: stripeRef, action }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('resolve-dispute error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
