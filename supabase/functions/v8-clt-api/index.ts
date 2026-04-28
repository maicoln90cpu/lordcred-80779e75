import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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
};

const MAX_RETRIES_CONSULT = 3;
const MAX_RETRIES_AUTHORIZE = 15;
const MAX_RETRIES_SIMULATE = 15;

let cachedToken: { token: string; expiresAt: number } | null = null;

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

function formatV8Guidance(kind: string) {
  switch (kind) {
    case 'active_consult':
      return 'Já existe consulta ativa para este CPF na V8.\nConsulte as operações existentes ou aguarde a análise em andamento.';
    case 'analysis_pending':
      return 'A consulta ainda está em análise na V8.\nAguarde um pouco e tente novamente em instantes.';
    case 'existing_proposal':
      return 'Já existe proposta para este cliente na V8.\nConsulte as operações existentes antes de tentar uma nova simulação.';
    case 'temporary_v8':
      return 'A V8 está com instabilidade ou rate limit.\nAguarde 1–2 minutos e use "Retentar" para tentar novamente.';
    case 'invalid_data':
      return 'A V8 recusou os dados enviados.\nRevise CPF, data de nascimento, tabela e valor informado.';
    default:
      return '';
  }
}

function buildV8ErrorResult(step: string, source: Record<string, any> = {}) {
  const kind = source.kind ?? detectV8ErrorKind(source);
  const baseMessage = source.userMessage ?? formatV8UserMessage(source);
  const guidance = formatV8Guidance(kind);
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
  // dos itens que ficaram com pelo menos um campo faltando, em paralelo (concorrência 6).
  // Limite de segurança: até 60 detalhes por chamada para não estourar tempo do edge.
  const needsEnrichment = preNormalized.filter(
    (op) => op?.id && (op.issueAmount == null || op.installmentFaceValue == null || op.numberOfInstallments == null)
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
        const opId = String(item.id);
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

  const normalized = preNormalized.map((op: any) => {
    const detail = op?.id ? enrichedById.get(String(op.id)) : null;
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

  // Authorize — opcional, mas a V8 só dispara webhook após termo aceito.
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

  const simulationBody = buildSimulationBodyWithValue(params, params.consult_id);
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
      raw_response: {
        upstream_request: { simulation: simulationBody },
        simulate: simJson,
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
    })
    .select()
    .single();
  if (batchErr) return { success: false, error: batchErr.message };

  // Cinto + suspensório: marca toda nova simulação como `analysis_pending` desde
  // o nascimento. Assim, mesmo que a 1ª chamada simulate_one nunca rode (timeout
  // de browser, refresh de página, falha de rede), o cron `v8-retry-cron` já
  // identifica como elegível para auto-retry — não fica "órfã" no banco.
  const sims = validRows.map((r) => ({
    batch_id: batch.id,
    created_by: userId,
    cpf: r.cpf.replace(/\D/g, ""),
    name: r.nome ?? null,
    birth_date: r.data_nascimento ? normalizeBirthDate(r.data_nascimento) : null,
    status: "pending",
    error_kind: "analysis_pending",
    // Persistir tabela e parcelas no nascimento — auto-retry depende disso.
    config_id: payload.config_id,
    config_name: payload.config_label ?? null,
    installments: payload.parcelas,
  }));

  const { error: simsErr } = await supabase.from("v8_simulations").insert(sims);
  if (simsErr) return { success: false, error: simsErr.message };

  return { success: true, data: { batch_id: batch.id, total: validRows.length } };
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
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
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
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
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
            // Não rebaixar: se a linha já é 'failed', manter — apenas anexar info ao raw_response.
            const { data: existing } = await supabase
              .from("v8_simulations")
              .select("status")
              .eq("id", params.simulation_id)
              .maybeSingle();
            const newStatus = existing?.status === "failed" ? "failed" : "pending";
            await supabase
              .from("v8_simulations")
              .update({
                status: newStatus,
                // Persiste error_kind em coluna dedicada para o cron de retry.
                // Sem isso, retentativas seguintes perdem a classificação e ficam órfãs.
                error_kind: (result as any).kind ?? null,
                error_message: String((result as any).user_message || (result as any).error || "Consulta ainda em análise"),
                raw_response: {
                  kind: (result as any).kind ?? null,
                  step: (result as any).step ?? null,
                  title: (result as any).title ?? null,
                  detail: (result as any).detail ?? null,
                  guidance: (result as any).guidance ?? null,
                  payload: (result as any).raw ?? null,
                },
                consult_id: (result as any)?.raw?.consult?.data?.id ?? (result as any)?.raw?.consult?.id ?? null,
                last_step: (result as any).step ?? 'consult_status',
                processed_at: new Date().toISOString(),
              })
              .eq("id", params.simulation_id);

            // Quando cai em "consulta ativa", dispara o poller IMEDIATAMENTE para
            // este CPF, sem esperar o tick de 1 min do cron — snapshot inline aparece em ~5-10s.
            if ((result as any).kind === "active_consult") {
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
            await supabase
              .from("v8_simulations")
              .update({
                status: "failed",
                // Persiste error_kind em coluna dedicada para o cron de retry.
                error_kind: (result as any).kind ?? null,
                error_message: String((result as any).user_message || (result as any).error || "Erro desconhecido"),
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
              })
              .eq("id", params.simulation_id);
            if (params.batch_id) {
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
                  console.warn("[v8-clt-api] kick-start fail", e);
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
          await supabase.from("v8_simulations").update({
            simulate_attempted_at: new Date().toISOString(),
            simulate_status: (result as any)?.success ? "done" : "failed",
          }).eq("id", params.simulation_id);
          if ((result as any)?.success) {
            await supabase.from("v8_simulations").update({
              released_value: (result as any).data.released_value,
              installment_value: (result as any).data.installment_value,
              interest_rate: (result as any).data.interest_rate,
              total_value: (result as any).data.total_value,
              company_margin: (result as any).data.company_margin,
              amount_to_charge: (result as any).data.amount_to_charge,
              v8_simulation_id: (result as any).data.simulation_id ?? null,
              config_id: params.config_id,
              installments: params.parcelas,
              last_step: "simulate_only",
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
