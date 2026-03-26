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
const WRITE_ACTIONS = ['insertQueueFGTS', 'createProposta', 'rawProxy']

// All valid actions
const VALID_ACTIONS = [
  'getPropostas', 'getAssets', 'listLogins',
  'insertQueueFGTS', 'listQueueFGTS', 'createProposta',
  'testConnection', 'rawProxy'
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

    // --- rawProxy: forward arbitrary payload to arbitrary URL (admin only) ---
    if (action === 'rawProxy') {
      if (!['master', 'admin'].includes(userRole)) {
        return new Response(JSON.stringify({ error: 'rawProxy restricted to admin/master' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const proxyUrl = params?.url
      const proxyBody = params?.body
      if (!proxyUrl) {
        return new Response(JSON.stringify({ error: 'Missing params.url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      console.log(`[corban-api] rawProxy to ${proxyUrl} by ${userEmail}`)
      const proxyResp = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody),
      })
      const proxyText = await proxyResp.text()
      console.log(`[corban-api] rawProxy response: ${proxyResp.status}, preview: ${proxyText.substring(0, 500)}`)

      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId, user_email: userEmail, action: 'corban_rawProxy',
        target_table: 'corban_api',
        details: { url: proxyUrl, status_code: proxyResp.status, response_preview: proxyText.substring(0, 500) },
      })

      return new Response(JSON.stringify({
        success: true,
        status_code: proxyResp.status,
        data: proxyText,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
        const gpFilters = params?.filters || {}
        if (!gpFilters.data) {
          const now = new Date()
          const from = new Date(now)
          from.setDate(from.getDate() - 30)
          gpFilters.data = {
            tipo: 'cadastro',
            startDate: from.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          }
        } else {
          if (!gpFilters.data.tipo) gpFilters.data.tipo = 'cadastro'
          // Enforce max 31 days range
          const start = new Date(gpFilters.data.startDate)
          const end = new Date(gpFilters.data.endDate)
          if ((end.getTime() - start.getTime()) / (1000 * 3600 * 24) > 31) {
            const adjusted = new Date(start)
            adjusted.setDate(start.getDate() + 30)
            gpFilters.data.endDate = adjusted.toISOString().split('T')[0]
          }
        }
        corbanBody.filters = gpFilters
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
        const fgtsFilters = params?.filters || {}
        if (!fgtsFilters.data) {
          const now = new Date()
          const from = new Date(now)
          from.setDate(from.getDate() - 30)
          fgtsFilters.data = {
            startDate: from.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          }
        }
        corbanBody.requestType = 'listQueueFGTS'
        corbanBody.filters = fgtsFilters
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
    console.log(`[corban-api] Response status: ${corbanResponse.status}, body preview:`, responseText.substring(0, 500))
    try {
      result = JSON.parse(responseText)
    } catch {
      result = { raw: responseText }
    }

    // Detect logical errors (API returns {"error":true} with HTTP 200)
    if (typeof result === 'object' && result !== null && (result as any).error === true) {
      const errMsg = (result as any).mensagem || 'Erro retornado pela API Corban'
      console.error(`[corban-api] Logical error from NewCorban:`, errMsg)
      
      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        user_email: userEmail,
        action: `corban_${action}`,
        target_table: 'corban_api',
        details: {
          action, params: params || {},
          status_code: corbanResponse.status,
          success: false,
          error_message: errMsg,
          response_preview: responseText.substring(0, 500),
        },
      })

      return new Response(JSON.stringify({
        error: errMsg,
        details: result,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Log to audit_logs (include truncated response for debugging)
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
        response_preview: responseText.substring(0, 500),
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

    // Convert keyed-object responses to arrays (NewCorban returns { "ID": {...} })
    let finalData = result
    if ((action === 'getPropostas' || action === 'listQueueFGTS') && typeof result === 'object' && result !== null && !Array.isArray(result)) {
      const entries = Object.entries(result as Record<string, unknown>)
      if (entries.length > 0 && entries.every(([k]) => /^\d+$/.test(k))) {
        finalData = entries.map(([id, value]) => ({
          proposta_id: id,
          ...(typeof value === 'object' && value !== null ? value as Record<string, unknown> : { raw: value }),
        }))
        console.log(`[corban-api] Converted keyed object to array: ${(finalData as any[]).length} items`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: finalData,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[corban-api] Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
