import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface CorbanAuth {
  username: string
  password: string
  empresa: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const normalizeLookupKey = (value: string) => (
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
)

const maybeParseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

const hasContent = (value: unknown) => !(
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '')
)

function findDeepValueByKey(source: unknown, candidate: string, seen = new WeakSet<object>()): unknown {
  const target = normalizeLookupKey(candidate)

  const walk = (value: unknown): unknown => {
    const current = maybeParseJson(value)

    if (Array.isArray(current)) {
      for (const item of current) {
        const found = walk(item)
        if (hasContent(found)) return found
      }
      return undefined
    }

    if (!isRecord(current)) return undefined
    if (seen.has(current)) return undefined
    seen.add(current)

    for (const [key, nested] of Object.entries(current)) {
      if (normalizeLookupKey(key) === target) {
        return maybeParseJson(nested)
      }
    }

    for (const nested of Object.values(current)) {
      const found = walk(nested)
      if (hasContent(found)) return found
    }

    return undefined
  }

  return walk(source)
}

function findDeepValue(source: unknown, candidates: string[]): unknown {
  for (const candidate of candidates) {
    const found = findDeepValueByKey(source, candidate)
    if (hasContent(found)) return found
  }
  return null
}

const toFlatString = (value: unknown): string | null => {
  const parsed = maybeParseJson(value)
  if (parsed === null || parsed === undefined) return null
  if (typeof parsed === 'string') return parsed.trim() || null
  if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed)
  return null
}

const toFlatNumber = (value: unknown): number | null => {
  const parsed = maybeParseJson(value)
  if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed
  if (typeof parsed !== 'string') return null

  const cleaned = parsed
    .replace(/\s+/g, '')
    .replace(/R\$/gi, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  if (!cleaned) return null

  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? numeric : null
}

function extractPropostasList(source: unknown): Record<string, unknown>[] {
  const parsed = maybeParseJson(source)

  if (Array.isArray(parsed)) {
    return parsed.map((item) => maybeParseJson(item)).filter(isRecord)
  }

  if (!isRecord(parsed)) return []

  for (const wrapperKey of ['data', 'dados', 'propostas', 'items', 'lista']) {
    if (wrapperKey in parsed) {
      const nested = extractPropostasList(parsed[wrapperKey])
      if (nested.length > 0) return nested
    }
  }

  const numericEntries = Object.entries(parsed).filter(([key, value]) => /^\d+$/.test(key) && value != null)
  if (numericEntries.length > 0) {
    return numericEntries.map(([key, value]) => {
      const parsedValue = maybeParseJson(value)
      return isRecord(parsedValue)
        ? { proposta_id: key, ...parsedValue }
        : { proposta_id: key, raw: parsedValue }
    })
  }

  if (
    'proposta_id' in parsed ||
    'id' in parsed ||
    'averbacao' in parsed ||
    'api' in parsed ||
    'datas' in parsed ||
    'cliente' in parsed
  ) {
    return [parsed]
  }

  return []
}

function normalizePropostaRecord(source: unknown): Record<string, unknown> {
  const parsed = maybeParseJson(source)
  const prazoValue = findDeepValue(parsed, ['prazo', 'prazos', 'parcelas', 'quantidade_parcelas'])

  return {
    proposta_id: toFlatString(findDeepValue(parsed, ['proposta_id', 'id', 'codigo_proposta'])),
    cpf: toFlatString(findDeepValue(parsed, ['cpf', 'cpf_cliente', 'documento', 'cpfcnpj'])),
    nome: toFlatString(findDeepValue(parsed, ['nome', 'nome_cliente', 'cliente_nome', 'nome_completo'])),
    telefone: toFlatString(findDeepValue(parsed, ['telefone', 'celular', 'fone', 'whatsapp'])),
    banco: toFlatString(findDeepValue(parsed, ['banco_nome', 'nome_banco', 'banco_averbacao_nome', 'banco_averbacao', 'banco'])),
    produto: toFlatString(findDeepValue(parsed, ['produto_nome', 'produto_descricao', 'produto', 'tipo_operacao'])),
    status: toFlatString(findDeepValue(parsed, ['status_api_descricao', 'status_nome', 'status_descricao', 'descricao_status', 'status_api', 'status'])),
    valor_liberado: toFlatNumber(findDeepValue(parsed, ['valor_liberado', 'vlr_liberado', 'valorliberado', 'valor_liquido', 'valor'])),
    valor_parcela: toFlatNumber(findDeepValue(parsed, ['valor_parcela', 'vlr_parcela', 'parcela'])),
    prazo: typeof prazoValue === 'number' ? prazoValue : toFlatString(prazoValue),
    data_cadastro: toFlatString(findDeepValue(parsed, ['data_cadastro', 'cadastro', 'inclusao'])),
    data_pagamento: toFlatString(findDeepValue(parsed, ['data_pagamento', 'pagamento', 'data_pago'])),
    convenio: toFlatString(findDeepValue(parsed, ['convenio_nome', 'convenio'])),
    tipo_liberacao: toFlatString(findDeepValue(parsed, ['tipo_liberacao'])),
    _raw: parsed,
  }
}

// Actions that require admin/master/support role
const WRITE_ACTIONS = ['insertQueueFGTS', 'createProposta', 'rawProxy']

// All valid actions
const VALID_ACTIONS = [
  'getPropostas', 'getAssets', 'listLogins',
  'insertQueueFGTS', 'listQueueFGTS', 'createProposta',
  'testConnection', 'rawProxy'
]

function normalizeAssetsResponse(raw: unknown, assetType: string): Record<string, unknown>[] {
  const parsed = maybeParseJson(raw)
  if (!isRecord(parsed)) return Array.isArray(parsed) ? parsed.filter(isRecord) : []

  // The API commonly returns { lista: { "0": {...}, "1": {...} } }
  let source: unknown = parsed
  for (const wrapperKey of ['lista', 'data', 'dados', 'items', 'assets']) {
    if (wrapperKey in (source as Record<string, unknown>)) {
      source = (source as Record<string, unknown>)[wrapperKey]
      break
    }
  }

  let items: Record<string, unknown>[] = []

  if (Array.isArray(source)) {
    items = source.filter(isRecord)
  } else if (isRecord(source)) {
    // Keyed object { "0": {...}, "1": {...} }
    const entries = Object.entries(source)
    if (entries.length > 0 && entries.some(([k]) => /^\d+$/.test(k))) {
      items = entries.map(([key, value]) => {
        const v = maybeParseJson(value)
        return isRecord(v) ? { _index: key, ...v } : { _index: key, raw: v }
      })
    } else {
      items = entries.map(([key, value]) => {
        const v = maybeParseJson(value)
        return isRecord(v) ? { _key: key, ...v } : { _key: key, value: v }
      })
    }
  }

  // Normalize each item: extract a stable id and label
  return items.map((item, idx) => {
    const id = toFlatString(item.empresa_id) || toFlatString(item.id) || toFlatString(item.codigo) || toFlatString(item.value) || toFlatString(item._index) || String(idx)
    // For 'status' assets, the label is usually in 'tabulacao'; for others try common fields
    const label = toFlatString(item.tabulacao) || toFlatString(item.nome) || toFlatString(item.descricao) || toFlatString(item.label) || toFlatString(item.name) || toFlatString(item.titulo) || id
    return {
      asset_id: id,
      asset_label: label,
      ...item,
    }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      console.error('[corban-api] Auth error:', userError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = user.id
    const userEmail = user.email || 'unknown'

    // Get user role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', userId).single()
    const userRole = roleData?.role || 'seller'

    // Parse request body
    const body = await req.json()
    const { action, params } = body

    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check write permissions
    if (WRITE_ACTIONS.includes(action) && !['master', 'admin', 'support'].includes(userRole)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions for write operations' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- rawProxy: forward arbitrary payload to arbitrary URL (admin only) ---
    if (action === 'rawProxy') {
      if (!['master', 'admin'].includes(userRole)) {
        return new Response(JSON.stringify({ error: 'rawProxy restricted to admin/master' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const proxyUrl = params?.url
      const proxyBody = params?.body
      if (!proxyUrl) {
        return new Response(JSON.stringify({ error: 'Missing params.url' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      console.log(`[corban-api] rawProxy to ${proxyUrl} by ${userEmail}`)
      const proxyResp = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody),
      })
      const proxyText = await proxyResp.text()
      console.log(`[corban-api] rawProxy response: ${proxyResp.status}, preview: ${proxyText.substring(0, 500)}`)

      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId, user_email: userEmail, action: 'corban_rawProxy',
        target_table: 'corban_api',
        details: {
          category: 'corban',
          request_payload: { url: proxyUrl, method: 'POST', body: proxyBody },
          response_payload: { status_code: proxyResp.status, body: proxyText.substring(0, 5000) },
          success: proxyResp.ok,
        },
      })

      return new Response(JSON.stringify({
        success: true,
        status_code: proxyResp.status,
        data: proxyText,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get Corban credentials from secrets
    const corbanUrl = Deno.env.get('CORBAN_API_URL')
    const corbanUsername = Deno.env.get('CORBAN_USERNAME')
    const corbanPassword = Deno.env.get('CORBAN_PASSWORD')
    const corbanEmpresa = Deno.env.get('CORBAN_EMPRESA')

    if (!corbanUrl || !corbanUsername || !corbanPassword || !corbanEmpresa) {
      return new Response(JSON.stringify({ error: 'Corban API credentials not configured. Please add secrets: CORBAN_API_URL, CORBAN_USERNAME, CORBAN_PASSWORD, CORBAN_EMPRESA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const auth: CorbanAuth = {
      username: corbanUsername,
      password: corbanPassword,
      empresa: corbanEmpresa,
    }

    // Build request body for NewCorban API
    let corbanBody: Record<string, unknown> = { auth }
    let result: unknown = null

    switch (action) {
      case 'testConnection': {
        // Simple test: try getAssets with 'status'
        corbanBody.requestType = 'getAssets'
        corbanBody.asset = 'status'
        break
      }
      case 'getPropostas': {
        corbanBody.requestType = 'getPropostas'
        const rawFilters = isRecord(params?.filters) ? { ...params.filters } : {}
        const rawData = isRecord(rawFilters.data) ? rawFilters.data : {}
        const now = new Date()
        const fallbackFrom = new Date(now)
        fallbackFrom.setDate(fallbackFrom.getDate() - 30)

        const startDate = typeof rawData.startDate === 'string' && rawData.startDate
          ? rawData.startDate
          : fallbackFrom.toISOString().split('T')[0]

        let endDate = typeof rawData.endDate === 'string' && rawData.endDate
          ? rawData.endDate
          : now.toISOString().split('T')[0]

        const start = new Date(startDate)
        const end = new Date(endDate)
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24)
          if (diffDays > 31) {
            const adjusted = new Date(start)
            adjusted.setDate(start.getDate() + 30)
            endDate = adjusted.toISOString().split('T')[0]
          }
        }

        const exactFilters = {
          status: [],
          data: {
            tipo: 'cadastro',
            startDate,
            endDate,
          },
        }

        corbanBody.filters = params?.exactPayload === true
          ? exactFilters
          : {
              ...rawFilters,
              status: Array.isArray(rawFilters.status) ? rawFilters.status : [],
              data: {
                ...rawData,
                tipo: 'cadastro',
                startDate,
                endDate,
              },
            }
        break
      }
      case 'getAssets': {
        corbanBody.requestType = 'getAssets'
        corbanBody.asset = params?.asset || 'status'
        break
      }
      case 'listLogins': {
        corbanBody.requestType = 'listLogins'
        corbanBody.instituicao = params?.instituicao || 'facta'
        break
      }
      case 'insertQueueFGTS': {
        corbanBody.requestType = 'insertQueueFGTS'
        const fgtsContent = { ...(params?.content || {}) }
        const tabelaValue = params?.tabela || fgtsContent.tabela || 'fgts'
        // Send tabela at both root and inside content to cover API variations
        corbanBody.tabela = tabelaValue
        fgtsContent.tabela = tabelaValue
        corbanBody.content = fgtsContent
        break
      }
      case 'listQueueFGTS': {
        const rawFgts = isRecord(params?.filters) ? { ...params.filters } : {}
        // Ensure data range exists (API requires it)
        const fgtsData = isRecord(rawFgts.data) ? { ...rawFgts.data } : {}
        if (!fgtsData.startDate) {
          const today = new Date().toISOString().split('T')[0]
          fgtsData.startDate = today
          fgtsData.endDate = today
        } else {
          // Enforce max 1-day range required by the API
          const start = new Date(fgtsData.startDate as string)
          const end = new Date((fgtsData.endDate || fgtsData.startDate) as string)
          if ((end.getTime() - start.getTime()) / (1000 * 3600 * 24) > 1) {
            fgtsData.endDate = fgtsData.startDate
          }
        }
        // Build filters with instituicao and searchString at the correct level
        corbanBody.requestType = 'listQueueFGTS'
        corbanBody.filters = {
          data: fgtsData,
          ...(rawFgts.instituicao ? { instituicao: rawFgts.instituicao } : {}),
          ...(rawFgts.searchString ? { searchString: rawFgts.searchString } : {}),
        }
        break
      }
      case 'createProposta': {
        corbanBody.requestType = 'createProposta'
        corbanBody.content = params?.content || {}
        break
      }
    }

    // Call NewCorban API
    const apiUrl = `${corbanUrl.replace(/\/$/, '')}/api/propostas/`
    console.log(`[corban-api] Calling ${action} for user ${userEmail} (${userRole})`)
    console.log(`[corban-api] Request body:`, JSON.stringify(corbanBody).substring(0, 500))

    const corbanResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corbanBody),
    })

    const responseText = await corbanResponse.text()
    console.log(`[corban-api] Response status: ${corbanResponse.status}, body preview:`, responseText.substring(0, 500))
    try {
      result = JSON.parse(responseText)
    } catch {
      result = { raw: responseText }
    }

    // Detect logical errors (API returns {"error":true} with HTTP 200)
    if (typeof result === 'object' && result !== null && (result as any).error === true) {
      const errMsg = (result as any).mensagem || 'Erro retornado pela API Corban'
      console.error(`[corban-api] Logical error from NewCorban:`, errMsg)
      
      await supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        user_email: userEmail,
        action: `corban_${action}`,
        target_table: 'corban_api',
        details: {
          category: 'corban',
          request_payload: { url: apiUrl, method: 'POST', action, params: params || {}, body: { ...corbanBody, auth: '***REDACTED***' } },
          response_payload: { status_code: corbanResponse.status, body: responseText.substring(0, 5000) },
          success: false,
          error_message: errMsg,
        },
      })

      return new Response(JSON.stringify({
        error: errMsg,
        details: result,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Log to audit_logs (include truncated response for debugging)
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      user_email: userEmail,
      action: `corban_${action}`,
      target_table: 'corban_api',
      details: {
        category: 'corban',
        request_payload: { url: apiUrl, method: 'POST', action, params: params || {}, body: { ...corbanBody, auth: '***REDACTED***' } },
        response_payload: { status_code: corbanResponse.status, body: responseText.substring(0, 5000) },
        success: corbanResponse.ok,
      },
    })

    if (!corbanResponse.ok) {
      console.error(`[corban-api] Error from NewCorban: ${corbanResponse.status}`, responseText)
      return new Response(JSON.stringify({
        error: 'Corban API returned an error',
        status_code: corbanResponse.status,
        details: result,
      }), { status: corbanResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let finalData = result
    if (action === 'getPropostas') {
      // Return raw data — normalization is done on the frontend (normalizeCorbanPropostasInput)
      // to avoid CPU timeout on large datasets (3000+ propostas)
      console.log(`[corban-api] Returning raw propostas data to frontend for client-side normalization`)
    } else if (action === 'getAssets') {
      // Normalize getAssets: API returns {"lista": {"0": {...}, "1": {...}}} or similar keyed objects
      finalData = normalizeAssetsResponse(result, params?.asset || 'status')
      console.log(`[corban-api] Normalized ${Array.isArray(finalData) ? (finalData as any[]).length : 0} assets for ${params?.asset}`)
    } else if (action === 'listQueueFGTS' && typeof result === 'object' && result !== null && !Array.isArray(result)) {
      const entries = Object.entries(result as Record<string, unknown>)
      if (entries.length > 0 && entries.every(([k]) => /^\d+$/.test(k))) {
        finalData = entries.map(([id, value]) => ({
          proposta_id: id,
          ...(typeof value === 'object' && value !== null ? value as Record<string, unknown> : { raw: value }),
        }))
        console.log(`[corban-api] Converted keyed object to array: ${(finalData as any[]).length} items`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: finalData,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[corban-api] Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
