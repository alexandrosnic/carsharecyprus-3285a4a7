import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Records a no-show report. Freezes payout for admin review.
 *
 * Body: { booking_id: string, no_show_type: 'driver' | 'passenger' }
 *
 * Authorization rules (enforced in DB function `report_no_show`):
 *   - Only the passenger can report a driver no-show
 *   - Only the driver can report a passenger no-show
 *   - Cannot report before scheduled departure time
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

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const body = await req.json().catch(() => ({}))
    const { booking_id, no_show_type } = body as { booking_id?: string; no_show_type?: string }

    if (!booking_id || !no_show_type || !['driver', 'passenger'].includes(no_show_type)) {
      return new Response(JSON.stringify({ error: 'booking_id and no_show_type ("driver"|"passenger") required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { error } = await supabaseUser.rpc('report_no_show', {
      p_booking_id: booking_id,
      p_no_show_type: no_show_type,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('report-no-show error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
