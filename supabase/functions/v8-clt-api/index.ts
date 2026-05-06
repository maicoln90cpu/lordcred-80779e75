import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { writeAuditLog } from "../_shared/auditLog.ts";
import { packPayloadForAudit } from "../_shared/v8AuditPayload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const V8_BASE = "https://bff.v8sistema.com";
// Auth oficial — Auth0 da V8 Sistema. Validado em 2026-04-24 via DNS+probe (302 -> /).
// Doc menciona "api.v8digital.com" mas esse host está fora do ar; o Auth0 tenant ativo é auth.v8sistema.com.
const V8_AUTH = "https://auth.v8sistema.com";

// Endpoints oficiais V8 — Crédito do Trabalhador (CLT) usa /private-consignment/*
const V8_PATHS = {
  configs: "/private-consignment/simulation/configs",
  consult: "/private-consignment/consult",
  authorize: (consultId: string) => `/private-consignment/consult/${consultId}/authorize`,
  simulate: "/private-consignment/simulation",
  operations: "/private-consignment/operation",
  operationDetail: (operationId: string) => `/private-consignment/operation/${operationId}`,
  operationCancel: (operationId: string) => `/private-consignment/operation/${operationId}/cancel`,
  operationPendencyPaymentData: (operationId: string) =>
    `/private-consignment/operation/${operationId}/pendency/payment-data`,
  operationDocument: (operationId: string) =>
    `/private-consignment/operation/${operationId}/document`,
  operationPendencyPresentation: (operationId: string) =>
    `/private-consignment/operation/${operationId}/pendency/presentation`,
};

// Tipos oficiais V8 de documento aceitos no upload
const V8_DOC_TYPES = new Set([
  'identification_front',
  'identification_back',
  'address_proof',
  'paycheck',
  'selfie',
  'other',
]);

// Defaults — usados quando v8_settings ainda não foi carregado ou falhar a leitura.
// Editáveis via UI em Configurações → "Retentativas internas por etapa V8" (1-30).
const DEFAULT_MAX_RETRIES_CONSULT = 3;
const DEFAULT_MAX_RETRIES_AUTHORIZE = 15;
const DEFAULT_MAX_RETRIES_SIMULATE = 15;

// Cache em memória dos limites lidos do banco — recarrega a cada 60s para
// não martelar o DB em lotes pesados, mas refletir mudanças da UI rapidamente.
let retryLimitsCache: {
  consult: number;
  authorize: number;
  simulate: number;
  expiresAt: number;
} | null = null;

async function getRetryLimits(supabaseAdmin: any): Promise<{
  consult: number;
  authorize: number;
  simulate: number;
}> {
  const now = Date.now();
  if (retryLimitsCache && retryLimitsCache.expiresAt > now) {
    return {
      consult: retryLimitsCache.consult,
      authorize: retryLimitsCache.authorize,
      simulate: retryLimitsCache.simulate,
    };
  }
  try {
    const { data } = await supabaseAdmin
      .from("v8_settings")
      .select("max_retries_consult, max_retries_authorize, max_retries_simulate")
      .eq("singleton", true)
      .maybeSingle();
    const consult = Number(data?.max_retries_consult) || DEFAULT_MAX_RETRIES_CONSULT;
    const authorize = Number(data?.max_retries_authorize) || DEFAULT_MAX_RETRIES_AUTHORIZE;
    const simulate = Number(data?.max_retries_simulate) || DEFAULT_MAX_RETRIES_SIMULATE;
    retryLimitsCache = { consult, authorize, simulate, expiresAt: now + 60_000 };
    return { consult, authorize, simulate };
  } catch (err) {
    console.error("[getRetryLimits] fallback to defaults:", err);
    return {
      consult: DEFAULT_MAX_RETRIES_CONSULT,
      authorize: DEFAULT_MAX_RETRIES_AUTHORIZE,
      simulate: DEFAULT_MAX_RETRIES_SIMULATE,
    };
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

// Limites runtime — preenchidos por refreshRetryLimits() no início de cada
// request relevante. Valores aqui são apenas seed; o cache+banco mandam.
let MAX_RETRIES_CONSULT = DEFAULT_MAX_RETRIES_CONSULT;
let MAX_RETRIES_AUTHORIZE = DEFAULT_MAX_RETRIES_AUTHORIZE;
let MAX_RETRIES_SIMULATE = DEFAULT_MAX_RETRIES_SIMULATE;

async function refreshRetryLimits(supabaseAdmin: any) {
  const limits = await getRetryLimits(supabaseAdmin);
  MAX_RETRIES_CONSULT = limits.consult;
  MAX_RETRIES_AUTHORIZE = limits.authorize;
  MAX_RETRIES_SIMULATE = limits.simulate;
}


async function getV8Token(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) return cachedToken.token;

  const clientId = Deno.env.get("V8_CLIENT_ID");
  const username = Deno.env.get("V8_USERNAME");
  const password = Deno.env.get("V8_PASSWORD");
  const audience = Deno.env.get("V8_AUDIENCE");
  if (!clientId || !username || !password || !audience) {
    throw new Error("V8 credentials missing");
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    username,
    password,
    audience,
    scope: "offline_access",
  });

  const resp = await fetch(`${V8_AUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`V8 auth failed: ${resp.status} - ${err}`);
  }
  const json = await resp.json();
  const token = json.access_token as string;
  const expiresIn = (json.expires_in as number) || 86400;
  cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

async function v8Fetch(path: string, init: RequestInit = {}) {
  const token = await getV8Token();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  const hasBody = init.body != null;
  if (hasBody) {
    headers.set("Content-Type", "application/json");
  } else {
    headers.delete("Content-Type");
  }
  return fetch(`${V8_BASE}${path}`, { ...init, headers });
}

/**
 * Faz fetch com retry exponencial para erros 5xx (instabilidade upstream V8/QI).
 * Tenta até `maxAttempts` vezes (padrão 3) com backoff 500ms / 1500ms.
 * Erros 4xx NÃO são retentados (são problemas de payload do cliente).
 */
async function v8FetchWithRetry(
  path: string,
  init: RequestInit = {},
  maxAttempts = 3,
  step = "unknown"
): Promise<Response> {
  let lastResp: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await v8Fetch(path, init);
    // 429 (rate limit) e 5xx são retentáveis; demais 4xx não.
    if (resp.status < 500 && resp.status !== 429) return resp;
    lastResp = resp;
    console.error(`[v8FetchWithRetry] step=${step} attempt=${attempt}/${maxAttempts} failed status=${resp.status} path=${path}`);
    if (attempt < maxAttempts) {
      // Backoff maior em 429 (V8 precisa de respiro)
      const isRateLimit = resp.status === 429;
      const delay = isRateLimit
        ? (attempt === 1 ? 2000 : attempt === 2 ? 5000 : 10000)
        : (attempt === 1 ? 500 : 1500);
      console.log(`[v8FetchWithRetry] step=${step} status=${resp.status} retry=${attempt}/${maxAttempts - 1} em ${delay}ms path=${path}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return lastResp as Response;
}

async function readUpstreamErrorBody(resp: Response) {
  const rawText = await resp.text().catch(() => "");
  try {
    const parsed = rawText ? JSON.parse(rawText) : null;
    const title = parsed?.title ?? null;
    const detail = parsed?.detail ?? null;
    const message = parsed?.message ?? null;
    const error = parsed?.error ?? null;
    return {
      rawText,
      parsed,
      title,
      detail,
      message,
      error,
      status: resp.status,
      userMessage: formatV8UserMessage({ title, detail, message, error, status: resp.status, rawText }),
    };
  } catch {
    return {
      rawText,
      parsed: null,
      title: null,
      detail: null,
      message: null,
      error: null,
      status: resp.status,
      userMessage: formatV8UserMessage({ rawText, status: resp.status }),
    };
  }
}

type V8HumanErrorInput = {
  title?: string | null;
  detail?: string | null;
  message?: string | null;
  error?: string | null;
  status?: number | null;
  rawText?: string | null;
};

export function formatV8UserMessage(input: V8HumanErrorInput) {
  const title = String(input.title || '').trim();
  const detail = String(input.detail || '').trim();
  const message = String(input.message || '').trim();
  const error = String(input.error || '').trim();
  const rawText = String(input.rawText || '').trim();
  const status = Number(input.status);

  const primary = title || detail || message || error || rawText || (Number.isFinite(status) ? `Status HTTP ${status}` : 'Erro inesperado na V8');
  const secondaryCandidates = [detail, message, error, rawText].filter((item) => item && item !== primary);
  const secondary = secondaryCandidates[0] || '';

  if (secondary) return `${primary}\n${secondary}`;
  return primary;
}

function detectV8ErrorKind(input: Record<string, any> = {}) {
  const haystack = [
    input.title,
    input.detail,
    input.message,
    input.error,
    input.rawText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('já existe uma consulta ativa') || haystack.includes('ja existe uma consulta ativa')) {
    return 'active_consult';
  }
  if (haystack.includes('ainda em análise') || haystack.includes('ainda em analise')) {
    return 'analysis_pending';
  }
  if (haystack.includes('operation') && haystack.includes('already') || haystack.includes('proposta já existente') || haystack.includes('proposta ja existente')) {
    return 'existing_proposal';
  }
  // Rate limit V8 — texto observado em produção e HTTP 429 são tratáveis.
  if (
    Number(input.status) === 429 ||
    haystack.includes('limite de requisições excedido') ||
    haystack.includes('limite de requisicoes excedido') ||
    haystack.includes('rate limit')
  ) {
    return 'temporary_v8';
  }
  if (Number(input.status) >= 500) {
    return 'temporary_v8';
  }
  if (Number(input.status) >= 400) {
    return 'invalid_data';
  }
  return 'unknown';
}

// Frente C: rótulo amigável da action que disparou o erro — usado no toast/dialog
// para o operador saber EXATAMENTE o que pausar quando a V8 limita.
function formatStepLabel(step?: string | null): string | null {
  if (!step) return null;
  const map: Record<string, string> = {
    simulate_one: 'simulação de CPF',
    simulate_consult_only: 'consulta de CPF',
    simulate_only_for_consult: 'simulação de proposta',
    create_batch: 'criação de lote',
    list_operations: 'busca de propostas',
    list_consults: 'busca de consultas',
    check_consult_status: 'verificação de status na V8',
    get_operation: 'detalhes da proposta',
    get_consult: 'detalhes da consulta',
  };
  return map[step] ?? null;
}

function formatV8Guidance(kind: string, step?: string | null) {
  const stepLabel = formatStepLabel(step);
  switch (kind) {
    case 'active_consult':
      return 'Já existe consulta ativa para este CPF na V8.\nConsulte as operações existentes ou aguarde a análise em andamento.';
    case 'analysis_pending':
      return 'A consulta ainda está em análise na V8.\nAguarde um pouco e tente novamente em instantes.';
    case 'existing_proposal':
      return 'Já existe proposta para este cliente na V8.\nConsulte as operações existentes antes de tentar uma nova simulação.';
    case 'temporary_v8':
      // Frente C: contextualiza qual operação estourou o limite (ex: "ao buscar propostas").
      return stepLabel
        ? `A V8 limitou as requisições durante ${stepLabel}.\nAguarde 1–2 minutos antes de repetir essa ação. Outras operações podem continuar normalmente.`
        : 'A V8 está com instabilidade ou rate limit.\nAguarde 1–2 minutos e use "Retentar" para tentar novamente.';
    case 'invalid_data':
      return 'A V8 recusou os dados enviados.\nRevise CPF, data de nascimento, tabela e valor informado.';
    default:
      return '';
  }
}

function buildV8ErrorResult(step: string, source: Record<string, any> = {}) {
  const kind = source.kind ?? detectV8ErrorKind(source);
  const baseMessage = source.userMessage ?? formatV8UserMessage(source);
  const guidance = formatV8Guidance(kind, step);
  return {
    success: false,
    step,
    kind,
    title: source.title ?? null,
    detail: source.detail ?? null,
    message: source.message ?? null,
    error: source.error ?? source.userMessage ?? 'Erro inesperado na V8',
    status: source.status ?? null,
    guidance,
    user_message: guidance ? `${baseMessage}\n${guidance}` : baseMessage,
    raw: source.raw ?? source.parsed ?? null,
  };
}

type V8OperationListParams = {
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
  provider?: string;
  documentNumber?: string;
  search?: string;
};

export function buildOperationListQuery(params: V8OperationListParams = {}) {
  const query = new URLSearchParams();
  const provider = (params.provider || "QI").trim() || "QI";
  query.set("provider", provider);

  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.search) query.set("search", String(params.search).trim());
  if (Number.isFinite(params.limit) && Number(params.limit) > 0) {
    query.set("limit", String(Math.trunc(Number(params.limit))));
  }
  if (Number.isFinite(params.page) && Number(params.page) > 0) {
    query.set("page", String(Math.trunc(Number(params.page))));
  }

  return query.toString();
}

async function actionListOperations(params: V8OperationListParams = {}) {
  const query = buildOperationListQuery(params);
  const resp = await v8Fetch(`${V8_PATHS.operations}?${query}`, { method: "GET" });

  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult('list_operations', {
      ...err,
      raw: err.parsed ?? err.rawText,
    });
  }

  const json = await resp.json().catch(() => ([]));
  const operations = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.operations)
          ? json.operations
          : [];

  const cpfFilter = (params.documentNumber || "").replace(/\D/g, "");
  const filteredOperations = cpfFilter
    ? operations.filter((item: any) => String(item?.documentNumber ?? item?.document_number ?? "").replace(/\D/g, "") === cpfFilter)
    : operations;

  // Helper: extrai os 4 campos do payload (topo OU operation_data aninhado).
  const pickAmounts = (op: any) => {
    const od = op?.operation_data || op?.operationData || {};
    return {
      issueAmount: op?.issueAmount ?? op?.issue_amount ?? od?.issue_amount ?? od?.issueAmount ?? null,
      disbursedIssueAmount:
        op?.disbursedIssueAmount ?? op?.disbursed_issue_amount ?? od?.disbursed_issue_amount ?? od?.disbursedIssueAmount ?? null,
      installmentFaceValue:
        op?.installmentFaceValue ?? op?.installment_face_value ?? od?.installment_face_value ?? od?.installmentFaceValue ?? null,
      numberOfInstallments:
        op?.numberOfInstallments ?? op?.number_of_installments ?? od?.number_of_installments ?? od?.numberOfInstallments ?? null,
    };
  };

  // Pré-normaliza o que já veio na listagem.
  const preNormalized = filteredOperations.map((op: any) => ({ ...op, ...pickAmounts(op) }));

  // ENRICHMENT: o endpoint /operation (listagem) da V8 NÃO retorna issueAmount,
  // installmentFaceValue nem numberOfInstallments — só o /operation/{id} (detail).
  // Para que a tabela mostre Valor bruto / Parcela / Nº parcelas, buscamos o detail
  // dos itens que ficaram com pelo menos um campo faltando, em paralelo (concorrência 8).
  // Limite de segurança: até 200 detalhes por chamada para não estourar tempo do edge.
  // ATENÇÃO: a V8 expõe o id da operação como `operationId` (camelCase) no JSON da
  // listagem — NÃO como `id`. Não regredir esse fallback ou o enrichment para de rodar
  // e a tabela volta a mostrar "R$ 0,00" / "—".
  const getOpId = (op: any): string | null => {
    const v = op?.operationId ?? op?.id ?? op?.operation_id ?? null;
    return v ? String(v) : null;
  };
  const needsEnrichment = preNormalized.filter(
    (op) => getOpId(op) && (op.issueAmount == null || op.installmentFaceValue == null || op.numberOfInstallments == null)
  );
  const ENRICH_CAP = 200;
  const CONCURRENCY = 8;
  const toEnrich = needsEnrichment.slice(0, ENRICH_CAP);
  const enrichedById = new Map<string, any>();

  if (toEnrich.length > 0) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, toEnrich.length) }, async () => {
      while (cursor < toEnrich.length) {
        const idx = cursor++;
        const item = toEnrich[idx];
        const opId = getOpId(item);
        if (!opId) continue;
        try {
          const r = await v8Fetch(V8_PATHS.operationDetail(opId), { method: "GET" });
          if (r.ok) {
            const j = await r.json().catch(() => ({}));
            const detail = j?.data ?? j ?? {};
            enrichedById.set(opId, detail);
          }
        } catch (_) { /* silencioso — listagem não pode quebrar por enrichment */ }
      }
    });
    await Promise.all(workers);
  }
  console.log(
    `[list_operations] enrichment: ${preNormalized.length} linhas, ${toEnrich.length} candidatas, ${enrichedById.size} detalhes obtidos`,
  );

  const normalized = preNormalized.map((op: any) => {
    const opId = getOpId(op);
    const detail = opId ? enrichedById.get(opId) : null;
    if (!detail) return op;
    const merged = { ...op, operation_data: op?.operation_data ?? detail?.operation_data ?? null };
    const amounts = pickAmounts({ ...detail, ...op, operation_data: detail?.operation_data ?? op?.operation_data });
    return { ...merged, ...Object.fromEntries(Object.entries(amounts).filter(([_, v]) => v != null)) };
  });

  return {
    success: true,
    data: normalized,
    total: normalized.length,
    enriched: toEnrich.length,
  };
}

async function actionListConsults(params: V8OperationListParams = {}) {
  const query = buildOperationListQuery({
    ...params,
    search: params.search ?? params.documentNumber,
  });
  const resp = await v8Fetch(`${V8_PATHS.consult}?${query}`, { method: "GET" });

  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult('list_consults', {
      ...err,
      raw: err.parsed ?? err.rawText,
    });
  }

  const json = await resp.json().catch(() => ([]));
  const consults = Array.isArray(json)
    ? json
    : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.consults)
          ? json.consults
          : [];

  const cpfFilter = String(params.documentNumber || "").replace(/\D/g, "");
  const textFilter = String(params.search || "").trim().toLowerCase();
  const filteredConsults = consults.filter((item: any) => {
    const document = String(
      item?.documentNumber ?? item?.document_number ?? item?.borrowerDocumentNumber ?? ""
    ).replace(/\D/g, "");
    const name = String(
      item?.name ?? item?.borrowerName ?? item?.signerName ?? item?.customer_name ?? ""
    ).toLowerCase();

    const matchesCpf = !cpfFilter || document === cpfFilter || document.includes(cpfFilter);
    const matchesText = !textFilter || name.includes(textFilter) || document.includes(textFilter.replace(/\D/g, ""));
    return matchesCpf && matchesText;
  }).map((item: any) => ({
    consultId: String(item?.id ?? item?.consult_id ?? item?.consultId ?? ""),
    status: item?.status ?? null,
    name: item?.name ?? item?.borrowerName ?? item?.signerName ?? item?.customer_name ?? null,
    documentNumber: item?.documentNumber ?? item?.document_number ?? item?.borrowerDocumentNumber ?? null,
    title: item?.title ?? item?.error_title ?? null,
    detail: item?.detail ?? item?.description ?? item?.message ?? item?.reason ?? null,
    createdAt: item?.created_at ?? item?.createdAt ?? item?.updated_at ?? null,
    raw: item,
  }));

  return {
    success: true,
    data: filteredConsults,
    total: filteredConsults.length,
  };
}

async function actionGetOperation(operationId?: string) {
  const safeOperationId = String(operationId || "").trim();
  if (!safeOperationId) {
    return { success: false, error: "operationId é obrigatório" };
  }

  const resp = await v8Fetch(V8_PATHS.operationDetail(safeOperationId), { method: "GET" });
  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult('get_operation', {
      ...err,
      raw: err.parsed ?? err.rawText,
    });
  }

  const json = await resp.json().catch(() => ({}));
  return { success: true, data: json?.data ?? json };
}

/**
 * Cancela uma operação na V8 (POST /private-consignment/operation/{id}/cancel).
 * Doc oficial V8: cancela proposta enquanto ainda elegível para cancelamento.
 * Após sucesso, atualiza v8_operations_local.status='canceled' para refletir na UI.
 */
async function actionCancelOperation(supabase: any, operationId?: string, reason?: string) {
  const safeOperationId = String(operationId || "").trim();
  if (!safeOperationId) {
    return { success: false, error: "operationId é obrigatório" };
  }

  const body = reason ? JSON.stringify({ reason: String(reason).slice(0, 500) }) : undefined;
  const resp = await v8Fetch(V8_PATHS.operationCancel(safeOperationId), {
    method: "POST",
    body,
  });

  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult('cancel_operation', {
      ...err,
      raw: err.parsed ?? err.rawText,
    });
  }

  const json = await resp.json().catch(() => ({}));

  // Reflete localmente — não bloqueia em caso de falha de update.
  try {
    await supabase
      .from("v8_operations_local")
      .update({
        status: "canceled",
        last_updated_at: new Date().toISOString(),
        raw_response: json?.data ?? json ?? null,
      })
      .eq("operation_id", safeOperationId);
  } catch (_e) { /* best-effort */ }

  return { success: true, data: json?.data ?? json ?? { canceled: true } };
}

/**
 * Resolve pendência de PIX em uma operação CLT na V8.
 * PATCH /private-consignment/operation/{idOperation}/pendency/payment-data
 * Doc oficial V8: reapresenta dados bancários (chave PIX) quando a proposta
 * está em pending_pix por inconsistência da chave inicial.
 *
 * Tipos de chave aceitos: cpf | email | phone | random.
 * (Esta etapa expõe cpf, email e phone — random fica para etapa futura.)
 */
async function actionResolvePixPendency(
  supabase: any,
  operationId?: string,
  pixKey?: string,
  pixKeyType?: string,
) {
  const safeOperationId = String(operationId || "").trim();
  if (!safeOperationId) {
    return { success: false, error: "operationId é obrigatório" };
  }

  const allowedTypes = new Set(["cpf", "email", "phone", "random"]);
  const safeType = String(pixKeyType || "").trim().toLowerCase();
  if (!allowedTypes.has(safeType)) {
    return {
      success: false,
      error: `pix_key_type inválido. Use: ${Array.from(allowedTypes).join(", ")}`,
    };
  }

  let safeKey = String(pixKey || "").trim();
  if (!safeKey) {
    return { success: false, error: "pix_key é obrigatório" };
  }

  // Normalizações leves por tipo (V8 valida do lado deles, mas evitamos round-trip).
  if (safeType === "cpf") {
    safeKey = safeKey.replace(/\D/g, "");
    if (safeKey.length !== 11) {
      return { success: false, error: "CPF deve ter 11 dígitos" };
    }
  } else if (safeType === "phone") {
    // V8 exige formato internacional. Aceita já com + ou só dígitos.
    const digits = safeKey.replace(/\D/g, "");
    if (digits.length < 12 || digits.length > 13) {
      return { success: false, error: "Telefone deve incluir +55 + DDD + número (ex.: +5511999998888)" };
    }
    safeKey = `+${digits}`;
  } else if (safeType === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeKey)) {
      return { success: false, error: "E-mail inválido" };
    }
    safeKey = safeKey.toLowerCase();
  }

  const body = JSON.stringify({
    bank: {
      transfer_method: "pix",
      pix_key: safeKey,
      pix_key_type: safeType,
    },
  });

  const resp = await v8Fetch(V8_PATHS.operationPendencyPaymentData(safeOperationId), {
    method: "PATCH",
    body,
  });

  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult('resolve_pix_pendency', {
      ...err,
      raw: err.parsed ?? err.rawText,
    });
  }

  const json = await resp.json().catch(() => ({}));

  // Reflete localmente — best-effort. V8 normalmente reprocessa e muda status via webhook.
  try {
    await supabase
      .from("v8_operations_local")
      .update({
        last_updated_at: new Date().toISOString(),
        raw_response: json?.data ?? json ?? null,
      })
      .eq("operation_id", safeOperationId);
  } catch (_e) { /* best-effort */ }

  return { success: true, data: json?.data ?? json ?? { resolved: true } };
}

/**
 * Faz upload de UM documento da operação na V8.
 * POST /private-consignment/operation/{idOperation}/document  (multipart/form-data)
 *
 * Recebe o arquivo em base64 (vindo do front) e reenvia para a V8 como multipart.
 * Também arquiva uma cópia no bucket privado `v8-operation-documents` para auditoria.
 */
async function actionUploadDocument(
  supabase: any,
  operationId?: string,
  fileBase64?: string,
  fileName?: string,
  mimeType?: string,
  documentType?: string,
  userId?: string | null,
) {
  const safeOperationId = String(operationId || "").trim();
  if (!safeOperationId) return { success: false, error: "operationId é obrigatório" };

  const safeType = String(documentType || "").trim();
  if (!V8_DOC_TYPES.has(safeType)) {
    return { success: false, error: `documentType inválido. Aceitos: ${Array.from(V8_DOC_TYPES).join(", ")}` };
  }

  const safeName = String(fileName || "documento").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const safeMime = String(mimeType || "application/octet-stream");
  if (!fileBase64 || typeof fileBase64 !== "string") {
    return { success: false, error: "Arquivo (base64) é obrigatório" };
  }

  // Decodifica base64 -> bytes
  let bytes: Uint8Array;
  try {
    const cleaned = fileBase64.replace(/^data:[^;]+;base64,/, "");
    const bin = atob(cleaned);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (_e) {
    return { success: false, error: "Falha ao decodificar arquivo (base64 inválido)" };
  }

  // Limite de 10MB para evitar timeout/memória.
  if (bytes.length > 10 * 1024 * 1024) {
    return { success: false, error: "Arquivo excede 10MB" };
  }

  // 1) Envia multipart para V8
  const form = new FormData();
  form.append("type", safeType);
  form.append("file", new Blob([bytes], { type: safeMime }), safeName);

  const token = await getV8Token();
  const resp = await fetch(`${V8_BASE}${V8_PATHS.operationDocument(safeOperationId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult('upload_document', { ...err, raw: err.parsed ?? err.rawText });
  }

  const json = await resp.json().catch(() => ({}));

  // 2) Arquiva cópia no bucket privado (best-effort, não bloqueia)
  try {
    const ts = Date.now();
    const ownerFolder = userId || "system";
    const path = `${safeOperationId}/${ownerFolder}/${ts}_${safeType}_${safeName}`;
    await supabase.storage
      .from("v8-operation-documents")
      .upload(path, bytes, { contentType: safeMime, upsert: false });
  } catch (_e) { /* best-effort */ }

  return { success: true, data: json?.data ?? json ?? { uploaded: true } };
}

/**
 * Cria uma nova proposta (operation) na V8.
 * POST /private-consignment/operation
 *
 * Recebe payload já validado pelo frontend + Zod-like server side aqui.
 * Após sucesso, persiste em v8_operations_local com raw_payload completo
 * para que o trigger v8_extract_operation_fields preencha as colunas dedicadas (Etapa 4).
 *
 * @param consultId  ID da consulta autorizada (consult_id que retornou margem positiva)
 * @param simulationId  ID local em v8_simulations (opcional — para vincular)
 * @param payload  Objeto completo da proposta no formato V8 (borrower, address, bank, etc.)
 * @param requireDocs  Se true, exige documents[] com pelo menos 1 item antes de enviar
 */
async function actionCreateOperation(
  supabase: any,
  params: any,
  userId?: string | null,
) {
  const consultId = String(params?.consult_id || "").trim();
  const simulationId = params?.simulation_id ? String(params.simulation_id) : null;
  const draftId = params?.draft_id ? String(params.draft_id) : null;
  const payload = params?.payload;

  if (!consultId) return { success: false, error: "consult_id é obrigatório" };
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "payload da proposta é obrigatório" };
  }

  // Validações server-side mínimas (espelha schema Zod do frontend)
  const borrower = payload?.borrower || {};
  const address = payload?.address || {};
  const bank = payload?.bank || {};
  const errors: string[] = [];

  const cpfDigits = String(borrower?.cpf || "").replace(/\D/g, "");
  if (cpfDigits.length !== 11) errors.push("CPF do mutuário inválido");
  if (!String(borrower?.name || "").trim()) errors.push("Nome do mutuário é obrigatório");
  if (!String(borrower?.birth_date || "").trim()) errors.push("Data de nascimento é obrigatória");
  if (!String(borrower?.mother_name || "").trim()) errors.push("Nome da mãe é obrigatório");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(borrower?.email || ""))) errors.push("E-mail inválido");
  const phoneDigits = String(borrower?.phone || "").replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 13) errors.push("Telefone inválido");

  if (!String(address?.zip_code || "").replace(/\D/g, "")) errors.push("CEP é obrigatório");
  if (!String(address?.street || "").trim()) errors.push("Endereço (logradouro) é obrigatório");
  if (!String(address?.number || "").trim()) errors.push("Número é obrigatório");
  if (!String(address?.city || "").trim()) errors.push("Cidade é obrigatória");
  if (!String(address?.state || "").trim()) errors.push("UF é obrigatório");

  if (!String(bank?.transfer_method || "").trim()) errors.push("Forma de pagamento é obrigatória");
  if (bank?.transfer_method === "pix" && !String(bank?.pix_key || "").trim()) {
    errors.push("Chave PIX é obrigatória");
  }

  if (errors.length) {
    return { success: false, error: errors.join(" • "), validation_errors: errors };
  }

  // Verifica toggle "exigir documentos no envio"
  let requireDocs = false;
  try {
    const { data: settings } = await supabase
      .from("v8_settings")
      .select("require_documents_on_create")
      .eq("singleton", true)
      .maybeSingle();
    requireDocs = !!settings?.require_documents_on_create;
  } catch (_e) { /* ignore — default false */ }

  const documents = Array.isArray(params?.documents) ? params.documents : [];
  if (requireDocs && documents.length === 0) {
    return {
      success: false,
      error: "Documentos obrigatórios pelas configurações. Anexe ao menos 1 documento antes de enviar.",
    };
  }

  // Monta payload final V8 — injeta consult_id
  const v8Body = {
    consult_id: consultId,
    ...payload,
  };

  // Envia POST /operation
  const resp = await v8FetchWithRetry(
    V8_PATHS.operations,
    { method: "POST", body: JSON.stringify(v8Body) },
    3,
    "create_operation",
  );

  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    // Marca rascunho com erro para o usuário poder reabrir
    if (draftId) {
      try {
        await supabase
          .from("v8_operation_drafts")
          .update({ last_error: err.userMessage || err.rawText || `HTTP ${resp.status}` })
          .eq("id", draftId);
      } catch (_e) { /* best-effort */ }
    }
    return buildV8ErrorResult("create_operation", { ...err, raw: err.parsed ?? err.rawText });
  }

  const json = await resp.json().catch(() => ({}));
  const operationData = json?.data ?? json ?? {};
  const operationId = operationData?.id || operationData?.operation_id || operationData?.idOperation || null;

  // Persiste localmente com raw_payload — o trigger v8_extract_operation_fields preenche colunas
  if (operationId) {
    try {
      await supabase.from("v8_operations_local").upsert({
        operation_id: String(operationId),
        consult_id: consultId,
        simulation_id: simulationId,
        cpf: cpfDigits,
        status: operationData?.status || "pending",
        raw_payload: operationData,
        raw_response: operationData,
        last_updated_at: new Date().toISOString(),
        created_by: userId,
      }, { onConflict: "operation_id" });
    } catch (e) {
      console.error("[create_operation] failed to persist local:", (e as Error).message);
    }

    // Faz upload dos documentos sequencialmente (best-effort — não derruba o sucesso)
    for (const doc of documents) {
      try {
        await actionUploadDocument(
          supabase,
          String(operationId),
          doc?.file_base64,
          doc?.file_name,
          doc?.mime_type,
          doc?.document_type,
          userId,
        );
      } catch (e) {
        console.error("[create_operation] doc upload failed:", (e as Error).message);
      }
    }
  }

  // Marca rascunho como enviado
  if (draftId) {
    try {
      await supabase
        .from("v8_operation_drafts")
        .update({
          is_submitted: true,
          submitted_operation_id: operationId ? String(operationId) : null,
          submitted_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", draftId);
    } catch (_e) { /* best-effort */ }
  }

  return {
    success: true,
    data: {
      operation_id: operationId,
      status: operationData?.status || null,
      raw: operationData,
    },
  };
}

/**
 * Reapresenta a operação para análise após resolver pendências de documentos.
 * PATCH /private-consignment/operation/{idOperation}/pendency/presentation
 */
async function actionResubmitDocuments(supabase: any, operationId?: string) {
  const safeOperationId = String(operationId || "").trim();
  if (!safeOperationId) return { success: false, error: "operationId é obrigatório" };

  const resp = await v8Fetch(V8_PATHS.operationPendencyPresentation(safeOperationId), {
    method: "PATCH",
  });

  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult('resubmit_documents', { ...err, raw: err.parsed ?? err.rawText });
  }

  const json = await resp.json().catch(() => ({}));

  try {
    await supabase
      .from("v8_operations_local")
      .update({
        last_updated_at: new Date().toISOString(),
        raw_response: json?.data ?? json ?? null,
      })
      .eq("operation_id", safeOperationId);
  } catch (_e) { /* best-effort */ }

  return { success: true, data: json?.data ?? json ?? { resubmitted: true } };
}

async function actionGetConfigs(supabase: any) {
  const resp = await v8Fetch(V8_PATHS.configs, { method: "GET" });
  if (!resp.ok) {
    const err = await resp.text();
    return { success: false, error: `V8 get_configs: ${resp.status} - ${err}` };
  }
  const data = await resp.json();
  // V8 retorna { data: [...] } ou array direto. Cada item tem id (UUID), name, financial.{bank,minTerm,maxTerm,minValue,maxValue}
  const configs = Array.isArray(data) ? data : data?.data ?? data?.items ?? data?.configs ?? [];

  // Coleta os config_id que vieram nesta resposta — usados para desativar os ausentes.
  const incomingIds = new Set<string>();

  if (Array.isArray(configs) && configs.length > 0) {
    // Log inspeção: imprime as chaves do primeiro item para auditoria
    console.log("[v8 get_configs] sample keys:", Object.keys(configs[0] || {}));
    console.log("[v8 get_configs] sample item:", JSON.stringify(configs[0]).slice(0, 800));

    for (const c of configs) {
      const config_id = String(c.id ?? c.configId ?? c.uuid ?? c.code ?? "");
      if (!config_id) continue;
      incomingIds.add(config_id);
      // V8 envia detalhes em "financial" OU "financial_conditions" OU plano direto.
      const fin = c.financial ?? c.financialConditions ?? c.financial_conditions ?? c.conditions ?? {};
      const displayName = String(
        c.slug ?? c.name ?? c.label ?? c.description ?? c.product_name ?? "Sem nome"
      );
      const isInsured = c.is_insured === true || c.isInsured === true;
      const bankName =
        fin.bank ??
        fin.bank_name ??
        fin.bankName ??
        c.bank ??
        c.bankName ??
        c.bank_name ??
        c.provider ??
        c.partner ??
        null;
      const minValue =
        fin.minValue ?? fin.min_value ?? fin.minAmount ?? c.minValue ?? c.min_value ?? null;
      const maxValue =
        fin.maxValue ?? fin.max_value ?? fin.maxAmount ?? c.maxValue ?? c.max_value ?? null;
      const minTerm =
        fin.minTerm ??
        fin.min_term ??
        fin.minInstallments ??
        fin.min_installments ??
        c.minTerm ??
        c.minInstallments ??
        c.min_installments ??
        null;
      const maxTerm =
        fin.maxTerm ??
        fin.max_term ??
        fin.maxInstallments ??
        fin.max_installments ??
        c.maxTerm ??
        c.maxInstallments ??
        c.max_installments ??
        null;

      await supabase
        .from("v8_configs_cache")
        .upsert(
          {
            config_id,
            name: displayName,
            bank_name: bankName,
            product_type: c.productType ?? c.product ?? c.product_type ?? "clt",
            min_value: minValue,
            max_value: maxValue,
            min_term: minTerm,
            max_term: maxTerm,
            is_active: c.active !== false && c.is_active !== false,
            raw_data: { ...c, _is_insured: isInsured },
            synced_at: new Date().toISOString(),
          },
          { onConflict: "config_id" }
        );
    }
  }

  // Dedupe automática: marca como inativas TODAS as configs do cache cujo
  // config_id NÃO veio na resposta atual da V8. Assim, quando a V8 publicar
  // novos UUIDs para a mesma "CLT Acelera", as antigas somem do dropdown
  // (o useV8Configs filtra is_active=true).
  if (incomingIds.size > 0) {
    const idsArr = Array.from(incomingIds);
    await supabase
      .from("v8_configs_cache")
      .update({ is_active: false, synced_at: new Date().toISOString() })
      .not("config_id", "in", `(${idsArr.map((s) => `"${s}"`).join(",")})`);
  }

  return { success: true, data: configs };
}

export interface SimulateInput {
  cpf: string;
  nome?: string;
  data_nascimento?: string;
  /** "M" | "F" | "male" | "female" — convertido para o enum aceito pela V8 */
  genero?: string;
  email?: string;
  telefone?: string;
  config_id: string;
  parcelas: number;
  simulation_mode?: "disbursed_amount" | "installment_face_value";
  simulation_value?: number;
  batch_id?: string;
  simulation_id?: string;
}

function formatIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Converte data dd/mm/aaaa ou yyyy-mm-dd para o formato aceito pela V8 (yyyy-mm-dd). */
export function normalizeBirthDate(input?: string): string | null {
  if (!input) return null;
  const s = input.trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return formatIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return formatIsoDate(Number(br[3]), Number(br[2]), Number(br[1]));
  }

  return null;
}

/** Normaliza gênero para o enum esperado pela V8 ("male" | "female"). */
export function normalizeGender(input?: string): "male" | "female" {
  const g = (input || "").trim().toLowerCase();
  if (g.startsWith("f") || g === "feminino" || g === "female") return "female";
  return "male";
}

/** Sanitiza telefone para apenas dígitos; retorna {areaCode, phoneNumber} com fallback 11/999999999. */
export function normalizePhone(input?: string): { areaCode: string; phoneNumber: string } {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length >= 10) {
    return { areaCode: digits.slice(0, 2), phoneNumber: digits.slice(2) };
  }
  return { areaCode: "11", phoneNumber: "999999999" };
}

/** Monta o payload de /consult conforme spec V8 (Crédito do Trabalhador). Função pura — testável. */
export function buildConsultBody(input: SimulateInput) {
  const cpf = (input.cpf || "").replace(/\D/g, "");
  const birthDate = normalizeBirthDate(input.data_nascimento);
  const phone = normalizePhone(input.telefone);
  return {
    borrowerDocumentNumber: cpf,
    gender: normalizeGender(input.genero),
    birthDate,
    signerName: (input.nome || "").trim(),
    signerEmail: input.email?.trim() || `${cpf}@lordcred.temp`,
    signerPhone: {
      countryCode: "55",
      areaCode: phone.areaCode,
      phoneNumber: phone.phoneNumber,
    },
    provider: "QI",
  };
}

/** Monta o payload oficial de /simulation conforme documentação V8. */
export function buildSimulationBody(input: Pick<SimulateInput, "config_id" | "parcelas">, consultId: string) {
  return {
    consult_id: consultId,
    config_id: input.config_id,
    number_of_installments: input.parcelas,
    provider: "QI",
  };
}

function buildSimulationBodyWithValue(
  input: Pick<SimulateInput, "config_id" | "parcelas" | "simulation_mode" | "simulation_value">,
  consultId: string,
) {
  const base = buildSimulationBody(input, consultId) as Record<string, unknown>;
  const valueNum = Number(input.simulation_value);
  // Se valor não foi informado (ou é zero/inválido), envia payload mínimo —
  // a V8 devolve cenários default. Isso permite "consulta exploratória".
  if (!Number.isFinite(valueNum) || valueNum <= 0) {
    return base;
  }
  if (input.simulation_mode === "installment_face_value") {
    base.installment_face_value = valueNum;
  } else if (input.simulation_mode === "disbursed_amount") {
    base.disbursed_amount = valueNum;
  }
  return base;
}

async function waitForConsultReady(supabase: any, consultId: string, cpf: string) {
  const endDate = new Date();
  const startDate = new Date(Date.now() - 60 * 60 * 1000);
  const searchValue = cpf.replace(/\D/g, "");
  let lastPayload: any = null;

  for (let attempt = 1; attempt <= 6; attempt++) {
    const query = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: "50",
      page: "1",
      provider: "QI",
      search: searchValue,
    });

    const statusResp = await v8Fetch(`${V8_PATHS.consult}?${query.toString()}`, { method: "GET" });
    const statusJson = await statusResp.json().catch(() => ({}));
    lastPayload = statusJson;

    if (!statusResp.ok) {
      return buildV8ErrorResult('consult_status', {
        title: statusJson?.title ?? null,
        detail: statusJson?.detail ?? null,
        message: statusJson?.message ?? null,
        error: statusJson?.error ?? null,
        status: statusResp.status,
        raw: statusJson,
      });
    }

    const records = Array.isArray(statusJson?.data) ? statusJson.data : Array.isArray(statusJson) ? statusJson : [];
    const consultRow = records.find((row: any) => {
      const rowId = String(row?.id ?? row?.consult_id ?? row?.consultId ?? "");
      const rowDocument = String(row?.documentNumber ?? row?.borrowerDocumentNumber ?? "").replace(/\D/g, "");
      return rowId === consultId || rowDocument === searchValue;
    });

    if (!consultRow) {
      console.error(`[v8ConsultStatus] attempt=${attempt}/6 consult_id=${consultId} not found in listing`);
    } else {
      const consultStatus = String(consultRow?.status ?? "").toUpperCase();
      if (consultStatus === "SUCCESS") {
        return { success: true, data: consultRow };
      }
      if (consultStatus === "FAILED" || consultStatus === "REJECTED") {
        return buildV8ErrorResult('consult_status', {
          title: consultRow?.title ?? null,
          detail: consultRow?.description ?? null,
          message: consultRow?.message ?? null,
          error: consultRow?.error ?? `Consulta retornou ${consultStatus}`,
          raw: consultRow,
        });
      }
      console.log(`[v8ConsultStatus] attempt=${attempt}/6 consult_id=${consultId} status=${consultStatus}`);
    }

    if (attempt < 6) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return buildV8ErrorResult('consult_status', {
    detail: 'Consulta ainda em análise na V8. Aguarde e tente novamente em instantes.',
    status: 202,
    raw: lastPayload,
  });
}

async function actionSimulateOne(supabase: any, input: SimulateInput) {
  const cpf = (input.cpf || "").replace(/\D/g, "");
  if (cpf.length !== 11) return { success: false, kind: "invalid_data", step: "consult", error: "CPF inválido" };

  const birthDate = normalizeBirthDate(input.data_nascimento);
  if (!birthDate) {
    return { success: false, kind: "invalid_data", step: "consult", error: "Data de nascimento inválida (use dd/mm/aaaa)" };
  }
  if (!input.nome || input.nome.trim().length < 3) {
    return { success: false, kind: "invalid_data", step: "consult", error: "Nome do cliente é obrigatório (mínimo 3 caracteres)" };
  }
  if (!input.config_id?.trim()) {
    return { success: false, kind: "invalid_data", step: "simulate", error: "config_id é obrigatório" };
  }
  if (!Number.isInteger(input.parcelas) || input.parcelas <= 0) {
    return { success: false, kind: "invalid_data", step: "simulate", error: "number_of_installments inválido" };
  }
  // simulation_mode + simulation_value são OPCIONAIS pela doc V8.
  // Se um for informado, o outro deve ser também — senão envia payload mínimo.
  const hasMode = ["disbursed_amount", "installment_face_value"].includes(String(input.simulation_mode || ""));
  const hasValue = Number.isFinite(Number(input.simulation_value)) && Number(input.simulation_value) > 0;
  if (hasMode && !hasValue) {
    return { success: false, kind: "invalid_data", step: "simulate", error: "Tipo da simulação informado mas valor está vazio. Preencha o valor ou remova o tipo." };
  }
  if (hasValue && !hasMode) {
    return { success: false, kind: "invalid_data", step: "simulate", error: "Valor informado mas tipo da simulação está vazio." };
  }

  // 1) Consult — builder testável
  const consultBody = buildConsultBody(input);

  const consultResp = await v8FetchWithRetry(V8_PATHS.consult, {
    method: "POST",
    body: JSON.stringify(consultBody),
  }, MAX_RETRIES_CONSULT, "consult");
  const consultJson = await consultResp.json().catch(() => ({}));
  if (!consultResp.ok) {
    return buildV8ErrorResult('consult', {
      title: consultJson?.title ?? null,
      detail: consultJson?.detail ?? null,
      message: consultJson?.message ?? null,
      error: consultJson?.error ?? null,
      status: consultResp.status,
      raw: consultJson,
    });
  }
  const consultData = consultJson?.data ?? consultJson;
  const consultId = String(
    consultData?.id ?? consultData?.consult_id ?? consultData?.consultId ?? ""
  );
  if (!consultId) {
    return {
      success: false,
      step: "consult",
      error: "consult_id não retornado pela V8",
      raw: consultJson,
    };
  }

  // 2) Authorize — passa consult_id na URL
  const authResp = await v8FetchWithRetry(V8_PATHS.authorize(consultId), {
    method: "POST",
  }, MAX_RETRIES_AUTHORIZE, "authorize");
  const authJson = await authResp.json().catch(() => ({}));
  if (!authResp.ok) {
    return buildV8ErrorResult('authorize', {
      title: authJson?.title ?? null,
      detail: authJson?.detail ?? null,
      message: authJson?.message ?? null,
      error: authJson?.error ?? null,
      status: authResp.status,
      raw: { consult: consultJson, authorize: authJson },
    });
  }

  const consultStatusResult = await waitForConsultReady(supabase, consultId, cpf);
  if (!consultStatusResult.success) {
    const failedConsultStatus = consultStatusResult as {
      title?: string | null;
      detail?: string | null;
      message?: string | null;
      error?: string | null;
      status?: number | null;
      raw?: any;
    };
    return buildV8ErrorResult('consult_status', {
      title: failedConsultStatus.title ?? null,
      detail: failedConsultStatus.detail ?? null,
      message: failedConsultStatus.message ?? null,
      error: failedConsultStatus.error ?? null,
      status: failedConsultStatus.status ?? null,
      raw: {
        consult: consultJson,
        authorize: authJson,
        consult_status: failedConsultStatus.raw,
      },
    });
  }
  const consultStatusData = (consultStatusResult as { success: true; data: any }).data;

  // 3) Simulate — payload oficial V8: consult_id + config_id + number_of_installments + provider
  const simulationBody = buildSimulationBodyWithValue(input, consultId);
  const simResp = await v8FetchWithRetry(V8_PATHS.simulate, {
    method: "POST",
    body: JSON.stringify(simulationBody),
  }, MAX_RETRIES_SIMULATE, "simulate");
  if (!simResp.ok) {
    const simError = await readUpstreamErrorBody(simResp);
    return buildV8ErrorResult('simulate', {
      ...simError,
      raw: {
        upstream_request: { consult: consultBody, simulation: simulationBody },
        consult: consultJson,
        authorize: authJson,
        consult_status: consultStatusData,
        simulate: simError.parsed,
        simulate_text: simError.rawText || null,
        simulate_status: simResp.status,
      },
    });
  }
  const simJson = await simResp.json().catch(() => ({}));

  const result = simJson?.data ?? simJson;
  // V8 (Crédito do Trabalhador) — resposta oficial usa disbursement_option.
  // disbursement_options pode vir como array de cenários; pegamos o primeiro válido.
  const dispOpt =
    result?.disbursement_option ??
    (Array.isArray(result?.disbursement_options) ? result.disbursement_options[0] : null) ??
    result?.disbursementOption ??
    null;

  const simulationId = String(
    result?.id_simulation ?? result?.simulation_id ?? result?.simulationId ?? result?.id ?? ""
  );

  const released_value = Number(
    dispOpt?.final_disbursement_amount ??
      dispOpt?.finalDisbursementAmount ??
      result?.disbursement_amount ??
      dispOpt?.net_amount ??
      result?.netAmount ??
      result?.releasedValue ??
      result?.valorLiberado ??
      0
  );
  const installment_value = Number(
    result?.installment_value ??
    dispOpt?.installment_amount ??
      dispOpt?.installmentAmount ??
      result?.installmentAmount ??
      result?.parcelValue ??
      result?.valorParcela ??
      0
  );
  const interest_rate = Number(
    result?.monthly_interest_rate ??
    dispOpt?.monthly_interest_rate ??
      dispOpt?.interest_rate ??
      result?.interestRate ??
      result?.rate ??
      result?.taxa ??
      0
  );
  const total_value = Number(
    result?.operation_amount ??
    dispOpt?.total_amount ??
      dispOpt?.totalAmount ??
      result?.totalAmount ??
      result?.valorTotal ??
      installment_value * input.parcelas
  );

  const { data: marginRow } = await supabase
    .from("v8_margin_config")
    .select("margin_percent")
    .limit(1)
    .maybeSingle();
  const marginPct = Number(marginRow?.margin_percent ?? 5);
  const company_margin = Number(((released_value * marginPct) / 100).toFixed(2));
  const amount_to_charge = Number((released_value - company_margin).toFixed(2));
  // margem_valor = mesmo número de company_margin, mas exposto como coluna dedicada
  // (mantém compat. com a UI atual que usa company_margin e adiciona o campo "oficial").
  const margem_valor = company_margin;

  return {
    success: true,
    data: {
      simulation_id: simulationId || null,
      consult_id: consultId,
      released_value,
      installment_value,
      interest_rate,
      total_value,
      company_margin,
      margem_valor,
      amount_to_charge,
      raw_response: {
        upstream_request: { consult: consultBody, simulation: simulationBody },
        consult: consultJson,
        authorize: authJson,
        consult_status: consultStatusData,
        simulate: simJson,
      },
    },
  };
}

/**
 * NOVA ESTRATÉGIA `webhook_only`: dispara apenas /consult + /authorize na V8,
 * sem polling síncrono e sem chamar /simulation. O sistema fica "aguardando webhook"
 * (evento `private.consignment.consult.updated` com status SUCCESS chega em 10–20s
 * trazendo `availableMarginValue` + `simulationLimit`).
 *
 * Vantagens:
 *  - 1 lote de 200 CPFs = ~400 requests V8 (vs 800–3000 do fluxo síncrono antigo)
 *  - Sem rate-limit em massa, sem "consulta ativa duplicada" induzida
 *  - Webhook traz dados mais ricos (faixa de parcelas/valor) do que /simulation rápido
 */
async function actionSimulateConsultOnly(supabase: any, input: SimulateInput) {
  const earlySimulationId = (input as any)?.simulation_id ? String((input as any).simulation_id) : null;
  const cpf = (input.cpf || "").replace(/\D/g, "");
  if (cpf.length !== 11) {
    return { success: false, kind: "invalid_data", step: "consult", error: "CPF inválido" };
  }
  const birthDate = normalizeBirthDate(input.data_nascimento);
  if (!birthDate) {
    return { success: false, kind: "invalid_data", step: "consult", error: "Data de nascimento inválida (use dd/mm/aaaa)" };
  }
  if (!input.nome || input.nome.trim().length < 3) {
    return { success: false, kind: "invalid_data", step: "consult", error: "Nome é obrigatório (mínimo 3 caracteres)" };
  }

  const consultBody = buildConsultBody(input);
  const consultResp = await v8FetchWithRetry(V8_PATHS.consult, {
    method: "POST",
    body: JSON.stringify(consultBody),
  }, MAX_RETRIES_CONSULT, "consult");
  const consultJson = await consultResp.json().catch(() => ({}));

  if (!consultResp.ok) {
    return buildV8ErrorResult('consult', {
      title: consultJson?.title ?? null,
      detail: consultJson?.detail ?? null,
      message: consultJson?.message ?? null,
      error: consultJson?.error ?? null,
      status: consultResp.status,
      raw: consultJson,
    });
  }

  const consultData = consultJson?.data ?? consultJson;
  const consultId = String(
    consultData?.id ?? consultData?.consult_id ?? consultData?.consultId ?? ""
  );
  if (!consultId) {
    return { success: false, step: "consult", error: "consult_id não retornado pela V8", raw: consultJson };
  }

  // ETAPA 2 — FIX RACE WEBHOOK: grava consult_id ANTES de /authorize.
  // Se a gravação falhar, NÃO prosseguimos (evita órfã sem rastreio).
  if (earlySimulationId) {
    const { error: updErr } = await supabase
      .from("v8_simulations")
      .update({
        consult_id: consultId,
        last_step: "consult_id_saved",
      })
      .eq("id", earlySimulationId);
    if (updErr) {
      console.error(`[simulate_consult_only] FALHA ao salvar consult_id=${consultId} sim=${earlySimulationId}`, updErr);
      return {
        success: false,
        kind: "db_save_failed",
        step: "consult_id_save",
        error: `Falha ao gravar consult_id no banco: ${updErr.message}`,
        consult_id: consultId,
        raw: { consult: consultJson },
      };
    }
  }

  // Authorize — V8 só dispara webhook após termo aceito.
  const authResp = await v8FetchWithRetry(V8_PATHS.authorize(consultId), {
    method: "POST",
  }, MAX_RETRIES_AUTHORIZE, "authorize");
  const authJson = await authResp.json().catch(() => ({}));
  if (!authResp.ok) {
    // ETAPA 2: mantém consult_id gravado e marca como falha retentável.
    if (earlySimulationId) {
      await supabase
        .from("v8_simulations")
        .update({ last_step: "authorize_failed" })
        .eq("id", earlySimulationId);
    }
    return buildV8ErrorResult('authorize', {
      title: authJson?.title ?? null,
      detail: authJson?.detail ?? null,
      message: authJson?.message ?? null,
      error: authJson?.error ?? null,
      status: authResp.status,
      consult_id: consultId,
      raw: { consult: consultJson, authorize: authJson },
    });
  }

  // Sucesso do /authorize — marca aguardando webhook.
  if (earlySimulationId) {
    await supabase
      .from("v8_simulations")
      .update({ last_step: "awaiting_webhook" })
      .eq("id", earlySimulationId);
  }

  // Sucesso parcial — agora a linha fica `pending` aguardando webhook V8.
  return {
    success: true,
    data: {
      consult_id: consultId,
      strategy: 'webhook_only',
      raw_response: {
        upstream_request: { consult: consultBody },
        consult: consultJson,
        authorize: authJson,
        awaiting_webhook: true,
      },
    },
  };
}

/**
 * Roda apenas POST /simulation usando um consult_id existente (já SUCCESS).
 * Usado pelo botão "Simular selecionados" (ou auto-simulate após webhook).
 */
async function actionSimulateOnlyForConsult(supabase: any, params: {
  simulation_id: string;
  consult_id: string;
  config_id: string;
  parcelas: number;
  simulation_mode?: "disbursed_amount" | "installment_face_value";
  simulation_value?: number;
}) {
  if (!params?.consult_id) return { success: false, error: "consult_id é obrigatório" };
  if (!params?.config_id) return { success: false, error: "config_id é obrigatório" };
  if (!Number.isInteger(params?.parcelas) || params.parcelas <= 0) {
    return { success: false, error: "parcelas inválido" };
  }

  // FIX 4: Clamp de parcelas e valor padrão usando os limites retornados pela /consult
  // (sim_installments_min/max, sim_value_min/max). Antes, o handler enviava parcelas fixas
  // do operador — quando 24x não cabia em monthMax=23 (ex: CPF 04706020158), V8 rejeitava.
  let parcelasFinal = params.parcelas;
  let simulationValueFinal = params.simulation_value;
  let clampNote: string | null = null;

  if (params.simulation_id) {
    const { data: simRow } = await supabase
      .from("v8_simulations")
      .select("sim_installments_min, sim_installments_max, sim_value_min, sim_value_max")
      .eq("id", params.simulation_id)
      .maybeSingle();
    if (simRow) {
      const instMin = Number(simRow.sim_installments_min ?? 0);
      const instMax = Number(simRow.sim_installments_max ?? 0);
      const valMin = Number(simRow.sim_value_min ?? 0);
      const valMax = Number(simRow.sim_value_max ?? 0);

      if (instMin > 0 && instMax > 0) {
        const clamped = Math.min(Math.max(parcelasFinal, instMin), instMax);
        if (clamped !== parcelasFinal) {
          clampNote = `parcelas ajustadas de ${parcelasFinal} para ${clamped} (limite V8: ${instMin}-${instMax})`;
          parcelasFinal = clamped;
        }
      }
      // Se operador não informou valor de simulação, usa o meio da faixa permitida.
      if ((simulationValueFinal == null || simulationValueFinal <= 0) && valMin > 0 && valMax > 0) {
        simulationValueFinal = Number(((valMin + valMax) / 2).toFixed(2));
      }
    }
  }

  const effectiveParams = {
    ...params,
    parcelas: parcelasFinal,
    simulation_value: simulationValueFinal,
    simulation_mode: params.simulation_mode ?? (simulationValueFinal != null ? "disbursed_amount" : undefined),
  };

  const simulationBody = buildSimulationBodyWithValue(effectiveParams, params.consult_id);
  const simResp = await v8FetchWithRetry(V8_PATHS.simulate, {
    method: "POST",
    body: JSON.stringify(simulationBody),
  }, MAX_RETRIES_SIMULATE, "simulate");

  if (!simResp.ok) {
    const simError = await readUpstreamErrorBody(simResp);
    return buildV8ErrorResult('simulate', {
      ...simError,
      raw: {
        upstream_request: { simulation: simulationBody },
        simulate: simError.parsed,
        simulate_text: simError.rawText || null,
        simulate_status: simResp.status,
        clamp_note: clampNote,
        effective_parcelas: parcelasFinal,
        effective_value: simulationValueFinal,
      },
    });
  }

  const simJson = await simResp.json().catch(() => ({}));
  const result = simJson?.data ?? simJson;
  const dispOpt =
    result?.disbursement_option ??
    (Array.isArray(result?.disbursement_options) ? result.disbursement_options[0] : null) ??
    result?.disbursementOption ??
    null;

  const released_value = Number(
    dispOpt?.final_disbursement_amount ?? dispOpt?.finalDisbursementAmount ??
    result?.disbursement_amount ?? dispOpt?.net_amount ?? result?.netAmount ?? 0
  );
  const installment_value = Number(
    result?.installment_value ?? dispOpt?.installment_amount ?? dispOpt?.installmentAmount ?? 0
  );
  const interest_rate = Number(
    result?.monthly_interest_rate ?? dispOpt?.monthly_interest_rate ?? dispOpt?.interest_rate ?? 0
  );
  const total_value = Number(
    result?.operation_amount ?? dispOpt?.total_amount ?? dispOpt?.totalAmount ??
    installment_value * params.parcelas
  );

  const { data: marginRow } = await supabase
    .from("v8_margin_config").select("margin_percent").limit(1).maybeSingle();
  const marginPct = Number(marginRow?.margin_percent ?? 5);
  const company_margin = Number(((released_value * marginPct) / 100).toFixed(2));
  const amount_to_charge = Number((released_value - company_margin).toFixed(2));

  return {
    success: true,
    data: {
      simulation_id: String(result?.id_simulation ?? result?.simulation_id ?? ""),
      consult_id: params.consult_id,
      released_value,
      installment_value,
      interest_rate,
      total_value,
      company_margin,
      margem_valor: company_margin,
      amount_to_charge,
      installments: parcelasFinal,
      // Etapa 1 (item 3): expõe se o sistema precisou ajustar parcelas/valor para caber
      // nos limites da V8. Frontend mostra ⚠️ na coluna Parcelas com tooltip explicativo.
      clamp_applied: clampNote != null,
      clamp_note: clampNote,
      raw_response: {
        upstream_request: { simulation: simulationBody },
        simulate: simJson,
        clamp_applied: clampNote != null,
        clamp_note: clampNote,
        effective_parcelas: parcelasFinal,
        effective_value: simulationValueFinal,
      },
    },
  };
}

/**
 * Verifica o status de uma consulta existente na V8 SEM disparar nova simulação.
 * Aceita { cpf } ou { consult_id }. Útil quando a V8 retorna "já existe consulta ativa"
 * e o operador quer só ver onde ela está.
 */
async function actionCheckConsultStatus(params: { cpf?: string; consult_id?: string } = {}) {
  const cpf = String(params.cpf || "").replace(/\D/g, "");
  const consultId = String(params.consult_id || "").trim();
  if (!cpf && !consultId) {
    return { success: false, error: "Informe CPF ou consult_id" };
  }

  // Procura consultas dos últimos 30 dias
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const query = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit: "50",
    page: "1",
    provider: "QI",
  });
  if (cpf) query.set("search", cpf);

  const resp = await v8Fetch(`${V8_PATHS.consult}?${query.toString()}`, { method: "GET" });
  if (!resp.ok) {
    const err = await readUpstreamErrorBody(resp);
    return buildV8ErrorResult("check_consult_status", { ...err, raw: err.parsed ?? err.rawText });
  }

  const json = await resp.json().catch(() => ({}));
  const records = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

  // Filtra: por consult_id se informado, senão por CPF
  const matches = records.filter((row: any) => {
    if (consultId) {
      const rowId = String(row?.id ?? row?.consult_id ?? row?.consultId ?? "");
      return rowId === consultId;
    }
    const rowDoc = String(row?.documentNumber ?? row?.borrowerDocumentNumber ?? "").replace(/\D/g, "");
    return rowDoc === cpf;
  });

  if (matches.length === 0) {
    return {
      success: true,
      data: { found: false, consults: [], message: "Nenhuma consulta encontrada nos últimos 30 dias para este CPF." },
    };
  }

  // Ordena por createdAt desc — a mais recente primeiro
  matches.sort((a: any, b: any) => {
    const ta = new Date(a?.created_at ?? a?.createdAt ?? 0).getTime();
    const tb = new Date(b?.created_at ?? b?.createdAt ?? 0).getTime();
    return tb - ta;
  });

  return {
    success: true,
    data: {
      found: true,
      latest: {
        consultId: String(matches[0]?.id ?? matches[0]?.consult_id ?? matches[0]?.consultId ?? ""),
        status: matches[0]?.status ?? null,
        name: matches[0]?.name ?? matches[0]?.borrowerName ?? matches[0]?.signerName ?? null,
        documentNumber: matches[0]?.documentNumber ?? matches[0]?.borrowerDocumentNumber ?? null,
        title: matches[0]?.title ?? null,
        detail: matches[0]?.detail ?? matches[0]?.description ?? matches[0]?.message ?? null,
        createdAt: matches[0]?.created_at ?? matches[0]?.createdAt ?? null,
        raw: matches[0],
      },
      consults: matches.map((row: any) => ({
        consultId: String(row?.id ?? row?.consult_id ?? row?.consultId ?? ""),
        status: row?.status ?? null,
        createdAt: row?.created_at ?? row?.createdAt ?? null,
        detail: row?.detail ?? row?.description ?? null,
      })),
    },
  };
}

async function actionCreateBatch(
  supabase: any,
  payload: {
    name: string;
    config_id: string;
    config_label?: string;
    parcelas: number;
    rows: Array<{ cpf: string; nome?: string; data_nascimento?: string }>;
  },
  userId: string
) {
  const validRows = (payload.rows || []).filter(
    (r) => (r.cpf || "").replace(/\D/g, "").length === 11
  );
  if (validRows.length === 0) return { success: false, error: "Nenhum CPF válido" };

  const invalidBirthRow = validRows.find(
    (r) => r.data_nascimento && !normalizeBirthDate(r.data_nascimento)
  );
  if (invalidBirthRow) {
    return {
      success: false,
      error: `Data de nascimento inválida para CPF ${(invalidBirthRow.cpf || "").replace(/\D/g, "")}`,
    };
  }

  const { data: batch, error: batchErr } = await supabase
    .from("v8_batches")
    .insert({
      name: payload.name,
      created_by: userId,
      config_id: payload.config_id,
      config_name: payload.config_label ?? null,
      installments: payload.parcelas,
      total_count: validRows.length,
      pending_count: validRows.length,
      status: "processing",
      // Etapa 3 (mai/2026): Auto-best automático já no nascimento do lote.
      // Elimina necessidade de clicar em "Simular selecionados" no Histórico/Nova Simulação.
      auto_best_enabled: true,
    })
    .select()
    .single();
  if (batchErr) return { success: false, error: batchErr.message };

  // Etapa C — Dedupe de CPF dentro de janela configurável.
  // Lê config; se ligado, busca consultas recentes (success/pending) do mesmo CPF
  // e marca essas linhas como "skipped_duplicate" (ainda inseridas no lote para
  // visibilidade), em vez de criar uma nova consulta na V8.
  let dedupeEnabled = true;
  let dedupeWindowDays = 7;
  try {
    const { data: cfg } = await supabase
      .from("v8_settings")
      .select("cpf_dedupe_enabled, cpf_dedupe_window_days")
      .eq("singleton", true)
      .maybeSingle();
    if (cfg) {
      dedupeEnabled = cfg.cpf_dedupe_enabled !== false;
      const w = Number(cfg.cpf_dedupe_window_days);
      if (Number.isFinite(w) && w > 0) dedupeWindowDays = w;
    }
  } catch (_) { /* segue com defaults */ }

  const cpfList = validRows.map((r) => r.cpf.replace(/\D/g, ""));
  const duplicateMap = new Map<string, { id: string; status: string; created_at: string }>();
  if (dedupeEnabled && cpfList.length > 0) {
    const cutoffIso = new Date(Date.now() - dedupeWindowDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("v8_simulations")
      .select("id, cpf, status, created_at")
      .in("cpf", cpfList)
      .in("status", ["success", "pending"])
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false });
    for (const row of recent ?? []) {
      const cpf = String((row as any).cpf || "");
      if (!duplicateMap.has(cpf)) duplicateMap.set(cpf, row as any);
    }
  }

  const sims = validRows.map((r, idx) => {
    const cpfDigits = r.cpf.replace(/\D/g, "");
    const dup = duplicateMap.get(cpfDigits);
    if (dup) {
      return {
        batch_id: batch.id,
        created_by: userId,
        cpf: cpfDigits,
        name: r.nome ?? null,
        birth_date: r.data_nascimento ? normalizeBirthDate(r.data_nascimento) : null,
        status: "skipped",
        error_kind: "duplicate_recent",
        error_message: `CPF já consultado há menos de ${dedupeWindowDays} dia(s) — ver simulação ${dup.id}.`,
        raw_response: { kind: "duplicate_recent", original_id: dup.id, original_status: dup.status, original_created_at: dup.created_at, window_days: dedupeWindowDays },
        config_id: payload.config_id,
        config_name: payload.config_label ?? null,
        installments: payload.parcelas,
        paste_order: idx,
      };
    }
    return {
      batch_id: batch.id,
      created_by: userId,
      cpf: cpfDigits,
      name: r.nome ?? null,
      birth_date: r.data_nascimento ? normalizeBirthDate(r.data_nascimento) : null,
      status: "pending",
      error_kind: "analysis_pending",
      config_id: payload.config_id,
      config_name: payload.config_label ?? null,
      installments: payload.parcelas,
      paste_order: idx,
    };
  });

  const { error: simsErr } = await supabase.from("v8_simulations").insert(sims);
  if (simsErr) return { success: false, error: simsErr.message };

  const skippedCount = duplicateMap.size;
  return {
    success: true,
    data: {
      batch_id: batch.id,
      total: validRows.length,
      skipped_duplicates: skippedCount,
      dedupe_window_days: dedupeWindowDays,
    },
  };
}

/**
 * Etapa 3 (item 7): cria lote agendado para horário futuro.
 * Mesma estrutura do create_batch, mas:
 *  - status = 'scheduled'
 *  - scheduled_for = quando o lote deve começar
 *  - scheduled_strategy / scheduled_payload guardam o que o launcher precisa para disparar
 *
 * Linhas (v8_simulations) NÃO são criadas agora. O launcher cuida disso quando o
 * horário chegar — assim, se o operador editar/cancelar antes da hora, nada vaza.
 */
async function actionScheduleBatch(
  supabase: any,
  payload: {
    name: string;
    config_id: string;
    config_label?: string;
    parcelas: number;
    rows: Array<{ cpf: string; nome?: string; data_nascimento?: string; genero?: string; telefone?: string }>;
    scheduled_for: string; // ISO com -03:00
    strategy?: "webhook_only" | "simulate_now";
    simulation_mode?: "none" | "disbursed_amount" | "installment_face_value";
    simulation_value?: number | null;
  },
  userId: string,
) {
  const validRows = (payload.rows || []).filter(
    (r) => (r.cpf || "").replace(/\D/g, "").length === 11,
  );
  if (validRows.length === 0) return { success: false, error: "Nenhum CPF válido" };

  const when = payload.scheduled_for ? new Date(payload.scheduled_for) : null;
  if (!when || Number.isNaN(when.getTime())) {
    return { success: false, error: "Horário do agendamento inválido" };
  }
  if (when.getTime() < Date.now() - 60_000) {
    return { success: false, error: "Horário do agendamento já passou" };
  }

  const invalidBirthRow = validRows.find(
    (r) => r.data_nascimento && !normalizeBirthDate(r.data_nascimento),
  );
  if (invalidBirthRow) {
    return {
      success: false,
      error: `Data de nascimento inválida para CPF ${(invalidBirthRow.cpf || "").replace(/\D/g, "")}`,
    };
  }

  const cleanRows = validRows.map((r) => ({
    cpf: r.cpf.replace(/\D/g, ""),
    nome: r.nome ?? null,
    data_nascimento: r.data_nascimento ? normalizeBirthDate(r.data_nascimento) : null,
    genero: r.genero ?? null,
    telefone: r.telefone ?? null,
  }));

  const { data: batch, error: batchErr } = await supabase
    .from("v8_batches")
    .insert({
      name: payload.name,
      created_by: userId,
      config_id: payload.config_id,
      config_name: payload.config_label ?? null,
      installments: payload.parcelas,
      total_count: validRows.length,
      pending_count: validRows.length,
      status: "scheduled",
      scheduled_for: when.toISOString(),
      scheduled_strategy: payload.strategy ?? "webhook_only",
      scheduled_payload: {
        rows: cleanRows,
        simulation_mode: payload.simulation_mode ?? "none",
        simulation_value: payload.simulation_value ?? null,
      },
    })
    .select()
    .single();
  if (batchErr) return { success: false, error: batchErr.message };

  return {
    success: true,
    data: {
      batch_id: batch.id,
      total: validRows.length,
      scheduled_for: when.toISOString(),
    },
  };
}

/**
 * Etapa 4 (Item 10): enfileira um lote para execução sequencial.
 * Mesma validação do schedule_batch, mas grava status='queued' + queue_position
 * (próxima posição livre na fila do operador). O launcher promove queued→scheduled
 * com scheduled_for=now() quando o operador não tem nenhum lote em processing/scheduled.
 */
async function actionQueueBatch(
  supabase: any,
  payload: {
    name: string;
    config_id: string;
    config_label?: string;
    parcelas: number;
    rows: Array<{ cpf: string; nome?: string; data_nascimento?: string; genero?: string; telefone?: string }>;
    strategy?: "webhook_only" | "simulate_now";
    simulation_mode?: "none" | "disbursed_amount" | "installment_face_value";
    simulation_value?: number | null;
  },
  userId: string,
) {
  const validRows = (payload.rows || []).filter(
    (r) => (r.cpf || "").replace(/\D/g, "").length === 11,
  );
  if (validRows.length === 0) return { success: false, error: "Nenhum CPF válido" };

  const invalidBirthRow = validRows.find(
    (r) => r.data_nascimento && !normalizeBirthDate(r.data_nascimento),
  );
  if (invalidBirthRow) {
    return {
      success: false,
      error: `Data de nascimento inválida para CPF ${(invalidBirthRow.cpf || "").replace(/\D/g, "")}`,
    };
  }

  const cleanRows = validRows.map((r) => ({
    cpf: r.cpf.replace(/\D/g, ""),
    nome: r.nome ?? null,
    data_nascimento: r.data_nascimento ? normalizeBirthDate(r.data_nascimento) : null,
    genero: r.genero ?? null,
    telefone: r.telefone ?? null,
  }));

  // Próxima posição livre na fila do operador.
  const { data: lastInQueue } = await supabase
    .from("v8_batches")
    .select("queue_position")
    .eq("queue_owner", userId)
    .eq("status", "queued")
    .order("queue_position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = ((lastInQueue?.queue_position as number | null) ?? 0) + 1;
  const nowIso = new Date().toISOString();

  const { data: batch, error: batchErr } = await supabase
    .from("v8_batches")
    .insert({
      name: payload.name,
      created_by: userId,
      config_id: payload.config_id,
      config_name: payload.config_label ?? null,
      installments: payload.parcelas,
      total_count: validRows.length,
      pending_count: validRows.length,
      status: "queued",
      queue_owner: userId,
      queue_position: nextPos,
      queued_at: nowIso,
      // reusa scheduled_payload para que o launcher saiba materializar:
      scheduled_strategy: payload.strategy ?? "webhook_only",
      scheduled_payload: {
        rows: cleanRows,
        simulation_mode: payload.simulation_mode ?? "none",
        simulation_value: payload.simulation_value ?? null,
      },
    })
    .select()
    .single();
  if (batchErr) return { success: false, error: batchErr.message };

  return {
    success: true,
    data: { batch_id: batch.id, queue_position: nextPos, total: validRows.length },
  };
}

/**
 * Etapa 4: cancela um lote ainda na fila (status='queued').
 * Compacta as posições subsequentes (-1) para não deixar buracos.
 */
async function actionCancelQueue(supabase: any, batchId: string, userId: string, isPriv: boolean) {
  const { data: batchRow } = await supabase
    .from("v8_batches")
    .select("id, status, created_by, queue_owner, queue_position")
    .eq("id", batchId)
    .maybeSingle();
  if (!batchRow) return { success: false, error: "Lote não encontrado" };
  if (!isPriv && batchRow.created_by !== userId) return { success: false, error: "Sem permissão" };
  if (batchRow.status !== "queued") {
    return { success: false, error: `Lote não está na fila (status: ${batchRow.status})` };
  }

  const removedPos = batchRow.queue_position as number;
  const owner = batchRow.queue_owner as string;

  const { error: upErr } = await supabase
    .from("v8_batches")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      canceled_by: userId,
      queue_position: null,
    })
    .eq("id", batchId)
    .eq("status", "queued");
  if (upErr) return { success: false, error: upErr.message };

  // Compacta a fila (decrementa posições maiores).
  const { data: toShift } = await supabase
    .from("v8_batches")
    .select("id, queue_position")
    .eq("queue_owner", owner)
    .eq("status", "queued")
    .gt("queue_position", removedPos);
  for (const row of toShift ?? []) {
    await supabase
      .from("v8_batches")
      .update({ queue_position: (row.queue_position as number) - 1 })
      .eq("id", row.id);
  }

  return { success: true, data: { batch_id: batchId } };
}

/**
 * Etapa 4: reordena um lote na fila (move ↑/↓).
 * direction: 'up' troca com posição-1; 'down' troca com posição+1.
 */
async function actionReorderQueue(
  supabase: any, batchId: string, direction: "up" | "down", userId: string, isPriv: boolean,
) {
  const { data: batchRow } = await supabase
    .from("v8_batches")
    .select("id, status, created_by, queue_owner, queue_position")
    .eq("id", batchId)
    .maybeSingle();
  if (!batchRow) return { success: false, error: "Lote não encontrado" };
  if (!isPriv && batchRow.created_by !== userId) return { success: false, error: "Sem permissão" };
  if (batchRow.status !== "queued") return { success: false, error: "Lote não está na fila" };

  const curPos = batchRow.queue_position as number;
  const targetPos = direction === "up" ? curPos - 1 : curPos + 1;
  if (targetPos < 1) return { success: false, error: "Já está no topo" };

  const { data: neighbor } = await supabase
    .from("v8_batches")
    .select("id, queue_position")
    .eq("queue_owner", batchRow.queue_owner)
    .eq("status", "queued")
    .eq("queue_position", targetPos)
    .maybeSingle();
  if (!neighbor) return { success: false, error: "Já está no fim" };

  // swap em duas etapas (posição temporária para evitar conflito de UNIQUE se existir).
  await supabase.from("v8_batches").update({ queue_position: -1 }).eq("id", batchId);
  await supabase.from("v8_batches").update({ queue_position: curPos }).eq("id", neighbor.id);
  await supabase.from("v8_batches").update({ queue_position: targetPos }).eq("id", batchId);

  return { success: true, data: { batch_id: batchId, new_position: targetPos } };
}

async function actionListBatches(supabase: any, userId: string, isPriv: boolean) {
  let q = supabase
    .from("v8_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!isPriv) q = q.eq("created_by", userId);
  const { data, error } = await q;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

/**
 * Registra os 2 webhooks da V8 (consult + operation) apontando para nossa edge v8-webhook.
 * A V8 faz POST de teste antes de aceitar — nosso receptor já responde 200 e identifica
 * `webhook.test`/`webhook.registered` para preencher v8_webhook_registrations.
 */
async function actionRegisterWebhooks(supabase: any) {
  const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
  // URL pública do nosso receptor (sem JWT — V8 não envia Authorization)
  const baseWebhookUrl = `${projectUrl}/functions/v1/v8-webhook`;
  const targets: Array<{ type: "consult" | "operation"; v8Path: string; url: string }> = [
    {
      type: "consult",
      v8Path: "/user/webhook/private-consignment/consult",
      url: `${baseWebhookUrl}?type=consult`,
    },
    {
      type: "operation",
      v8Path: "/user/webhook/private-consignment/operation",
      url: `${baseWebhookUrl}?type=operation`,
    },
  ];

  const results: Array<Record<string, unknown>> = [];

  for (const t of targets) {
    let ok = false;
    let status = 0;
    let errorMsg: string | null = null;
    try {
      const resp = await v8Fetch(t.v8Path, {
        method: "POST",
        body: JSON.stringify({ url: t.url }),
      });
      status = resp.status;
      const txt = await resp.text();
      ok = resp.ok;
      if (!ok) errorMsg = txt.slice(0, 500);
    } catch (err) {
      errorMsg = (err as Error)?.message || String(err);
    }

    // Upsert no nosso registro
    await supabase
      .from("v8_webhook_registrations")
      .upsert(
        {
          webhook_type: t.type,
          registered_url: t.url,
          last_registered_at: new Date().toISOString(),
          last_status: ok ? "success" : "failed",
          last_error: errorMsg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "webhook_type" },
      );

    results.push({ type: t.type, url: t.url, status, ok, error: errorMsg });
  }

  const allOk = results.every((r) => r.ok);
  return {
    success: allOk,
    data: { results },
    error: allOk ? null : "Falha ao registrar um ou mais webhooks (ver detalhes)",
  };
}


const handler = async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });


  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        success: false,
        error: "Unauthorized",
        code: "AUTH_REQUIRED",
        fallback: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Etapa 2A — Atualiza limites de retentativa internos (cache 60s).
    // Não bloqueia se falhar (cai nos defaults). Roda apenas 1x por request.
    await refreshRetryLimits(supabase);

    const token = authHeader.replace("Bearer ", "");
    // Aceita chamadas internas tanto do v8-retry-cron quanto do v8-active-consult-poller
    // (ambas usam SERVICE_ROLE e não têm usuário humano associado).
    const cronTriggerHeader = req.headers.get("x-cron-trigger");
    const isCronCall =
      (cronTriggerHeader === "v8-retry-cron" || cronTriggerHeader === "v8-active-consult-poller")
      && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let userId: string;
    let userEmail: string | null = null;
    let isPriv = false;

    if (isCronCall) {
      // Chamada interna do v8-retry-cron — não temos um usuário humano.
      // Usa o created_by da própria simulação (passado em params.cron_user_id) para audit.
      const body0 = await req.clone().json().catch(() => ({}));
      userId = body0?.params?.cron_user_id || "00000000-0000-0000-0000-000000000000";
      userEmail = "cron@v8-retry";
      isPriv = true;
    } else {
      const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({
          success: false,
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
          fallback: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
      userEmail = userData.user.email ?? null;
      const { data: privData } = await supabase.rpc("is_privileged", { _user_id: userId });
      isPriv = !!privData;
    }

    const body = await req.json().catch(() => ({}));
    const { action, params } = body;

    let result;
    switch (action) {
      case "get_configs":
        result = await actionGetConfigs(supabase);
        await writeAuditLog(supabase, {
          action: "v8_get_configs",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_configs_cache",
          details: {
            request_payload: { action: "get_configs" },
            response_payload: {
              success: !!(result as any)?.success,
              count: Array.isArray((result as any)?.data) ? (result as any).data.length : 0,
              data: (result as any)?.data ?? null,
              error: (result as any)?.error ?? null,
            },
            count: Array.isArray((result as any)?.data) ? (result as any).data.length : 0,
            error: (result as any)?.error ?? null,
          },
        });
        break;
      case "simulate_one": {
        const _attemptStartedAt = Date.now();
        result = await actionSimulateOne(supabase, params);
        const _attemptDurationMs = Date.now() - _attemptStartedAt;
        // Audit fino: registra a tentativa em v8_simulation_attempts (se houver simulation_id)
        if (params?.simulation_id) {
          try {
            const _kind = (result as any)?.kind ?? null;
            const _step = (result as any)?.step ?? null;
            const _statusForAttempt = (result as any)?.success
              ? "success"
              : (_step === "consult_status" ? "pending" : "failed");
            await supabase.from("v8_simulation_attempts").insert({
              simulation_id: params.simulation_id,
              batch_id: params.batch_id ?? null,
              attempt_number: Math.max(Number(params?.attempt_count ?? 1), 1),
              triggered_by: params?.triggered_by || "user",
              triggered_by_user: userId,
              request_payload: {
                cpf_masked: params?.cpf ? String(params.cpf).replace(/\d(?=\d{4})/g, "*") : null,
                config_id: params?.config_id ?? null,
                parcelas: params?.parcelas ?? null,
                simulation_mode: params?.simulation_mode ?? null,
                simulation_value: params?.simulation_value ?? null,
              },
              response_body: {
                success: !!(result as any)?.success,
                step: _step,
                kind: _kind,
                title: (result as any)?.title ?? null,
                detail: (result as any)?.detail ?? null,
                user_message: (result as any)?.user_message ?? null,
                data: (result as any)?.data ?? null,
              },
              http_status: (result as any)?.http_status ?? null,
              status: _statusForAttempt,
              error_kind: _kind,
              error_message: (result as any)?.success ? null : String((result as any)?.user_message || (result as any)?.error || ""),
              duration_ms: _attemptDurationMs,
            });
          } catch (logErr) {
            console.error("[v8-clt-api] failed to insert v8_simulation_attempts", logErr);
          }
        }
        await writeAuditLog(supabase, {
          action: "v8_simulate_one",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_simulations",
          targetId: params?.simulation_id ?? null,
          details: {
            request_payload: {
              action: "simulate_one",
              cpf_masked: params?.cpf ? String(params.cpf).replace(/\d(?=\d{4})/g, "*") : null,
              nome: params?.nome ?? null,
              config_id: params?.config_id ?? null,
              config_label: params?.config_label ?? null,
              parcelas: params?.parcelas ?? null,
              simulation_mode: params?.simulation_mode ?? null,
              simulation_value: params?.simulation_value ?? null,
              simulation_payload:
                params?.config_id && params?.parcelas && params?.simulation_mode && params?.simulation_value
                  ? buildSimulationBodyWithValue(params, "<consult_id>")
                  : null,
              batch_id: params?.batch_id ?? null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              step: (result as any)?.step ?? null,
              kind: (result as any)?.kind ?? null,
              title: (result as any)?.title ?? null,
              detail: (result as any)?.detail ?? null,
              guidance: (result as any)?.guidance ?? null,
              user_message: (result as any)?.user_message ?? null,
              error: (result as any)?.error ?? null,
              data: (result as any)?.data ?? null,
              raw: (result as any)?.raw ?? null,
            },
            retry_limits: {
              consult: MAX_RETRIES_CONSULT,
              authorize: MAX_RETRIES_AUTHORIZE,
              simulate: MAX_RETRIES_SIMULATE,
            },
            cpf_masked: params?.cpf ? String(params.cpf).replace(/\d(?=\d{4})/g, "*") : null,
            config_id: params?.config_id ?? null,
            parcelas: params?.parcelas ?? null,
            simulation_mode: params?.simulation_mode ?? null,
            kind: (result as any)?.kind ?? null,
            step: (result as any)?.step ?? null,
            guidance: (result as any)?.guidance ?? null,
            error: (result as any)?.error ?? null,
            released_value: (result as any)?.data?.released_value ?? null,
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        if (params?.simulation_id) {
          await supabase
            .from("v8_simulations")
            .update({
              attempt_count: Math.max(Number(params?.attempt_count ?? 0), 1),
              last_attempt_at: new Date().toISOString(),
              last_step: (result as any)?.step ?? 'simulate_one',
            })
            .eq("id", params.simulation_id);

          if (result.success) {
            await supabase
              .from("v8_simulations")
              .update({
                status: "success",
                config_id: params.config_id,
                config_name: params.config_label ?? null,
                installments: params.parcelas,
                released_value: (result as any).data.released_value,
                installment_value: (result as any).data.installment_value,
                interest_rate: (result as any).data.interest_rate,
                total_value: (result as any).data.total_value,
                company_margin: (result as any).data.company_margin,
                margem_valor: (result as any).data.margem_valor ?? (result as any).data.company_margin,
                amount_to_charge: (result as any).data.amount_to_charge,
                raw_response: (result as any).data.raw_response,
                v8_simulation_id: (result as any).data.simulation_id ?? null,
                consult_id: (result as any).data.consult_id ?? null,
                last_step: 'simulate',
                processed_at: new Date().toISOString(),
              })
              .eq("id", params.simulation_id);
            if (params.batch_id) {
              await supabase.rpc("v8_increment_batch_success", {
                _batch_id: params.batch_id,
              });
            }
          } else if ((result as any)?.step === "consult_status") {
            // CASO ESPECIAL active_consult: não é falha real — é a V8 dizendo que
            // outra plataforma (ou nós antes) já tem uma consulta em andamento p/ o CPF.
            // Tratamos como "aguardando consulta antiga concluir": status=pending +
            // webhook_status=WAITING_EXTERNAL.
            const isActiveConsult = (result as any).kind === "active_consult";

            // FIX: detectar status TERMINAL retornado pela check_consult_status
            // (REJECTED/FAILED/CANCELED). Antes, qualquer não-active_consult virava pending,
            // deixando a UI mostrando "em análise" mesmo após rejeição confirmada.
            const rawConsult = (result as any)?.raw ?? {};
            const consultStatus = String(
              rawConsult?.status
                ?? rawConsult?.latest?.status
                ?? '',
            ).toUpperCase();
            const isTerminalReject =
              consultStatus === "REJECTED"
              || consultStatus === "FAILED"
              || consultStatus === "CANCELED";

            const { data: existing } = await supabase
              .from("v8_simulations")
              .select("status")
              .eq("id", params.simulation_id)
              .maybeSingle();

            // Lógica: active_consult → pending (aguarda). Terminal reject → failed
            // (não-retentável). Demais casos → mantém comportamento anterior.
            const newStatus = isActiveConsult
              ? "pending"
              : (isTerminalReject ? "failed" : (existing?.status === "failed" ? "failed" : "pending"));

            // Mensagem SEM prefixo "Rejeitada pela V8:" — o badge já indica isso.
            const reason = rawConsult?.description
              ?? rawConsult?.detail
              ?? (result as any).detail
              ?? (result as any).user_message
              ?? (result as any).error
              ?? "Consulta ainda em análise";

            await supabase
              .from("v8_simulations")
              .update({
                status: newStatus,
                error_kind: isTerminalReject ? "rejected_by_v8" : ((result as any).kind ?? null),
                error_message: String(reason),
                webhook_status: isActiveConsult ? "WAITING_EXTERNAL" : undefined,
                raw_response: {
                  kind: (result as any).kind ?? null,
                  step: (result as any).step ?? null,
                  title: (result as any).title ?? null,
                  detail: (result as any).detail ?? null,
                  guidance: (result as any).guidance ?? null,
                  consult_status: consultStatus || null,
                  payload: (result as any).raw ?? null,
                },
                consult_id: (result as any)?.raw?.consult?.data?.id ?? (result as any)?.raw?.consult?.id ?? null,
                last_step: (result as any).step ?? 'consult_status',
                processed_at: new Date().toISOString(),
              })
              .eq("id", params.simulation_id);

            // Incrementa failure_count do lote quando promovido para terminal failed.
            if (isTerminalReject && params.batch_id) {
              await supabase.rpc("v8_increment_batch_failure", {
                _batch_id: params.batch_id,
              });
            }

            // Quando cai em "consulta ativa", dispara o poller IMEDIATAMENTE para
            // este CPF, sem esperar o tick de 1 min do cron — snapshot inline aparece em ~5-10s.
            if (isActiveConsult) {
              try {
                const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
                const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                // @ts-ignore EdgeRuntime exists in Supabase Edge Runtime
                EdgeRuntime.waitUntil(
                  fetch(`${supabaseUrl2}/functions/v1/v8-active-consult-poller`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${serviceRoleKey2}`,
                    },
                    body: JSON.stringify({ simulation_id: params.simulation_id, manual: true }),
                  }).catch(() => {}),
                );
              } catch (_) { /* ignore */ }
            }
          } else {
            // Mesma proteção de active_consult — pode chegar aqui se a classificação
            // vier do step `consult` (não `consult_status`). Nunca virar failed.
            const isActiveConsult = (result as any).kind === "active_consult";
            // FIX 4: quando o erro vem do step `simulate`, grava também em
            // simulate_error_message (coluna dedicada). error_message continua
            // recebendo para retrocompat, mas a UI dá preferência à coluna nova.
            const isSimulateStep = (result as any)?.step === "simulate";
            const errorMsg = String((result as any).user_message || (result as any).error || "Erro desconhecido");
            const updates: Record<string, unknown> = {
              status: isActiveConsult ? "pending" : "failed",
              error_kind: (result as any).kind ?? null,
              error_message: errorMsg,
              webhook_status: isActiveConsult ? "WAITING_EXTERNAL" : undefined,
              raw_response: {
                kind: (result as any).kind ?? null,
                step: (result as any).step ?? null,
                title: (result as any).title ?? null,
                detail: (result as any).detail ?? null,
                guidance: (result as any).guidance ?? null,
                payload: (result as any).raw ?? null,
              },
              last_step: (result as any).step ?? 'simulate_one',
              processed_at: new Date().toISOString(),
            };
            if (isSimulateStep) {
              updates.simulate_error_message = errorMsg;
              updates.simulate_status = "failed";
              updates.simulate_attempted_at = new Date().toISOString();
            }
            await supabase
              .from("v8_simulations")
              .update(updates)
              .eq("id", params.simulation_id);
            if (params.batch_id && !isActiveConsult) {
              await supabase.rpc("v8_increment_batch_failure", {
                _batch_id: params.batch_id,
              });
            }
          }
        }
        break;
      }
      case "create_batch":
        result = await actionCreateBatch(supabase, params, userId);
        await writeAuditLog(supabase, {
          action: "v8_create_batch",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_batches",
          targetId: (result as any)?.data?.batch_id ?? null,
          details: {
            request_payload: {
              action: "create_batch",
              name: params?.name ?? null,
              config_id: params?.config_id ?? null,
              config_label: params?.config_label ?? null,
              parcelas: params?.parcelas ?? null,
              rows_count: Array.isArray(params?.rows) ? params.rows.length : 0,
            },
            response_payload: {
              success: !!(result as any)?.success,
              batch_id: (result as any)?.data?.batch_id ?? null,
              total: (result as any)?.data?.total ?? null,
              error: (result as any)?.error ?? null,
            },
            total: (result as any)?.data?.total ?? null,
            error: (result as any)?.error ?? null,
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        // Kick-start do auto-retry: agenda 3 disparos do v8-retry-cron nos próximos 90s,
        // sem esperar pg_cron (que roda a cada 1min). Assim, falhas da 1ª passada já são
        // retentadas em ~30s, evitando que o usuário precise clicar manualmente em "Retentar".
        // Não bloqueia a resposta: roda em background com EdgeRuntime.waitUntil quando disponível.
        try {
          const batchId = (result as any)?.data?.batch_id;
          if (batchId) {
            const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/v8-retry-cron`;
            const autoBestUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/v8-auto-best-worker`;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const kickStart = (async () => {
              for (const delayMs of [30_000, 60_000, 90_000]) {
                await new Promise((r) => setTimeout(r, delayMs));
                try {
                  await fetch(url, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${serviceKey}`,
                      "x-cron-trigger": "v8-clt-api-kickstart",
                    },
                    body: JSON.stringify({ batch_id: batchId, manual: true }),
                  });
                } catch (e) {
                  console.warn("[v8-clt-api] kick-start retry fail", e);
                }
                // Etapa 3 (mai/2026): também kicka o auto-best-worker para
                // não esperar até 1min do pg_cron processar a fila recém-enfileirada.
                try {
                  await fetch(autoBestUrl, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${serviceKey}`,
                      "x-cron-trigger": "v8-clt-api-kickstart",
                    },
                    body: JSON.stringify({ batch_id: batchId, manual: true }),
                  });
                } catch (e) {
                  console.warn("[v8-clt-api] kick-start auto-best fail", e);
                }
              }
            })();
            // @ts-ignore EdgeRuntime existe em Supabase Edge runtime
            if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
              // @ts-ignore
              EdgeRuntime.waitUntil(kickStart);
            }
          }
        } catch (e) {
          console.warn("[v8-clt-api] kick-start setup error", e);
        }
        break;
      case "list_batches":
        result = await actionListBatches(supabase, userId, isPriv);
        await writeAuditLog(supabase, {
          action: "v8_list_batches",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_batches",
          details: {
            request_payload: { action: "list_batches" },
            response_payload: {
              success: !!(result as any)?.success,
              count: Array.isArray((result as any)?.data) ? (result as any).data.length : 0,
              error: (result as any)?.error ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      case "cancel_batch": {
        const batchId = String(params?.batch_id ?? "");
        if (!batchId) {
          result = { success: false, error: "batch_id obrigatório" };
        } else {
          // Carrega o lote para checar permissão (dono OU privilegiado)
          const { data: batchRow, error: batchErr } = await supabase
            .from("v8_batches")
            .select("id, status, created_by, name")
            .eq("id", batchId)
            .maybeSingle();
          if (batchErr || !batchRow) {
            result = { success: false, error: batchErr?.message || "Lote não encontrado" };
          } else if (!isPriv && batchRow.created_by !== userId) {
            result = { success: false, error: "Sem permissão para cancelar este lote" };
          } else if (batchRow.status === "canceled") {
            result = { success: true, data: { already_canceled: true } };
          } else {
            // Marca lote como canceled
            const nowIso = new Date().toISOString();
            const { error: upBatchErr } = await supabase
              .from("v8_batches")
              .update({ status: "canceled", canceled_at: nowIso, canceled_by: userId })
              .eq("id", batchId);
            // Marca pendentes como canceladas (preserva success/failed)
            const { error: upSimsErr, count: canceledCount } = await supabase
              .from("v8_simulations")
              .update({
                status: "failed",
                error_kind: "canceled",
                error_message: "Lote cancelado pelo operador",
                processed_at: nowIso,
              }, { count: "exact" })
              .eq("batch_id", batchId)
              .eq("status", "pending");
            if (upBatchErr || upSimsErr) {
              result = { success: false, error: upBatchErr?.message || upSimsErr?.message };
            } else {
              result = { success: true, data: { batch_id: batchId, canceled_simulations: canceledCount ?? 0 } };
            }
          }
        }
        await writeAuditLog(supabase, {
          action: "v8_cancel_batch",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_batches",
          targetId: params?.batch_id ?? null,
          details: {
            request_payload: { action: "cancel_batch", batch_id: params?.batch_id ?? null },
            response_payload: result,
          },
        });
        break;
      }

      case "cancel_batch_hard": {
        const batchId = String(params?.batch_id ?? "");
        if (!batchId) {
          result = { success: false, error: "batch_id obrigatório" };
        } else {
          const { data: batchRow, error: batchErr } = await supabase
            .from("v8_batches")
            .select("id, status, created_by, name")
            .eq("id", batchId)
            .maybeSingle();
          if (batchErr || !batchRow) {
            result = { success: false, error: batchErr?.message || "Lote não encontrado" };
          } else if (!isPriv && batchRow.created_by !== userId) {
            result = { success: false, error: "Sem permissão para cancelar este lote" };
          } else if (batchRow.status === "canceled") {
            result = { success: true, data: { already_canceled: true } };
          } else {
            const nowIso = new Date().toISOString();
            const { error: upBatchErr } = await supabase
              .from("v8_batches")
              .update({ status: "canceled", canceled_at: nowIso, canceled_by: userId })
              .eq("id", batchId);
            // Marca TODAS as sims não-success como canceled_hard — webhook vai ignorar.
            const { error: upSimsErr, count: canceledCount } = await supabase
              .from("v8_simulations")
              .update({
                status: "failed",
                error_kind: "canceled_hard",
                error_message: "Cancelado pelo operador (webhooks ignorados)",
                processed_at: nowIso,
              }, { count: "exact" })
              .eq("batch_id", batchId)
              .neq("status", "success");
            if (upBatchErr || upSimsErr) {
              result = { success: false, error: upBatchErr?.message || upSimsErr?.message };
            } else {
              result = { success: true, data: { batch_id: batchId, canceled_simulations: canceledCount ?? 0 } };
            }
          }
        }
        await writeAuditLog(supabase, {
          action: "v8_cancel_batch_hard",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_batches",
          targetId: params?.batch_id ?? null,
          details: {
            request_payload: { action: "cancel_batch_hard", batch_id: params?.batch_id ?? null },
            response_payload: result,
          },
        });
        break;
      }
      case "schedule_batch": {
        result = await actionScheduleBatch(supabase, params, userId);
        await writeAuditLog(supabase, {
          action: "v8_schedule_batch",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_batches",
          targetId: (result as any)?.data?.batch_id ?? null,
          details: {
            request_payload: {
              action: "schedule_batch",
              name: params?.name ?? null,
              config_id: params?.config_id ?? null,
              parcelas: params?.parcelas ?? null,
              scheduled_for: params?.scheduled_for ?? null,
              strategy: params?.strategy ?? null,
              rows_count: Array.isArray(params?.rows) ? params.rows.length : 0,
            },
            response_payload: result,
          },
        });
        break;
      }
      case "cancel_schedule": {
        const batchId = String(params?.batch_id ?? "");
        if (!batchId) {
          result = { success: false, error: "batch_id obrigatório" };
        } else {
          const { data: batchRow } = await supabase
            .from("v8_batches")
            .select("id, status, created_by, name")
            .eq("id", batchId)
            .maybeSingle();
          if (!batchRow) {
            result = { success: false, error: "Lote não encontrado" };
          } else if (!isPriv && batchRow.created_by !== userId) {
            result = { success: false, error: "Sem permissão" };
          } else if (batchRow.status !== "scheduled") {
            result = { success: false, error: `Lote não está mais agendado (status: ${batchRow.status})` };
          } else {
            const { error: upErr } = await supabase
              .from("v8_batches")
              .update({
                status: "canceled",
                canceled_at: new Date().toISOString(),
                canceled_by: userId,
              })
              .eq("id", batchId)
              .eq("status", "scheduled"); // proteção: só cancela se ainda está agendado
            result = upErr
              ? { success: false, error: upErr.message }
              : { success: true, data: { batch_id: batchId } };
          }
        }
        await writeAuditLog(supabase, {
          action: "v8_cancel_schedule",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_batches",
          targetId: params?.batch_id ?? null,
          details: { request_payload: params, response_payload: result },
        });
        break;
      }
      case "queue_batch": {
        result = await actionQueueBatch(supabase, params, userId);
        await writeAuditLog(supabase, {
          action: "v8_queue_batch",
          category: "simulator",
          success: !!(result as any)?.success,
          userId, userEmail,
          targetTable: "v8_batches",
          targetId: (result as any)?.data?.batch_id ?? null,
          details: { request_payload: { name: params?.name, rows_count: Array.isArray(params?.rows) ? params.rows.length : 0 }, response_payload: result },
        });
        break;
      }
      case "cancel_queue": {
        const batchId = String(params?.batch_id ?? "");
        result = batchId
          ? await actionCancelQueue(supabase, batchId, userId, isPriv)
          : { success: false, error: "batch_id obrigatório" };
        await writeAuditLog(supabase, {
          action: "v8_cancel_queue", category: "simulator",
          success: !!(result as any)?.success, userId, userEmail,
          targetTable: "v8_batches", targetId: batchId || null,
          details: { request_payload: params, response_payload: result },
        });
        break;
      }
      case "reorder_queue": {
        const batchId = String(params?.batch_id ?? "");
        const direction = (params?.direction === "down" ? "down" : "up") as "up" | "down";
        result = batchId
          ? await actionReorderQueue(supabase, batchId, direction, userId, isPriv)
          : { success: false, error: "batch_id obrigatório" };
        await writeAuditLog(supabase, {
          action: "v8_reorder_queue", category: "simulator",
          success: !!(result as any)?.success, userId, userEmail,
          targetTable: "v8_batches", targetId: batchId || null,
          details: { request_payload: params, response_payload: result },
        });
        break;
      }
      case "register_webhooks": {
        if (!isPriv) {
          result = { success: false, error: "Apenas administradores podem registrar webhooks" };
          break;
        }
        result = await actionRegisterWebhooks(supabase);
        await writeAuditLog(supabase, {
          action: "v8_register_webhooks",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_webhook_registrations",
          details: {
            request_payload: { action: "register_webhooks" },
            response_payload: result,
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "get_webhook_status": {
        const { data: regs } = await supabase
          .from("v8_webhook_registrations")
          .select("*")
          .order("webhook_type");
        const { data: lastLog } = await supabase
          .from("v8_webhook_logs")
          .select("id, event_type, status, received_at")
          .order("received_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        result = { success: true, data: { registrations: regs ?? [], last_log: lastLog ?? null } };
        await writeAuditLog(supabase, {
          action: "v8_get_webhook_status",
          category: "simulator",
          success: true,
          userId,
          userEmail,
          targetTable: "v8_webhook_registrations",
          details: {
            request_payload: { action: "get_webhook_status" },
            response_payload: result,
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "list_operations":
        result = await actionListOperations(params);
        await writeAuditLog(supabase, {
          action: "v8_list_operations",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_operations",
          details: {
            request_payload: {
              action: "list_operations",
              startDate: params?.startDate ?? null,
              endDate: params?.endDate ?? null,
              limit: params?.limit ?? null,
              page: params?.page ?? null,
              provider: params?.provider ?? "QI",
              documentNumber: params?.documentNumber ? String(params.documentNumber).replace(/\d(?=\d{4})/g, "*") : null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              total: (result as any)?.total ?? 0,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      case "list_consults":
        result = await actionListConsults(params);
        await writeAuditLog(supabase, {
          action: "v8_list_consults",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_consults",
          details: {
            request_payload: {
              action: "list_consults",
              startDate: params?.startDate ?? null,
              endDate: params?.endDate ?? null,
              limit: params?.limit ?? null,
              page: params?.page ?? null,
              provider: params?.provider ?? "QI",
              documentNumber: params?.documentNumber ? String(params.documentNumber).replace(/\d(?=\d{4})/g, "*") : null,
              search: params?.search ?? null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              total: (result as any)?.total ?? 0,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      case "get_operation":
        result = await actionGetOperation(params?.operationId);
        await writeAuditLog(supabase, {
          action: "v8_get_operation",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_operations",
          targetId: params?.operationId ?? null,
          details: {
            request_payload: {
              action: "get_operation",
              operationId: params?.operationId ?? null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      case "resolve_pix_pendency": {
        // Apenas privilegiados podem reapresentar dados bancários na V8.
        if (!isPriv) {
          result = { success: false, error: "Apenas administradores podem resolver pendências na V8" };
        } else {
          result = await actionResolvePixPendency(
            supabase,
            params?.operationId,
            params?.pixKey,
            params?.pixKeyType,
          );
        }
        await writeAuditLog(supabase, {
          action: "v8_resolve_pix_pendency",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_operations_local",
          targetId: params?.operationId ?? null,
          details: {
            request_payload: {
              action: "resolve_pix_pendency",
              operationId: params?.operationId ?? null,
              pix_key_type: params?.pixKeyType ?? null,
              // Mascarar a chave para auditoria — nunca logar PII em claro.
              pix_key_masked: params?.pixKey
                ? String(params.pixKey).replace(/.(?=.{4})/g, "*")
                : null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "cancel_operation": {
        // Apenas privilegiados (master/admin/manager) podem cancelar na V8.
        if (!isPriv) {
          result = { success: false, error: "Apenas administradores podem cancelar operação na V8" };
        } else {
          result = await actionCancelOperation(supabase, params?.operationId, params?.reason);
        }
        await writeAuditLog(supabase, {
          action: "v8_cancel_operation",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_operations_local",
          targetId: params?.operationId ?? null,
          details: {
            request_payload: {
              action: "cancel_operation",
              operationId: params?.operationId ?? null,
              reason: params?.reason ?? null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "upload_document": {
        if (!isPriv) {
          result = { success: false, error: "Apenas administradores podem enviar documentos à V8" };
        } else {
          result = await actionUploadDocument(
            supabase,
            params?.operationId,
            params?.fileBase64,
            params?.fileName,
            params?.mimeType,
            params?.documentType,
            userId,
          );
        }
        await writeAuditLog(supabase, {
          action: "v8_upload_document",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_operations_local",
          targetId: params?.operationId ?? null,
          details: {
            request_payload: {
              action: "upload_document",
              operationId: params?.operationId ?? null,
              document_type: params?.documentType ?? null,
              file_name: params?.fileName ?? null,
              mime_type: params?.mimeType ?? null,
              file_size_b64: params?.fileBase64 ? String(params.fileBase64).length : 0,
            },
            response_payload: {
              success: !!(result as any)?.success,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "resubmit_documents": {
        if (!isPriv) {
          result = { success: false, error: "Apenas administradores podem reapresentar a operação" };
        } else {
          result = await actionResubmitDocuments(supabase, params?.operationId);
        }
        await writeAuditLog(supabase, {
          action: "v8_resubmit_documents",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_operations_local",
          targetId: params?.operationId ?? null,
          details: {
            request_payload: {
              action: "resubmit_documents",
              operationId: params?.operationId ?? null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "check_consult_status":
        result = await actionCheckConsultStatus(params);
        await writeAuditLog(supabase, {
          action: "v8_check_consult_status",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_consults",
          details: {
            request_payload: {
              action: "check_consult_status",
              cpf_masked: params?.cpf ? String(params.cpf).replace(/\d(?=\d{4})/g, "*") : null,
              consult_id: params?.consult_id ?? null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              found: (result as any)?.data?.found ?? false,
              latest_status: (result as any)?.data?.latest?.status ?? null,
              error: (result as any)?.error ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      case "simulate_consult_only": {
        // ESTRATÉGIA WEBHOOK_ONLY — só consulta de margem, sem /simulation.
        result = await actionSimulateConsultOnly(supabase, params);
        if (params?.simulation_id) {
          const _success = !!(result as any)?.success;
          if (_success) {
            await supabase.from("v8_simulations").update({
              status: "pending",
              simulation_strategy: "webhook_only",
              consult_id: (result as any).data.consult_id,
              raw_response: (result as any).data.raw_response,
              last_step: "consult_only",
              attempt_count: Math.max(Number(params?.attempt_count ?? 0), 1),
              last_attempt_at: new Date().toISOString(),
              error_kind: null,
              error_message: null,
            }).eq("id", params.simulation_id);
          } else {
            await supabase.from("v8_simulations").update({
              status: "failed",
              simulation_strategy: "webhook_only",
              error_kind: (result as any).kind ?? null,
              error_message: String((result as any).user_message || (result as any).error || "Erro"),
              raw_response: { kind: (result as any).kind, step: (result as any).step, payload: (result as any).raw },
              last_step: (result as any).step ?? "consult_only",
              attempt_count: Math.max(Number(params?.attempt_count ?? 0), 1),
              last_attempt_at: new Date().toISOString(),
              processed_at: new Date().toISOString(),
            }).eq("id", params.simulation_id);
            if (params.batch_id) {
              await supabase.rpc("v8_increment_batch_failure", { _batch_id: params.batch_id });
            }
          }
        }
        await writeAuditLog(supabase, {
          action: "v8_simulate_consult_only",
          category: "simulator",
          success: !!(result as any)?.success,
          userId, userEmail,
          targetTable: "v8_simulations",
          targetId: params?.simulation_id ?? null,
          details: {
            cpf_masked: params?.cpf ? String(params.cpf).replace(/\d(?=\d{4})/g, "*") : null,
            kind: (result as any)?.kind ?? null,
            step: (result as any)?.step ?? null,
            consult_id: (result as any)?.data?.consult_id ?? null,
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "simulate_only_for_consult": {
        // Roda /simulation usando consult_id já validado (botão "Simular selecionados").
        result = await actionSimulateOnlyForConsult(supabase, params);
        if (params?.simulation_id) {
          // FIX 4: grava motivo do erro em coluna dedicada (simulate_error_message)
          // — antes ficava null, deixando UI mostrando "Falha sem detalhe".
          const simErrorMsg = !(result as any)?.success
            ? String(
                (result as any)?.user_message
                  ?? (result as any)?.detail
                  ?? (result as any)?.title
                  ?? (result as any)?.error
                  ?? "Erro desconhecido na simulação V8",
              )
            : null;
          await supabase.from("v8_simulations").update({
            simulate_attempted_at: new Date().toISOString(),
            simulate_status: (result as any)?.success ? "success" : "failed",
            simulate_error_message: simErrorMsg,
          }).eq("id", params.simulation_id);
          if ((result as any)?.success) {
            // Usa parcelas efetivas (após clamp), não o que veio do request.
            const effectiveParcelas = (result as any)?.data?.installments ?? params.parcelas;
            // Etapa 1 (item 3): preserva clamp no raw_response para a UI mostrar tooltip.
            const { data: existing } = await supabase
              .from("v8_simulations")
              .select("raw_response")
              .eq("id", params.simulation_id)
              .maybeSingle();
            const baseRaw = (existing?.raw_response as any) ?? {};
            const newRaw = {
              ...baseRaw,
              ...(((result as any)?.data?.raw_response) ?? {}),
              clamp_applied: !!(result as any)?.data?.clamp_applied,
              clamp_note: (result as any)?.data?.clamp_note ?? null,
            };
            await supabase.from("v8_simulations").update({
              released_value: (result as any).data.released_value,
              installment_value: (result as any).data.installment_value,
              interest_rate: (result as any).data.interest_rate,
              total_value: (result as any).data.total_value,
              company_margin: (result as any).data.company_margin,
              amount_to_charge: (result as any).data.amount_to_charge,
              v8_simulation_id: (result as any).data.simulation_id ?? null,
              config_id: params.config_id,
              installments: effectiveParcelas,
              last_step: "simulate_only",
              raw_response: newRaw,
            }).eq("id", params.simulation_id);
          }
        }
        await writeAuditLog(supabase, {
          action: "v8_simulate_only_for_consult",
          category: "simulator",
          success: !!(result as any)?.success,
          userId, userEmail,
          targetTable: "v8_simulations",
          targetId: params?.simulation_id ?? null,
          details: {
            consult_id: params?.consult_id ?? null,
            config_id: params?.config_id ?? null,
            parcelas: params?.parcelas ?? null,
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      case "create_operation": {
        result = await actionCreateOperation(supabase, params, userId);
        await writeAuditLog(supabase, {
          action: "v8_create_operation",
          category: "simulator",
          success: !!(result as any)?.success,
          userId,
          userEmail,
          targetTable: "v8_operations_local",
          targetId: (result as any)?.data?.operation_id ?? null,
          details: {
            request_payload: {
              action: "create_operation",
              consult_id: params?.consult_id ?? null,
              simulation_id: params?.simulation_id ?? null,
              draft_id: params?.draft_id ?? null,
              cpf_masked: params?.payload?.borrower?.cpf
                ? String(params.payload.borrower.cpf).replace(/\d(?=\d{4})/g, "*")
                : null,
              has_documents: Array.isArray(params?.documents) ? params.documents.length : 0,
            },
            response_payload: {
              success: !!(result as any)?.success,
              operation_id: (result as any)?.data?.operation_id ?? null,
              error: (result as any)?.error ?? null,
              title: (result as any)?.title ?? null,
            },
            ...packPayloadForAudit(result, "payload_full"),
          },
        });
        break;
      }
      default:
        result = { success: false, error: `Ação desconhecida: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("v8-clt-api error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

if (import.meta.main) {
  serve(handler);
}
