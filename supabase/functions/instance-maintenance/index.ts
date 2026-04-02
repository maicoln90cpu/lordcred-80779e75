import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { data: settings } = await adminClient
      .from('system_settings')
      .select('provider_api_url, provider_api_key, uazapi_api_url, uazapi_api_key, whatsapp_provider')
      .limit(1)
      .maybeSingle()

    const provider = (settings as any)?.whatsapp_provider || 'evolution'
    const baseUrl = ((settings as any)?.uazapi_api_url || settings?.provider_api_url || '').replace(/\/$/, '')
    const adminToken = (settings as any)?.uazapi_api_key || settings?.provider_api_key || ''

    if (!baseUrl || !adminToken) {
      return new Response(
        JSON.stringify({ error: 'API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: string[] = []

    // 1. Cleanup inactive chips (14+ days)
    const { data: inactiveChips } = await adminClient
      .from('chips')
      .select('*')
      .eq('status', 'connected')
      .or(`last_message_at.lt.${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()},last_message_at.is.null`)

    for (const chip of inactiveChips || []) {
      if (!chip.last_message_at && chip.activated_at) {
        const activatedAge = Date.now() - new Date(chip.activated_at).getTime()
        if (activatedAge < 14 * 24 * 60 * 60 * 1000) continue
      }

      try {
        const chipToken = chip.instance_token
        if (chipToken) {
          await fetch(`${baseUrl}/instance/disconnect`, {
            method: 'POST',
            headers: { 'token': chipToken },
          }).catch(() => {})

          await fetch(`${baseUrl}/instance`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
          }).catch(() => {})
        }

        await adminClient.from('chips').update({ status: 'inactive', health_fail_count: 0 }).eq('id', chip.id)
        await logLifecycle(adminClient, chip.id, 'inactive', 'Auto-cleanup: 14+ days inactive')
        results.push(`Cleaned up: ${chip.instance_name}`)
      } catch (e) {
        results.push(`Error cleaning ${chip.instance_name}: ${e.message}`)
      }
    }

    // 2. Health monitoring with 3-strikes tolerance
    const { data: connectedChips } = await adminClient
      .from('chips')
      .select('*')
      .eq('status', 'connected')

    for (const chip of connectedChips || []) {
      try {
        const chipToken = chip.instance_token
        if (!chipToken) continue

        const response = await fetch(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chipToken },
        })
        const data = await response.json()

        let actualState = 'disconnected'
        if (data.status?.connected === true || data.status?.loggedIn === true) actualState = 'connected'

        if (actualState === 'connected') {
          // Healthy — reset fail counter
          if (chip.health_fail_count > 0) {
            await adminClient.from('chips').update({ health_fail_count: 0 }).eq('id', chip.id)
          }
          results.push(`Healthy: ${chip.instance_name}`)
        } else {
          // Failed — increment counter
          const newFailCount = (chip.health_fail_count || 0) + 1

          if (newFailCount >= STRIKE_THRESHOLD) {
            await adminClient.from('chips').update({
              status: 'disconnected',
              health_fail_count: newFailCount
            }).eq('id', chip.id)
            await logLifecycle(adminClient, chip.id, 'disconnected', `Maintenance: ${STRIKE_THRESHOLD} consecutive failures — marked disconnected`)
            results.push(`Status corrected (3 strikes): ${chip.instance_name} -> disconnected`)
          } else {
            await adminClient.from('chips').update({ health_fail_count: newFailCount }).eq('id', chip.id)
            results.push(`Warning: ${chip.instance_name} fail ${newFailCount}/${STRIKE_THRESHOLD}`)
          }
        }
      } catch (e) {
        const newFailCount = (chip.health_fail_count || 0) + 1
        if (newFailCount >= STRIKE_THRESHOLD) {
          await adminClient.from('chips').update({
            status: 'disconnected',
            health_fail_count: newFailCount
          }).eq('id', chip.id)
          await logLifecycle(adminClient, chip.id, 'disconnected', `Maintenance: network error + ${STRIKE_THRESHOLD} strikes`)
          results.push(`Error + 3 strikes ${chip.instance_name}: ${e.message}`)
        } else {
          await adminClient.from('chips').update({ health_fail_count: newFailCount }).eq('id', chip.id)
          results.push(`Error (${newFailCount}/${STRIKE_THRESHOLD}) ${chip.instance_name}: ${e.message}`)
        }
      }
    }

    console.log('Maintenance results:', results)

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Maintenance error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function logLifecycle(client: any, chipId: string, event: string, details: string) {
  try {
    await client.from('chip_lifecycle_logs').insert({ chip_id: chipId, event, details })
  } catch (e) {
    console.error('Failed to log lifecycle:', e)
  }
}
