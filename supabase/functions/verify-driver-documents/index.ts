import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Threshold for auto-approval (all 4 boolean checks must pass + score >= this)
const AUTO_APPROVE_SCORE = 0.85;

interface AIResult {
  extracted: {
    name_on_license: string | null;
    license_number: string | null;
    license_category: string | null;
    is_cyprus_eu_format: boolean;
    plate_on_vehicle: string | null;
  };
  matches: {
    name_match: boolean;
    license_number_match: boolean;
    plate_match: boolean;
    cyprus_format_valid: boolean;
  };
  confidence: number; // 0..1
  notes: string;
}

function normalize(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

async function fetchAsBase64(supabaseAdmin: any, path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from("driver-docs").download(path);
  if (error || !data) {
    console.error("Failed to download", path, error);
    return null;
  }
  const buf = await data.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const mime = data.type || "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth client (to identify the user)
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { verification_id } = await req.json();
    if (!verification_id) {
      return new Response(JSON.stringify({ error: "verification_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client (bypasses RLS for storage download + status update)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load verification + profile
    const { data: ver, error: verErr } = await supabaseAdmin
      .from("driver_verifications")
      .select("*")
      .eq("id", verification_id)
      .eq("driver_id", userId)
      .single();

    if (verErr || !ver) {
      return new Response(JSON.stringify({ error: "Verification not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, id_verified")
      .eq("user_id", userId)
      .single();

    // Skip if already paid Stripe Identity
    if (profile?.id_verified) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "User already Stripe-verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ver.license_image_url || !ver.vehicle_image_url) {
      return new Response(JSON.stringify({ error: "Missing document images" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // license_image_url & vehicle_image_url store the storage PATH (not URL)
    const licenseB64 = await fetchAsBase64(supabaseAdmin, ver.license_image_url);
    const vehicleB64 = await fetchAsBase64(supabaseAdmin, ver.vehicle_image_url);

    if (!licenseB64 || !vehicleB64) {
      return new Response(JSON.stringify({ error: "Could not load document images" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedName = profile?.full_name || "";
    const expectedLicenseNumber = ver.license_number || "";
    const expectedPlate = ver.vehicle_registration || "";

    const systemPrompt = `You are a strict document verification assistant for a Cyprus-only carpooling platform.
You will receive two images: (1) a driver's license, (2) a photo of a vehicle.
Extract details and compare them to the typed values provided.

Cyprus / EU driving licence format checks:
- Pink/credit-card sized plastic card
- Has "Republic of Cyprus" / "Κυπριακή Δημοκρατία" or EU stars
- Category B is shown in the categories table
- License number is alphanumeric

Be strict but fair. If an image is blurry/unreadable, set match=false and explain in notes.
Names match if first+last names align (ignore middle names, accents, case, order).
License & plate match if normalized strings (no spaces, uppercase) are identical.`;

    const userText = `Typed values to verify against:
- Account name: "${expectedName}"
- Typed license number: "${expectedLicenseNumber}"
- Typed plate number: "${expectedPlate}"

Image 1 = driver's license. Image 2 = vehicle photo (look for plate).
Extract and compare. Return result via the verify_documents tool.`;

    const aiResp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: licenseB64 } },
              { type: "image_url", image_url: { url: vehicleB64 } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "verify_documents",
              description: "Return structured verification result",
              parameters: {
                type: "object",
                properties: {
                  extracted: {
                    type: "object",
                    properties: {
                      name_on_license: { type: ["string", "null"] },
                      license_number: { type: ["string", "null"] },
                      license_category: { type: ["string", "null"] },
                      is_cyprus_eu_format: { type: "boolean" },
                      plate_on_vehicle: { type: ["string", "null"] },
                    },
                    required: [
                      "name_on_license",
                      "license_number",
                      "license_category",
                      "is_cyprus_eu_format",
                      "plate_on_vehicle",
                    ],
                  },
                  matches: {
                    type: "object",
                    properties: {
                      name_match: { type: "boolean" },
                      license_number_match: { type: "boolean" },
                      plate_match: { type: "boolean" },
                      cyprus_format_valid: { type: "boolean" },
                    },
                    required: [
                      "name_match",
                      "license_number_match",
                      "plate_match",
                      "cyprus_format_valid",
                    ],
                  },
                  confidence: { type: "number" },
                  notes: { type: "string" },
                },
                required: ["extracted", "matches", "confidence", "notes"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "verify_documents" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit, try later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI verification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(aiJson));
      return new Response(JSON.stringify({ error: "AI did not return structured result" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: AIResult = JSON.parse(toolCall.function.arguments);

    // Server-side double-check on normalized strings (defence in depth)
    const nameMatchServer =
      normalize(result.extracted.name_on_license).length > 0 &&
      normalize(expectedName)
        .split("")
        .every((c) => normalize(result.extracted.name_on_license).includes(c)) === false
        ? result.matches.name_match
        : true && result.matches.name_match;
    const licenseMatchServer =
      normalize(result.extracted.license_number) === normalize(expectedLicenseNumber) &&
      result.matches.license_number_match;
    const plateMatchServer =
      normalize(result.extracted.plate_on_vehicle) === normalize(expectedPlate) &&
      result.matches.plate_match;

    const allMatch =
      result.matches.name_match &&
      licenseMatchServer &&
      plateMatchServer &&
      result.matches.cyprus_format_valid;

    const shouldAutoApprove = allMatch && result.confidence >= AUTO_APPROVE_SCORE;

    const adminNotesText = `AI Verification Report
━━━━━━━━━━━━━━━━━━━━
Confidence: ${(result.confidence * 100).toFixed(0)}%
Name on license: ${result.extracted.name_on_license || "—"} (match: ${result.matches.name_match ? "✓" : "✗"})
License number: ${result.extracted.license_number || "—"} (match: ${licenseMatchServer ? "✓" : "✗"})
Plate on vehicle: ${result.extracted.plate_on_vehicle || "—"} (match: ${plateMatchServer ? "✓" : "✗"})
Cyprus/EU format: ${result.matches.cyprus_format_valid ? "✓" : "✗"}
Category: ${result.extracted.license_category || "—"}

Notes: ${result.notes}`;

    const updatePayload: any = {
      ai_verification_score: result.confidence,
      ai_verification_result: result as any,
      ai_verified_at: new Date().toISOString(),
      admin_notes: adminNotesText,
    };

    if (shouldAutoApprove) {
      updatePayload.verification_status = "approved";
      updatePayload.verified_at = new Date().toISOString();
    }

    const { error: updErr } = await supabaseAdmin
      .from("driver_verifications")
      .update(updatePayload)
      .eq("id", verification_id);

    if (updErr) {
      console.error("Update failed:", updErr);
      return new Response(JSON.stringify({ error: "Failed to save result" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log
    await supabaseAdmin.from("driver_verification_audit").insert({
      verification_id,
      action: shouldAutoApprove ? "ai_auto_approved" : "ai_reviewed_pending",
      details: { confidence: result.confidence, matches: result.matches } as any,
    });

    return new Response(
      JSON.stringify({
        auto_approved: shouldAutoApprove,
        confidence: result.confidence,
        matches: result.matches,
        notes: result.notes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("verify-driver-documents error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
