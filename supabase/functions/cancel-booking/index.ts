import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cancels a booking with tiered refund based on time-to-departure.
 *
 * Refund tiers (passenger-initiated cancellation):
 *   - >24h before departure: 100% refund
 *   - 2-24h before departure: 50% refund
 *   - <2h before / after departure: 0% refund
 *
 * Driver-initiated cancellation: passenger always gets 100% refund.
 *
 * Body: { booking_id: string, reason?: string }
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

    const body = await req.json().catch(() => ({}))
    const { booking_id, reason } = body as { booking_id?: string; reason?: string }

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Load booking + ride
    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('id, ride_id, passenger_id, total_amount, status, payout_status, stripe_payment_intent_id, refund_status, seats_booked')
      .eq('id', booking_id)
      .single()

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (booking.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Booking already cancelled' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: ride } = await supabaseAdmin
      .from('rides')
      .select('driver_id, departure_time, available_seats')
      .eq('id', booking.ride_id)
      .single()

    if (!ride) {
      return new Response(JSON.stringify({ error: 'Ride not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Caller must be passenger or driver
    const isPassenger = user.id === booking.passenger_id
    const isDriver = user.id === ride.driver_id
    if (!isPassenger && !isDriver) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Compute refund percentage
    const departure = new Date(ride.departure_time).getTime()
    const now = Date.now()
    const hoursToDeparture = (departure - now) / (1000 * 60 * 60)

    let refundPct = 0
    if (isDriver) {
      // Driver cancels → full refund to passenger
      refundPct = 1
    } else {
      if (hoursToDeparture > 24) refundPct = 1
      else if (hoursToDeparture > 2) refundPct = 0.5
      else refundPct = 0
    }

    const total = Number(booking.total_amount)
    const refundAmount = Math.round(total * refundPct * 100) / 100

    // Process Stripe refund if payment was captured and refund > 0
    let refundId: string | null = null
    let refundStatus = 'none'

    if (refundAmount > 0 && booking.stripe_payment_intent_id) {
      try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
          apiVersion: '2023-10-16',
        })
        const refund = await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
          metadata: {
            booking_id: booking.id,
            cancelled_by: isDriver ? 'driver' : 'passenger',
            refund_pct: String(refundPct),
          },
        })
        refundId = refund.id
        refundStatus = 'refunded'
        console.log('Stripe refund created:', refundId, 'amount:', refundAmount)
      } catch (e: any) {
        console.error('Stripe refund failed:', e.message)
        refundStatus = 'failed'
      }
    } else if (refundAmount === 0) {
      refundStatus = 'none'
    }

    // If refund was full and funds were held, we don't release to driver. If partial,
    // remaining ($ - refund) stays available for driver release on auto-release tick
    // (driver still gets their share of the unrefunded portion, minus our 10% commission).
    // Simpler: when partial refund, freeze payout so admin reviews split.
    let newPayoutStatus = booking.payout_status
    if (refundPct === 1 && booking.payout_status === 'held') {
      newPayoutStatus = 'refunded'
    } else if (refundPct > 0 && refundPct < 1 && booking.payout_status === 'held') {
      newPayoutStatus = 'frozen'
    }

    // Update booking
    const { error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason ?? `Cancelled by ${isDriver ? 'driver' : 'passenger'}`,
        refund_amount: refundAmount,
        refund_status: refundStatus,
        stripe_refund_id: refundId,
        payout_status: newPayoutStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)

    if (updErr) throw updErr

    // Restore seats on the ride
    await supabaseAdmin
      .from('rides')
      .update({ available_seats: ride.available_seats + booking.seats_booked })
      .eq('id', booking.ride_id)

    return new Response(JSON.stringify({
      success: true,
      refund_amount: refundAmount,
      refund_pct: refundPct,
      refund_status: refundStatus,
      hours_to_departure: Math.round(hoursToDeparture * 10) / 10,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('cancel-booking error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
