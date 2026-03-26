import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface CorbanAuth {
  username: string
  password: string
  empresa: string
}

// Actions that require admin/master/support role
const WRITE_ACTIONS = ['insertQueueFGTS', 'createProposta']

// All valid actions
const VALID_ACTIONS = [
  'getPropostas', 'getAssets', 'listLogins',
  'insertQueueFGTS', 'listQueueFGTS', 'createProposta',
  'testConnection'
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      console.error('[corban-api] Auth error:', userError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = user.id
    const userEmail = user.email || 'unknown'

    // Get user role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).single()
    const userRole = roleData?.role || 'seller'

    // Parse request body
    const body = await req.json()
    const { action, params } = body

    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check write permissions
    if (WRITE_ACTIONS.includes(action) && !['master', 'admin', 'support'].includes(userRole)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions for write operations' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get Corban credentials from secrets
    const corbanUrl = Deno.env.get('CORBAN_API_URL')
    const corbanUsername = Deno.env.get('CORBAN_USERNAME')
    const corbanPassword = Deno.env.get('CORBAN_PASSWORD')
    const corbanEmpresa = Deno.env.get('CORBAN_EMPRESA')

    if (!corbanUrl || !corbanUsername || !corbanPassword || !corbanEmpresa) {
      return new Response(JSON.stringify({ error: 'Corban API credentials not configured. Please add secrets: CORBAN_API_URL, CORBAN_USERNAME, CORBAN_PASSWORD, CORBAN_EMPRESA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const auth: CorbanAuth = {
      username: corbanUsername,
      password: corbanPassword,
      empresa: corbanEmpresa,
    }

    // Build request body for NewCorban API
    let corbanBody: Record<string, unknown> = { auth }
    let result: unknown = null

    switch (action) {
      case 'testConnection': {
        // Simple test: try getAssets with 'status'
        corbanBody.requestType = 'getAssets'
        corbanBody.asset = 'status'
        break
      }
      case 'getPropostas': {
        corbanBody.requestType = 'getPropostas'
        corbanBody.filters = params?.filters || {}
        break
      }
      case 'getAssets': {
        corbanBody.requestType = 'getAssets'
        corbanBody.asset = params?.asset || 'status'
        break
      }
      case 'listLogins': {
        corbanBody.requestType = 'listLogins'
        corbanBody.instituicao = params?.instituicao || 'facta'
        break
      }
      case 'insertQueueFGTS': {
        corbanBody.requestType = 'insertQueueFGTS'
        corbanBody.content = params?.content || {}
        break
      }
      case 'listQueueFGTS': {
        corbanBody.requestType = 'listQueueFGTS'
        corbanBody.filters = params?.filters || {}
        break
      }
      case 'createProposta': {
        corbanBody.requestType = 'createProposta'
        corbanBody.content = params?.content || {}
        break
      }
    }

    // Call NewCorban API
    const apiUrl = `${corbanUrl.replace(/\/$/, '')}/api/propostas/`
    console.log(`[corban-api] Calling ${action} for user ${userEmail} (${userRole})`)
    console.log(`[corban-api] Request body:`, JSON.stringify(corbanBody).substring(0, 500))

    const corbanResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corbanBody),
    })

    const responseText = await corbanResponse.text()
    try {
      result = JSON.parse(responseText)
    } catch {
      result = { raw: responseText }
    }

    // Log to audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      user_email: userEmail,
      action: `corban_${action}`,
      target_table: 'corban_api',
      details: {
        action,
        params: params || {},
        status_code: corbanResponse.status,
        success: corbanResponse.ok,
      },
    })

    if (!corbanResponse.ok) {
      console.error(`[corban-api] Error from NewCorban: ${corbanResponse.status}`, responseText)
      return new Response(JSON.stringify({
        error: 'Corban API returned an error',
        status_code: corbanResponse.status,
        details: result,
      }), { status: corbanResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      data: result,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[corban-api] Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
