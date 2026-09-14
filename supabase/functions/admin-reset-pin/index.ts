import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "POST method required." }, 405);
  }

  try {
    const { adminId, adminPassword, phone, newPin } = await req.json();

    const expectedAdminId = Deno.env.get("ADMIN_ID");
    const expectedAdminPassword = Deno.env.get("ADMIN_PASSWORD");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (
      !expectedAdminId ||
      !expectedAdminPassword ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return json({ error: "Server secrets are not configured." }, 500);
    }

    if (
      typeof adminId !== "string" ||
      typeof adminPassword !== "string" ||
      adminId !== expectedAdminId ||
      adminPassword !== expectedAdminPassword
    ) {
      return json({ error: "Admin ID or password is incorrect." }, 401);
    }

    const normalizedPhone = String(phone ?? "").replace(/\D/g, "");
    if (!/^\d{10}$/.test(normalizedPhone)) {
      return json({ error: "Enter a valid 10-digit phone number." }, 400);
    }

    if (typeof newPin !== "string" || !/^\d{4}$/.test(newPin)) {
      return json({ error: "New PIN must be exactly 4 digits." }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await supabase
      .from("village_profiles")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);
      return json({ error: "Could not look up that phone number." }, 500);
    }

    if (!profile) {
      return json({ error: "No account found for that phone number." }, 404);
    }

    // Existing Festival Connect login uses:
    // email = normalizedPhone + "@festivalconnect.local"
    // password = "FC!" + PIN + "#2026"
    const newInternalPassword = `FC!${newPin}#2026`;

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { password: newInternalPassword },
    );

    if (updateError) {
      console.error("PIN update failed:", updateError.message);
      return json({ error: "PIN could not be reset." }, 500);
    }

    return json({ message: "PIN reset successfully. The user can log in with the new PIN." });
  } catch (error) {
    console.error("Request failed:", error);
    return json({ error: "Invalid request." }, 400);
  }
});