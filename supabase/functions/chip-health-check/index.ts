import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Optional: validate caller (admin or support) if Authorization header present
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })
      const token = authHeader.replace('Bearer ', '')
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const userId = claimsData.claims.sub as string
      const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', userId).single()
      const role = roleData?.role
      if (role !== 'master' && role !== 'admin' && role !== 'support') {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Get UazAPI settings
    const { data: settings } = await adminClient
      .from('system_settings')
      .select('uazapi_api_url, uazapi_api_key, provider_api_url, provider_api_key')
      .limit(1)
      .maybeSingle()

    const baseUrl = ((settings as any)?.uazapi_api_url || settings?.provider_api_url || '').replace(/\/$/, '')
    const adminToken = (settings as any)?.uazapi_api_key || settings?.provider_api_key || ''

    if (!baseUrl || !adminToken) {
      return new Response(
        JSON.stringify({ error: 'UazAPI not configured', checked: 0, connected: 0, disconnected: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all chips
    const { data: chips, error: chipsError } = await adminClient
      .from('chips')
      .select('id, instance_name, instance_token, status, warming_phase')

    if (chipsError || !chips) {
      throw new Error('Failed to fetch chips: ' + (chipsError?.message || 'unknown'))
    }

    let connected = 0
    let disconnected = 0
    const results: Array<{ chipId: string; instanceName: string; oldStatus: string; newStatus: string }> = []

    for (const chip of chips) {
      if (!chip.instance_token) {
        disconnected++
        continue
      }

      try {
        const response = await fetch(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chip.instance_token },
        })

        const data = await response.json()

        let newStatus = 'disconnected'
        if (data.status?.connected === true || data.status?.loggedIn === true) {
          newStatus = 'connected'
        } else if (data.instance?.status === 'connecting') {
          newStatus = 'connecting'
        }

        // Update if status changed
        if (newStatus !== chip.status) {
          await adminClient
            .from('chips')
            .update({
              status: newStatus,
              last_connection_attempt: new Date().toISOString()
            })
            .eq('id', chip.id)

          // Log status change
          await adminClient
            .from('chip_lifecycle_logs')
            .insert({
              chip_id: chip.id,
              event: 'health_check',
              details: `Status changed: ${chip.status} → ${newStatus}`
            })
        } else {
          // Update last_connection_attempt even if status didn't change
          await adminClient
            .from('chips')
            .update({ last_connection_attempt: new Date().toISOString() })
            .eq('id', chip.id)
        }

        if (newStatus === 'connected') connected++
        else disconnected++

        results.push({
          chipId: chip.id,
          instanceName: chip.instance_name,
          oldStatus: chip.status,
          newStatus
        })
      } catch (error) {
        console.error(`Health check failed for ${chip.instance_name}:`, error)
        disconnected++

        // If chip was connected but now unreachable, mark as disconnected
        if (chip.status === 'connected') {
          await adminClient
            .from('chips')
            .update({
              status: 'disconnected',
              last_connection_attempt: new Date().toISOString()
            })
            .eq('id', chip.id)

          await adminClient
            .from('chip_lifecycle_logs')
            .insert({
              chip_id: chip.id,
              event: 'health_check_failed',
              details: `Chip unreachable — marked as disconnected`
            })
        }

        results.push({
          chipId: chip.id,
          instanceName: chip.instance_name,
          oldStatus: chip.status,
          newStatus: 'disconnected'
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: chips.length,
        connected,
        disconnected,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('chip-health-check error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
