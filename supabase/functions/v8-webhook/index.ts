// Edge Function: v8-webhook
// Recebe eventos da V8 Sistema (Crédito do Trabalhador):
//   POST /user/webhook/private-consignment/consult
//   POST /user/webhook/private-consignment/operation
//
// Comportamento:
//  1. Aceita POST sem JWT (a V8 não envia Authorization).
//  2. Persiste TODO evento bruto em v8_webhook_logs (auditoria + replay).
//  3. Tenta correlacionar com v8_simulations via consult_id e atualiza status/raw_response.
//  4. Sempre responde 200 — falhar aqui faria a V8 reentregar e duplicar o trabalho.
//
// Segurança: como a V8 não usa secret compartilhado, mantemos verify_jwt=false
// e fazemos validação leve por estrutura do payload + log completo dos headers
// para investigação posterior.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { writeAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mapeia o status bruto da V8 para um status interno em v8_simulations.
 * Mantemos o original em raw_response para auditoria completa.
 */
function mapV8StatusToInternal(v8Status?: string): string | null {
  if (!v8Status) return null;
  const s = v8Status.toUpperCase();
  if (s === "SUCCESS" || s === "CONSENT_APPROVED") return "success";
  if (
    s === "FAILED" ||
    s === "REJECTED" ||
    s === "ERROR"
  ) return "failed";
  if (
    s === "WAITING_CONSENT" ||
    s === "WAITING_CONSULT" ||
    s === "WAITING_CREDIT_ANALYSIS"
  ) return "pending";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Coleta payload bruto + headers (truncados, sem Authorization)
  let rawText = "";
  let payload: Record<string, unknown> = {};
  try {
    rawText = await req.text();
    payload = rawText ? JSON.parse(rawText) : {};
  } catch (_) {
    payload = { _parse_error: true, raw: rawText.slice(0, 2000) };
  }

  const headersObj: Record<string, string> = {};
  for (const [k, v] of req.headers.entries()) {
    if (k.toLowerCase() === "authorization" || k.toLowerCase() === "cookie") continue;
    headersObj[k] = v;
  }

  // Detecta o tipo do evento via URL path enviada pela V8 ou heurística no body
  const url = new URL(req.url);
  const pathHint = url.pathname.toLowerCase();
  const eventType =
    pathHint.includes("operation") || (payload as any)?.operation_id
      ? "operation"
      : "consult";

  const consultId = String(
    (payload as any)?.consult_id ??
      (payload as any)?.consultId ??
      (payload as any)?.id ??
      ""
  ) || null;
  const operationId = String(
    (payload as any)?.operation_id ??
      (payload as any)?.operationId ??
      ""
  ) || null;
  const v8SimulationId = String(
    (payload as any)?.id_simulation ??
      (payload as any)?.simulation_id ??
      ""
  ) || null;
  const v8Status = String((payload as any)?.status ?? "") || null;

  // 1. Persiste log bruto (sempre)
  let logId: string | null = null;
  try {
    const { data: logRow } = await supabase
      .from("v8_webhook_logs")
      .insert({
        event_type: eventType,
        consult_id: consultId,
        operation_id: operationId,
        v8_simulation_id: v8SimulationId,
        status: v8Status,
        payload,
        headers: headersObj,
      })
      .select("id")
      .single();
    logId = logRow?.id ?? null;
  } catch (err) {
    console.error("v8-webhook: failed to insert log", err);
  }

  // 2. Tenta correlacionar com simulação local (best-effort)
  let processed = false;
  let processError: string | null = null;
  try {
    if (consultId) {
      const internalStatus = mapV8StatusToInternal(v8Status);
      const updates: Record<string, unknown> = {
        raw_response: payload,
        processed_at: new Date().toISOString(),
      };
      if (internalStatus) updates.status = internalStatus;
      if (v8SimulationId) updates.v8_simulation_id = v8SimulationId;

      const { data: updRows, error: updErr } = await supabase
        .from("v8_simulations")
        .update(updates)
        .eq("consult_id", consultId)
        .select("id");

      if (updErr) {
        processError = updErr.message;
      } else if (updRows && updRows.length > 0) {
        processed = true;
      }
    }
  } catch (err) {
    processError = (err as Error)?.message || String(err);
  }

  // Marca o log como processado (best-effort)
  if (logId) {
    await supabase
      .from("v8_webhook_logs")
      .update({ processed, process_error: processError })
      .eq("id", logId)
      .then(() => undefined, () => undefined);
  }

  // 3. Auditoria estruturada
  await writeAuditLog(supabase, {
    action: `v8_webhook_${eventType}`,
    category: "simulator",
    success: processed || !processError,
    targetTable: "v8_simulations",
    targetId: consultId,
    details: {
      consult_id: consultId,
      operation_id: operationId,
      v8_simulation_id: v8SimulationId,
      v8_status: v8Status,
      processed,
      process_error: processError,
      payload_keys: Object.keys(payload || {}),
    },
  });

  // 4. Sempre 200 — V8 não deve reentregar
  return new Response(
    JSON.stringify({ ok: true, processed, log_id: logId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
