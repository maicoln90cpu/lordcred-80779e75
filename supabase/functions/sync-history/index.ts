import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BATCH_SIZE = 30 // chats per invocation
const API_DELAY_MS = 200

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
    for (const key of ['results', 'items', 'chats', 'data', 'messages', 'records', 'rows', 'list', 'result']) {
      if (Array.isArray(response[key])) return response[key]
    }
    const keys = Object.keys(response)
    if (keys.length === 1 && Array.isArray(response[keys[0]])) return response[keys[0]]
    for (const key of keys) {
      if (Array.isArray(response[key]) && response[key].length > 0) return response[key]
    }
  }
  return []
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Resolve a chat's canonical JID (always @s.whatsapp.net for individuals).
 * If wa_chatid is @lid, try to resolve using the `phone` field.
 * Returns { canonicalJid, apiJid } where apiJid is what to send to /message/find.
 */
/**
 * Resolve a chat's canonical JID.
 * @param resolvedPhone - optional phone from /chat/details (already cleaned digits)
 */
function resolveJid(chat: any, resolvedPhone?: string): { canonicalJid: string; apiJid: string } {
  const rawJid = chat.wa_chatid || chat.chatid || chat.jid || ''
  
  if (rawJid.includes('@g.us')) {
    return { canonicalJid: rawJid, apiJid: rawJid }
  }
  
  if (rawJid.includes('@s.whatsapp.net')) {
    return { canonicalJid: rawJid, apiJid: rawJid }
  }
  
  if (rawJid.includes('@lid')) {
    // Priority 1: resolvedPhone from /chat/details
    if (resolvedPhone && resolvedPhone.length >= 10) {
      return { canonicalJid: `${resolvedPhone}@s.whatsapp.net`, apiJid: rawJid }
    }
    // Priority 2: chat.phone from /chat/find
    const phone = (chat.phone || '').replace(/\D/g, '')
    if (phone && phone.length >= 10) {
      return { canonicalJid: `${phone}@s.whatsapp.net`, apiJid: rawJid }
    }
    // Can't resolve - use LID as-is
    return { canonicalJid: rawJid, apiJid: rawJid }
  }
  
  if (rawJid) {
    return { canonicalJid: rawJid, apiJid: rawJid }
  }
  return { canonicalJid: '', apiJid: '' }
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

    const { chipId, cursor: requestedCursor } = await req.json()
    if (!chipId) throw new Error('chipId is required')

    // Get chip info
    const { data: chip, error: chipError } = await adminClient
      .from('chips')
      .select('id, instance_token, last_sync_at, last_sync_cursor')
      .eq('id', chipId)
      .single()

    if (chipError) console.error('[sync-history] Chip query error:', chipError.message)

    if (!chip || !chip.instance_token) {
      return new Response(JSON.stringify({ success: true, synced: 0, chats: 0, reason: 'no token', hasMore: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Use requested cursor or chip's saved cursor
    const currentCursor = typeof requestedCursor === 'number' ? requestedCursor : (chip.last_sync_cursor || 0)
    
    // Only throttle on first batch (cursor 0)
    if (currentCursor === 0 && chip.last_sync_at) {
      const lastSync = new Date(chip.last_sync_at).getTime()
      if (Date.now() - lastSync < 60 * 1000) {
        return new Response(JSON.stringify({ success: true, synced: 0, chats: 0, reason: 'recently synced', hasMore: false }), {
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
      return new Response(JSON.stringify({ success: false, error: 'UazAPI not configured', hasMore: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[sync-history] Starting batch: chip=${chipId}, cursor=${currentCursor}, batchSize=${BATCH_SIZE}`)

    // ========== Phase 1: Fetch ALL chats (only on first batch) ==========
    // We cache the full chat list and process in batches using cursor
    let rawChats: any[] = []
    try {
      const resp = await fetch(`${baseUrl}/chat/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': chipToken },
        body: JSON.stringify({ limit: 500 }), // fetch all chats
      })
      
      if (!resp.ok) {
        const errBody = await resp.text()
        console.error(`[sync-history] /chat/find HTTP ${resp.status}: ${errBody}`)
      } else {
        const chatsResponse = await resp.json()
        rawChats = extractArray(chatsResponse)
        console.log(`[sync-history] /chat/find returned ${rawChats.length} total chats`)
      }
    } catch (e) {
      console.error('[sync-history] Failed to fetch chats:', e)
    }

    if (rawChats.length === 0) {
      await adminClient.from('chips').update({ last_sync_cursor: 0, last_sync_at: new Date().toISOString() } as any).eq('id', chipId)
      return new Response(JSON.stringify({ success: true, synced: 0, chats: 0, hasMore: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Filter out status broadcasts
    const filteredChats = rawChats.filter(c => {
      const jid = c.wa_chatid || c.chatid || c.jid || ''
      return jid && !jid.includes('status@')
    })

    const totalChats = filteredChats.length
    const batchStart = currentCursor
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChats)
    const batchChats = filteredChats.slice(batchStart, batchEnd)
    const hasMore = batchEnd < totalChats

    console.log(`[sync-history] Processing batch ${batchStart}-${batchEnd} of ${totalChats} chats, hasMore=${hasMore}`)

    // ========== Phase 2: Archive orphans (only on FIRST batch) ==========
    if (currentCursor === 0 && filteredChats.length > 0) {
      // Build set of all canonical JIDs from API
      const activeJids = new Set<string>()
      for (const chat of filteredChats) {
        const { canonicalJid } = resolveJid(chat)
        if (canonicalJid) activeJids.add(canonicalJid)
        // Also add raw JID to handle legacy matches
        const rawJid = chat.wa_chatid || chat.chatid || chat.jid || ''
        if (rawJid) activeJids.add(rawJid)
      }

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
            if (c.last_message_at && c.last_message_at > sevenDaysAgo) return false
            return true
          })
          .map(c => c.remote_jid)

        if (orphanJids.length > 0) {
          console.log(`[sync-history] Archiving ${orphanJids.length} orphan conversations`)
          await adminClient
            .from('conversations')
            .update({ is_archived: true } as any)
            .eq('chip_id', chipId)
            .in('remote_jid', orphanJids)
        }
      }

      // Archive groups where user has left
      for (const chat of filteredChats) {
        const isGroup = chat.wa_isGroup || (chat.wa_chatid || '').includes('@g.us')
        const isGroupMember = chat.wa_isGroup_member !== false
        if (isGroup && !isGroupMember) {
          const { canonicalJid } = resolveJid(chat)
          if (canonicalJid) {
            console.log(`[sync-history] Archiving left group: ${canonicalJid}`)
            await adminClient.from('conversations')
              .update({ is_archived: true } as any)
              .eq('chip_id', chipId)
              .eq('remote_jid', canonicalJid)
          }
        }
      }
    }

    // ========== Phase 3: Process batch - upsert conversations + messages ==========
    let syncedMessages = 0
    
    let profilePicFetches = 0
    const MAX_PROFILE_PIC_FETCHES = 10 // per batch (for non-LID profile pics only)

    for (let i = 0; i < batchChats.length; i++) {
      const chat = batchChats[i]
      const chatIndex = batchStart + i
      const rawJid = chat.wa_chatid || chat.chatid || chat.jid || ''

      // === LID PHONE RESOLUTION via /chat/details ===
      // For @lid chats without a valid phone, ALWAYS call /chat/details to resolve
      let resolvedPhone: string | undefined
      const chatPhone = (chat.phone || '').replace(/\D/g, '')
      const isLid = rawJid.includes('@lid')
      
      if (isLid && (!chatPhone || chatPhone.length < 10)) {
        try {
          const detailsResp = await fetch(`${baseUrl}/chat/details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
            body: JSON.stringify({ number: rawJid }),
          })
          if (detailsResp.ok) {
            const details = await detailsResp.json()
            const detailPhone = (details.phone || '').replace(/\D/g, '')
            if (detailPhone && detailPhone.length >= 10) {
              resolvedPhone = detailPhone
              console.log(`[sync-history] LID resolved: ${rawJid} -> ${resolvedPhone} via /chat/details`)
            }
            // Also grab profile pic while we're here
            if (!chat.imagePreview && !chat.image) {
              chat._resolvedPic = details.imagePreview || details.image || null
            }
          }
        } catch (e) {
          console.error(`[sync-history] /chat/details failed for ${rawJid}:`, e)
        }
        await delay(API_DELAY_MS)
      }

      const { canonicalJid, apiJid } = resolveJid(chat, resolvedPhone)
      if (!canonicalJid) {
        console.log(`[sync-history] Skipping unresolvable LID: ${rawJid}`)
        continue
      }

      const isGroup = chat.wa_isGroup || canonicalJid.includes('@g.us') || false
      const isGroupMember = chat.wa_isGroup_member !== false
      if (isGroup && !isGroupMember) continue

      if (chatIndex < 3) {
        console.log(`[sync-history] DEBUG chat[${chatIndex}]: wa_chatid=${rawJid}, phone=${chat.phone}, resolvedPhone=${resolvedPhone || 'none'}, canonicalJid=${canonicalJid}, apiJid=${apiJid}`)
      }

      // Never use instance's own name as contact name — compare with chip phone
      const rawContactName = chat.wa_contactName || chat.name || ''
      const chipPhone = (chip as any).phone_number || ''
      const isOwnName = rawContactName && chipPhone && rawContactName.replace(/\D/g, '').includes(chipPhone.replace(/\D/g, ''))
      const contactName = (rawContactName && !isOwnName) ? rawContactName : (canonicalJid.split('@')[0] || '')
      const waName = chat.wa_name || ''
      // CRITICAL: use resolvedPhone or chat.phone, NEVER the LID number
      const contactPhone = resolvedPhone || chatPhone || (isLid ? '' : canonicalJid.split('@')[0])
      let profilePicUrl = chat.imagePreview || chat.image || chat._resolvedPic || null

      // Fetch profile pic for non-LID chats if missing (uses separate counter)
      if (!profilePicUrl && !isLid && profilePicFetches < MAX_PROFILE_PIC_FETCHES) {
        try {
          const detailsResp = await fetch(`${baseUrl}/chat/details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
            body: JSON.stringify({ number: apiJid }),
          })
          if (detailsResp.ok) {
            const details = await detailsResp.json()
            profilePicUrl = details.imagePreview || details.image || null
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

      const unreadCount = typeof chat.wa_unreadCount === 'number' ? chat.wa_unreadCount : 0

      // SAFE upsert: NUNCA sobrescrever unread_count, is_archived, is_pinned, is_starred, custom_status, label_ids
      // Esses campos sao geridos pelo webhook/usuario e NUNCA devem ser tocados pelo sync
      const convData: any = {
        chip_id: chipId,
        remote_jid: canonicalJid,
        contact_name: contactName,
        contact_phone: contactPhone,
        is_group: isGroup,
      }

      // Apenas incluir se tiver valor real (nunca sobrescrever com vazio/null)
      if (lastMsgAt) convData.last_message_at = lastMsgAt
      if (waName) convData.wa_name = waName
      if (profilePicUrl) convData.profile_pic_url = profilePicUrl

      // last_message_text: SOMENTE se a UazAPI retornou texto real
      const apiLastMsg = chat.wa_lastMessageTextVote || chat.lastMessage || ''
      if (apiLastMsg.length > 0) {
        convData.last_message_text = apiLastMsg
      }

      // unread_count: SOMENTE atualizar se UazAPI reporta > 0 (nunca zerar)
      if (unreadCount > 0) {
        convData.unread_count = unreadCount
      }
      // is_archived: NUNCA incluir no upsert (preservar estado do usuario)

      const { error: convError } = await adminClient.from('conversations').upsert(convData, { onConflict: 'chip_id,remote_jid' })
      if (convError) {
        console.error(`[sync-history] Conv upsert error ${canonicalJid}:`, convError.message)
      }

      // If we resolved a LID to phone, migrate existing messages and clean bogus data
      if (rawJid.includes('@lid') && canonicalJid !== rawJid) {
        console.log(`[sync-history] Migrating messages from ${rawJid} -> ${canonicalJid}`)
        // Update messages stored with @lid to use canonical phone JID
        const { count: migratedCount } = await adminClient
          .from('message_history')
          .update({ remote_jid: canonicalJid, recipient_phone: contactPhone || null })
          .eq('chip_id', chipId)
          .eq('remote_jid', rawJid)
          .select('*', { count: 'exact', head: true })
        if (migratedCount && migratedCount > 0) {
          console.log(`[sync-history] Migrated ${migratedCount} messages from ${rawJid} to ${canonicalJid}`)
        }

        // Delete bogus conversation created by old migration (LID number used as phone)
        const bogusJid = rawJid.replace('@lid', '@s.whatsapp.net')
        await adminClient
          .from('conversations')
          .delete()
          .eq('chip_id', chipId)
          .eq('remote_jid', bogusJid)
      }

      // ========== Fetch messages ==========
      try {
        // Use apiJid (could be LID) to query UazAPI, but store with canonicalJid
        const msgResp = await fetch(`${baseUrl}/message/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ chatid: apiJid, limit: 100 }),
        })

        if (!msgResp.ok) {
          const errBody = await msgResp.text()
          console.error(`[sync-history] /message/find HTTP ${msgResp.status} for ${apiJid}: ${errBody}`)
          await delay(API_DELAY_MS)
          continue
        }

        const msgData = await msgResp.json()
        const messages = extractArray(msgData)

        // Debug: log first 3 chats
        if (chatIndex < 3) {
          console.log(`[sync-history] DEBUG chat[${chatIndex}] messages: ${messages.length} found, apiJid=${apiJid}, storing as ${canonicalJid}`)
          if (messages.length > 0) {
            console.log(`[sync-history] DEBUG first msg keys: ${Object.keys(messages[0]).join(', ')}`)
          } else if (msgData && typeof msgData === 'object') {
            console.log(`[sync-history] DEBUG empty response keys: ${Object.keys(msgData).join(', ')}`)
            console.log(`[sync-history] DEBUG raw preview: ${JSON.stringify(msgData).substring(0, 300)}`)
          }
        }

        if (messages.length > 0) {
          console.log(`[sync-history] ${canonicalJid}: ${messages.length} messages`)
        }

        const rows = []
        for (const m of messages) {
          const msgId = m.messageid || m.id || null
          if (!msgId) continue

          let ts = 0
          if (m.messageTimestamp) {
            ts = Number(m.messageTimestamp)
            if (ts < 10000000000) ts = ts * 1000
          }
          

          const mediaType = m.mediaType || normalizeMessageType(m.messageType || '') || ''
          const text = typeof m.text === 'string' ? m.text : (typeof m.content === 'string' ? m.content : '')
          const fromMe = m.fromMe === true || m.fromMe === 'true'

          rows.push({
            chip_id: chipId,
            message_id: msgId,
            message_content: text,
            direction: fromMe ? 'outgoing' : 'incoming',
            status: 'delivered',
            recipient_phone: canonicalJid.split('@')[0].replace(/\D/g, '') || null,
            remote_jid: canonicalJid, // ALWAYS use canonical (phone) JID
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
            console.error(`[sync-history] Upsert error for ${canonicalJid}:`, error.message)
          } else {
            syncedMessages += rows.length
          }
        }
      } catch (e) {
        console.error(`[sync-history] Failed to sync messages for ${canonicalJid}:`, e)
      }

      // Delay between API calls to avoid rate limiting
      if (i < batchChats.length - 1) {
        await delay(API_DELAY_MS)
      }
    }

    // Update cursor and sync timestamp
    const newCursor = hasMore ? batchEnd : 0
    const updateData: any = { last_sync_cursor: newCursor }
    if (!hasMore) {
      updateData.last_sync_at = new Date().toISOString()
    }
    await adminClient.from('chips').update(updateData).eq('id', chipId)

    console.log(`[sync-history] Batch complete: processed ${batchChats.length} chats (${batchStart}-${batchEnd}), ${syncedMessages} messages synced, hasMore=${hasMore}`)

    return new Response(JSON.stringify({
      success: true,
      chats: totalChats,
      synced: syncedMessages,
      processed: batchEnd,
      total: totalChats,
      hasMore,
      nextCursor: hasMore ? batchEnd : 0,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[sync-history] Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message, hasMore: false }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
