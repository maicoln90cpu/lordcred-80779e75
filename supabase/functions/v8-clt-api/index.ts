import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const V8_BASE = "https://bff.v8sistema.com";
const V8_AUTH = "https://auth.v8sistema.com";

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
  const resp = await v8Fetch("/products/clt/configs", { method: "GET" });
  if (!resp.ok) {
    const err = await resp.text();
    return { success: false, error: `V8 get_configs: ${resp.status} - ${err}` };
  }
  const data = await resp.json();
  const configs = Array.isArray(data) ? data : data?.data ?? data?.items ?? [];

  if (Array.isArray(configs) && configs.length > 0) {
    for (const c of configs) {
      const config_id = String(c.id ?? c.configId ?? c.code ?? "");
      if (!config_id) continue;
      await supabase
        .from("v8_configs_cache")
        .upsert(
          {
            config_id,
            name: String(c.name ?? c.label ?? c.description ?? "Sem nome"),
            bank_name: c.bank ?? c.bankName ?? null,
            product_type: c.productType ?? c.product ?? "clt",
            min_value: c.minValue ?? null,
            max_value: c.maxValue ?? null,
            min_term: c.minTerm ?? c.minInstallments ?? null,
            max_term: c.maxTerm ?? c.maxInstallments ?? null,
            is_active: true,
            raw_data: c,
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
  config_id: string;
  parcelas: number;
  batch_id?: string;
  simulation_id?: string;
}

async function actionSimulateOne(supabase: any, input: SimulateInput) {
  const cpf = (input.cpf || "").replace(/\D/g, "");
  if (cpf.length !== 11) return { success: false, error: "CPF inválido" };

  const consultBody = {
    document: cpf,
    name: input.nome ?? null,
    birthDate: input.data_nascimento ?? null,
  };
  const consultResp = await v8Fetch("/products/clt/consult", {
    method: "POST",
    body: JSON.stringify(consultBody),
  });
  const consultJson = await consultResp.json().catch(() => ({}));
  if (!consultResp.ok) {
    return {
      success: false,
      step: "consult",
      error: consultJson?.message || `Status ${consultResp.status}`,
      raw: consultJson,
    };
  }

  const authResp = await v8Fetch("/products/clt/authorize", {
    method: "POST",
    body: JSON.stringify({ document: cpf }),
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

  const simResp = await v8Fetch("/products/clt/simulate", {
    method: "POST",
    body: JSON.stringify({
      document: cpf,
      configId: input.config_id,
      installments: input.parcelas,
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
  const released_value = Number(
    result?.netAmount ?? result?.releasedValue ?? result?.valorLiberado ?? 0
  );
  const installment_value = Number(
    result?.installmentAmount ?? result?.parcelValue ?? result?.valorParcela ?? 0
  );
  const interest_rate = Number(
    result?.interestRate ?? result?.rate ?? result?.taxa ?? 0
  );
  const total_value = Number(
    result?.totalAmount ?? result?.valorTotal ?? installment_value * input.parcelas
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

    let result;
    switch (action) {
      case "get_configs":
        result = await actionGetConfigs(supabase);
        break;
      case "simulate_one":
        result = await actionSimulateOne(supabase, params);
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
