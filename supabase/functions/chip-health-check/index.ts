import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const STRIKE_THRESHOLD = 3

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
      .select('id, instance_name, instance_token, status, warming_phase, health_fail_count')

    if (chipsError || !chips) {
      throw new Error('Failed to fetch chips: ' + (chipsError?.message || 'unknown'))
    }

    let connected = 0
    let disconnected = 0
    const results: Array<{ chipId: string; instanceName: string; oldStatus: string; newStatus: string; failCount: number }> = []

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

        if (newStatus === 'connected') {
          // Success: reset fail counter, update status
          await adminClient
            .from('chips')
            .update({
              status: 'connected',
              health_fail_count: 0,
              last_connection_attempt: new Date().toISOString()
            })
            .eq('id', chip.id)

          if (chip.status !== 'connected') {
            await adminClient
              .from('chip_lifecycle_logs')
              .insert({
                chip_id: chip.id,
                event: 'health_check',
                details: `Status recovered: ${chip.status} → connected (fail count reset)`
              })
          }

          connected++
          results.push({ chipId: chip.id, instanceName: chip.instance_name, oldStatus: chip.status, newStatus: 'connected', failCount: 0 })
        } else {
          // Failure: increment counter, only mark disconnected after STRIKE_THRESHOLD
          const newFailCount = (chip.health_fail_count || 0) + 1

          if (newFailCount >= STRIKE_THRESHOLD) {
            // 3 strikes — mark as disconnected
            await adminClient
              .from('chips')
              .update({
                status: 'disconnected',
                health_fail_count: newFailCount,
                last_connection_attempt: new Date().toISOString()
              })
              .eq('id', chip.id)

            if (chip.status !== 'disconnected') {
              await adminClient
                .from('chip_lifecycle_logs')
                .insert({
                  chip_id: chip.id,
                  event: 'health_check_3strikes',
                  details: `${STRIKE_THRESHOLD} consecutive failures — ${chip.status} → disconnected`
                })
            }

            disconnected++
            results.push({ chipId: chip.id, instanceName: chip.instance_name, oldStatus: chip.status, newStatus: 'disconnected', failCount: newFailCount })
          } else {
            // Still under threshold — keep current status, just bump counter
            await adminClient
              .from('chips')
              .update({
                health_fail_count: newFailCount,
                last_connection_attempt: new Date().toISOString()
              })
              .eq('id', chip.id)

            // Log warning but DON'T change status
            console.log(`Health check warning for ${chip.instance_name}: fail ${newFailCount}/${STRIKE_THRESHOLD}`)

            if (chip.status === 'connected') connected++
            else disconnected++

            results.push({ chipId: chip.id, instanceName: chip.instance_name, oldStatus: chip.status, newStatus: chip.status, failCount: newFailCount })
          }
        }
      } catch (error) {
        console.error(`Health check failed for ${chip.instance_name}:`, error)

        const newFailCount = (chip.health_fail_count || 0) + 1

        if (newFailCount >= STRIKE_THRESHOLD && chip.status === 'connected') {
          await adminClient
            .from('chips')
            .update({
              status: 'disconnected',
              health_fail_count: newFailCount,
              last_connection_attempt: new Date().toISOString()
            })
            .eq('id', chip.id)

          await adminClient
            .from('chip_lifecycle_logs')
            .insert({
              chip_id: chip.id,
              event: 'health_check_3strikes',
              details: `${STRIKE_THRESHOLD} consecutive failures (network error) — marked disconnected`
            })
        } else {
          await adminClient
            .from('chips')
            .update({
              health_fail_count: newFailCount,
              last_connection_attempt: new Date().toISOString()
            })
            .eq('id', chip.id)
        }

        disconnected++
        results.push({
          chipId: chip.id,
          instanceName: chip.instance_name,
          oldStatus: chip.status,
          newStatus: newFailCount >= STRIKE_THRESHOLD ? 'disconnected' : chip.status,
          failCount: newFailCount
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: chips.length,
        connected,
        disconnected,
        strikeThreshold: STRIKE_THRESHOLD,
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
