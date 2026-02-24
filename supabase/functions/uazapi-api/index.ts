import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const body = await req.json()
    const { action, instanceName, phoneNumber, message, instanceToken, apiUrl, apiKey, chipId, chatId, limit, page, mediaType, mediaBase64, mediaCaption, mediaFileName, messageId, emoji, newText } = body
    console.log(`uazapi-api: action=${action}, chipId=${chipId}, instanceName=${instanceName}`)

    // Handle test-connection before requiring settings
    if (action === 'test-connection') {
      const testUrl = (apiUrl || '').replace(/\/$/, '')
      const testKey = apiKey || ''
      if (!testUrl || !testKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'URL and API Key are required' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const testResponse = await fetch(`${testUrl}/instance/all`, {
        method: 'GET',
        headers: { 'admintoken': testKey },
      })
      if (testResponse.ok) {
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        const errData = await testResponse.text()
        return new Response(
          JSON.stringify({ success: false, error: `Status ${testResponse.status}: ${errData}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { data: settings } = await adminClient
      .from('system_settings')
      .select('provider_api_url, provider_api_key, uazapi_api_url, uazapi_api_key')
      .limit(1)
      .maybeSingle()

    const baseUrl = ((settings as any)?.uazapi_api_url || settings?.provider_api_url || '').replace(/\/$/, '')
    const adminToken = (settings as any)?.uazapi_api_key || settings?.provider_api_key || ''

    if (!baseUrl || !adminToken) {
      return new Response(
        JSON.stringify({ error: 'UazAPI not configured. Set URL and token in Master Admin.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    switch (action) {

      case 'create-instance': {
        const response = await fetch(`${baseUrl}/instance/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
          body: JSON.stringify({ name: instanceName }),
        })
        const data = await response.json()
        if (!response.ok) {
          if (data.message?.includes('already') || data.error?.includes('exists')) {
            // Instance exists - fetch its token from UazAPI and store it
            try {
              const statusResp = await fetch(`${baseUrl}/instance/all`, {
                method: 'GET',
                headers: { 'admintoken': adminToken },
              })
              const allInstances = await statusResp.json()
              const instances = Array.isArray(allInstances) ? allInstances : (allInstances.instances || [])
              const found = instances.find((i: any) => i.name === instanceName || i.instance?.name === instanceName)
              const existingToken = found?.token || found?.instance?.token || null
              if (existingToken) {
                await adminClient.from('chips').update({ instance_token: existingToken } as any).eq('instance_name', instanceName)
              }
              return new Response(
                JSON.stringify({ exists: true, instanceName, instanceToken: existingToken }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            } catch {
              return new Response(
                JSON.stringify({ exists: true, instanceName }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
          throw new Error(data.message || data.error || 'Failed to create instance')
        }
        const returnedToken = data.token || data.instance?.token || null
        if (returnedToken) {
          await adminClient.from('chips').update({ instance_token: returnedToken } as any).eq('instance_name', instanceName)
        }
        // Log lifecycle
        const { data: chipForLog } = await adminClient.from('chips').select('id').eq('instance_name', instanceName).single()
        if (chipForLog) {
          await adminClient.from('chip_lifecycle_logs').insert({ chip_id: chipForLog.id, event: 'created', details: `Instance created: ${instanceName}` })
        }
        return new Response(
          JSON.stringify({ success: true, data, instanceToken: returnedToken }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get-qrcode': {
        let chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) {
          // Try to fetch token from UazAPI directly
          try {
            const allResp = await fetch(`${baseUrl}/instance/all`, {
              method: 'GET',
              headers: { 'admintoken': adminToken },
            })
            const allData = await allResp.json()
            const instances = Array.isArray(allData) ? allData : (allData.instances || [])
            const found = instances.find((i: any) => i.name === instanceName || i.instance?.name === instanceName)
            chipToken = found?.token || found?.instance?.token || null
            if (chipToken) {
              await adminClient.from('chips').update({ instance_token: chipToken } as any).eq('instance_name', instanceName)
            }
          } catch {}
        }
        if (!chipToken) throw new Error('Instance token not found. Recreate the instance.')
        await fetch(`${baseUrl}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
        })
        await new Promise(resolve => setTimeout(resolve, 2000))
        const statusResponse = await fetch(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chipToken },
        })
        const statusData = await statusResponse.json()
        const qrcode = statusData.instance?.qrcode || statusData.qrcode || ''
        return new Response(
          JSON.stringify({ success: true, qrcode: qrcode || null, code: statusData.instance?.paircode || null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'check-status': {
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) {
          return new Response(
            JSON.stringify({ success: true, state: 'unknown' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const response = await fetch(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chipToken },
        })
        const data = await response.json()
        let state = 'disconnected'
        if (data.status?.connected === true || data.status?.loggedIn === true) state = 'connected'
        else if (data.instance?.status === 'connecting') state = 'connecting'

        // Auto-configure webhook when chip becomes connected
        if (state === 'connected') {
          try {
            const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook`
            console.log(`Auto-configuring webhook for ${instanceName} -> ${webhookUrl}`)
            await fetch(`${baseUrl}/webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': chipToken },
              body: JSON.stringify({
                url: webhookUrl,
                events: ['messages', 'chats', 'connection.update', 'messages_update'],
              }),
            })
          } catch (whErr) {
            console.error('Failed to auto-configure webhook:', whErr)
          }
        }

        return new Response(
          JSON.stringify({ success: true, state, jid: data.status?.jid || null, instance: data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'fetch-instance-info': {
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) {
          return new Response(
            JSON.stringify({ success: true, phoneNumber: null, data: {} }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const response = await fetch(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chipToken },
        })
        const data = await response.json()
        let phone = null
        if (data.status?.jid) phone = data.status.jid.split('@')[0]
        else if (data.instance?.owner) phone = data.instance.owner.split('@')[0]
        else if (data.ownerJid) phone = data.ownerJid.split('@')[0]
        else if (data.number) phone = data.number
        return new Response(
          JSON.stringify({ success: true, phoneNumber: phone, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send-message': {
        if (!phoneNumber || !message) {
          return new Response(
            JSON.stringify({ error: 'Phone number and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) throw new Error('Instance token not found')
        let normalizedPhone = phoneNumber.replace(/\D/g, '')
        if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
          normalizedPhone = '55' + normalizedPhone
        }
        const response = await fetch(`${baseUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: normalizedPhone, text: message }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to send message')
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ===== NEW CHAT ACTIONS =====

      case 'fetch-chats': {
        // Fetch chat list from UazAPI for a specific chip
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')

        const fetchChatsBody = { limit: limit || 200, page: page || 1 }
        console.log(`fetch-chats: chipId=${chipId}, body=${JSON.stringify(fetchChatsBody)}`)

        const response = await fetch(`${baseUrl}/chat/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(fetchChatsBody),
        })
        const data = await response.json()
        
        const rawStr = JSON.stringify(data)
        console.log(`fetch-chats: UazAPI returned ${rawStr.length} bytes, type=${typeof data}, isArray=${Array.isArray(data)}`)
        // Log first 500 chars of response for debugging
        console.log(`fetch-chats: response preview: ${rawStr.substring(0, 500)}`)
        // Log top-level keys
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          console.log(`fetch-chats: top-level keys: ${Object.keys(data).join(', ')}`)
        }

        // Normalize the chat list — try multiple response formats
        let chats: any[] = []
        if (Array.isArray(data)) {
          chats = data
        } else if (data && typeof data === 'object') {
          chats = data.chats || data.data || data.results || data.items || data.records || []
          if (!Array.isArray(chats)) chats = []
        }
        
        console.log(`fetch-chats: raw chats count before filter: ${chats.length}`)

        // Flexible filter: accept wa_chatid, chatid, jid, or remoteJid
        const normalizedChats = chats
          .map((c: any) => {
            const chatJid = c.wa_chatid || c.chatid || c.jid || c.remoteJid || ''
            return { ...c, _resolvedJid: chatJid }
          })
          .filter((c: any) => c._resolvedJid && !c._resolvedJid.includes('status@'))
          .map((c: any) => {
            // wa_lastMsgTimestamp is int64 milliseconds per UazAPI schema
            let lastMsgAt: string | null = null
            if (c.wa_lastMsgTimestamp) {
              const ts = Number(c.wa_lastMsgTimestamp)
              // If timestamp is in seconds (< year 2100 in seconds), convert to ms
              const msTs = ts < 10000000000 ? ts * 1000 : ts
              lastMsgAt = new Date(msTs).toISOString()
            }

            return {
              id: c.id || c._resolvedJid,
              remoteJid: c._resolvedJid,
              name: c.name || c.wa_name || c.wa_contactName || c.phone || c._resolvedJid?.split('@')[0] || 'Desconhecido',
              phone: c.phone || c._resolvedJid?.split('@')[0] || '',
              lastMessage: c.wa_lastMessageTextVote || c.lastMessage || '',
              lastMessageAt: lastMsgAt,
              unreadCount: c.wa_unreadCount || 0,
              isGroup: c.wa_isGroup || c._resolvedJid?.includes('@g.us') || false,
              isPinned: !!(c.wa_isPinned || c.wa_pin || c.pin),
              profilePicUrl: c.imagePreview || c.image || null,
            }
          })

        console.log(`fetch-chats: normalized chats count after filter: ${normalizedChats.length}`)

        // Fallback: if UazAPI returned empty, try loading from conversations table
        if (normalizedChats.length === 0) {
          console.log(`fetch-chats: UazAPI returned 0 chats, falling back to conversations table`)
          const { data: dbConvos, error: dbErr } = await adminClient
            .from('conversations')
            .select('*')
            .eq('chip_id', chipId)
            .order('last_message_at', { ascending: false })
            .limit(limit || 200)
          
          if (dbErr) {
            console.log(`fetch-chats: DB fallback error: ${dbErr.message}`)
          } else if (dbConvos && dbConvos.length > 0) {
            console.log(`fetch-chats: DB fallback found ${dbConvos.length} conversations`)
            const dbChats = dbConvos.map((r: any) => ({
              id: r.id,
              remoteJid: r.remote_jid,
              name: r.contact_name || r.contact_phone || r.remote_jid?.split('@')[0] || 'Desconhecido',
              phone: r.contact_phone || r.remote_jid?.split('@')[0] || '',
              lastMessage: r.last_message_text || '',
              lastMessageAt: r.last_message_at,
              unreadCount: r.unread_count || 0,
              isGroup: r.is_group || false,
              isPinned: false,
              profilePicUrl: null,
            }))
            return new Response(
              JSON.stringify({ success: true, chats: dbChats, source: 'database' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        return new Response(
          JSON.stringify({ success: true, chats: normalizedChats }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'fetch-messages': {
        // Fetch messages for a specific chat
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        console.log(`fetch-messages: chipId=${chipId}, chatId=${chatId}, limit=${limit || 50}`)

        const response = await fetch(`${baseUrl}/message/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            chatid: chatId,
            limit: limit || 50,
            page: page || 1,
          }),
        })
        const data = await response.json()
        
        console.log(`fetch-messages: UazAPI returned ${JSON.stringify(data).length} bytes, type=${typeof data}, isArray=${Array.isArray(data)}`)
        
        const messages = Array.isArray(data) ? data : (data.messages || data.data || [])
        
        console.log(`fetch-messages: parsed ${messages.length} messages`)
        
        const MEDIA_KEYWORDS = ['ptt', 'audio', 'image', 'video', 'sticker', 'document', 'ptv', 'myaudio']

        const normalizedMessages = messages.map((m: any) => {
          // Prioridade: mediaType (já simples) > normalizeMessageType(messageType PascalCase) > type
          let detectedMediaType = m.mediaType || normalizeMessageType(m.messageType) || m.type || ''
          
          // Normalizar caso o valor ainda esteja em PascalCase
          if (detectedMediaType && !MEDIA_KEYWORDS.includes(detectedMediaType.toLowerCase())) {
            const normalized = normalizeMessageType(detectedMediaType)
            if (normalized) detectedMediaType = normalized
          }
          detectedMediaType = detectedMediaType.toLowerCase()

          let text = typeof m.text === 'string' ? m.text : ''
          
          // Se o texto é exatamente uma keyword de mídia e não temos tipo detectado
          if (!detectedMediaType || detectedMediaType === 'text' || detectedMediaType === 'chat') {
            if (MEDIA_KEYWORDS.includes(text.toLowerCase().trim())) {
              detectedMediaType = text.toLowerCase().trim()
              text = ''
            }
          }

          const isMedia = !!(detectedMediaType && detectedMediaType !== 'text' && detectedMediaType !== 'chat')

          // Resolve timestamp: prefer ISO m.timestamp, then m.messageTimestamp (int ms or s)
          let resolvedTimestamp: string
          if (m.timestamp && typeof m.timestamp === 'string' && !isNaN(Date.parse(m.timestamp))) {
            resolvedTimestamp = m.timestamp
          } else if (m.messageTimestamp) {
            const ts = Number(m.messageTimestamp)
            const msTs = ts < 10000000000 ? ts * 1000 : ts
            resolvedTimestamp = new Date(msTs).toISOString()
          } else {
            resolvedTimestamp = new Date().toISOString()
          }

          return {
            id: m.id || m.messageid || crypto.randomUUID(),
            text,
            fromMe: m.fromMe === true,
            timestamp: resolvedTimestamp,
            senderName: m.senderName || '',
            messageType: detectedMediaType || 'text',
            mediaType: detectedMediaType || '',
            messageId: m.messageid || m.id || '',
            hasMedia: isMedia,
            chatId: m.chatid || chatId,
          }
        })

        return new Response(
          JSON.stringify({ success: true, messages: normalizedMessages }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send-chat-message': {
        // Send text message in chat context (uses chatId/remoteJid)
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        
        let targetNumber = (chatId || phoneNumber || '').split('@')[0].replace(/\D/g, '')
        if (targetNumber.length === 10 || targetNumber.length === 11) {
          targetNumber = '55' + targetNumber
        }
        if (!targetNumber || !message) throw new Error('Target and message required')

        console.log(`send-chat-message: sending to ${targetNumber}, text length=${message.length}, token=${chipToken?.substring(0,8)}...`)
        const sendPayload = { number: targetNumber, text: message }
        const response = await fetch(`${baseUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(sendPayload),
        })
        const responseText = await response.text()
        console.log(`send-chat-message: UazAPI status=${response.status}, body=${responseText.substring(0, 500)}`)
        
        let data: any = {}
        try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }
        
        if (!response.ok) {
          const errMsg = data.message || data.error || `UazAPI returned ${response.status}`
          return new Response(
            JSON.stringify({ success: false, error: errMsg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'mark-read': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        const response = await fetch(`${baseUrl}/chat/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, read: true }),
        })
        const data = await response.json()

        // Update unread_count in DB after successful UazAPI call
        await adminClient
          .from('conversations')
          .update({ unread_count: 0 })
          .eq('chip_id', chipId)
          .eq('remote_jid', chatId)

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'mark-unread': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        const response = await fetch(`${baseUrl}/chat/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, read: false }),
        })
        const data = await response.json()

        // Set unread_count to 1 in DB after successful UazAPI call
        await adminClient
          .from('conversations')
          .update({ unread_count: 1 })
          .eq('chip_id', chipId)
          .eq('remote_jid', chatId)

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send-presence': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        
        let targetNumber = (chatId || phoneNumber || '').split('@')[0].replace(/\D/g, '')
        if (targetNumber.length === 10 || targetNumber.length === 11) {
          targetNumber = '55' + targetNumber
        }
        if (!targetNumber) throw new Error('Target number required')

        const { presence } = body
        const response = await fetch(`${baseUrl}/message/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            number: targetNumber,
            presence: presence || 'composing',
            delay: 3000,
          }),
        })
        const data = await response.json()

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'send-media': {
        // Send media (image, video, audio, document, ptt) via UazAPI
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        
        let targetNumber = (chatId || phoneNumber || '').split('@')[0].replace(/\D/g, '')
        if (targetNumber.length === 10 || targetNumber.length === 11) {
          targetNumber = '55' + targetNumber
        }
        if (!targetNumber) throw new Error('Target number required')
        if (!mediaBase64 && !body.mediaUrl) throw new Error('Media file or URL required')

        const sendBody: any = {
          number: targetNumber,
          type: mediaType || 'image',
        }

        if (mediaBase64) {
          sendBody.file = mediaBase64
        } else if (body.mediaUrl) {
          sendBody.file = body.mediaUrl
        }

        if (mediaCaption) sendBody.text = mediaCaption
        if (mediaFileName) sendBody.docName = mediaFileName

        const response = await fetch(`${baseUrl}/send/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(sendBody),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || data.error || 'Failed to send media')

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'download-media': {
        // Download media file from a message (returns public URL)
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')

        const response = await fetch(`${baseUrl}/message/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            id: messageId,
            return_link: true,
            generate_mp3: true,
          }),
        })
        const data = await response.json()

        return new Response(
          JSON.stringify({
            success: true,
            fileURL: data.fileURL || null,
            mimetype: data.mimetype || null,
            base64Data: data.base64Data || null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete-instance': {
        try {
          const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
          // Log lifecycle before deletion
          const { data: chipForLog } = await adminClient.from('chips').select('id').eq('instance_name', instanceName).single()
          if (chipForLog) {
            await adminClient.from('chip_lifecycle_logs').insert({ chip_id: chipForLog.id, event: 'deleted', details: `Instance deleted: ${instanceName}` })
          }
          if (chipToken) {
            const response = await fetch(`${baseUrl}/instance`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'token': chipToken },
            })
            const data = await response.json().catch(() => ({}))
            return new Response(
              JSON.stringify({ success: true, data }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          } else {
            return new Response(
              JSON.stringify({ success: true, warning: 'No instance token - removed from DB only' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } catch (deleteError) {
          return new Response(
            JSON.stringify({ success: true, warning: 'Instance may not have been removed from UazAPI' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      case 'logout-instance': {
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        // Log lifecycle
        try {
          const { data: chipForLog } = await adminClient.from('chips').select('id').eq('instance_name', instanceName).single()
          if (chipForLog) {
            await adminClient.from('chip_lifecycle_logs').insert({ chip_id: chipForLog.id, event: 'disconnected', details: `Graceful logout: ${instanceName}` })
          }
        } catch {}
        if (!chipToken) {
          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        try {
          const response = await fetch(`${baseUrl}/instance/disconnect`, {
            method: 'POST',
            headers: { 'token': chipToken },
          })
          const data = await response.json().catch(() => ({}))
          return new Response(
            JSON.stringify({ success: true, data }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (logoutErr) {
          return new Response(
            JSON.stringify({ success: true, warning: 'Instance may already be disconnected' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      case 'forward-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const targetNumber = (chatId || '').split('@')[0].replace(/\D/g, '')
        if (!targetNumber) throw new Error('Target chatId required')

        // Forward text message (re-send with forward flag if supported)
        const fwdText = body.text || message || ''
        if (!fwdText && !messageId) throw new Error('Nothing to forward')

        const fwdBody: any = { number: targetNumber, text: fwdText }
        const response = await fetch(`${baseUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(fwdBody),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to forward')
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'react-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')
        if (emoji === undefined) throw new Error('emoji is required')

        const response = await fetch(`${baseUrl}/message/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            id: messageId,
            number: chatId || '',
            text: emoji, // empty string "" removes reaction
          }),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')

        const response = await fetch(`${baseUrl}/message/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ id: messageId }),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // pin-chat REMOVED — now handled 100% locally in frontend

      case 'edit-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')
        if (!newText) throw new Error('newText is required')

        const response = await fetch(`${baseUrl}/message/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ id: messageId, content: newText }),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // archive-chat REMOVED — now handled 100% locally in frontend

      // fetch-labels, set-chat-labels REMOVED — now handled 100% locally in frontend

      case 'update-profile-name': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { profileName } = body
        if (!profileName) throw new Error('profileName is required')
        const response = await fetch(`${baseUrl}/profile/name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ name: profileName }),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-profile-image': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { profileImage } = body
        if (!profileImage) throw new Error('profileImage is required')
        const response = await fetch(`${baseUrl}/profile/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ file: profileImage }),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get-privacy': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const response = await fetch(`${baseUrl}/instance/privacy`, {
          method: 'GET',
          headers: { 'token': chipToken },
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'set-privacy': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { privacy } = body
        if (!privacy) throw new Error('privacy settings are required')
        const response = await fetch(`${baseUrl}/instance/privacy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(privacy),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get-business-profile': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const response = await fetch(`${baseUrl}/business/get/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({}),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update-business-profile': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { businessProfile } = body
        if (!businessProfile) throw new Error('businessProfile is required')
        const response = await fetch(`${baseUrl}/business/update/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(businessProfile),
        })
        const data = await response.json()
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // edit-label REMOVED — now handled 100% locally in frontend

      case 'connect-instance': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        try {
          const response = await fetch(`${baseUrl}/instance/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
          })
          const data = await response.json().catch(() => ({}))
          console.log(`connect-instance: status=${response.status}`)
          return new Response(
            JSON.stringify({ success: true, data }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (connErr) {
          console.error('connect-instance error:', connErr)
          return new Response(
            JSON.stringify({ success: false, error: connErr.message || 'Failed to connect' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      case 'get-profile-name': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        // Get chip nickname from DB as fallback
        const { data: chipData } = await adminClient
          .from('chips')
          .select('nickname, phone_number, instance_name')
          .eq('id', chipId)
          .single()
        // Try to get profile name and pic from UazAPI
        try {
          const response = await fetch(`${baseUrl}/instance/status`, {
            method: 'GET',
            headers: { 'token': chipToken },
          })
          const statusData = await response.json()
          const profileName = statusData?.instance?.profileName || statusData?.profileName || chipData?.nickname || ''
          const profilePicUrl = statusData?.instance?.profilePicUrl || statusData?.profilePicUrl || null
          return new Response(
            JSON.stringify({ success: true, profileName, profilePicUrl, chipData, instance: statusData?.instance }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch {
          return new Response(
            JSON.stringify({ success: true, profileName: chipData?.nickname || '', chipData }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      case 'delete-chat': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        // Call UazAPI to delete chat
        const response = await fetch(`${baseUrl}/chat/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, deleteWhatsApp: true, deleteDB: true, deleteMessages: true }),
        })
        const data = await response.json()
        console.log(`delete-chat: UazAPI response status=${response.status}`, JSON.stringify(data).substring(0, 300))

        // Delete from local DB regardless of API result
        await adminClient.from('message_history').delete().eq('chip_id', chipId).eq('remote_jid', chatId)
        await adminClient.from('conversations').delete().eq('chip_id', chipId).eq('remote_jid', chatId)

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'mute-chat': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        const duration = body.duration ?? 0
        const response = await fetch(`${baseUrl}/chat/mute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, duration }),
        })
        const data = await response.json()
        console.log(`mute-chat: duration=${duration}, status=${response.status}`)

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'block-contact': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        const block = body.block ?? true
        const response = await fetch(`${baseUrl}/chat/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, block }),
        })
        const data = await response.json()
        console.log(`block-contact: block=${block}, status=${response.status}`)

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'list-quick-replies': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')

        const response = await fetch(`${baseUrl}/quickreply/showall`, {
          method: 'GET',
          headers: { 'token': chipToken },
        })
        const data = await response.json()
        console.log(`list-quick-replies: status=${response.status}, count=${Array.isArray(data) ? data.length : 'n/a'}`)

        return new Response(
          JSON.stringify({ success: true, quickReplies: Array.isArray(data) ? data : (data.quickReplies || data.data || []) }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'edit-quick-reply': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')

        const { shortCut, text, id, delete: deleteFlag, type } = body
        const payload: any = { shortCut, text }
        if (id) payload.id = id
        if (deleteFlag) payload.delete = true
        if (type) payload.type = type

        const response = await fetch(`${baseUrl}/quickreply/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(payload),
        })
        const data = await response.json()

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('UazAPI error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper to get instance token by instance name
async function getInstanceToken(adminClient: any, instanceName: string): Promise<string | null> {
  const { data } = await adminClient
    .from('chips')
    .select('instance_token')
    .eq('instance_name', instanceName)
    .single()
  return data?.instance_token || null
}

// Helper to get chip token by chipId or fallback to instanceToken
async function getChipToken(adminClient: any, chipId?: string, instanceToken?: string): Promise<string | null> {
  if (instanceToken) return instanceToken
  if (!chipId) return null
  const { data } = await adminClient
    .from('chips')
    .select('instance_token')
    .eq('id', chipId)
    .single()
  return data?.instance_token || null
}
