// ==============================================================================
// Supabase Edge Function: invite-staff
// Description: Owner-only staff invitation and account provisioning.
// Calls auth.admin.inviteUserByEmail, inserts staff_profiles row with role,
// and writes an audit log entry.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { getCorsHeaders, handleCorsPreflight, getConfiguredOrigin, getMissingOriginConfigResponse } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const configuredOrigin = getConfiguredOrigin();
  if (!configuredOrigin) {
    return getMissingOriginConfigResponse();
  }

  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing bearer authentication token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify caller session
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication session.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Enforce Owner RBAC Gate
    const { data: callerProfile, error: profileErr } = await supabase
      .from('staff_profiles')
      .select('role, active, restaurant_id, full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (
      profileErr ||
      !callerProfile ||
      !callerProfile.active ||
      callerProfile.role !== 'owner'
    ) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only active restaurant owners can invite and provision staff.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse & Validate Payload
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const rawName = typeof (body.full_name || body.fullName || body.name) === 'string'
      ? (body.full_name || body.fullName || body.name).trim()
      : '';
    const rawRole = typeof body.role === 'string' ? body.role.trim().toLowerCase() : 'staff';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid staff email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rawName || rawName.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Please provide a full name (minimum 2 characters).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['owner', 'manager', 'staff'].includes(rawRole)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be owner, manager, or staff.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const restaurantId = callerProfile.restaurant_id || 'the-cafe-barrackpore';

    // 4. Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
      rawEmail,
      { data: { full_name: rawName, restaurant_id: restaurantId } }
    );

    if (inviteErr || !inviteData?.user) {
      return new Response(
        JSON.stringify({ error: inviteErr?.message || 'Failed to issue auth invitation email.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invitedUserId = inviteData.user.id;

    // 5. Insert staff_profiles row with chosen role
    const { data: newProfile, error: insertErr } = await supabase
      .from('staff_profiles')
      .insert({
        user_id: invitedUserId,
        full_name: rawName,
        role: rawRole,
        active: true,
        restaurant_id: restaurantId,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({
          error: `User was invited to Auth, but creating the staff profile record failed: ${insertErr.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Write Audit Log Event
    const clientIp = req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      null;

    await supabase.from('audit_log').insert({
      restaurant_id: restaurantId,
      actor_id: user.id,
      actor_role: callerProfile.role,
      actor_name: callerProfile.full_name || 'Owner',
      action: 'staff_invited',
      target_type: 'staff_profiles',
      target_id: newProfile?.id || invitedUserId,
      details: {
        email: rawEmail,
        role: rawRole,
        full_name: rawName,
        invited_user_id: invitedUserId,
      },
      ip_address: clientIp,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation successfully dispatched to ${rawEmail}.`,
        profile: newProfile,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error while inviting staff.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
