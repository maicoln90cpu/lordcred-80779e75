import { createClient } from "npm:@supabase/supabase-js@2.57.4"

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

// ===== RESILIENCE HELPERS =====

/** Fetch with AbortController timeout — prevents hanging requests */
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 15000, ...fetchOptions } = options
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal })
    return response
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw createUazapiError(`UazAPI request timeout after ${timeout}ms: ${url.split('/').pop()}`, {
        code: 'UAZAPI_TIMEOUT',
        recoverable: true,
      })
    }

    const errMsg = toErrorMessage(err).toLowerCase()
    if (
      err?.name === 'TypeError' ||
      errMsg.includes('failed to fetch') ||
      errMsg.includes('network') ||
      errMsg.includes('socket')
    ) {
      throw createUazapiError(toErrorMessage(err), {
        code: 'UAZAPI_NETWORK_ERROR',
        recoverable: true,
      })
    }

    throw err
  } finally {
    clearTimeout(tid)
  }
}

/** Safe JSON parse from Response — never throws on non-JSON bodies */
async function safeJson(response: Response): Promise<any> {
  try {
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

/** JSON response helper */
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type UazapiError = Error & {
  code?: string
  recoverable?: boolean
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Internal server error'
  }
}

function createUazapiError(message: string, options: { code?: string; recoverable?: boolean } = {}): UazapiError {
  const error = new Error(message) as UazapiError
  if (options.code) error.code = options.code
  if (options.recoverable) error.recoverable = true
  return error
}

function isRecoverableUazapiError(error: unknown): boolean {
  const typedError = error as UazapiError | undefined
  if (typedError?.recoverable) return true

  const text = toErrorMessage(error).toLowerCase()
  return (
    text.includes('timeout') ||
    text.includes('aborterror') ||
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('load failed') ||
    text.includes('socket') ||
    text.includes('disconnected') ||
    text.includes('not connected') ||
    text.includes('chip token not found') ||
    text.includes('instance token not found')
  )
}

// Timeout presets (ms)
const TIMEOUT = {
  FAST: 8000,      // status checks, presence, read markers
  NORMAL: 15000,   // send text, reactions, edits
  MEDIA: 45000,    // send/download media (large payloads)
  ADMIN: 12000,    // instance management
} as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: 'Invalid token' }, 401)
    }

    const user = { id: claimsData.claims.sub as string, email: (claimsData.claims.email as string) || '' }

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
        return jsonResponse({ success: false, error: 'URL and API Key are required' })
      }
      try {
        const testResponse = await fetchWithTimeout(`${testUrl}/instance/all`, {
          method: 'GET',
          headers: { 'admintoken': testKey },
          timeout: TIMEOUT.ADMIN,
        })
        if (testResponse.ok) {
          await testResponse.text() // consume body
          return jsonResponse({ success: true })
        } else {
          const errData = await testResponse.text()
          return jsonResponse({ success: false, error: `Status ${testResponse.status}: ${errData}` })
        }
      } catch (e: any) {
        return jsonResponse({ success: false, error: e.message || 'Connection failed' })
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
      return jsonResponse({ error: 'UazAPI not configured. Set URL and token in Master Admin.' }, 500)
    }

    switch (action) {

      case 'create-instance': {
        const response = await fetchWithTimeout(`${baseUrl}/instance/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
          body: JSON.stringify({ name: instanceName }),
          timeout: TIMEOUT.ADMIN,
        })
        const data = await safeJson(response)
        if (!response.ok) {
          if (data.message?.includes('already') || data.error?.includes('exists')) {
            try {
              const statusResp = await fetchWithTimeout(`${baseUrl}/instance/all`, {
                method: 'GET',
                headers: { 'admintoken': adminToken },
                timeout: TIMEOUT.ADMIN,
              })
              const allInstances = await safeJson(statusResp)
              const instances = Array.isArray(allInstances) ? allInstances : (allInstances.instances || [])
              const found = instances.find((i: any) => i.name === instanceName || i.instance?.name === instanceName)
              const existingToken = found?.token || found?.instance?.token || null
              if (existingToken) {
                await adminClient.from('chips').update({ instance_token: existingToken } as any).eq('instance_name', instanceName)
              }
              return jsonResponse({ exists: true, instanceName, instanceToken: existingToken })
            } catch {
              return jsonResponse({ exists: true, instanceName })
            }
          }
          throw new Error(data.message || data.error || 'Failed to create instance')
        }
        const returnedToken = data.token || data.instance?.token || null
        if (returnedToken) {
          await adminClient.from('chips').update({ instance_token: returnedToken } as any).eq('instance_name', instanceName)
        }
        const { data: chipForLog } = await adminClient.from('chips').select('id').eq('instance_name', instanceName).single()
        if (chipForLog) {
          await adminClient.from('chip_lifecycle_logs').insert({ chip_id: chipForLog.id, event: 'created', details: `Instance created: ${instanceName}` })
        }
        return jsonResponse({ success: true, data, instanceToken: returnedToken })
      }

      case 'get-qrcode': {
        let chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) {
          try {
            const allResp = await fetchWithTimeout(`${baseUrl}/instance/all`, {
              method: 'GET',
              headers: { 'admintoken': adminToken },
              timeout: TIMEOUT.ADMIN,
            })
            const allData = await safeJson(allResp)
            const instances = Array.isArray(allData) ? allData : (allData.instances || [])
            const found = instances.find((i: any) => i.name === instanceName || i.instance?.name === instanceName)
            chipToken = found?.token || found?.instance?.token || null
            if (chipToken) {
              await adminClient.from('chips').update({ instance_token: chipToken } as any).eq('instance_name', instanceName)
            }
          } catch {}
        }
        if (!chipToken) throw new Error('Instance token not found. Recreate the instance.')
        await fetchWithTimeout(`${baseUrl}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          timeout: TIMEOUT.ADMIN,
        }).catch(() => {}) // best effort
        await new Promise(resolve => setTimeout(resolve, 2000))
        const statusResponse = await fetchWithTimeout(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chipToken },
          timeout: TIMEOUT.FAST,
        })
        const statusData = await safeJson(statusResponse)
        const qrcode = statusData.instance?.qrcode || statusData.qrcode || ''
        return jsonResponse({ success: true, qrcode: qrcode || null, code: statusData.instance?.paircode || null })
      }

      case 'check-status': {
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) {
          return jsonResponse({ success: true, state: 'unknown' })
        }
        const response = await fetchWithTimeout(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chipToken },
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        let state = 'disconnected'
        if (data.status?.connected === true || data.status?.loggedIn === true) state = 'connected'
        else if (data.instance?.status === 'connecting') state = 'connecting'

        return jsonResponse({ success: true, state, jid: data.status?.jid || null, instance: data })
      }

      case 'fetch-instance-info': {
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) {
          return jsonResponse({ success: true, phoneNumber: null, data: {} })
        }
        const response = await fetchWithTimeout(`${baseUrl}/instance/status`, {
          method: 'GET',
          headers: { 'token': chipToken },
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        let phone = null
        if (data.status?.jid) phone = data.status.jid.split('@')[0]
        else if (data.instance?.owner) phone = data.instance.owner.split('@')[0]
        else if (data.ownerJid) phone = data.ownerJid.split('@')[0]
        else if (data.number) phone = data.number
        return jsonResponse({ success: true, phoneNumber: phone, data })
      }

      case 'send-message': {
        if (!phoneNumber || !message) {
          return jsonResponse({ error: 'Phone number and message are required' }, 400)
        }
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        if (!chipToken) throw new Error('Instance token not found')
        let normalizedPhone = phoneNumber.replace(/\D/g, '')
        if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
          normalizedPhone = '55' + normalizedPhone
        }
        const response = await fetchWithTimeout(`${baseUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: normalizedPhone, text: message }),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        if (!response.ok) throw new Error(data.message || 'Failed to send message')
        return jsonResponse({ success: true, data })
      }

      // ===== NEW CHAT ACTIONS =====

      case 'fetch-chats': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')

        const fetchChatsBody = { limit: limit || 200, page: page || 1 }
        console.log(`fetch-chats: chipId=${chipId}, body=${JSON.stringify(fetchChatsBody)}`)

        const response = await fetchWithTimeout(`${baseUrl}/chat/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(fetchChatsBody),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        
        const rawStr = JSON.stringify(data)
        console.log(`fetch-chats: UazAPI returned ${rawStr.length} bytes, type=${typeof data}, isArray=${Array.isArray(data)}`)
        console.log(`fetch-chats: response preview: ${rawStr.substring(0, 500)}`)
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          console.log(`fetch-chats: top-level keys: ${Object.keys(data).join(', ')}`)
        }

        let chats: any[] = []
        if (Array.isArray(data)) {
          chats = data
        } else if (data && typeof data === 'object') {
          chats = data.chats || data.data || data.results || data.items || data.records || []
          if (!Array.isArray(chats)) chats = []
        }
        
        console.log(`fetch-chats: raw chats count before filter: ${chats.length}`)

        const normalizedChats = chats
          .map((c: any) => {
            const chatJid = c.wa_chatid || c.chatid || c.jid || c.remoteJid || ''
            return { ...c, _resolvedJid: chatJid }
          })
          .filter((c: any) => c._resolvedJid && !c._resolvedJid.includes('status@'))
          .map((c: any) => {
            let lastMsgAt: string | null = null
            if (c.wa_lastMsgTimestamp) {
              const ts = Number(c.wa_lastMsgTimestamp)
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
            return jsonResponse({ success: true, chats: dbChats, source: 'database' })
          }
        }

        return jsonResponse({ success: true, chats: normalizedChats })
      }

      case 'fetch-messages': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        console.log(`fetch-messages: chipId=${chipId}, chatId=${chatId}, limit=${limit || 50}`)

        const response = await fetchWithTimeout(`${baseUrl}/message/find`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            chatid: chatId,
            limit: limit || 50,
            page: page || 1,
          }),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        
        console.log(`fetch-messages: UazAPI returned ${JSON.stringify(data).length} bytes, type=${typeof data}, isArray=${Array.isArray(data)}`)
        
        const messages = Array.isArray(data) ? data : (data.messages || data.data || [])
        
        console.log(`fetch-messages: parsed ${messages.length} messages`)
        
        const MEDIA_KEYWORDS = ['ptt', 'audio', 'image', 'video', 'sticker', 'document', 'ptv', 'myaudio']

        const normalizedMessages = messages.map((m: any) => {
          let detectedMediaType = m.mediaType || normalizeMessageType(m.messageType) || m.type || ''
          
          if (detectedMediaType && !MEDIA_KEYWORDS.includes(detectedMediaType.toLowerCase())) {
            const normalized = normalizeMessageType(detectedMediaType)
            if (normalized) detectedMediaType = normalized
          }
          detectedMediaType = detectedMediaType.toLowerCase()

          let text = typeof m.text === 'string' ? m.text : ''
          
          if (!detectedMediaType || detectedMediaType === 'text' || detectedMediaType === 'chat') {
            if (MEDIA_KEYWORDS.includes(text.toLowerCase().trim())) {
              detectedMediaType = text.toLowerCase().trim()
              text = ''
            }
          }

          const isMedia = !!(detectedMediaType && detectedMediaType !== 'text' && detectedMediaType !== 'chat')

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

        return jsonResponse({ success: true, messages: normalizedMessages })
      }

      case 'send-chat-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        
        let targetNumber = (chatId || phoneNumber || '').split('@')[0].replace(/\D/g, '')
        if (targetNumber.length === 10 || targetNumber.length === 11) {
          targetNumber = '55' + targetNumber
        }
        if (!targetNumber || !message) throw new Error('Target and message required')

        console.log(`send-chat-message: sending to ${targetNumber}, text length=${message.length}, token=${chipToken?.substring(0,8)}...`)
        const sendPayload = { number: targetNumber, text: message }
        const response = await fetchWithTimeout(`${baseUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(sendPayload),
          timeout: TIMEOUT.NORMAL,
        })
        const responseText = await response.text()
        console.log(`send-chat-message: UazAPI status=${response.status}, body=${responseText.substring(0, 500)}`)
        
        let data: any = {}
        try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }
        
        if (!response.ok) {
          const errMsg = data.message || data.error || `UazAPI returned ${response.status}`
          return jsonResponse({ success: false, error: errMsg })
        }

        return jsonResponse({ success: true, data })
      }

      case 'mark-read': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        try {
          const response = await fetchWithTimeout(`${baseUrl}/chat/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
            body: JSON.stringify({ number: chatId, read: true }),
            timeout: TIMEOUT.FAST,
          })
          const data = await safeJson(response)

          if (!response.ok) {
            const errMsg = data?.message || data?.error || `UazAPI returned ${response.status}`
            console.warn(`mark-read failed: status=${response.status}, error=${errMsg}`)
            return jsonResponse({ success: false, error: errMsg, fallback: response.status >= 500 }, 200)
          }

          await adminClient
            .from('conversations')
            .update({ unread_count: 0 })
            .eq('chip_id', chipId)
            .eq('remote_jid', chatId)

          return jsonResponse({ success: true, data })
        } catch (error) {
          const errMsg = toErrorMessage(error)
          console.warn(`mark-read recoverable error: ${errMsg}`)
          return jsonResponse({ success: false, error: errMsg, fallback: true }, 200)
        }
      }

      case 'mark-unread': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        try {
          const response = await fetchWithTimeout(`${baseUrl}/chat/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
            body: JSON.stringify({ number: chatId, read: false }),
            timeout: TIMEOUT.FAST,
          })
          const data = await safeJson(response)

          if (!response.ok) {
            const errMsg = data?.message || data?.error || `UazAPI returned ${response.status}`
            console.warn(`mark-unread failed: status=${response.status}, error=${errMsg}`)
            return jsonResponse({ success: false, error: errMsg, fallback: response.status >= 500 }, 200)
          }

          await adminClient
            .from('conversations')
            .update({ unread_count: 1 })
            .eq('chip_id', chipId)
            .eq('remote_jid', chatId)

          return jsonResponse({ success: true, data })
        } catch (error) {
          const errMsg = toErrorMessage(error)
          console.warn(`mark-unread recoverable error: ${errMsg}`)
          return jsonResponse({ success: false, error: errMsg, fallback: true }, 200)
        }
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
        const response = await fetchWithTimeout(`${baseUrl}/message/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            number: targetNumber,
            presence: presence || 'composing',
            delay: 3000,
          }),
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)

        return jsonResponse({ success: true, data })
      }

      case 'send-media': {
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

        const response = await fetchWithTimeout(`${baseUrl}/send/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(sendBody),
          timeout: TIMEOUT.MEDIA,
        })
        const data = await safeJson(response)
        if (!response.ok) {
          return jsonResponse({ success: false, error: data.message || data.error || 'Failed to send media' })
        }

        return jsonResponse({ success: true, data })
      }

      case 'download-media': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')

        const response = await fetchWithTimeout(`${baseUrl}/message/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            id: messageId,
            return_link: true,
            generate_mp3: true,
          }),
          timeout: TIMEOUT.MEDIA,
        })
        const data = await safeJson(response)

        return jsonResponse({
          success: true,
          fileURL: data.fileURL || null,
          mimetype: data.mimetype || null,
          base64Data: data.base64Data || null,
        })
      }

      case 'delete-instance': {
        try {
          const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
          const { data: chipForLog } = await adminClient.from('chips').select('id').eq('instance_name', instanceName).single()
          if (chipForLog) {
            await adminClient.from('chip_lifecycle_logs').insert({ chip_id: chipForLog.id, event: 'deleted', details: `Instance deleted: ${instanceName}` })
          }
          if (chipToken) {
            const response = await fetchWithTimeout(`${baseUrl}/instance`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'token': chipToken },
              timeout: TIMEOUT.ADMIN,
            })
            const data = await safeJson(response)
            return jsonResponse({ success: true, data })
          } else {
            return jsonResponse({ success: true, warning: 'No instance token - removed from DB only' })
          }
        } catch (deleteError) {
          return jsonResponse({ success: true, warning: 'Instance may not have been removed from UazAPI' })
        }
      }

      case 'logout-instance': {
        const chipToken = instanceToken || await getInstanceToken(adminClient, instanceName)
        try {
          const { data: chipForLog } = await adminClient.from('chips').select('id').eq('instance_name', instanceName).single()
          if (chipForLog) {
            await adminClient.from('chip_lifecycle_logs').insert({ chip_id: chipForLog.id, event: 'disconnected', details: `Graceful logout: ${instanceName}` })
          }
        } catch {}
        if (!chipToken) {
          return jsonResponse({ success: true })
        }
        try {
          const response = await fetchWithTimeout(`${baseUrl}/instance/disconnect`, {
            method: 'POST',
            headers: { 'token': chipToken },
            timeout: TIMEOUT.ADMIN,
          })
          const data = await safeJson(response)
          return jsonResponse({ success: true, data })
        } catch (logoutErr) {
          return jsonResponse({ success: true, warning: 'Instance may already be disconnected' })
        }
      }

      case 'forward-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        let targetNumber = (chatId || '').split('@')[0].replace(/\D/g, '')
        if (targetNumber.length === 10 || targetNumber.length === 11) {
          targetNumber = '55' + targetNumber
        }
        if (!targetNumber) throw new Error('Target chatId required')

        const fwdText = body.text || message || ''
        const fwdMediaType = body.mediaType || ''
        const fwdHasMedia = body.hasMedia === true
        const fwdMessageId = body.messageId || messageId || ''

        console.log(`forward-message: to=${targetNumber}, mediaType=${fwdMediaType}, hasMedia=${fwdHasMedia}, messageId=${fwdMessageId}, textLen=${fwdText.length}`)

        // If media message, download then re-send
        if (fwdHasMedia && fwdMediaType && fwdMediaType !== 'text' && fwdMediaType !== 'chat' && fwdMessageId) {
          try {
            // Step 1: Download media from original message
            console.log(`forward-message: downloading media for messageId=${fwdMessageId}`)
            const dlResponse = await fetchWithTimeout(`${baseUrl}/message/download`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': chipToken },
              body: JSON.stringify({ id: fwdMessageId, return_link: true, generate_mp3: true }),
              timeout: TIMEOUT.MEDIA,
            })
            const dlData = await safeJson(dlResponse)
            console.log(`forward-message: download result keys=${Object.keys(dlData).join(',')}, fileURL=${!!dlData.fileURL}, base64=${!!(dlData.base64Data)}`)

            const mediaFile = dlData.fileURL || dlData.base64Data || null
            if (!mediaFile) {
              // Fallback: send text if no media could be downloaded
              if (fwdText) {
                console.log(`forward-message: media download failed, falling back to text`)
                const fallbackResp = await fetchWithTimeout(`${baseUrl}/send/text`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'token': chipToken },
                  body: JSON.stringify({ number: targetNumber, text: fwdText }),
                  timeout: TIMEOUT.NORMAL,
                })
                const fallbackData = await safeJson(fallbackResp)
                return jsonResponse({ success: fallbackResp.ok, data: fallbackData, fallback: true })
              }
              return jsonResponse({ success: false, error: 'Could not download media for forwarding' })
            }

            // Step 2: Re-send media to target
            const sendMediaBody: any = {
              number: targetNumber,
              type: fwdMediaType === 'ptt' ? 'ptt' : fwdMediaType,
              file: mediaFile,
            }
            if (fwdText) sendMediaBody.text = fwdText

            console.log(`forward-message: re-sending media type=${sendMediaBody.type} to ${targetNumber}`)
            const sendResp = await fetchWithTimeout(`${baseUrl}/send/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'token': chipToken },
              body: JSON.stringify(sendMediaBody),
              timeout: TIMEOUT.MEDIA,
            })
            const sendData = await safeJson(sendResp)
            console.log(`forward-message: send media result status=${sendResp.status}`)

            if (!sendResp.ok) {
              return jsonResponse({ success: false, error: sendData.message || sendData.error || 'Failed to forward media' })
            }
            return jsonResponse({ success: true, data: sendData })
          } catch (e: any) {
            console.error(`forward-message: media forward error: ${e.message}`)
            return jsonResponse({ success: false, error: e.message || 'Media forward failed' })
          }
        }

        // Text-only forward
        if (!fwdText) throw new Error('Nothing to forward')
        console.log(`forward-message: sending text to ${targetNumber}, text length=${fwdText.length}`)
        const fwdBody: any = { number: targetNumber, text: fwdText }
        const response = await fetchWithTimeout(`${baseUrl}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(fwdBody),
          timeout: TIMEOUT.NORMAL,
        })
        const responseText = await response.text()
        console.log(`forward-message: UazAPI status=${response.status}, body=${responseText.substring(0, 300)}`)
        let data: any = {}
        try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }
        if (!response.ok) {
          return jsonResponse({ success: false, error: data.message || data.error || 'Failed to forward' })
        }
        return jsonResponse({ success: true, data })
      }

      case 'react-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')
        if (emoji === undefined) throw new Error('emoji is required')

        const response = await fetchWithTimeout(`${baseUrl}/message/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({
            id: messageId,
            number: chatId || '',
            text: emoji,
          }),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      case 'delete-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')

        const response = await fetchWithTimeout(`${baseUrl}/message/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ id: messageId }),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      // pin-chat REMOVED — now handled 100% locally in frontend

      case 'edit-message': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!messageId) throw new Error('messageId is required')
        if (!newText) throw new Error('newText is required')

        const response = await fetchWithTimeout(`${baseUrl}/message/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ id: messageId, content: newText }),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      // archive-chat REMOVED — now handled 100% locally in frontend

      // fetch-labels, set-chat-labels REMOVED — now handled 100% locally in frontend

      case 'update-profile-name': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { profileName } = body
        if (!profileName) throw new Error('profileName is required')
        const response = await fetchWithTimeout(`${baseUrl}/profile/name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ name: profileName }),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      case 'update-profile-image': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { profileImage } = body
        if (!profileImage) throw new Error('profileImage is required')
        const response = await fetchWithTimeout(`${baseUrl}/profile/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ file: profileImage }),
          timeout: TIMEOUT.MEDIA,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      case 'get-privacy': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const response = await fetchWithTimeout(`${baseUrl}/instance/privacy`, {
          method: 'GET',
          headers: { 'token': chipToken },
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      case 'set-privacy': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { privacy } = body
        if (!privacy) throw new Error('privacy settings are required')
        const response = await fetchWithTimeout(`${baseUrl}/instance/privacy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(privacy),
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      case 'get-business-profile': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const response = await fetchWithTimeout(`${baseUrl}/business/get/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({}),
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      case 'update-business-profile': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { businessProfile } = body
        if (!businessProfile) throw new Error('businessProfile is required')
        const response = await fetchWithTimeout(`${baseUrl}/business/update/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(businessProfile),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        return jsonResponse({ success: true, data })
      }

      // edit-label REMOVED — now handled 100% locally in frontend

      case 'connect-instance': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        try {
          const response = await fetchWithTimeout(`${baseUrl}/instance/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'token': chipToken },
            timeout: TIMEOUT.ADMIN,
          })
          const data = await safeJson(response)
          console.log(`connect-instance: status=${response.status}`)
          return jsonResponse({ success: true, data })
        } catch (connErr: any) {
          console.error('connect-instance error:', connErr)
          return jsonResponse({ success: false, error: connErr.message || 'Failed to connect' })
        }
      }

      case 'get-profile-name': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        const { data: chipData } = await adminClient
          .from('chips')
          .select('nickname, phone_number, instance_name')
          .eq('id', chipId)
          .single()
        try {
          const response = await fetchWithTimeout(`${baseUrl}/instance/status`, {
            method: 'GET',
            headers: { 'token': chipToken },
            timeout: TIMEOUT.FAST,
          })
          const statusData = await safeJson(response)
          const profileName = statusData?.instance?.profileName || statusData?.profileName || chipData?.nickname || ''
          const profilePicUrl = statusData?.instance?.profilePicUrl || statusData?.profilePicUrl || null
          return jsonResponse({ success: true, profileName, profilePicUrl, chipData, instance: statusData?.instance })
        } catch {
          return jsonResponse({ success: true, profileName: chipData?.nickname || '', chipData })
        }
      }

      case 'delete-chat': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        const response = await fetchWithTimeout(`${baseUrl}/chat/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, deleteWhatsApp: true, deleteDB: true, deleteMessages: true }),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        console.log(`delete-chat: UazAPI response status=${response.status}`, JSON.stringify(data).substring(0, 300))

        await adminClient.from('message_history').delete().eq('chip_id', chipId).eq('remote_jid', chatId)
        await adminClient.from('conversations').delete().eq('chip_id', chipId).eq('remote_jid', chatId)

        return jsonResponse({ success: true, data })
      }

      case 'mute-chat': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        const duration = body.duration ?? 0
        const response = await fetchWithTimeout(`${baseUrl}/chat/mute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, duration }),
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        console.log(`mute-chat: duration=${duration}, status=${response.status}`)

        return jsonResponse({ success: true, data })
      }

      case 'block-contact': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')
        if (!chatId) throw new Error('chatId is required')

        const block = body.block ?? true
        const response = await fetchWithTimeout(`${baseUrl}/chat/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify({ number: chatId, block }),
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        console.log(`block-contact: block=${block}, status=${response.status}`)

        return jsonResponse({ success: true, data })
      }

      case 'list-quick-replies': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')

        const response = await fetchWithTimeout(`${baseUrl}/quickreply/showall`, {
          method: 'GET',
          headers: { 'token': chipToken },
          timeout: TIMEOUT.FAST,
        })
        const data = await safeJson(response)
        console.log(`list-quick-replies: status=${response.status}, count=${Array.isArray(data) ? data.length : 'n/a'}`)

        if (!response.ok) {
          console.error(`list-quick-replies FAILED: status=${response.status}`, data)
          return jsonResponse({ success: false, error: data?.error || `UazAPI returned ${response.status}`, quickReplies: [] })
        }

        return jsonResponse({ success: true, quickReplies: Array.isArray(data) ? data : (data.quickReplies || data.data || []) })
      }

      case 'edit-quick-reply': {
        const chipToken = await getChipToken(adminClient, chipId, instanceToken)
        if (!chipToken) throw new Error('Chip token not found')

        const { shortCut, text, id, delete: deleteFlag, type } = body
        const payload: any = { shortCut, text }
        if (id) payload.id = id
        if (deleteFlag) payload.delete = true
        if (type) payload.type = type

        console.log(`edit-quick-reply: chipId=${chipId}, shortCut=${shortCut}, delete=${!!deleteFlag}, hasId=${!!id}`)
        const response = await fetchWithTimeout(`${baseUrl}/quickreply/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': chipToken },
          body: JSON.stringify(payload),
          timeout: TIMEOUT.NORMAL,
        })
        const data = await safeJson(response)
        console.log(`edit-quick-reply result: status=${response.status}`, data)

        if (!response.ok) {
          return jsonResponse({ success: false, error: data?.error || `UazAPI returned ${response.status}` })
        }

        return jsonResponse({ success: true, data })
      }

      default:
        return jsonResponse({ error: 'Invalid action' }, 400)
    }

  } catch (error) {
    const errMsg = toErrorMessage(error)

    if (isRecoverableUazapiError(error)) {
      console.warn('UazAPI recoverable error:', errMsg)
      return jsonResponse({ success: false, error: errMsg, fallback: true }, 200)
    }

    console.error('UazAPI error:', errMsg)
    return jsonResponse({ error: errMsg }, 500)
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
