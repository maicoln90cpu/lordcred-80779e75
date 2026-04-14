import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const body = await req.json().catch(() => ({}))
    const campaignId = body.campaign_id

    // If no specific campaign, find running ones
    let campaigns: any[] = []

    if (campaignId) {
      const { data } = await adminClient
        .from('broadcast_campaigns')
        .select('*, chips(instance_name, instance_token, status)')
        .eq('id', campaignId)
        .in('status', ['running', 'scheduled'])
        .limit(1)
      campaigns = data || []
    } else {
      // Auto-pick running campaigns
      const { data } = await adminClient
        .from('broadcast_campaigns')
        .select('*, chips(instance_name, instance_token, status)')
        .eq('status', 'running')
        .limit(5)
      campaigns = data || []

      // Also check scheduled ones that are ready
      const { data: scheduled } = await adminClient
        .from('broadcast_campaigns')
        .select('*, chips(instance_name, instance_token, status)')
        .eq('status', 'scheduled')
        .lte('scheduled_at', new Date().toISOString())
        .limit(5)

      if (scheduled?.length) {
        for (const sc of scheduled) {
          await adminClient
            .from('broadcast_campaigns')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('id', sc.id)
          sc.status = 'running'
        }
        campaigns.push(...scheduled)
      }
    }

    if (campaigns.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No active campaigns', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read provider config
    const { data: providerSettings } = await adminClient
      .from('system_settings')
      .select('provider_api_url')
      .limit(1)
      .maybeSingle()

    const apiUrl = (providerSettings?.provider_api_url || '').replace(/\/$/, '')
    if (!apiUrl) {
      return new Response(
        JSON.stringify({ error: 'UazAPI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalProcessed = 0
    let totalFailed = 0

    for (const campaign of campaigns) {
      if (!campaign.chips || campaign.chips.status !== 'connected') {
        console.log(`Chip not connected for campaign ${campaign.id}`)
        continue
      }

      const chipToken = campaign.chips.instance_token
      if (!chipToken) {
        console.log(`No token for campaign ${campaign.id}`)
        continue
      }

      // Get pending recipients, limited by rate_per_minute
      const batchSize = Math.min(campaign.rate_per_minute || 10, 20)
      const { data: recipients } = await adminClient
        .from('broadcast_recipients')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(batchSize)

      if (!recipients || recipients.length === 0) {
        // Campaign complete
        await adminClient
          .from('broadcast_campaigns')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', campaign.id)
        console.log(`Campaign ${campaign.id} completed`)
        continue
      }

      // Send with delay between messages (anti-blocking)
      const delayMs = Math.max(Math.floor(60000 / batchSize), 2000)

      for (const recipient of recipients) {
        try {
          const response = await fetch(`${apiUrl}/send/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
            body: JSON.stringify({
              number: recipient.phone,
              text: campaign.message_content,
            }),
          })

          if (response.ok) {
            await adminClient
              .from('broadcast_recipients')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', recipient.id)

            await adminClient
              .from('broadcast_campaigns')
              .update({ sent_count: campaign.sent_count + 1 + totalProcessed })
              .eq('id', campaign.id)

            totalProcessed++
          } else {
            const errData = await response.json().catch(() => ({}))
            await adminClient
              .from('broadcast_recipients')
              .update({ status: 'failed', error_message: errData.message || 'Send failed' })
              .eq('id', recipient.id)

            await adminClient
              .from('broadcast_campaigns')
              .update({ failed_count: campaign.failed_count + 1 + totalFailed })
              .eq('id', campaign.id)

            totalFailed++
          }
        } catch (err) {
          await adminClient
            .from('broadcast_recipients')
            .update({ status: 'failed', error_message: err.message || 'Network error' })
            .eq('id', recipient.id)
          totalFailed++
        }

        // Rate limiting delay
        if (recipients.indexOf(recipient) < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: totalProcessed, failed: totalFailed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Broadcast sender error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
