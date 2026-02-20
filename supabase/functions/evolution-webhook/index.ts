import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getMediaLabel(type: string): string {
  switch (type) {
    case 'image': return '📷 Imagem'
    case 'video': return '🎬 Vídeo'
    case 'audio': case 'ptt': return '🎤 Áudio'
    case 'document': return '📄 Documento'
    case 'sticker': return '🎨 Sticker'
    default: return '📎 Mídia'
  }
}

function safeString(val: unknown): string {
  if (typeof val === 'string') return val
  return ''
}

// Normaliza messageType PascalCase da UazAPI para tipo simples
function normalizeMessageType(raw: string): string {
  if (!raw) return ''
  const lower = raw.toLowerCase().replace('message', '')
  const map: Record<string, string> = {
    'image': 'image', 'audio': 'audio', 'ptt': 'ptt',
    'video': 'video', 'document': 'document', 'sticker': 'sticker',
    'conversation': 'text', 'chat': 'text', 'text': 'text',
    'ptv': 'ptv', 'myaudio': 'myaudio',
  }
  return map[lower] || ''
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

    const payload = await req.json()
    console.log('Webhook received:', JSON.stringify(payload))

    const eventType = payload.EventType || payload.event
    const instanceName = payload.instanceName || payload.instance

    if (!instanceName) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No instance name' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: chip, error: chipError } = await adminClient
      .from('chips')
      .select('*')
      .eq('instance_name', instanceName)
      .single()

    if (chipError || !chip) {
      console.log('Chip not found for instance:', instanceName)
      return new Response(
        JSON.stringify({ ok: true, message: 'Chip not found, ignoring' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (eventType === 'messages' && payload.message) {
      await handleUazapiMessage(adminClient, chip, payload)
    } else if (eventType === 'chats' && payload.chat) {
      await handleUazapiChat(adminClient, chip, payload)
    } else if (eventType === 'messages_update') {
      console.log('Messages update event (read receipt):', payload.state)
    } else if (eventType === 'connection.update' || payload.event === 'connection.update') {
      await handleConnectionUpdate(adminClient, chip, payload)
    } else if (eventType === 'qrcode.updated') {
      await adminClient.from('chips').update({ status: 'connecting' }).eq('id', chip.id)
    } else {
      if (payload.event) {
        await handleEvolutionEvent(adminClient, chip, payload)
      } else {
        console.log('Unhandled event type:', eventType)
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleUazapiMessage(adminClient: any, chip: any, payload: any) {
  const msg = payload.message
  const chat = payload.chat

  if (!msg || !msg.chatid) return
  if (msg.chatid === 'status@broadcast') return

  // Deduplication: skip if message_id already exists
  const existingMsgId = msg.messageid || msg.id || null
  if (existingMsgId) {
    const { data: existingMsg } = await adminClient
      .from('message_history')
      .select('id')
      .eq('chip_id', chip.id)
      .eq('message_id', existingMsgId)
      .maybeSingle()
    if (existingMsg) {
      console.log(`Skipping duplicate message: ${existingMsgId}`)
      return
    }
  }

  const messageContent = safeString(msg.text)
  const isFromMe = msg.fromMe === true
  const remoteJid = msg.chatid
  const recipientPhone = remoteJid.split('@')[0].replace(/\D/g, '')
  const senderName = safeString(msg.senderName) || safeString(chat?.name) || ''

  // Determine display text for sidebar — fallback para messageType normalizado
  const rawMediaType = safeString(msg.mediaType)
  const mediaType = rawMediaType || normalizeMessageType(safeString(msg.messageType))
  const isMedia = mediaType && mediaType !== 'text' && mediaType !== 'chat'
  const displayText = isMedia ? getMediaLabel(mediaType) : messageContent

  await adminClient.from('message_history').insert({
    chip_id: chip.id,
    message_content: messageContent,
    direction: isFromMe ? 'outgoing' : 'incoming',
    status: 'delivered',
    recipient_phone: recipientPhone || null,
    remote_jid: remoteJid,
    message_id: msg.messageid || msg.id || null,
    sender_name: senderName,
    media_type: mediaType || null,
  })

  const contactName = safeString(chat?.name) || safeString(chat?.wa_name) || senderName || recipientPhone
  const contactPhone = safeString(chat?.phone) || recipientPhone

  // Get current unread count for increment
  const { data: existing } = await adminClient
    .from('conversations')
    .select('id, unread_count')
    .eq('chip_id', chip.id)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  const newUnread = isFromMe ? (existing?.unread_count || 0) : (existing?.unread_count || 0) + 1

  // UPSERT to prevent race condition duplicates
  await adminClient.from('conversations').upsert({
    chip_id: chip.id,
    remote_jid: remoteJid,
    contact_name: contactName,
    contact_phone: contactPhone,
    last_message_text: displayText,
    last_message_at: new Date().toISOString(),
    unread_count: newUnread,
    is_group: msg.isGroup || false,
  }, { onConflict: 'chip_id,remote_jid' })

  console.log(`UazAPI message saved: ${isFromMe ? 'outgoing' : 'incoming'} from ${senderName}`)
}

async function handleUazapiChat(adminClient: any, chip: any, payload: any) {
  const chat = payload.chat
  if (!chat || !chat.wa_chatid) return

  const remoteJid = chat.wa_chatid
  const contactName = safeString(chat.name) || safeString(chat.wa_name) || ''
  const contactPhone = safeString(chat.phone) || remoteJid.split('@')[0]

  // UPSERT to prevent race condition duplicates
  await adminClient.from('conversations').upsert({
    chip_id: chip.id,
    remote_jid: remoteJid,
    ...conversationData,
  }, { onConflict: 'chip_id,remote_jid' })
}

async function handleConnectionUpdate(adminClient: any, chip: any, payload: any) {
  const data = payload.data || payload
  const state = data?.state || data?.status || 'unknown'
  let newStatus = 'disconnected'

  if (state === 'open' || state === 'connected') newStatus = 'connected'
  else if (state === 'connecting' || state === 'qr') newStatus = 'connecting'

  const updateData: Record<string, any> = { status: newStatus }
  if (newStatus === 'connected' && !chip.activated_at) {
    updateData.activated_at = new Date().toISOString()
  }

  let phoneNumber = null
  if (data?.jid) phoneNumber = data.jid.split('@')[0].replace(/\D/g, '')
  else if (data?.wid) phoneNumber = data.wid.split('@')[0].replace(/\D/g, '')
  else if (data?.owner) phoneNumber = data.owner.split('@')[0].replace(/\D/g, '')
  else if (payload?.owner) phoneNumber = payload.owner.split('@')[0].replace(/\D/g, '')
  
  if (phoneNumber && phoneNumber.length >= 10) {
    updateData.phone_number = phoneNumber
  }

  await adminClient.from('chips').update(updateData).eq('id', chip.id)

  // Log lifecycle event
  await adminClient.from('chip_lifecycle_logs').insert({
    chip_id: chip.id,
    event: newStatus,
    details: `Connection update via webhook: ${state} -> ${newStatus}${phoneNumber ? ` (${phoneNumber})` : ''}`,
  }).catch(() => {})

  console.log(`Chip ${chip.instance_name} status: ${newStatus}`)
}

async function handleEvolutionEvent(adminClient: any, chip: any, payload: any) {
  const { event, data } = payload

  switch (event) {
    case 'connection.update': {
      await handleConnectionUpdate(adminClient, chip, payload)
      break
    }
    case 'messages.upsert': {
      const messages = data?.messages || data || []
      const messageList = Array.isArray(messages) ? messages : [messages]
      for (const msg of messageList) {
        if (msg.key?.remoteJid === 'status@broadcast') continue
        if (!msg.message?.conversation && !msg.message?.extendedTextMessage?.text) continue
        const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
        const isFromMe = msg.key?.fromMe || false
        const remoteJid = msg.key?.remoteJid || ''
        const recipientPhone = remoteJid.split('@')[0].replace(/\D/g, '')
        await adminClient.from('message_history').insert({
          chip_id: chip.id,
          message_content: messageContent,
          direction: isFromMe ? 'outgoing' : 'incoming',
          status: 'delivered',
          recipient_phone: recipientPhone || null,
        })
      }
      break
    }
    case 'qrcode.updated':
      await adminClient.from('chips').update({ status: 'connecting' }).eq('id', chip.id)
      break
    default:
      console.log('Unhandled Evolution event:', event)
  }
}
