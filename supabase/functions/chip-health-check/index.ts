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
    // Cron jobs (pg_net) send anon key which isn't a valid user JWT — skip gracefully
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
        const supabasePublishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
        const token = authHeader.replace('Bearer ', '').trim()
        
        // Skip validation if the token is the anon/publishable key (cron job call)
        const isAnonKey = token === supabaseAnonKey.trim() || token === supabasePublishableKey.trim()
        if (!isAnonKey) {
          const userClient = createClient(supabaseUrl, supabaseAnonKey || supabasePublishableKey, {
            global: { headers: { Authorization: authHeader } }
          })
          const { data: { user }, error: userError } = await userClient.auth.getUser(token)
          if (userError || !user) {
            // If getUser fails, allow through anyway — this function uses service_role internally
            console.warn('chip-health-check: auth validation failed, allowing through (service_role used internally)')
          } else {
            const userId = user.id
            const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', userId).single()
            const role = roleData?.role
            if (role !== 'master' && role !== 'admin' && role !== 'support') {
              return new Response(JSON.stringify({ error: 'Access denied' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              })
            }
          }
        }
        // If token === anonKey, this is a cron/pg_net call — proceed without auth
      } catch (authErr) {
        // Auth validation failed (likely cron call) — proceed without auth
        console.log('Auth validation skipped (likely cron call):', authErr)
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
    const UNSTABLE_MINUTES = 15

    const { data: chips, error: chipsError } = await adminClient
      .from('chips')
      .select('id, instance_name, instance_token, status, warming_phase, health_fail_count, last_webhook_at')

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
          // Check if chip is "unstable" — connected per API but no webhook signal in 15+ min
          let isUnstable = false
          if (chip.last_webhook_at) {
            const lastSignal = new Date(chip.last_webhook_at).getTime()
            const minutesSince = (Date.now() - lastSignal) / 60000
            if (minutesSince > UNSTABLE_MINUTES) {
              isUnstable = true
            }
          }

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

          if (isUnstable) {
            await adminClient
              .from('chip_lifecycle_logs')
              .insert({
                chip_id: chip.id,
                event: 'watchdog_unstable',
                details: `Connected per API but no webhook signal in ${UNSTABLE_MINUTES}+ minutes`
              })
          }

          connected++
          results.push({ chipId: chip.id, instanceName: chip.instance_name, oldStatus: chip.status, newStatus: 'connected', failCount: 0, unstable: isUnstable })
        } else {
          // Failure: increment counter, only mark disconnected after STRIKE_THRESHOLD
          const newFailCount = (chip.health_fail_count || 0) + 1

          if (newFailCount >= STRIKE_THRESHOLD) {
            // 3 strikes — mark as disconnected AND delete from UazAPI
            if (chip.instance_token) {
              await fetch(`${baseUrl}/instance/disconnect`, {
                method: 'POST',
                headers: { 'token': chip.instance_token },
              }).catch(() => {})

              await fetch(`${baseUrl}/instance`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'token': chip.instance_token },
              }).catch(() => {})
            }

            await adminClient
              .from('chips')
              .update({
                status: 'disconnected',
                health_fail_count: newFailCount,
                instance_token: null,
                last_connection_attempt: new Date().toISOString()
              })
              .eq('id', chip.id)

            if (chip.status !== 'disconnected') {
              await adminClient
                .from('chip_lifecycle_logs')
                .insert({
                  chip_id: chip.id,
                  event: 'health_check_3strikes',
                  details: `${STRIKE_THRESHOLD} consecutive failures — ${chip.status} → disconnected, removed from UazAPI`
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
          // Delete from UazAPI on 3 strikes
          if (chip.instance_token) {
            await fetch(`${baseUrl}/instance`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'token': chip.instance_token },
            }).catch(() => {})
          }

          await adminClient
            .from('chips')
            .update({
              status: 'disconnected',
              health_fail_count: newFailCount,
              instance_token: null,
              last_connection_attempt: new Date().toISOString()
            })
            .eq('id', chip.id)

          await adminClient
            .from('chip_lifecycle_logs')
            .insert({
              chip_id: chip.id,
              event: 'health_check_3strikes',
              details: `${STRIKE_THRESHOLD} consecutive failures (network error) — removed from UazAPI`
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
