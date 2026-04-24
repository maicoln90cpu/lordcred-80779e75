import { createClient } from "npm:@supabase/supabase-js@2.49.4"
import { writeAuditLog } from "../_shared/auditLog.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Format ISO timestamp into Brazilian date/time strings (America/Sao_Paulo).
 */
function formatBrazilDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  try {
    const d = new Date(iso)
    const date = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
    const time = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
    return { date, time }
  } catch {
    return { date: '', time: '' }
  }
}

function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match)
}

/**
 * Send a WhatsApp text message via UazAPI using the chip's instance token.
 * Returns { ok: boolean, error?: string }.
 */
async function sendUazapiText(
  apiUrl: string,
  chipToken: string,
  phone: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': chipToken },
      body: JSON.stringify({ number: phone, text }),
    })
    if (!response.ok) {
      const err = await response.text().catch(() => '')
      return { ok: false, error: `HTTP ${response.status}: ${err.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'network error' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Get UazAPI base URL from system_settings
    const { data: providerSettings } = await admin
      .from('system_settings')
      .select('provider_api_url')
      .limit(1)
      .maybeSingle()

    const apiUrl = (providerSettings?.provider_api_url || '').replace(/\/$/, '')
    if (!apiUrl) {
      return jsonResponse({ success: false, error: 'UazAPI not configured', processed: 0 })
    }

    // 2. Fetch pending notifications due now
    const { data: pending, error: pendErr } = await admin
      .from('hr_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('send_at', new Date().toISOString())
      .order('send_at', { ascending: true })
      .limit(50)

    if (pendErr) {
      console.error('[hr-notification-sender] fetch error:', pendErr)
      return jsonResponse({ success: false, error: pendErr.message, processed: 0 })
    }

    if (!pending || pending.length === 0) {
      return jsonResponse({ success: true, message: 'No pending notifications', processed: 0 })
    }

    // 3. Pre-load notification settings (templates)
    const { data: settings } = await admin
      .from('hr_notification_settings')
      .select('template_1_text, template_2_text')
      .limit(1)
      .maybeSingle()

    const tpl1 = settings?.template_1_text || 'Olá {name}! Lembrando que sua entrevista está agendada para {date} às {time}. Até lá!'
    const tpl2 = settings?.template_2_text || 'Olá {name}! Sua entrevista começa em 30 minutos ({time}). Estaremos te aguardando!'

    let sent = 0
    let failed = 0

    for (const notif of pending) {
      try {
        // Resolve chip
        if (!notif.chip_instance_id) {
          await admin.from('hr_notifications').update({
            status: 'failed',
            sent_at: new Date().toISOString(),
          }).eq('id', notif.id)
          failed++
          continue
        }

        const { data: chip } = await admin
          .from('chips')
          .select('id, instance_token, status')
          .eq('id', notif.chip_instance_id)
          .maybeSingle()

        if (!chip || !chip.instance_token) {
          await admin.from('hr_notifications').update({
            status: 'failed',
            sent_at: new Date().toISOString(),
          }).eq('id', notif.id)
          failed++
          continue
        }

        // Resolve linked entity (interview or meeting) to get name + scheduled time
        let candidateName = ''
        let scheduledIso: string | null = null

        if (notif.entity_type === 'interview') {
          const { data: interview } = await admin
            .from('hr_interviews')
            .select('scheduled_at, candidate_id')
            .eq('id', notif.entity_id)
            .maybeSingle()
          if (interview) {
            scheduledIso = interview.scheduled_at
            if (interview.candidate_id) {
              const { data: cand } = await admin
                .from('hr_candidates')
                .select('full_name')
                .eq('id', interview.candidate_id)
                .maybeSingle()
              candidateName = cand?.full_name || ''
            }
          }
        } else if (notif.entity_type === 'meeting') {
          const { data: lead } = await admin
            .from('hr_partner_leads')
            .select('full_name, meeting_date')
            .eq('id', notif.entity_id)
            .maybeSingle()
          if (lead) {
            candidateName = lead.full_name || ''
            scheduledIso = lead.meeting_date ? new Date(lead.meeting_date).toISOString() : null
          }
        }

        const { date, time } = formatBrazilDateTime(scheduledIso)
        const baseTemplate = notif.message_template === 'template_2' ? tpl2 : tpl1

        // Build recipient list
        const recipients: string[] = []
        if (notif.recipient_type === 'candidate' || notif.recipient_type === 'both') {
          if (notif.phone_candidate) recipients.push(notif.phone_candidate)
        }
        if (notif.recipient_type === 'interviewer' || notif.recipient_type === 'both') {
          if (notif.phone_interviewer) recipients.push(notif.phone_interviewer)
        }

        if (recipients.length === 0) {
          await admin.from('hr_notifications').update({
            status: 'failed',
            sent_at: new Date().toISOString(),
          }).eq('id', notif.id)
          failed++
          continue
        }

        const message = replaceVars(baseTemplate, {
          name: candidateName || 'candidato',
          date,
          time,
        })

        let allOk = true
        for (const phone of recipients) {
          const result = await sendUazapiText(apiUrl, chip.instance_token, phone, message)
          if (!result.ok) {
            allOk = false
            console.error(`[hr-notification-sender] send fail to ${phone}:`, result.error)
          }
        }

        await admin.from('hr_notifications').update({
          status: allOk ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
        }).eq('id', notif.id)

        if (allOk) sent++
        else failed++
      } catch (innerErr) {
        console.error('[hr-notification-sender] processing error:', innerErr)
        await admin.from('hr_notifications').update({
          status: 'failed',
          sent_at: new Date().toISOString(),
        }).eq('id', notif.id)
        failed++
      }
    }

    return jsonResponse({
      success: true,
      processed: pending.length,
      sent,
      failed,
    })
  } catch (e) {
    console.error('[hr-notification-sender] fatal:', e)
    // Never return 500 — keeps cron from failing loudly
    return jsonResponse({ success: false, error: (e as Error).message || 'unknown error' })
  }
})
