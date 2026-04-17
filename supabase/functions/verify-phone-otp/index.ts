import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MAX_VERIFY_ATTEMPTS = 5;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: 'Invalid code format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Get latest unconsumed code for this user
    const { data: otp, error: fetchErr } = await admin
      .from('phone_otp_codes')
      .select('id, code_hash, expires_at, attempts, phone_number, consumed_at')
      .eq('user_id', userId)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !otp) {
      return new Response(JSON.stringify({ error: 'No active code. Please request a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'Code expired. Please request a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((otp.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      // Burn the code
      await admin
        .from('phone_otp_codes')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', otp.id);
      return new Response(JSON.stringify({ error: 'Too many attempts. Please request a new code.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const codeHash = await sha256Hex(code);
    if (codeHash !== otp.code_hash) {
      await admin
        .from('phone_otp_codes')
        .update({ attempts: (otp.attempts ?? 0) + 1 })
        .eq('id', otp.id);
      return new Response(JSON.stringify({ error: 'Incorrect code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Success: consume code + mark profile verified
    await admin
      .from('phone_otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otp.id);

    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        phone_number: otp.phone_number,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (profileErr) {
      console.error('Failed to update profile:', profileErr);
      return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('verify-phone-otp unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
