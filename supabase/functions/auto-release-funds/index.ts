import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cron-invoked function that finds all bookings whose escrow hold has matured
 * (auto_release_at <= now) and triggers `release-funds` for each one.
 *
 * Frozen bookings (disputes filed) are skipped — admins resolve those manually.
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

    const { data: ready, error } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('payout_status', 'held')
      .lte('auto_release_at', new Date().toISOString())
      .limit(100)

    if (error) throw error

    console.log(`auto-release: ${ready?.length ?? 0} booking(s) ready for release`)

    const results: Array<{ booking_id: string; ok: boolean; error?: string }> = []

    for (const b of ready ?? []) {
      try {
        const res = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/release-funds`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ booking_id: b.id, auto: true }),
          }
        )
        const json = await res.json()
        results.push({ booking_id: b.id, ok: res.ok, error: res.ok ? undefined : json.error })
      } catch (e: any) {
        results.push({ booking_id: b.id, ok: false, error: e.message })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('auto-release-funds error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
