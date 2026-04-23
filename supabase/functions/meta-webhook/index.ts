import { createClient } from "npm:@supabase/supabase-js@2"
import { createHmac } from "node:crypto"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getMediaLabel(type: string): string {
  switch (type) {
    case 'image': return '📷 Imagem'
    case 'video': return '🎬 Vídeo'
    case 'audio': return '🎤 Áudio'
    case 'document': return '📄 Documento'
    case 'sticker': return '🎨 Sticker'
    default: return '📎 Mídia'
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // ===== GET: Meta Webhook Verification =====
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    // Get verify token from settings (DB priority, then env fallback)
    const { data: settings } = await adminClient
      .from('system_settings')
      .select('meta_verify_token')
      .limit(1)
      .maybeSingle()

    const verifyToken = (settings as any)?.meta_verify_token || Deno.env.get('META_VERIFY_TOKEN') || ''

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Meta webhook verified successfully')
      return new Response(challenge, { status: 200, headers: corsHeaders })
    }

    console.log('Meta webhook verification failed:', { mode, tokenMatch: token === verifyToken })
    return new Response('Verification failed', { status: 403, headers: corsHeaders })
  }

  // ===== POST: Meta Webhook Events =====
  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    // Verify signature — DB priority, then env fallback
    const { data: secretRow } = await adminClient
      .from('system_settings')
      .select('meta_webhook_secret')
      .limit(1)
      .maybeSingle()
    const webhookSecret = (secretRow as any)?.meta_webhook_secret || Deno.env.get('META_WEBHOOK_SECRET')
    if (webhookSecret) {
      const signature = req.headers.get('x-hub-signature-256')
      if (signature) {
        const expectedSig = 'sha256=' + createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
        if (signature !== expectedSig) {
          console.error('Meta webhook signature mismatch')
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    console.log('Meta webhook received:', JSON.stringify(payload).substring(0, 500))

    // Meta webhooks always have object = "whatsapp_business_account"
    if (payload.object !== 'whatsapp_business_account') {
      return new Response(JSON.stringify({ ok: true, message: 'Not a WhatsApp event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const entry of (payload.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue

        const value = change.value
        if (!value) continue

        const phoneNumberId = value.metadata?.phone_number_id
        const displayPhone = value.metadata?.display_phone_number

        if (!phoneNumberId) {
          console.log('No phone_number_id in webhook, skipping')
          continue
        }

        // Find the chip by meta_phone_number_id
        const { data: chip, error: chipError } = await adminClient
          .from('chips')
          .select('*')
          .eq('meta_phone_number_id', phoneNumberId)
          .single()

        if (chipError || !chip) {
          console.log(`No chip found for phone_number_id: ${phoneNumberId}`)
          continue
        }

        // Update last_webhook_at
        await adminClient.from('chips').update({
          last_webhook_at: new Date().toISOString(),
          status: 'connected',
        }).eq('id', chip.id)

        // Process messages
        if (value.messages) {
          for (const msg of value.messages) {
            await handleMetaMessage(adminClient, chip, msg, value.contacts)
          }
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleMetaStatus(adminClient, chip, status)
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Meta webhook error:', error?.message || error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ===== MESSAGE HANDLER =====
async function handleMetaMessage(adminClient: any, chip: any, msg: any, contacts?: any[]) {
  const from = msg.from // sender phone number
  const messageId = msg.id
  const timestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString()
  const remoteJid = `${from}@s.whatsapp.net`

  // Check for duplicate
  if (messageId) {
    const { data: existing } = await adminClient
      .from('message_history')
      .select('id')
      .eq('chip_id', chip.id)
      .eq('message_id', messageId)
      .maybeSingle()
    if (existing) {
      console.log(`Skipping duplicate Meta message: ${messageId}`)
      return
    }
  }

  // Extract message content based on type
  let messageContent = ''
  let mediaType = ''
  let displayText = ''

  if (msg.type === 'text') {
    messageContent = msg.text?.body || ''
    displayText = messageContent
  } else if (msg.type === 'image') {
    mediaType = 'image'
    messageContent = msg.image?.caption || ''
    displayText = msg.image?.caption || getMediaLabel('image')
  } else if (msg.type === 'video') {
    mediaType = 'video'
    messageContent = msg.video?.caption || ''
    displayText = msg.video?.caption || getMediaLabel('video')
  } else if (msg.type === 'audio') {
    mediaType = msg.audio?.voice ? 'ptt' : 'audio'
    displayText = getMediaLabel('audio')
  } else if (msg.type === 'document') {
    mediaType = 'document'
    messageContent = msg.document?.caption || msg.document?.filename || ''
    displayText = msg.document?.filename || getMediaLabel('document')
  } else if (msg.type === 'sticker') {
    mediaType = 'sticker'
    displayText = getMediaLabel('sticker')
  } else if (msg.type === 'reaction') {
    // Handle reactions — update existing message (don't create new entry)
    console.log(`Meta reaction: ${msg.reaction?.emoji} on ${msg.reaction?.message_id}`)
    return
  } else if (msg.type === 'interactive' || msg.type === 'button') {
    messageContent = msg.interactive?.body?.text || msg.button?.text || '[Interativo]'
    displayText = messageContent
  } else {
    messageContent = `[${msg.type || 'unknown'}]`
    displayText = messageContent
  }

  // Get media ID for later download
  const mediaId = msg[msg.type]?.id || null

  // Insert message into history
  await adminClient.from('message_history').insert({
    chip_id: chip.id,
    message_content: messageContent || displayText,
    direction: 'incoming',
    status: 'delivered',
    recipient_phone: from,
    remote_jid: remoteJid,
    message_id: messageId,
    sender_name: getContactName(contacts, from),
    media_type: mediaType || null,
    media_url: mediaId || null, // Store Meta media ID for later download
    created_at: timestamp,
  })

  // Upsert conversation
  const contactName = getContactName(contacts, from) || from
  const { data: existingConv } = await adminClient
    .from('conversations')
    .select('id, unread_count')
    .eq('chip_id', chip.id)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  const newUnread = (existingConv?.unread_count || 0) + 1

  await adminClient.from('conversations').upsert({
    chip_id: chip.id,
    remote_jid: remoteJid,
    contact_name: contactName,
    contact_phone: from,
    last_message_text: displayText || messageContent,
    last_message_at: timestamp,
    unread_count: newUnread,
    is_group: false,
  }, { onConflict: 'chip_id,remote_jid' })

  // Log cost for incoming
  try {
    await adminClient.from('whatsapp_cost_log').insert({
      chip_id: chip.id,
      direction: 'incoming',
      category: 'service',
      cost_estimate: 0,
      currency: 'BRL',
    })
  } catch { /* non-critical */ }

  console.log(`Meta message saved: incoming from ${from}, type=${msg.type}`)
}

// ===== STATUS HANDLER =====
async function handleMetaStatus(adminClient: any, chip: any, status: any) {
  const messageId = status.id
  const statusValue = status.status // sent, delivered, read, failed

  if (!messageId || !statusValue) return

  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  }

  const newStatus = statusMap[statusValue]
  if (!newStatus) {
    console.log(`Meta unknown status: ${statusValue}`)
    return
  }

  // Apply with downgrade protection
  const statusRank: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 0 }
  const newRank = statusRank[newStatus] || 0
  const excludeStatuses = Object.entries(statusRank)
    .filter(([, rank]) => rank >= newRank && newRank > 0)
    .map(([s]) => s)

  if (newStatus === 'failed') {
    // Failed can always override
    await adminClient
      .from('message_history')
      .update({ status: 'failed' })
      .eq('chip_id', chip.id)
      .eq('message_id', messageId)
  } else {
    await adminClient
      .from('message_history')
      .update({ status: newStatus })
      .eq('chip_id', chip.id)
      .eq('message_id', messageId)
      .not('status', 'in', `(${excludeStatuses.join(',')})`)
  }

  // Handle errors
  if (status.errors && status.errors.length > 0) {
    const errorMsg = status.errors[0]?.title || status.errors[0]?.message || 'Unknown error'
    console.error(`Meta message ${messageId} error: ${errorMsg}`)
  }

  console.log(`Meta status update: ${messageId} -> ${newStatus}`)
}

// ===== HELPERS =====
function getContactName(contacts: any[] | undefined, phone: string): string {
  if (!contacts) return ''
  const contact = contacts.find((c: any) => c.wa_id === phone)
  return contact?.profile?.name || ''
}
