import { createClient } from "npm:@supabase/supabase-js@2"
import { writeAuditLog } from "../_shared/auditLog.ts"
import { replaceVariables, applyComponentMapping } from "../_shared/templateMapping.ts"

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

    let campaigns: any[] = []

    const chipSelect = 'instance_name, instance_token, status, provider'

    if (campaignId) {
      const { data } = await adminClient
        .from('broadcast_campaigns')
        .select(`*, chips(${chipSelect})`)
        .eq('id', campaignId)
        .in('status', ['running', 'scheduled'])
        .limit(1)
      campaigns = data || []
    } else {
      const { data } = await adminClient
        .from('broadcast_campaigns')
        .select(`*, chips(${chipSelect})`)
        .eq('status', 'running')
        .limit(5)
      campaigns = data || []

      const { data: scheduled } = await adminClient
        .from('broadcast_campaigns')
        .select(`*, chips(${chipSelect})`)
        .eq('status', 'scheduled')
        .limit(10)

      if (scheduled?.length) {
        const now = new Date()
        for (const sc of scheduled) {
          const scheduleTime = sc.scheduled_date || sc.scheduled_at
          if (scheduleTime && new Date(scheduleTime) > now) continue
          await adminClient
            .from('broadcast_campaigns')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('id', sc.id)
          sc.status = 'running'
          campaigns.push(sc)
        }
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
    const hasUazapiCampaign = campaigns.some((c: any) => (c.provider || 'uazapi') !== 'meta')
    if (!apiUrl && hasUazapiCampaign) {
      return new Response(
        JSON.stringify({ error: 'UazAPI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Load blacklist once
    const { data: blacklistData } = await adminClient
      .from('broadcast_blacklist')
      .select('phone')
    const blacklistSet = new Set((blacklistData || []).map((b: any) => b.phone))

    let totalProcessed = 0
    let totalFailed = 0
    let totalSkipped = 0

    for (const campaign of campaigns) {
      const isMeta = campaign.provider === 'meta'

      // Build list of available chips: primary + overflow
      // For UazAPI: requires instance_token. For Meta: only chipId is needed (gateway resolves token).
      const chipCandidates: { token: string; chipId: string }[] = []

      if (campaign.chips && campaign.chips.status === 'connected') {
        if (isMeta || campaign.chips.instance_token) {
          chipCandidates.push({ token: campaign.chips.instance_token || '', chipId: campaign.chip_id })
        }
      }

      // Load overflow chips if configured
      const overflowIds: string[] = campaign.overflow_chip_ids || []
      if (overflowIds.length > 0) {
        const { data: overflowChips } = await adminClient
          .from('chips')
          .select('id, instance_token, status, broadcast_daily_limit, messages_sent_today, provider')
          .in('id', overflowIds)
          .eq('status', 'connected')
        if (overflowChips) {
          for (const oc of overflowChips) {
            // Same provider only (avoid mixing meta/uazapi mid-campaign)
            if (oc.provider !== campaign.provider) continue
            if (isMeta || oc.instance_token) {
              chipCandidates.push({ token: oc.instance_token || '', chipId: oc.id })
            }
          }
        }
      }

      if (chipCandidates.length === 0) {
        console.log(`No connected chips for campaign ${campaign.id}`)
        continue
      }

      // Function to get current chip with capacity
      const getAvailableChip = async (): Promise<{ token: string; chipId: string } | null> => {
        for (const candidate of chipCandidates) {
          const { data: chipData } = await adminClient
            .from('chips')
            .select('broadcast_daily_limit, messages_sent_today')
            .eq('id', candidate.chipId)
            .single()
          if (chipData) {
            const limit = chipData.broadcast_daily_limit || 200
            const sent = chipData.messages_sent_today || 0
            if (sent < limit) return candidate
          }
        }
        return null
      }

      const batchSize = Math.min(campaign.rate_per_minute || 10, 20)
      const { data: recipients } = await adminClient
        .from('broadcast_recipients')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(batchSize)

      if (!recipients || recipients.length === 0) {
        // No more pending — mark campaign completed
        await adminClient
          .from('broadcast_campaigns')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', campaign.id)
        console.log(`Campaign ${campaign.id} completed (no pending recipients)`)
        continue
      }

      const delayMs = Math.max(Math.floor(60000 / batchSize), 2000)

      // Pre-load lead data if source_type=leads and there are lead_ids
      const leadIds = recipients.map((r: any) => r.lead_id).filter(Boolean)
      let leadsMap: Record<string, any> = {}
      if (leadIds.length > 0) {
        const { data: leads } = await adminClient
          .from('client_leads')
          .select('id, nome, cpf, telefone, banco_nome, perfil, status')
          .in('id', leadIds)
        if (leads) {
          for (const l of leads) {
            leadsMap[l.id] = l
          }
        }
      }

      let batchSent = 0
      let batchFailed = 0

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i]

        // Check blacklist
        if (blacklistSet.has(recipient.phone)) {
          await adminClient
            .from('broadcast_recipients')
            .update({ status: 'skipped', error_message: 'Número na blacklist' })
            .eq('id', recipient.id)
          totalSkipped++
          continue
        }

        try {
          // Get a chip with remaining daily capacity
          const activeChip = await getAvailableChip()
          if (!activeChip) {
            await adminClient
              .from('broadcast_recipients')
              .update({ status: 'skipped', error_message: 'Limite diário atingido em todos os chips' })
              .eq('id', recipient.id)
            totalSkipped++
            continue
          }
          const chipToken = activeChip.token

          // Determine which variant to use (A/B testing)
          let messageText = campaign.message_content
          let variant = 'A'
          if (campaign.ab_enabled && campaign.message_variant_b) {
            if (i % 2 === 1) {
              messageText = campaign.message_variant_b
              variant = 'B'
            }
          }

          // Variable substitution
          if (recipient.lead_id && leadsMap[recipient.lead_id]) {
            const lead = leadsMap[recipient.lead_id]
            messageText = replaceVariables(messageText, {
              nome: lead.nome,
              cpf: lead.cpf,
              telefone: lead.telefone,
              banco: lead.banco_nome,
              perfil: lead.perfil,
              status: lead.status,
            })
          }

          let sendOk = false
          let sentMessageId: string | null = null
          let sendError: string | null = null

          if (isMeta) {
            // ── META: invoke whatsapp-gateway with send-template action ──
            if (!campaign.meta_template_name) {
              sendError = 'Campanha Meta sem template configurado'
            } else {
              // Apply lead-driven substitution (supports both {type:'text',text:'{{var}}'} and {type:'lead_field',field:'nome'})
              let components = campaign.meta_template_components
              const leadObj = recipient.lead_id && leadsMap[recipient.lead_id] ? leadsMap[recipient.lead_id] : null
              const leadVars = leadObj ? {
                nome: leadObj.nome, cpf: leadObj.cpf, telefone: leadObj.telefone,
                banco: leadObj.banco_nome, perfil: leadObj.perfil, status: leadObj.status,
              } : null
              if (Array.isArray(components)) {
                components = applyComponentMapping(components, leadVars)
              }

              const { data: gwData, error: gwErr } = await adminClient.functions.invoke('whatsapp-gateway', {
                body: {
                  action: 'send-template',
                  chipId: activeChip.chipId,
                  phoneNumber: recipient.phone,
                  templateName: campaign.meta_template_name,
                  templateLanguage: campaign.meta_template_language || 'pt_BR',
                  templateComponents: components || undefined,
                  filledTemplateText: campaign.message_content,
                },
              })
              if (gwErr) {
                sendError = gwErr.message || 'Erro no gateway Meta'
              } else if (gwData?.success) {
                sendOk = true
                sentMessageId = gwData?.data?.messageId || null
              } else {
                sendError = gwData?.error || 'Falha no envio Meta'
              }
            }
          } else {
            // ── UazAPI: free text or media ──
            const chipToken = activeChip.token
            let response: Response

            if ((campaign.media_type === 'image' || campaign.media_type === 'document') && campaign.media_url) {
              const mediaBody: Record<string, string> = {
                number: recipient.phone,
                type: campaign.media_type,
                file: campaign.media_url,
              }
              if (messageText) mediaBody.text = messageText
              if (campaign.media_type === 'document' && campaign.media_filename) {
                mediaBody.docName = campaign.media_filename
              }
              response = await fetch(`${apiUrl}/send/media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'token': chipToken },
                body: JSON.stringify(mediaBody),
              })
            } else {
              response = await fetch(`${apiUrl}/send/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'token': chipToken },
                body: JSON.stringify({
                  number: recipient.phone,
                  text: messageText,
                }),
              })
            }

            const resData = await response.json().catch(() => ({}))
            if (response.ok) {
              sendOk = true
              sentMessageId = resData?.messageId || resData?.id || resData?.key?.id || null
            } else {
              sendError = resData.message || 'Send failed'
            }
          }

          if (sendOk) {
            await adminClient
              .from('broadcast_recipients')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                variant,
                message_id: sentMessageId,
                delivery_status: 'sent',
              })
              .eq('id', recipient.id)
            // Increment messages_sent_today for the chip used
            const { data: chipCurrent } = await adminClient
              .from('chips')
              .select('messages_sent_today')
              .eq('id', activeChip.chipId)
              .single()
            if (chipCurrent) {
              await adminClient
                .from('chips')
                .update({ messages_sent_today: (chipCurrent.messages_sent_today || 0) + 1 })
                .eq('id', activeChip.chipId)
            }
            batchSent++
            totalProcessed++
          } else {
            await adminClient
              .from('broadcast_recipients')
              .update({ status: 'failed', error_message: sendError || 'Send failed' })
              .eq('id', recipient.id)
            batchFailed++
            totalFailed++
          }
        } catch (err: any) {
          await adminClient
            .from('broadcast_recipients')
            .update({ status: 'failed', error_message: err.message || 'Network error' })
            .eq('id', recipient.id)
          batchFailed++
          totalFailed++
        }

        // Rate limiting delay
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }

      // Update campaign counters using fresh DB values (avoid stale reads)
      if (batchSent > 0 || batchFailed > 0) {
        const { data: freshCampaign } = await adminClient
          .from('broadcast_campaigns')
          .select('sent_count, failed_count, total_recipients')
          .eq('id', campaign.id)
          .single()

        if (freshCampaign) {
          const newSent = (freshCampaign.sent_count || 0) + batchSent
          const newFailed = (freshCampaign.failed_count || 0) + batchFailed
          
          await adminClient
            .from('broadcast_campaigns')
            .update({ sent_count: newSent, failed_count: newFailed })
            .eq('id', campaign.id)

          // Check if campaign is now complete (all recipients processed)
          const { count: pendingCount } = await adminClient
            .from('broadcast_recipients')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'pending')

          if (pendingCount === 0) {
            await adminClient
              .from('broadcast_campaigns')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', campaign.id)
            console.log(`Campaign ${campaign.id} completed after batch`)
          }
        }
      }
    }

    await writeAuditLog(adminClient, {
      action: 'broadcast_run',
      category: 'broadcasts',
      success: true,
      targetTable: 'broadcast_campaigns',
      targetId: campaignId ?? null,
      details: {
        campaigns: campaigns.length,
        processed: totalProcessed,
        failed: totalFailed,
        skipped: totalSkipped,
      },
    })

    return new Response(
      JSON.stringify({ ok: true, processed: totalProcessed, failed: totalFailed, skipped: totalSkipped }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Broadcast sender error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
