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

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Check if driver already has a Stripe account
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete, full_name')
      .eq('user_id', user.id)
      .single()

    let accountId = profile?.stripe_account_id

    if (!accountId) {
      // Create new Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: { user_id: user.id },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
          email: user.email,
          first_name: profile?.full_name?.split(' ')[0] || undefined,
          last_name: profile?.full_name?.split(' ').slice(1).join(' ') || undefined,
        },
      })

      accountId = account.id

      // Save the account ID
      await supabaseClient
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('user_id', user.id)

      console.log('Created Stripe Connect account:', accountId, 'for user:', user.id)
    }

    // Get the request body for return/refresh URLs
    const body = await req.json().catch(() => ({}))
    const baseUrl = body.return_url || 'https://carsharecyprus.lovable.app/profile'

    // Check if onboarding is already complete
    const account = await stripe.accounts.retrieve(accountId)
    
    if (account.details_submitted) {
      // Onboarding complete — update DB and return dashboard link
      await supabaseClient
        .from('profiles')
        .update({ stripe_onboarding_complete: true })
        .eq('user_id', user.id)

      const loginLink = await stripe.accounts.createLoginLink(accountId)

      return new Response(
        JSON.stringify({ 
          type: 'dashboard',
          url: loginLink.url,
          onboarding_complete: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}?stripe=refresh`,
      return_url: `${baseUrl}?stripe=complete`,
      type: 'account_onboarding',
    })

    return new Response(
      JSON.stringify({ 
        type: 'onboarding',
        url: accountLink.url,
        onboarding_complete: false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in create-connect-account:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
