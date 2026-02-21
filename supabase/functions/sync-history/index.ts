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
    // Check known keys first
    for (const key of ['results', 'items', 'chats', 'data', 'messages', 'records', 'rows', 'list', 'result']) {
      if (Array.isArray(response[key])) return response[key]
    }
    // Fallback: if the object has exactly one key and it's an array, use it
    const keys = Object.keys(response)
    if (keys.length === 1 && Array.isArray(response[keys[0]])) {
      return response[keys[0]]
    }
    // Check any key that holds an array (skip metadata keys)
    for (const key of keys) {
      if (Array.isArray(response[key]) && response[key].length > 0) {
        return response[key]
      }
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
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
      return new Response(JSON.stringify({ success: true, synced: 0, chats: 0, reason: 'no token' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Throttle: 1 minute
    if (chip.last_sync_at) {
      const lastSync = new Date(chip.last_sync_at).getTime()
      if (Date.now() - lastSync < 60 * 1000) {
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
      return new Response(JSON.stringify({ success: false, error: 'UazAPI not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[sync-history] Using UazAPI: ${baseUrl}, token length: ${chipToken.length}`)

    // ========== Phase 1: Fetch chats ==========
    let rawChats: any[] = []
    try {
      const resp = await fetch(`${baseUrl}/chat/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': chipToken },
        body: JSON.stringify({ limit: 200 }),
      })
      
      if (!resp.ok) {
        const errBody = await resp.text()
        console.error(`[sync-history] /chat/find HTTP ${resp.status}: ${errBody}`)
      } else {
        const chatsResponse = await resp.json()
        rawChats = extractArray(chatsResponse)
        console.log(`[sync-history] /chat/find returned ${rawChats.length} chats`)
        if (rawChats.length > 0) {
          console.log(`[sync-history] Sample chat keys: ${Object.keys(rawChats[0]).join(', ')}`)
        }
      }
    } catch (e) {
      console.error('[sync-history] Failed to fetch chats:', e)
    }

    // ========== Phase 2: Archive orphan conversations (safe logic) ==========
    if (rawChats.length > 0) {
      const activeJids = new Set(rawChats.map(c => c.wa_chatid || c.chatid || c.jid || '').filter(Boolean))
      
      const { data: existingConvos } = await adminClient
        .from('conversations')
        .select('remote_jid, last_message_at')
        .eq('chip_id', chipId)
        .or('is_archived.is.null,is_archived.eq.false')

      if (existingConvos) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const orphanJids = existingConvos
          .filter(c => {
            if (activeJids.has(c.remote_jid)) return false
            // Don't archive if it has recent activity (last 7 days)
            if (c.last_message_at && c.last_message_at > sevenDaysAgo) return false
            return true
          })
          .map(c => c.remote_jid)

        if (orphanJids.length > 0) {
          console.log(`[sync-history] Archiving ${orphanJids.length} orphan conversations (no recent activity)`)
          await adminClient
            .from('conversations')
            .update({ is_archived: true } as any)
            .eq('chip_id', chipId)
            .in('remote_jid', orphanJids)
        }
      }
    }

    // ========== Phase 3: Upsert conversations + fetch profile pics ==========
    let syncedMessages = 0
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000
    let profilePicFetches = 0
    const MAX_PROFILE_PIC_FETCHES = 20

    for (const chat of rawChats) {
      const remoteJid = chat.wa_chatid || chat.chatid || chat.jid || ''
      if (!remoteJid || remoteJid.includes('status@')) continue

      const isGroup = chat.wa_isGroup || remoteJid.includes('@g.us') || false
      const isGroupMember = chat.wa_isGroup_member !== false // default true if field missing

      // Archive groups that user has left
      if (isGroup && !isGroupMember) {
        console.log(`[sync-history] Archiving left group: ${remoteJid}`)
        await adminClient.from('conversations')
          .update({ is_archived: true } as any)
          .eq('chip_id', chipId)
          .eq('remote_jid', remoteJid)
        continue
      }

      const contactName = chat.wa_contactName || chat.name || remoteJid.split('@')[0]
      const waName = chat.wa_name || ''
      const contactPhone = chat.phone || remoteJid.split('@')[0]
      let profilePicUrl = chat.imagePreview || chat.image || null

      // Fetch profile pic from /chat/details if missing
      if (!profilePicUrl && profilePicFetches < MAX_PROFILE_PIC_FETCHES) {
        try {
          const detailsResp = await fetch(`${baseUrl}/chat/details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
            body: JSON.stringify({ number: remoteJid }),
          })
          if (detailsResp.ok) {
            const details = await detailsResp.json()
            profilePicUrl = details.imagePreview || details.image || null
            if (profilePicUrl && profilePicFetches === 0) {
              console.log(`[sync-history] Got profile pic from /chat/details for ${remoteJid}`)
            }
          }
          profilePicFetches++
        } catch {
          profilePicFetches++
        }
      }

      let lastMsgAt: string | null = null
      if (chat.wa_lastMsgTimestamp) {
        const ts = Number(chat.wa_lastMsgTimestamp)
        const msTs = ts < 10000000000 ? ts * 1000 : ts
        lastMsgAt = new Date(msTs).toISOString()
      }

      // Use wa_unreadCount directly from UazAPI (real WhatsApp state)
      const unreadCount = typeof chat.wa_unreadCount === 'number' ? chat.wa_unreadCount : 0

      const convData: any = {
        chip_id: chipId,
        remote_jid: remoteJid,
        contact_name: contactName,
        contact_phone: contactPhone,
        last_message_text: chat.wa_lastMessageTextVote || chat.lastMessage || '',
        last_message_at: lastMsgAt || new Date().toISOString(),
        unread_count: unreadCount,
        is_group: isGroup,
        is_archived: false, // If returned by /chat/find and user is member, it's active
      }
      if (waName) convData.wa_name = waName
      if (profilePicUrl) convData.profile_pic_url = profilePicUrl

      const { error: convError } = await adminClient.from('conversations').upsert(convData, { onConflict: 'chip_id,remote_jid' })
      if (convError) {
        console.error(`[sync-history] Conversation upsert error for ${remoteJid}:`, convError.message)
      }

      // ========== Phase 4: Fetch messages for this chat ==========
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
        
        // Debug: log raw response for first chat if no messages found
        if (rawChats.indexOf(chat) === 0) {
          console.log(`[sync-history] FIRST CHAT raw /message/find response type: ${typeof msgData}, isArray: ${Array.isArray(msgData)}`)
          if (messages.length === 0 && msgData && typeof msgData === 'object') {
            console.log(`[sync-history] FIRST CHAT response keys: ${Object.keys(msgData).join(', ')}`)
            console.log(`[sync-history] FIRST CHAT raw body preview: ${JSON.stringify(msgData).substring(0, 500)}`)
          }
          if (messages.length > 0) {
            console.log(`[sync-history] Sample message keys: ${Object.keys(messages[0]).join(', ')}`)
          }
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
          // Handle text: could be in m.text or m.content (for media messages text may be empty)
          const text = typeof m.text === 'string' ? m.text : (typeof m.content === 'string' ? m.content : '')
          
          // Handle fromMe as boolean or string
          const fromMe = m.fromMe === true || m.fromMe === 'true'

          rows.push({
            chip_id: chipId,
            message_id: msgId,
            message_content: text,
            direction: fromMe ? 'outgoing' : 'incoming',
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

    console.log(`[sync-history] Complete: ${rawChats.length} chats, ${syncedMessages} messages synced, ${profilePicFetches} profile pics fetched`)

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
