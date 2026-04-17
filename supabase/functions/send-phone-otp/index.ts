import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Cyprus + EU country codes (E.164 prefixes, no +)
const ALLOWED_COUNTRY_CODES = [
  '357', '43', '32', '359', '385', '420', '45', '372', '358', '33', '49',
  '30', '36', '353', '39', '371', '370', '352', '356', '31', '48', '351',
  '40', '421', '386', '34', '46',
];

const SENDER_ID = 'CarShareCY'; // Max 11 alphanumeric chars
const CODE_TTL_MINUTES = 5;
const MAX_SENDS_PER_HOUR = 3;

function normalizePhone(raw: string): string {
  // Strip everything but digits and leading +
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('00')) return '+' + trimmed.slice(2);
  return trimmed;
}

function validatePhone(phone: string): { ok: boolean; digits?: string; error?: string } {
  if (!phone.startsWith('+')) return { ok: false, error: 'Phone must start with + and country code' };
  const digits = phone.slice(1);
  if (!/^\d{7,15}$/.test(digits)) return { ok: false, error: 'Phone must contain 7-15 digits' };
  const matched = ALLOWED_COUNTRY_CODES.find((cc) => digits.startsWith(cc));
  if (!matched) return { ok: false, error: 'Only Cyprus and EU numbers are accepted' };
  return { ok: true, digits };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // --- Auth ---
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

    // --- Validate input ---
    const body = await req.json().catch(() => ({}));
    const phoneRaw = typeof body?.phone === 'string' ? body.phone : '';
    const phone = normalizePhone(phoneRaw);
    const check = validatePhone(phone);
    if (!check.ok) {
      return new Response(JSON.stringify({ error: check.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // --- Rate limit: max N sends per hour ---
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('phone_otp_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again in an hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --- Generate + hash code ---
    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    // Invalidate any prior unconsumed codes for this user
    await admin
      .from('phone_otp_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('consumed_at', null);

    const { error: insertErr } = await admin.from('phone_otp_codes').insert({
      user_id: userId,
      phone_number: phone,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insertErr) {
      console.error('Failed to store OTP code:', insertErr);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('phone_otp_attempts').insert({
      user_id: userId,
      phone_number: phone,
    });

    // --- Send via BudgetSMS ---
    const username = Deno.env.get('BUDGETSMS_USERNAME');
    const userid = Deno.env.get('BUDGETSMS_USERID');
    const handle = Deno.env.get('BUDGETSMS_HANDLE');
    if (!username || !userid || !handle) {
      console.error('Missing BudgetSMS credentials');
      return new Response(JSON.stringify({ error: 'SMS service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // BudgetSMS expects E.164 *without* the leading +
    const toNumber = check.digits!;
    const message = `Your CarShareCY verification code is ${code}. Valid for ${CODE_TTL_MINUTES} minutes.`;

    const url = new URL('https://api.budgetsms.net/sendsms/');
    url.searchParams.set('username', username);
    url.searchParams.set('userid', userid);
    url.searchParams.set('handle', handle);
    url.searchParams.set('from', SENDER_ID);
    url.searchParams.set('to', toNumber);
    url.searchParams.set('msg', message);

    const smsRes = await fetch(url.toString(), { method: 'GET' });
    const smsBody = await smsRes.text();

    // BudgetSMS returns "OK <id>" on success or "ERR <code> <description>" on failure
    if (!smsRes.ok || !smsBody.trim().startsWith('OK')) {
      console.error('BudgetSMS error:', smsRes.status, smsBody);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-phone-otp unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
