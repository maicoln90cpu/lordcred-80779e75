import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const requesterId = claimsData.claims.sub

    // Verify requester is admin using service role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: requesterRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requesterId)
      .single()

    if (requesterRole?.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Apenas o Master pode alterar roles' }), { status: 403, headers: corsHeaders })
    }

    const { targetUserId, newRole } = await req.json()

    if (!targetUserId || !newRole || !['admin', 'seller', 'support'].includes(newRole)) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), { status: 400, headers: corsHeaders })
    }

    if (targetUserId === requesterId) {
      return new Response(JSON.stringify({ error: 'Você não pode alterar sua própria role' }), { status: 400, headers: corsHeaders })
    }

    const { error: updateError } = await adminClient
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', targetUserId)

    if (updateError) {
      throw updateError
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
