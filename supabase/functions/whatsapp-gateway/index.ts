import { createClient } from "npm:@supabase/supabase-js@2.49.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ===== META GRAPH API HELPERS =====

const META_API_VERSION = 'v21.0'
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

async function metaFetch(path: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 15000, ...fetchOptions } = options
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(`${META_BASE_URL}${path}`, { ...fetchOptions, signal: controller.signal })
  } finally {
    clearTimeout(tid)
  }
}

async function safeJson(response: Response): Promise<any> {
  try {
    const text = await response.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

// ===== META ACTION HANDLERS =====

async function handleMetaAction(
  action: string,
  body: any,
  adminClient: any,
  metaAccessToken: string,
  chip: any
): Promise<Response> {
  const phoneNumberId = chip.meta_phone_number_id

  if (!phoneNumberId) {
    return jsonResponse({ error: 'Meta Phone Number ID not configured for this chip' }, 400)
  }

  switch (action) {
    case 'check-status': {
      // Meta chips are always "connected" if token is valid
      try {
        const resp = await metaFetch(`/${phoneNumberId}`, {
          headers: { 'Authorization': `Bearer ${metaAccessToken}` },
          timeout: 8000,
        })
        const data = await safeJson(resp)
        if (data.error) {
          return jsonResponse({ success: true, state: 'disconnected', error: data.error.message })
        }
        return jsonResponse({
          success: true,
          state: 'connected',
          jid: data.display_phone_number ? `${data.display_phone_number.replace(/\D/g, '')}@s.whatsapp.net` : null,
          instance: { meta: true, phoneNumber: data.display_phone_number, qualityRating: data.quality_rating },
        })
      } catch (e: any) {
        return jsonResponse({ success: true, state: 'error', error: e.message })
      }
    }

    case 'send-message': {
      const { phoneNumber, message } = body
      if (!phoneNumber || !message) {
        return jsonResponse({ error: 'Phone number and message are required' }, 400)
      }
      let normalizedPhone = phoneNumber.replace(/\D/g, '')
      if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
        normalizedPhone = '55' + normalizedPhone
      }

      const resp = await metaFetch(`/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'text',
          text: { body: message },
        }),
        timeout: 15000,
      })
      const data = await safeJson(resp)
      if (data.error) {
        return jsonResponse({ success: false, error: data.error.message || 'Meta API error' })
      }

      // Log cost
      try {
        await adminClient.from('whatsapp_cost_log').insert({
          chip_id: chip.id,
          direction: 'outgoing',
          category: 'service',
          cost_estimate: 0.10,
          currency: 'BRL',
        })
      } catch { /* non-critical */ }

      return jsonResponse({ success: true, data: { messageId: data.messages?.[0]?.id } })
    }

    case 'send-media': {
      const { phoneNumber, mediaType, mediaBase64, mediaCaption, mediaFileName } = body
      if (!phoneNumber) {
        return jsonResponse({ error: 'Phone number is required' }, 400)
      }
      let normalizedPhone = phoneNumber.replace(/\D/g, '')
      if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
        normalizedPhone = '55' + normalizedPhone
      }

      // For Meta, we need to upload media first, then send
      // Determine MIME type
      const mimeMap: Record<string, string> = {
        image: 'image/jpeg',
        video: 'video/mp4',
        audio: 'audio/ogg',
        ptt: 'audio/ogg',
        document: 'application/pdf',
      }
      const mime = mimeMap[mediaType] || 'application/octet-stream'

      // Upload media
      const mediaData = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64
      const binaryData = Uint8Array.from(atob(mediaData), c => c.charCodeAt(0))

      const formData = new FormData()
      formData.append('messaging_product', 'whatsapp')
      formData.append('file', new Blob([binaryData], { type: mime }), mediaFileName || 'file')
      formData.append('type', mime)

      const uploadResp = await metaFetch(`/${phoneNumberId}/media`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${metaAccessToken}` },
        body: formData,
        timeout: 45000,
      })
      const uploadData = await safeJson(uploadResp)
      if (uploadData.error || !uploadData.id) {
        return jsonResponse({ success: false, error: uploadData.error?.message || 'Media upload failed' })
      }

      // Send message with media
      const metaType = mediaType === 'ptt' ? 'audio' : mediaType
      const msgBody: any = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: metaType,
        [metaType]: { id: uploadData.id },
      }
      if (mediaCaption && ['image', 'video', 'document'].includes(metaType)) {
        msgBody[metaType].caption = mediaCaption
      }
      if (metaType === 'document' && mediaFileName) {
        msgBody[metaType].filename = mediaFileName
      }

      const sendResp = await metaFetch(`/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify(msgBody),
        timeout: 15000,
      })
      const sendData = await safeJson(sendResp)
      if (sendData.error) {
        return jsonResponse({ success: false, error: sendData.error.message })
      }

      return jsonResponse({ success: true, data: { messageId: sendData.messages?.[0]?.id } })
    }

    case 'send-template': {
      const { phoneNumber, templateName, templateLanguage, templateComponents } = body
      if (!phoneNumber || !templateName) {
        return jsonResponse({ error: 'Phone number and template name are required' }, 400)
      }
      let normalizedPhone = phoneNumber.replace(/\D/g, '')
      if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
        normalizedPhone = '55' + normalizedPhone
      }

      const msgBody: any = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage || 'pt_BR' },
        },
      }
      if (templateComponents) {
        msgBody.template.components = templateComponents
      }

      const resp = await metaFetch(`/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify(msgBody),
        timeout: 15000,
      })
      const data = await safeJson(resp)
      if (data.error) {
        return jsonResponse({ success: false, error: data.error.message })
      }

      // Log cost as utility
      try {
        await adminClient.from('whatsapp_cost_log').insert({
          chip_id: chip.id,
          direction: 'outgoing',
          category: 'utility',
          cost_estimate: 0.15,
          currency: 'BRL',
        })
      } catch { /* non-critical */ }

      return jsonResponse({ success: true, data: { messageId: data.messages?.[0]?.id } })
    }

    case 'mark-read': {
      const { messageId } = body
      if (!messageId) {
        return jsonResponse({ success: true, unsupported: false })
      }
      const resp = await metaFetch(`/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
        timeout: 8000,
      })
      await safeJson(resp) // consume
      return jsonResponse({ success: true })
    }

    case 'react-message': {
      const { messageId, emoji } = body
      if (!messageId || !emoji) {
        return jsonResponse({ error: 'messageId and emoji required' }, 400)
      }
      // Need the chatId to know who to send the reaction to
      const chatId = body.chatId || ''
      const to = chatId.split('@')[0]
      if (!to) return jsonResponse({ error: 'chatId required for reaction' }, 400)

      const resp = await metaFetch(`/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'reaction',
          reaction: { message_id: messageId, emoji },
        }),
        timeout: 8000,
      })
      const data = await safeJson(resp)
      if (data.error) {
        return jsonResponse({ success: false, error: data.error.message })
      }
      return jsonResponse({ success: true, data })
    }

    case 'download-media': {
      const { messageId: mediaId } = body
      if (!mediaId) return jsonResponse({ error: 'mediaId required' }, 400)

      // Step 1: get media URL
      const urlResp = await metaFetch(`/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${metaAccessToken}` },
        timeout: 8000,
      })
      const urlData = await safeJson(urlResp)
      if (urlData.error || !urlData.url) {
        return jsonResponse({ success: false, error: urlData.error?.message || 'Media URL not found' })
      }

      // Step 2: download the media
      const mediaResp = await fetch(urlData.url, {
        headers: { 'Authorization': `Bearer ${metaAccessToken}` },
      })
      if (!mediaResp.ok) {
        return jsonResponse({ success: false, error: `Download failed: ${mediaResp.status}` })
      }

      const arrayBuffer = await mediaResp.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const mimeType = urlData.mime_type || mediaResp.headers.get('content-type') || 'application/octet-stream'

      return jsonResponse({
        success: true,
        data: {
          base64: `data:${mimeType};base64,${base64}`,
          mimetype: mimeType,
        },
      })
    }

    case 'fetch-chats': {
      // Meta doesn't have a "list chats" endpoint — we serve from DB
      const { data: dbConvos } = await adminClient
        .from('conversations')
        .select('*')
        .eq('chip_id', chip.id)
        .order('last_message_at', { ascending: false })
        .limit(body.limit || 200)

      const chats = (dbConvos || []).map((r: any) => ({
        id: r.id,
        remoteJid: r.remote_jid,
        name: r.contact_name || r.contact_phone || r.remote_jid?.split('@')[0] || 'Desconhecido',
        phone: r.contact_phone || r.remote_jid?.split('@')[0] || '',
        lastMessage: r.last_message_text || '',
        lastMessageAt: r.last_message_at,
        unreadCount: r.unread_count || 0,
        isGroup: r.is_group || false,
        isPinned: r.is_pinned || false,
        profilePicUrl: r.profile_pic_url || null,
      }))
      return jsonResponse({ success: true, chats, source: 'database' })
    }

    case 'fetch-messages': {
      // Meta messages come via webhook, served from DB
      const chatId = body.chatId
      if (!chatId) return jsonResponse({ error: 'chatId required' }, 400)

      const { data: msgs } = await adminClient
        .from('message_history')
        .select('*')
        .eq('chip_id', chip.id)
        .eq('remote_jid', chatId)
        .order('created_at', { ascending: true })
        .limit(body.limit || 50)

      const messages = (msgs || []).map((m: any) => ({
        id: m.message_id || m.id,
        text: m.message_content || '',
        fromMe: m.direction === 'outgoing',
        timestamp: m.created_at,
        senderName: m.sender_name || '',
        messageType: m.media_type || 'text',
        mediaType: m.media_type || '',
        messageId: m.message_id || m.id,
        hasMedia: !!(m.media_type && m.media_type !== 'text'),
        chatId,
      }))
      return jsonResponse({ success: true, messages })
    }

    case 'sync-templates': {
      // Sync Meta message templates
      const wabaId = chip.meta_waba_id
      if (!wabaId) return jsonResponse({ error: 'WABA ID not configured' }, 400)

      const resp = await metaFetch(`/${wabaId}/message_templates?limit=100`, {
        headers: { 'Authorization': `Bearer ${metaAccessToken}` },
        timeout: 15000,
      })
      const data = await safeJson(resp)
      if (data.error) {
        return jsonResponse({ success: false, error: data.error.message })
      }

      const templates = data.data || []
      let synced = 0
      for (const t of templates) {
        await adminClient.from('meta_message_templates').upsert({
          waba_id: wabaId,
          template_name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          components: t.components || [],
          synced_at: new Date().toISOString(),
        }, { onConflict: 'waba_id,template_name,language', ignoreDuplicates: false })
        synced++
      }
      return jsonResponse({ success: true, synced, total: templates.length })
    }

    case 'get-business-profile': {
      const resp = await metaFetch(`/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`, {
        headers: { 'Authorization': `Bearer ${metaAccessToken}` },
        timeout: 8000,
      })
      const data = await safeJson(resp)
      if (data.error) {
        return jsonResponse({ success: false, error: data.error.message })
      }
      return jsonResponse({ success: true, data: data.data?.[0] || {} })
    }

    // Actions not supported by Meta — return gracefully
    case 'create-instance':
    case 'get-qrcode':
    case 'delete-instance':
    case 'disconnect-instance':
    case 'send-presence':
    case 'delete-message':
    case 'edit-message':
    case 'set-profile-name':
    case 'set-profile-picture':
    case 'set-privacy':
    case 'fetch-privacy':
    case 'fetch-business-profile':
    case 'update-business-profile':
    case 'mute-chat':
    case 'block-contact':
    case 'delete-chat':
    case 'list-quick-replies':
    case 'edit-quick-reply':
      return jsonResponse({ success: true, unsupported: true, provider: 'meta', message: `Action '${action}' is not supported by Meta Cloud API` })

    default:
      return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  }
}

// ===== MAIN HANDLER =====

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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const body = await req.json()
    const { action, chipId } = body

    if (!action) {
      return jsonResponse({ error: 'action is required' }, 400)
    }

    // Determine provider from chip
    let provider = 'uazapi'
    let chip: any = null

    if (chipId) {
      const { data: chipData } = await adminClient
        .from('chips')
        .select('id, provider, meta_phone_number_id, meta_waba_id, instance_name, instance_token')
        .eq('id', chipId)
        .single()
      
      if (chipData) {
        chip = chipData
        provider = (chipData as any).provider || 'uazapi'
      }
    }

    // For actions that use instanceName instead of chipId, check provider
    if (!chipId && body.instanceName) {
      const { data: chipData } = await adminClient
        .from('chips')
        .select('id, provider, meta_phone_number_id, meta_waba_id, instance_name, instance_token')
        .eq('instance_name', body.instanceName)
        .single()
      
      if (chipData) {
        chip = chipData
        provider = (chipData as any).provider || 'uazapi'
      }
    }

    console.log(`whatsapp-gateway: action=${action}, chipId=${chipId}, provider=${provider}`)

    // Route to the correct provider
    if (provider === 'meta') {
      // Get Meta access token from settings
      const { data: settings } = await adminClient
        .from('system_settings')
        .select('meta_access_token')
        .limit(1)
        .maybeSingle()

      const metaAccessToken = (settings as any)?.meta_access_token
      if (!metaAccessToken) {
        return jsonResponse({ error: 'Meta access token not configured. Set it in Master Admin.' }, 500)
      }

      return handleMetaAction(action, body, adminClient, metaAccessToken, chip)
    }

    // Provider is 'uazapi' — proxy to the existing uazapi-api function
    const uazapiUrl = `${supabaseUrl}/functions/v1/uazapi-api`
    const proxyResp = await fetch(uazapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    })
    const proxyData = await safeJson(proxyResp)
    return jsonResponse(proxyData, proxyResp.status)

  } catch (error: any) {
    console.error('whatsapp-gateway error:', error?.message || error)
    return jsonResponse({ error: error?.message || 'Internal server error' }, 500)
  }
})
