import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Validate user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { chipId } = await req.json()
    if (!chipId) throw new Error('chipId is required')

    // Check if sync is needed (skip if synced within last 5 minutes)
    const { data: chip } = await adminClient
      .from('chips')
      .select('id, instance_token, last_sync_at')
      .eq('id', chipId)
      .single()

    if (!chip || !chip.instance_token) {
      return new Response(JSON.stringify({ success: true, synced: 0, reason: 'no token' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (chip.last_sync_at) {
      const lastSync = new Date(chip.last_sync_at).getTime()
      if (Date.now() - lastSync < 5 * 60 * 1000) {
        return new Response(JSON.stringify({ success: true, synced: 0, reason: 'recently synced' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
    const chipToken = chip.instance_token

    if (!baseUrl) {
      return new Response(JSON.stringify({ success: false, error: 'UazAPI not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Phase 1: Sync recent chats
    let chatsResponse: any
    try {
      const resp = await fetch(`${baseUrl}/chat/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': chipToken },
        body: JSON.stringify({ limit: 50 }),
      })
      chatsResponse = await resp.json()
    } catch (e) {
      console.error('Failed to fetch chats from UazAPI:', e)
      chatsResponse = []
    }

    const rawChats = Array.isArray(chatsResponse) ? chatsResponse :
      (chatsResponse?.chats || chatsResponse?.data || [])

    let syncedMessages = 0
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000

    for (const chat of rawChats) {
      const remoteJid = chat.wa_chatid || chat.chatid || chat.jid || ''
      if (!remoteJid || remoteJid.includes('status@')) continue

      const contactName = chat.wa_contactName || chat.name || remoteJid.split('@')[0]
      const waName = chat.wa_name || ''
      const contactPhone = chat.phone || remoteJid.split('@')[0]
      const profilePicUrl = chat.imagePreview || chat.image || null

      let lastMsgAt: string | null = null
      if (chat.wa_lastMsgTimestamp) {
        const ts = Number(chat.wa_lastMsgTimestamp)
        const msTs = ts < 10000000000 ? ts * 1000 : ts
        lastMsgAt = new Date(msTs).toISOString()
      }

      // Upsert conversation
      const convData: any = {
        chip_id: chipId,
        remote_jid: remoteJid,
        contact_name: contactName,
        contact_phone: contactPhone,
        last_message_text: chat.wa_lastMessageTextVote || chat.lastMessage || '',
        last_message_at: lastMsgAt || new Date().toISOString(),
        unread_count: chat.wa_unreadCount || 0,
        is_group: chat.wa_isGroup || remoteJid.includes('@g.us') || false,
      }
      if (waName) convData.wa_name = waName
      if (profilePicUrl) convData.profile_pic_url = profilePicUrl

      await adminClient.from('conversations').upsert(convData, { onConflict: 'chip_id,remote_jid' })

      // Phase 2: Sync messages for this chat (up to 100 most recent, within 10 days)
      try {
        const msgResp = await fetch(`${baseUrl}/message/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ chatid: remoteJid, limit: 100 }),
        })
        const msgData = await msgResp.json()
        const messages = Array.isArray(msgData) ? msgData : (msgData?.messages || msgData?.data || [])

        const rows = []
        for (const m of messages) {
          const msgId = m.messageid || m.id || null
          if (!msgId) continue

          let ts = 0
          if (m.messageTimestamp) {
            ts = Number(m.messageTimestamp)
            if (ts < 10000000000) ts = ts * 1000
          }
          if (ts > 0 && ts < tenDaysAgo) continue // Skip messages older than 10 days

          const mediaType = m.mediaType || normalizeMessageType(m.messageType || '') || ''
          const text = typeof m.text === 'string' ? m.text : ''

          rows.push({
            chip_id: chipId,
            message_id: msgId,
            message_content: text,
            direction: m.fromMe ? 'outgoing' : 'incoming',
            status: 'delivered',
            recipient_phone: remoteJid.split('@')[0].replace(/\D/g, '') || null,
            remote_jid: remoteJid,
            sender_name: m.senderName || '',
            media_type: mediaType || null,
            created_at: ts > 0 ? new Date(ts).toISOString() : new Date().toISOString(),
          })
        }

        if (rows.length > 0) {
          // Use upsert with the unique index on (chip_id, message_id)
          const { error } = await adminClient.from('message_history').upsert(rows, {
            onConflict: 'chip_id,message_id',
            ignoreDuplicates: true,
          })
          if (error) {
            console.error(`Sync error for ${remoteJid}:`, error.message)
          } else {
            syncedMessages += rows.length
          }
        }
      } catch (e) {
        console.error(`Failed to sync messages for ${remoteJid}:`, e)
      }
    }

    // Update last_sync_at
    await adminClient.from('chips').update({ last_sync_at: new Date().toISOString() }).eq('id', chipId)

    console.log(`Sync complete for chip ${chipId}: ${rawChats.length} chats, ${syncedMessages} messages`)

    return new Response(JSON.stringify({
      success: true,
      chats: rawChats.length,
      synced: syncedMessages,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
