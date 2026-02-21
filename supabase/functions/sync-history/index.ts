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

function extractArray(response: any): any[] {
  if (Array.isArray(response)) return response
  if (response && typeof response === 'object') {
    for (const key of ['results', 'items', 'chats', 'data', 'messages']) {
      if (Array.isArray(response[key])) return response[key]
    }
  }
  return []
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

    // Validate user with getUser (correct method for supabase-js v2)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      console.error('Auth error:', userError?.message)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { chipId } = await req.json()
    if (!chipId) throw new Error('chipId is required')

    console.log(`[sync-history] Starting sync for chip ${chipId}, user ${user.id}`)

    // Get chip info
    const { data: chip, error: chipError } = await adminClient
      .from('chips')
      .select('id, instance_token, last_sync_at')
      .eq('id', chipId)
      .single()

    if (chipError) {
      console.error('[sync-history] Chip query error:', chipError.message)
    }

    if (!chip || !chip.instance_token) {
      console.log('[sync-history] No chip or no token found')
      return new Response(JSON.stringify({ success: true, synced: 0, chats: 0, reason: 'no token' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Reduce throttle to 1 minute for manual sync
    if (chip.last_sync_at) {
      const lastSync = new Date(chip.last_sync_at).getTime()
      if (Date.now() - lastSync < 60 * 1000) {
        console.log('[sync-history] Skipped: synced less than 1 minute ago')
        return new Response(JSON.stringify({ success: true, synced: 0, chats: 0, reason: 'recently synced' }), {
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
      console.error('[sync-history] UazAPI URL not configured')
      return new Response(JSON.stringify({ success: false, error: 'UazAPI not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[sync-history] Using UazAPI: ${baseUrl}, token length: ${chipToken.length}`)

    // Phase 1: Fetch chats
    let rawChats: any[] = []
    try {
      const resp = await fetch(`${baseUrl}/chat/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': chipToken },
        body: JSON.stringify({ limit: 50 }),
      })
      
      if (!resp.ok) {
        const errBody = await resp.text()
        console.error(`[sync-history] /chat/find HTTP ${resp.status}: ${errBody}`)
      } else {
        const chatsResponse = await resp.json()
        rawChats = extractArray(chatsResponse)
        console.log(`[sync-history] /chat/find returned ${rawChats.length} chats. Response type: ${typeof chatsResponse}, isArray: ${Array.isArray(chatsResponse)}`)
        if (rawChats.length > 0) {
          console.log(`[sync-history] Sample chat keys: ${Object.keys(rawChats[0]).join(', ')}`)
        }
      }
    } catch (e) {
      console.error('[sync-history] Failed to fetch chats:', e)
    }

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

      const { error: convError } = await adminClient.from('conversations').upsert(convData, { onConflict: 'chip_id,remote_jid' })
      if (convError) {
        console.error(`[sync-history] Conversation upsert error for ${remoteJid}:`, convError.message)
      }

      // Phase 2: Fetch messages for this chat
      try {
        const msgResp = await fetch(`${baseUrl}/message/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ chatid: remoteJid, limit: 100 }),
        })

        if (!msgResp.ok) {
          const errBody = await msgResp.text()
          console.error(`[sync-history] /message/find HTTP ${msgResp.status} for ${remoteJid}: ${errBody}`)
          continue
        }

        const msgData = await msgResp.json()
        const messages = extractArray(msgData)
        
        if (messages.length > 0 && rawChats.indexOf(chat) === 0) {
          console.log(`[sync-history] Sample message keys: ${Object.keys(messages[0]).join(', ')}`)
        }
        console.log(`[sync-history] ${remoteJid}: ${messages.length} messages found`)

        const rows = []
        for (const m of messages) {
          const msgId = m.messageid || m.id || null
          if (!msgId) continue

          let ts = 0
          if (m.messageTimestamp) {
            ts = Number(m.messageTimestamp)
            if (ts < 10000000000) ts = ts * 1000
          }
          if (ts > 0 && ts < tenDaysAgo) continue

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
          const { error } = await adminClient.from('message_history').upsert(rows, {
            onConflict: 'chip_id,message_id',
            ignoreDuplicates: true,
          })
          if (error) {
            console.error(`[sync-history] Upsert error for ${remoteJid}:`, error.message)
          } else {
            syncedMessages += rows.length
          }
        }
      } catch (e) {
        console.error(`[sync-history] Failed to sync messages for ${remoteJid}:`, e)
      }
    }

    // Update last_sync_at
    await adminClient.from('chips').update({ last_sync_at: new Date().toISOString() }).eq('id', chipId)

    console.log(`[sync-history] Complete: ${rawChats.length} chats, ${syncedMessages} messages synced`)

    return new Response(JSON.stringify({
      success: true,
      chats: rawChats.length,
      synced: syncedMessages,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[sync-history] Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
