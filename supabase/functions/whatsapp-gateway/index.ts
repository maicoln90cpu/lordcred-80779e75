import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"
import { writeAuditLog } from '../_shared/auditLog.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Administrative actions that should be audit-logged.
// High-volume actions (send-message, fetch-*, mark-read, etc.) are intentionally excluded
// to avoid log bloat — those are tracked separately via message_history / webhook_logs.
const ADMIN_AUDIT_ACTIONS = new Set([
  'create-instance',
  'delete-instance',
  'disconnect-instance',
  'get-qrcode',
  'sync-templates',
  'create-template',
  'set-profile-name',
  'set-profile-picture',
  'set-privacy',
  'update-business-profile',
  'block-contact',
  'delete-chat',
])

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

/**
 * Converte erros crus da Meta Graph API em mensagens claras em português
 * com instrução acionável para o usuário do painel.
 */
function humanizeMetaError(metaError: any, phoneNumberId?: string): string {
  const code = metaError?.code
  const subcode = metaError?.error_subcode
  const raw = metaError?.message || 'Erro desconhecido na Meta API'

  // 100 = "Object does not exist / unsupported" → quase sempre número não registrado na Cloud API
  if (code === 100) {
    return `Número não registrado na WhatsApp Cloud API. Vá em Meta Business Manager → WhatsApp → API Setup → Phone Numbers, clique no número${phoneNumberId ? ` (ID ${phoneNumberId})` : ''}, escolha "Register" e defina um PIN de 6 dígitos. Sem esse passo, a Meta não aceita envios. Detalhe técnico: ${raw}`
  }
  // 190 = token inválido/expirado
  if (code === 190) {
    return `Token de acesso da Meta inválido ou expirado. Atualize o Access Token em Configurações → Integrações → Meta WhatsApp. Detalhe: ${raw}`
  }
  // 131056 = par destinatário/remetente em pause; 131026 = mensagem indeliverable
  if (code === 131056 || code === 131026) {
    return `Meta recusou a entrega para este número (pode ser número inválido, bloqueado, ou janela de 24h fechada exigindo template aprovado). Detalhe: ${raw}`
  }
  // 131047 = janela de 24h expirou
  if (code === 131047) {
    return `Janela de 24h expirou. Para reabrir conversa com este contato é preciso enviar um template aprovado pela Meta. Detalhe: ${raw}`
  }
  // 131051 = tipo de mensagem não suportado
  if (code === 131051) {
    return `Tipo de mensagem não suportado pela Meta para este número. Detalhe: ${raw}`
  }
  // 368 = bloqueio temporário por política
  if (code === 368) {
    return `Conta bloqueada temporariamente pela Meta por violação de política. Acesse o Business Manager para revisar. Detalhe: ${raw}`
  }
  // 80007 = rate limit
  if (code === 80007 || subcode === 2494055) {
    return `Limite de envio da Meta atingido. Aguarde alguns minutos e tente novamente. Detalhe: ${raw}`
  }
  return `Meta API: ${raw}${code ? ` (código ${code})` : ''}`
}

// ===== META ACTION HANDLERS =====

async function handleMetaAction(
  action: string,
  body: any,
  adminClient: any,
  metaAccessToken: string,
  chip: any,
  userId?: string
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

    case 'send-message':
    case 'send-chat-message': {
      // Aceita { phoneNumber, message } ou { chatId, message } (paridade com UazAPI)
      const { phoneNumber, message, chatId } = body
      const rawPhone = phoneNumber || (typeof chatId === 'string' ? chatId.split('@')[0] : '')
      if (!rawPhone || !message) {
        return jsonResponse({ error: 'Phone number (or chatId) and message are required' }, 400)
      }
      let normalizedPhone = rawPhone.replace(/\D/g, '')
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
        return jsonResponse({ success: false, error: humanizeMetaError(data.error, phoneNumberId), errorCode: data.error.code })
      }

      // Log cost + audit
      try {
        await adminClient.from('whatsapp_cost_log').insert({
          chip_id: chip.id,
          direction: 'outgoing',
          category: 'service',
          cost_estimate: 0.10,
          currency: 'BRL',
        })
      } catch { /* non-critical */ }

      // Audit: log who sent this message
      if (userId && data.messages?.[0]?.id) {
        try {
          // Wait briefly for webhook to create the message_history row
          setTimeout(async () => {
            await adminClient
              .from('message_history')
              .update({ sent_by_user_id: userId } as any)
              .eq('chip_id', chip.id)
              .eq('message_id', data.messages[0].id)
          }, 2000)
        } catch { /* non-critical */ }
      }

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
        return jsonResponse({ success: false, error: uploadData.error ? humanizeMetaError(uploadData.error, phoneNumberId) : 'Falha no upload do arquivo para a Meta', errorCode: uploadData.error?.code })
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
        return jsonResponse({ success: false, error: humanizeMetaError(sendData.error, phoneNumberId), errorCode: sendData.error.code })
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
        return jsonResponse({ success: false, error: humanizeMetaError(data.error, phoneNumberId), errorCode: data.error.code })
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
        return jsonResponse({ success: false, error: humanizeMetaError(data.error, phoneNumberId), errorCode: data.error.code })
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
        return jsonResponse({ success: false, error: humanizeMetaError(data.error, wabaId), errorCode: data.error.code })
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

    case 'create-template': {
      const wabaId = chip.meta_waba_id
      if (!wabaId) return jsonResponse({ error: 'WABA ID not configured' }, 400)

      const { name, language, category, components: tplComponents } = body
      if (!name || !category || !tplComponents) {
        return jsonResponse({ error: 'name, category and components are required' }, 400)
      }

      const resp = await metaFetch(`/${wabaId}/message_templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify({
          name,
          language: language || 'pt_BR',
          category: category || 'UTILITY',
          components: tplComponents,
        }),
        timeout: 15000,
      })
      const data = await safeJson(resp)
      if (data.error) {
        return jsonResponse({ success: false, error: humanizeMetaError(data.error, wabaId), errorCode: data.error.code })
      }

      // Save locally with PENDING status
      await adminClient.from('meta_message_templates').upsert({
        waba_id: wabaId,
        template_name: name,
        language: language || 'pt_BR',
        category: category || 'UTILITY',
        status: 'PENDING',
        components: tplComponents,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'waba_id,template_name,language', ignoreDuplicates: false })

      return jsonResponse({ success: true, data: { id: data.id, status: data.status || 'PENDING' } })
    }

    case 'get-business-profile': {
      const resp = await metaFetch(`/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`, {
        headers: { 'Authorization': `Bearer ${metaAccessToken}` },
        timeout: 8000,
      })
      const data = await safeJson(resp)
      if (data.error) {
        return jsonResponse({ success: false, error: humanizeMetaError(data.error, phoneNumberId), errorCode: data.error.code })
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

    const userId = (claimsData.claims as any).sub as string

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
    let isSharedChip = false

    if (chipId) {
      const { data: chipData } = await adminClient
        .from('chips')
        .select('id, provider, meta_phone_number_id, meta_waba_id, instance_name, instance_token, is_shared, shared_user_ids, user_id')
        .eq('id', chipId)
        .single()
      
      if (chipData) {
        chip = chipData
        provider = (chipData as any).provider || 'uazapi'
        isSharedChip = !!(chipData as any).is_shared
        
        // Check authorization for shared chips
        if (isSharedChip) {
          const sharedIds: string[] = (chipData as any).shared_user_ids || []
          const isOwner = (chipData as any).user_id === userId
          if (!isOwner && !sharedIds.includes(userId)) {
            return jsonResponse({ error: 'You are not authorized to use this shared chip' }, 403)
          }
        }
      }
    }

    // For actions that use instanceName instead of chipId, check provider
    if (!chipId && body.instanceName) {
      const { data: chipData } = await adminClient
        .from('chips')
        .select('id, provider, meta_phone_number_id, meta_waba_id, instance_name, instance_token, is_shared, shared_user_ids, user_id')
        .eq('instance_name', body.instanceName)
        .single()
      
      if (chipData) {
        chip = chipData
        provider = (chipData as any).provider || 'uazapi'
        isSharedChip = !!(chipData as any).is_shared
      }
    }

    console.log(`whatsapp-gateway: action=${action}, chipId=${chipId}, provider=${provider}, shared=${isSharedChip}, user=${userId}`)

    const shouldAudit = ADMIN_AUDIT_ACTIONS.has(action)
    const startedAt = Date.now()

    // Helper to log admin actions only.
    const logAdmin = async (success: boolean, statusCode: number, extra?: Record<string, unknown>) => {
      if (!shouldAudit) return
      try {
        const userEmail = (claimsData.claims as any)?.email as string | undefined
        await writeAuditLog(adminClient, {
          action: `whatsapp_${action.replace(/-/g, '_')}`,
          category: 'whatsapp',
          success,
          userId,
          userEmail: userEmail ?? null,
          targetTable: 'chips',
          targetId: chip?.id ?? null,
          details: {
            provider,
            chip_id: chipId ?? null,
            instance_name: chip?.instance_name ?? body.instanceName ?? null,
            status_code: statusCode,
            duration_ms: Date.now() - startedAt,
            ...(extra || {}),
          },
        })
      } catch { /* non-critical */ }
    }

    // Route to the correct provider
    if (provider === 'meta') {
      // Get Meta access token — DB priority, then env fallback
      const { data: settings } = await adminClient
        .from('system_settings')
        .select('meta_access_token')
        .limit(1)
        .maybeSingle()

      const metaAccessToken = (settings as any)?.meta_access_token || Deno.env.get('META_ACCESS_TOKEN')
      if (!metaAccessToken) {
        await logAdmin(false, 500, { error_message: 'Meta access token not configured' })
        return jsonResponse({ error: 'Meta access token not configured. Set it in Admin → Integrations → Meta.' }, 500)
      }

      const metaResp = await handleMetaAction(action, body, adminClient, metaAccessToken, chip, userId)
      // Read body to capture success flag without consuming the response
      let parsedBody: any = {}
      try { parsedBody = await metaResp.clone().json() } catch { /* ignore */ }
      await logAdmin(parsedBody?.success !== false && metaResp.ok, metaResp.status, parsedBody?.error ? { error_message: parsedBody.error } : undefined)
      return metaResp
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

    // Audit: log sent_by_user_id for outgoing messages on shared chips
    if (isSharedChip && chip && ['send-chat-message', 'send-media'].includes(action)) {
      try {
        const chatId = body.chatId || ''
        if (chatId) {
          // Tag the most recent outgoing message with sent_by_user_id
          const { data: recentMsg } = await adminClient
            .from('message_history')
            .select('id')
            .eq('chip_id', chip.id)
            .eq('remote_jid', chatId)
            .eq('direction', 'outgoing')
            .is('sent_by_user_id', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (recentMsg) {
            await adminClient
              .from('message_history')
              .update({ sent_by_user_id: userId } as any)
              .eq('id', recentMsg.id)
          }
        }
      } catch { /* non-critical audit */ }
    }

    await logAdmin(proxyResp.ok && proxyData?.success !== false, proxyResp.status, proxyData?.error ? { error_message: proxyData.error } : undefined)
    return jsonResponse(proxyData, proxyResp.status)

  } catch (error: any) {
    console.error('whatsapp-gateway error:', error?.message || error)
    return jsonResponse({ error: error?.message || 'Internal server error' }, 500)
  }
})
