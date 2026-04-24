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

async function logWebhook(adminClient: any, chipId: string | null, instanceName: string | null, eventType: string, payload: any, statusCode: number, result: string) {
  try {
    await adminClient.from('webhook_logs').insert({
      chip_id: chipId,
      instance_name: instanceName,
      event_type: eventType,
      payload,
      status_code: statusCode,
      processing_result: result,
    })
  } catch (e: any) {
    console.error('Failed to log webhook:', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    const payload = await req.json()
    console.log('Webhook received:', JSON.stringify(payload))

    const eventType = payload.EventType || payload.event
    const instanceName = payload.instanceName || payload.instance

    if (!instanceName) {
      await logWebhook(adminClient, null, null, eventType || 'unknown', payload, 200, 'No instance name')
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
      await logWebhook(adminClient, null, instanceName, eventType || 'unknown', payload, 200, 'Chip not found')
      console.log('Chip not found for instance:', instanceName)
      return new Response(
        JSON.stringify({ ok: true, message: 'Chip not found, ignoring' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let processingResult = 'unhandled'

    // Update last_webhook_at on every webhook received for this chip
    await adminClient.from('chips').update({ last_webhook_at: new Date().toISOString() }).eq('id', chip.id)

    if (eventType === 'messages' && payload.message) {
      await handleUazapiMessage(adminClient, chip, payload)
      processingResult = 'message_processed'

      // ── Broadcast reply detection ──
      if (!payload.message.fromMe) {
        try {
          await detectBroadcastReply(adminClient, chip, payload)
        } catch (e: any) {
          console.error('Broadcast reply detection error:', e)
        }
      }
    } else if (eventType === 'chats' && payload.chat) {
      await handleUazapiChat(adminClient, chip, payload)
      processingResult = 'chat_processed'
    } else if (eventType === 'messages_update') {
      await handleMessagesUpdate(adminClient, chip, payload)
      processingResult = 'status_update_processed'

      // ── Broadcast delivery status cross-reference ──
      try {
        await updateBroadcastDeliveryStatus(adminClient, payload)
      } catch (e: any) {
        console.error('Broadcast delivery status error:', e)
      }
    } else if (eventType === 'connection.update' || payload.event === 'connection.update') {
      await handleConnectionUpdate(adminClient, chip, payload)
      processingResult = 'connection_update_processed'
    } else if (eventType === 'qrcode.updated') {
      await adminClient.from('chips').update({ status: 'connecting' }).eq('id', chip.id)
      processingResult = 'qrcode_updated'
    } else {
      console.log('Unhandled event type:', eventType)
      processingResult = `unhandled: ${eventType}`
    }

    await logWebhook(adminClient, chip.id, instanceName, eventType || 'unknown', payload, 200, processingResult)

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Webhook error:', error)
    // Try to log even on error
    try {
      const rawBody = error.message || 'Internal error'
      await logWebhook(adminClient, null, null, 'error', { error: rawBody }, 500, rawBody)
    } catch (_: any) {}
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

  const rawMediaType = safeString(msg.mediaType)
  const mediaType = (rawMediaType && rawMediaType !== 'url') ? rawMediaType : normalizeMessageType(safeString(msg.messageType))
  const isMedia = mediaType && mediaType !== 'text' && mediaType !== 'chat' && mediaType !== 'url'
  const displayText = isMedia ? getMediaLabel(mediaType) : messageContent

  const quotedMessageId = safeString(msg.quoted) || null

  await adminClient.from('message_history').insert({
    chip_id: chip.id,
    message_content: messageContent,
    direction: isFromMe ? 'outgoing' : 'incoming',
    status: isFromMe ? 'sent' : 'delivered',
    recipient_phone: recipientPhone || null,
    remote_jid: remoteJid,
    message_id: msg.messageid || msg.id || null,
    sender_name: senderName,
    media_type: mediaType || null,
    quoted_message_id: quotedMessageId,
  })

  const contactName = safeString(chat?.wa_contactName) || safeString(chat?.name) || (!isFromMe ? senderName : '') || recipientPhone
  const waName = safeString(chat?.wa_name) || ''
  const contactPhone = safeString(chat?.phone) || recipientPhone
  const profilePicUrl = safeString(chat?.imagePreview) || safeString(chat?.image) || null

  const { data: existing } = await adminClient
    .from('conversations')
    .select('id, unread_count, contact_name')
    .eq('chip_id', chip.id)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  const newUnread = isFromMe ? (existing?.unread_count || 0) : (existing?.unread_count || 0) + 1

  const isRealName = contactName && !/^\d+$/.test(contactName)

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

  if (existing && existing.contact_name && !isRealName) {
    delete upsertData.contact_name
  }

  if (waName) upsertData.wa_name = waName
  if (profilePicUrl) upsertData.profile_pic_url = profilePicUrl

  await adminClient.from('conversations').upsert(upsertData, { onConflict: 'chip_id,remote_jid' })

  if (remoteJid.includes('@s.whatsapp.net') && contactName) {
    try {
      const { data: lidConvos } = await adminClient
        .from('conversations')
        .select('id, remote_jid, contact_name')
        .eq('chip_id', chip.id)
        .like('remote_jid', '%@lid')

      if (lidConvos && lidConvos.length > 0) {
        const match = lidConvos.filter((c: any) => c.contact_name === contactName)
        if (match.length === 1) {
          console.log(`Auto-correcting: deleting @lid conv ${match[0].remote_jid} (duplicate of ${remoteJid})`)
          await adminClient.from('conversations').delete().eq('id', match[0].id)
        }
      }
    } catch (e: any) {
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
  
  if (typeof chat.wa_unreadCount === 'number') {
    const { data: existing } = await adminClient
      .from('conversations')
      .select('unread_count')
      .eq('chip_id', chip.id)
      .eq('remote_jid', remoteJid)
      .maybeSingle()
    
    const currentCount = existing?.unread_count || 0
    const snapshotCount = chat.wa_unreadCount
    
    if (!existing || snapshotCount < currentCount) {
      upsertData.unread_count = snapshotCount
      console.log(`chats event: unread ${currentCount} -> ${snapshotCount} for ${remoteJid} (correction)`)
    } else {
      console.log(`chats event: ignoring unread snapshot ${snapshotCount} (current: ${currentCount}) for ${remoteJid}`)
    }
  }

  await adminClient.from('conversations').upsert(upsertData, { onConflict: 'chip_id,remote_jid' })
}

async function handleMessagesUpdate(adminClient: any, chip: any, payload: any) {
  console.log('messages_update payload:', JSON.stringify(payload).substring(0, 500))

  // ── 1. Determine the status from UazAPI payload ──
  // UazAPI sends: event.Type (Read/Played/Delivered) and/or state at root
  const eventType = payload?.event?.Type || ''
  const rootState = payload?.state || ''
  const stateRaw = eventType || rootState
  const stateStr = String(stateRaw).toLowerCase()

  console.log(`messages_update: event.Type=${eventType}, state=${rootState}, resolved=${stateStr}`)

  // ── 2. Collect all message IDs ──
  // UazAPI v2 primary format: event.MessageIDs (array)
  // Fallback formats for legacy/other payloads
  let messageIds: string[] = []

  if (payload?.event?.MessageIDs && Array.isArray(payload.event.MessageIDs)) {
    messageIds = payload.event.MessageIDs.filter((id: any) => typeof id === 'string' && id.length > 0)
  }

  // Fallback: single message ID from various legacy fields
  if (messageIds.length === 0) {
    const singleId = payload?.messageid || payload?.message?.messageid || payload?.key?.id || payload?.id
    if (singleId) messageIds = [singleId]
  }

  // Fallback: updates array (legacy format)
  if (messageIds.length === 0 && payload?.updates && Array.isArray(payload.updates)) {
    for (const u of payload.updates) {
      const mid = u?.messageid || u?.key?.id || u?.id
      if (mid) messageIds.push(mid)
    }
  }

  if (messageIds.length === 0) {
    console.log('messages_update: no message IDs found in payload, skipping')
    return
  }

  console.log(`messages_update: ${messageIds.length} message ID(s): [${messageIds.slice(0, 5).join(', ')}${messageIds.length > 5 ? '...' : ''}]`)

  // ── 3. Handle special states (revoked/edited) ──
  if (stateStr === 'revoked' || stateStr === 'deleted') {
    for (const mid of messageIds) {
      const { data, error } = await adminClient
        .from('message_history')
        .update({ message_content: '[Mensagem apagada]', status: 'deleted' })
        .eq('chip_id', chip.id)
        .eq('message_id', mid)
        .select('id')
      console.log(`Message ${mid} deleted: ${data?.length || 0} row(s) affected${error ? ', error: ' + error.message : ''}`)
    }
    return
  }

  if (stateStr === 'edited') {
    const editedText = payload?.event?.editedMessage?.text || payload?.editedMessage?.text || payload?.message?.editedMessage?.text || ''
    if (editedText) {
      for (const mid of messageIds) {
        await adminClient
          .from('message_history')
          .update({ message_content: editedText })
          .eq('chip_id', chip.id)
          .eq('message_id', mid)
        console.log(`Message ${mid} edited: ${editedText.substring(0, 50)}`)
      }
    }
    return
  }

  // ── 4. Map state to our status ──
  let newStatus = ''
  if (stateStr === 'read' || stateStr === 'played' || stateStr === 'read_by_me' || stateStr === '4' || stateStr === '5') {
    newStatus = 'read'
  } else if (stateStr === 'delivered' || stateStr === 'delivery_ack' || stateStr === '3') {
    newStatus = 'delivered'
  } else if (stateStr === 'sent' || stateStr === 'server_ack' || stateStr === '1' || stateStr === '2') {
    newStatus = 'sent'
  }

  if (!newStatus) {
    console.log(`messages_update: unknown state "${stateRaw}", skipping`)
    return
  }

  // ── 5. Batch update all message IDs (with downgrade protection) ──
  // Status hierarchy: sent(1) → delivered(2) → read(3). Never downgrade.
  const statusRank: Record<string, number> = { sent: 1, delivered: 2, read: 3 }
  const newRank = statusRank[newStatus] || 0
  const excludeStatuses = Object.entries(statusRank)
    .filter(([, rank]) => rank >= newRank)
    .map(([s]) => s)

  let totalUpdated = 0

  // Build query: update only messages whose current status is "lower" than newStatus
  if (messageIds.length === 1) {
    const { data, error } = await adminClient
      .from('message_history')
      .update({ status: newStatus })
      .eq('chip_id', chip.id)
      .eq('message_id', messageIds[0])
      .not('status', 'in', `(${excludeStatuses.join(',')})`)
      .select('id')
    totalUpdated = data?.length || 0
    if (error) console.log(`Failed to update ${messageIds[0]}: ${error.message}`)
  } else {
    const { data, error } = await adminClient
      .from('message_history')
      .update({ status: newStatus })
      .eq('chip_id', chip.id)
      .in('message_id', messageIds)
      .not('status', 'in', `(${excludeStatuses.join(',')})`)
      .select('id')
    totalUpdated = data?.length || 0
    if (error) console.log(`Failed batch update: ${error.message}`)
  }

  console.log(`messages_update: status=${newStatus}, IDs=${messageIds.length}, matched=${totalUpdated}`)
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

  await adminClient.from('chip_lifecycle_logs').insert({
    chip_id: chip.id,
    event: newStatus,
    details: `Connection update via webhook: ${state} -> ${newStatus}${phoneNumber ? ` (${phoneNumber})` : ''}`,
  }).catch(() => {})

  console.log(`Chip ${chip.instance_name} status: ${newStatus}`)
}

// ── Broadcast delivery status cross-reference ──
async function updateBroadcastDeliveryStatus(adminClient: any, payload: any) {
  const eventType = payload?.event?.Type || ''
  const stateStr = String(eventType || payload?.state || '').toLowerCase()

  let newDeliveryStatus = ''
  if (stateStr === 'read' || stateStr === 'played' || stateStr === '4' || stateStr === '5') {
    newDeliveryStatus = 'read'
  } else if (stateStr === 'delivered' || stateStr === 'delivery_ack' || stateStr === '3') {
    newDeliveryStatus = 'delivered'
  }

  if (!newDeliveryStatus) return

  // Collect message IDs
  let messageIds: string[] = []
  if (payload?.event?.MessageIDs && Array.isArray(payload.event.MessageIDs)) {
    messageIds = payload.event.MessageIDs.filter((id: any) => typeof id === 'string' && id.length > 0)
  }
  if (messageIds.length === 0) {
    const singleId = payload?.messageid || payload?.message?.messageid || payload?.key?.id
    if (singleId) messageIds = [singleId]
  }

  if (messageIds.length === 0) return

  // Status hierarchy for broadcast: sent(1) → delivered(2) → read(3)
  const statusRank: Record<string, number> = { sent: 1, delivered: 2, read: 3 }
  const newRank = statusRank[newDeliveryStatus] || 0
  const excludeStatuses = Object.entries(statusRank)
    .filter(([, rank]) => rank >= newRank)
    .map(([s]) => s)

  const { data, error } = await adminClient
    .from('broadcast_recipients')
    .update({ delivery_status: newDeliveryStatus })
    .in('message_id', messageIds)
    .not('delivery_status', 'in', `(${excludeStatuses.join(',')})`)
    .select('id')

  if (data?.length) {
    console.log(`Broadcast delivery: ${data.length} recipient(s) updated to ${newDeliveryStatus}`)
  }
}

// ── Broadcast reply detection ──
async function detectBroadcastReply(adminClient: any, chip: any, payload: any) {
  const msg = payload.message
  if (!msg || !msg.chatid || msg.fromMe) return

  const senderPhone = msg.chatid.split('@')[0].replace(/\D/g, '')
  if (!senderPhone) return

  // Find recent broadcast recipients with this phone (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recipients } = await adminClient
    .from('broadcast_recipients')
    .select('id, replied')
    .eq('phone', senderPhone)
    .eq('status', 'sent')
    .eq('replied', false)
    .gte('sent_at', sevenDaysAgo)
    .limit(5)

  if (recipients && recipients.length > 0) {
    const ids = recipients.map((r: any) => r.id)
    await adminClient
      .from('broadcast_recipients')
      .update({ replied: true, replied_at: new Date().toISOString() })
      .in('id', ids)
    console.log(`Broadcast reply detected from ${senderPhone}: ${ids.length} recipient(s) marked`)
  }
}
