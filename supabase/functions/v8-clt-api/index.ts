import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { writeAuditLog } from "../_shared/auditLog.ts";

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
};

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
  headers.set("Content-Type", "application/json");
  return fetch(`${V8_BASE}${path}`, { ...init, headers });
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

  if (Array.isArray(configs) && configs.length > 0) {
    for (const c of configs) {
      const config_id = String(c.id ?? c.configId ?? c.uuid ?? c.code ?? "");
      if (!config_id) continue;
      const fin = c.financial ?? c.financialConditions ?? {};
      // V8 (Crédito do Trabalhador) retorna o nome em "slug" no payload flat.
      // Fallbacks adicionais cobrem versões antigas e variações por provider.
      const displayName = String(
        c.slug ?? c.name ?? c.label ?? c.description ?? c.product_name ?? "Sem nome"
      );
      const isInsured = c.is_insured === true || c.isInsured === true;
      await supabase
        .from("v8_configs_cache")
        .upsert(
          {
            config_id,
            name: displayName,
            bank_name: fin.bank ?? c.bank ?? c.bankName ?? c.provider ?? null,
            product_type: c.productType ?? c.product ?? "clt",
            min_value: fin.minValue ?? c.minValue ?? c.min_value ?? null,
            max_value: fin.maxValue ?? c.maxValue ?? c.max_value ?? null,
            min_term:
              fin.minTerm ?? c.minTerm ?? c.minInstallments ?? c.min_installments ?? null,
            max_term:
              fin.maxTerm ?? c.maxTerm ?? c.maxInstallments ?? c.max_installments ?? null,
            is_active: c.active !== false,
            raw_data: { ...c, _is_insured: isInsured },
            synced_at: new Date().toISOString(),
          },
          { onConflict: "config_id" }
        );
    }
  }

  return { success: true, data: configs };
}

interface SimulateInput {
  cpf: string;
  nome?: string;
  data_nascimento?: string;
  /** "M" | "F" | "male" | "female" — convertido para o enum aceito pela V8 */
  genero?: string;
  email?: string;
  telefone?: string;
  config_id: string;
  parcelas: number;
  batch_id?: string;
  simulation_id?: string;
}

/** Converte data dd/mm/aaaa ou yyyy-mm-dd para o formato aceito pela V8 (yyyy-mm-dd). */
function normalizeBirthDate(input?: string): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Normaliza gênero para o enum esperado pela V8 ("male" | "female"). */
function normalizeGender(input?: string): "male" | "female" {
  const g = (input || "").trim().toLowerCase();
  if (g.startsWith("f") || g === "feminino" || g === "female") return "female";
  return "male";
}

/** Sanitiza telefone para apenas dígitos; retorna {areaCode, number} com fallback 11/999999999. */
function normalizePhone(input?: string): { areaCode: string; number: string } {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length >= 10) {
    return { areaCode: digits.slice(0, 2), number: digits.slice(2) };
  }
  return { areaCode: "11", number: "999999999" };
}

async function actionSimulateOne(supabase: any, input: SimulateInput) {
  const cpf = (input.cpf || "").replace(/\D/g, "");
  if (cpf.length !== 11) return { success: false, error: "CPF inválido" };

  const birthDate = normalizeBirthDate(input.data_nascimento);
  if (!birthDate) {
    return { success: false, step: "consult", error: "Data de nascimento inválida (use dd/mm/aaaa)" };
  }
  if (!input.nome || input.nome.trim().length < 3) {
    return { success: false, step: "consult", error: "Nome do cliente é obrigatório (mínimo 3 caracteres)" };
  }

  // 1) Consult — payload completo conforme docs.v8sistema.com (Crédito Privado CLT)
  const phone = normalizePhone(input.telefone);
  const consultBody = {
    borrowerDocumentNumber: cpf,
    gender: normalizeGender(input.genero),
    birthDate,
    signerName: input.nome.trim(),
    signerEmail: input.email?.trim() || `${cpf}@lordcred.temp`,
    signerPhone: {
      countryCode: "55",
      areaCode: phone.areaCode,
      number: phone.number,
    },
    provider: "QI",
  };

  const consultResp = await v8Fetch(V8_PATHS.consult, {
    method: "POST",
    body: JSON.stringify(consultBody),
  });
  const consultJson = await consultResp.json().catch(() => ({}));
  if (!consultResp.ok) {
    return {
      success: false,
      step: "consult",
      error: consultJson?.message || consultJson?.error || `Status ${consultResp.status}`,
      raw: consultJson,
    };
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
  const authResp = await v8Fetch(V8_PATHS.authorize(consultId), {
    method: "POST",
    body: JSON.stringify({}),
  });
  const authJson = await authResp.json().catch(() => ({}));
  if (!authResp.ok) {
    return {
      success: false,
      step: "authorize",
      error: authJson?.message || `Status ${authResp.status}`,
      raw: { consult: consultJson, authorize: authJson },
    };
  }

  // 3) Simulate — referencia consult_id, configId e provider QI
  const simResp = await v8Fetch(V8_PATHS.simulate, {
    method: "POST",
    body: JSON.stringify({
      consult_id: consultId,
      configId: input.config_id,
      installments: input.parcelas,
      provider: "QI",
    }),
  });
  const simJson = await simResp.json().catch(() => ({}));
  if (!simResp.ok) {
    return {
      success: false,
      step: "simulate",
      error: simJson?.message || `Status ${simResp.status}`,
      raw: { consult: consultJson, authorize: authJson, simulate: simJson },
    };
  }

  const result = simJson?.data ?? simJson;
  // V8 (Crédito do Trabalhador) — resposta oficial usa disbursement_option.
  // disbursement_options pode vir como array de cenários; pegamos o primeiro válido.
  const dispOpt =
    result?.disbursement_option ??
    (Array.isArray(result?.disbursement_options) ? result.disbursement_options[0] : null) ??
    result?.disbursementOption ??
    null;

  const simulationId = String(
    result?.id ?? result?.simulation_id ?? result?.simulationId ?? ""
  );

  const released_value = Number(
    dispOpt?.final_disbursement_amount ??
      dispOpt?.finalDisbursementAmount ??
      dispOpt?.net_amount ??
      result?.netAmount ??
      result?.releasedValue ??
      result?.valorLiberado ??
      0
  );
  const installment_value = Number(
    dispOpt?.installment_amount ??
      dispOpt?.installmentAmount ??
      result?.installmentAmount ??
      result?.parcelValue ??
      result?.valorParcela ??
      0
  );
  const interest_rate = Number(
    dispOpt?.monthly_interest_rate ??
      dispOpt?.interest_rate ??
      result?.interestRate ??
      result?.rate ??
      result?.taxa ??
      0
  );
  const total_value = Number(
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

  return {
    success: true,
    data: {
      released_value,
      installment_value,
      interest_rate,
      total_value,
      company_margin,
      amount_to_charge,
      raw_response: { consult: consultJson, authorize: authJson, simulate: simJson },
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

  const sims = validRows.map((r) => ({
    batch_id: batch.id,
    created_by: userId,
    cpf: r.cpf.replace(/\D/g, ""),
    name: r.nome ?? null,
    birth_date: r.data_nascimento ?? null,
    status: "pending",
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

serve(async (req) => {
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
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: privData } = await supabase.rpc("is_privileged", { _user_id: userId });
    const isPriv = !!privData;

    const body = await req.json().catch(() => ({}));
    const { action, params } = body;

    const userEmail = userData.user.email ?? null;

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
      case "simulate_one":
        result = await actionSimulateOne(supabase, params);
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
              batch_id: params?.batch_id ?? null,
            },
            response_payload: {
              success: !!(result as any)?.success,
              step: (result as any)?.step ?? null,
              error: (result as any)?.error ?? null,
              data: (result as any)?.data ?? null,
              raw: (result as any)?.raw ?? null,
            },
            cpf_masked: params?.cpf ? String(params.cpf).replace(/\d(?=\d{4})/g, "*") : null,
            config_id: params?.config_id ?? null,
            parcelas: params?.parcelas ?? null,
            step: (result as any)?.step ?? null,
            error: (result as any)?.error ?? null,
            released_value: (result as any)?.data?.released_value ?? null,
          },
        });
        if (params?.simulation_id) {
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
                amount_to_charge: (result as any).data.amount_to_charge,
                raw_response: (result as any).data.raw_response,
                processed_at: new Date().toISOString(),
              })
              .eq("id", params.simulation_id);
            if (params.batch_id) {
              await supabase.rpc("v8_increment_batch_success", {
                _batch_id: params.batch_id,
              });
            }
          } else {
            await supabase
              .from("v8_simulations")
              .update({
                status: "failed",
                error_message: String((result as any).error || "Erro desconhecido"),
                raw_response: (result as any).raw ?? null,
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
          },
        });
        break;
      case "list_batches":
        result = await actionListBatches(supabase, userId, isPriv);
        break;
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
});
