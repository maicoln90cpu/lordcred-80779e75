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
      await handleMessagesUpdate(adminClient, chip, payload)
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

  const contactName = safeString(chat?.wa_contactName) || safeString(chat?.name) || senderName || recipientPhone
  const waName = safeString(chat?.wa_name) || ''
  const contactPhone = safeString(chat?.phone) || recipientPhone
  const profilePicUrl = safeString(chat?.imagePreview) || safeString(chat?.image) || null

  // Get current unread count for increment
  const { data: existing } = await adminClient
    .from('conversations')
    .select('id, unread_count')
    .eq('chip_id', chip.id)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  const newUnread = isFromMe ? (existing?.unread_count || 0) : (existing?.unread_count || 0) + 1

  const upsertData: any = {
    chip_id: chip.id,
    remote_jid: remoteJid,
    contact_name: contactName,
    contact_phone: contactPhone,
    last_message_text: displayText,
    last_message_at: new Date().toISOString(),
    unread_count: newUnread,
    is_group: msg.isGroup || false,
  }
  if (waName) upsertData.wa_name = waName
  if (profilePicUrl) upsertData.profile_pic_url = profilePicUrl

  // UPSERT to prevent race condition duplicates
  await adminClient.from('conversations').upsert(upsertData, { onConflict: 'chip_id,remote_jid' })

  // Auto-correct: if this is a @s.whatsapp.net message, check for duplicate @lid conversation
  // and delete it (the @s.whatsapp.net conv from the upsert above is the correct one)
  if (remoteJid.includes('@s.whatsapp.net') && contactName) {
    try {
      const { data: lidConvos } = await adminClient
        .from('conversations')
        .select('id, remote_jid, contact_name')
        .eq('chip_id', chip.id)
        .like('remote_jid', '%@lid')

      if (lidConvos && lidConvos.length > 0) {
        // Match by contact_name (since contact_phone on @lid convos contains LID, not phone)
        const match = lidConvos.filter(c => c.contact_name === contactName)
        if (match.length === 1) {
          console.log(`Auto-correcting: deleting @lid conv ${match[0].remote_jid} (duplicate of ${remoteJid})`)
          await adminClient.from('conversations').delete().eq('id', match[0].id)
        }
      }
    } catch (e) {
      console.error('Auto-correct LID cleanup error:', e)
    }
  }

  console.log(`UazAPI message saved: ${isFromMe ? 'outgoing' : 'incoming'} from ${senderName}`)
}

async function handleUazapiChat(adminClient: any, chip: any, payload: any) {
  const chat = payload.chat
  if (!chat || !chat.wa_chatid) return

  const remoteJid = chat.wa_chatid
  const contactName = safeString(chat.wa_contactName) || safeString(chat.name) || ''
  const waName = safeString(chat.wa_name) || ''
  const contactPhone = safeString(chat.phone) || remoteJid.split('@')[0]
  const profilePicUrl = safeString(chat.imagePreview) || safeString(chat.image) || null

  const upsertData: any = {
    chip_id: chip.id,
    remote_jid: remoteJid,
    contact_name: contactName,
    contact_phone: contactPhone,
    is_group: chat.wa_isGroup || remoteJid.includes('@g.us') || false,
  }
  if (waName) upsertData.wa_name = waName
  if (profilePicUrl) upsertData.profile_pic_url = profilePicUrl
  
  // Sync unread count from UazAPI when available
  if (typeof chat.wa_unreadCount === 'number') {
    upsertData.unread_count = chat.wa_unreadCount
  }

  // UPSERT to prevent race condition duplicates
  await adminClient.from('conversations').upsert(upsertData, { onConflict: 'chip_id,remote_jid' })
}

async function handleMessagesUpdate(adminClient: any, chip: any, payload: any) {
  // Handle message status updates (sent, delivered, read)
  console.log('messages_update FULL payload:', JSON.stringify(payload))
  
  // UazAPI sends messages_update with message object at root or nested
  // Try to build update list from various formats
  let updateList: any[] = []
  
  if (payload.message && payload.message.messageid) {
    // Most common: message object with status info at root
    updateList = [payload.message]
  } else if (payload.updates && Array.isArray(payload.updates)) {
    updateList = payload.updates
  } else if (payload.data && Array.isArray(payload.data)) {
    updateList = payload.data
  } else if (payload.messageid) {
    // Status fields directly on payload root
    updateList = [payload]
  } else {
    updateList = [payload]
  }

  for (const update of updateList) {
    if (!update) continue
    // Try multiple field names for message ID
    const messageId = update?.messageid || update?.message?.messageid || update?.key?.id || update?.id || payload?.messageid
    // Try multiple field names for state/status
    const state = update?.state || update?.status || update?.ack || update?.message?.status || payload?.state || payload?.ack
    
    console.log(`messages_update: extracted messageId=${messageId}, state=${state} (type: ${typeof state})`)
    
    if (!messageId || state === undefined || state === null) continue

    // Map UazAPI states to our status — comprehensive mapping
    let newStatus = ''
    const stateStr = String(state).toLowerCase()
    
    // Handle deletion (revoked/deleted)
    if (stateStr === 'revoked' || stateStr === 'deleted' || state === 0) {
      console.log(`Message ${messageId} was deleted/revoked`)
      const { error: delError } = await adminClient
        .from('message_history')
        .update({ message_content: '[Mensagem apagada]', status: 'deleted' })
        .eq('chip_id', chip.id)
        .eq('message_id', messageId)
      if (!delError) {
        console.log(`Message ${messageId} marked as deleted in DB`)
      }
      continue
    }

    // Handle edit (edited message text)
    if (stateStr === 'edited' || update?.editedMessage || update?.message?.editedMessage) {
      const editedText = update?.editedMessage?.text || update?.message?.editedMessage?.text || update?.editedMessage?.conversation || ''
      if (editedText) {
        console.log(`Message ${messageId} was edited: ${editedText.substring(0, 50)}`)
        await adminClient
          .from('message_history')
          .update({ message_content: editedText })
          .eq('chip_id', chip.id)
          .eq('message_id', messageId)
      }
      continue
    }

    // Numeric: 0=pending, 1=sent, 2=delivered/server_ack, 3=delivered, 4=read, 5=played
    if (state === 4 || state === 5 || stateStr === 'read' || stateStr === 'played' || stateStr === 'read_by_me' || stateStr === '4' || stateStr === '5') {
      newStatus = 'read'
    } else if (state === 3 || stateStr === 'delivered' || stateStr === 'delivery_ack' || stateStr === '3') {
      newStatus = 'delivered'
    } else if (state === 2 || state === 1 || stateStr === 'sent' || stateStr === 'server_ack' || stateStr === '2' || stateStr === '1') {
      newStatus = 'sent'
    }

    if (!newStatus) {
      console.log(`Unknown message status state: ${state} (type: ${typeof state})`)
      continue
    }

    const { error } = await adminClient
      .from('message_history')
      .update({ status: newStatus })
      .eq('chip_id', chip.id)
      .eq('message_id', messageId)

    if (!error) {
      console.log(`Message ${messageId} status updated to ${newStatus} (raw state: ${state})`)
    } else {
      console.log(`Failed to update message ${messageId}: ${error.message}`)
    }
  }
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
