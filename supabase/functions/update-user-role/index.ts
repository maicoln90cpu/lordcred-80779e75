import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { writeAuditLog } from '../_shared/auditLog.ts'

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

    // Verify requester role using service role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: requesterRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requesterId)
      .single()

    const isMaster = requesterRole?.role === 'master'
    const isAdmin = requesterRole?.role === 'admin'
    const isManagerRole = requesterRole?.role === 'manager'

    if (!isMaster && !isAdmin && !isManagerRole) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), { status: 403, headers: corsHeaders })
    }

    const { targetUserId, newRole } = await req.json()

    // Validate allowed roles
    const allowedRoles = isMaster ? ['admin', 'manager', 'seller', 'support'] : ['manager', 'seller', 'support']
    if (!targetUserId || !newRole || !allowedRoles.includes(newRole)) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), { status: 400, headers: corsHeaders })
    }

    if (targetUserId === requesterId) {
      return new Response(JSON.stringify({ error: 'Você não pode alterar sua própria role' }), { status: 400, headers: corsHeaders })
    }

    // Non-master cannot change a master's or admin's role (manager can't change admin)
    if (!isMaster) {
      const { data: targetRole } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .single()
      if (targetRole?.role === 'master') {
        return new Response(JSON.stringify({ error: 'Não é possível alterar a role de um Master' }), { status: 403, headers: corsHeaders })
      }
      if (isManagerRole && targetRole?.role === 'admin') {
        return new Response(JSON.stringify({ error: 'Gerente não pode alterar a role de um Administrador' }), { status: 403, headers: corsHeaders })
      }
    }

    const { error: updateError } = await adminClient
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', targetUserId)

    if (updateError) {
      throw updateError
    }

    await writeAuditLog(adminClient, {
      action: 'user_role_updated',
      category: 'users',
      success: true,
      userId: requesterId,
      targetTable: 'user_roles',
      targetId: targetUserId,
      details: { new_role: newRole, by_role: requesterRole?.role ?? null },
    })

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
