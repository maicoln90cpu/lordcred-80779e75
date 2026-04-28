// Edge Function: v8-webhook
// Recebe eventos da V8 Sistema (Crédito do Trabalhador):
//   POST /user/webhook/private-consignment/consult
//   POST /user/webhook/private-consignment/operation
//
// Comportamento:
//  1. Aceita POST sem JWT (a V8 não envia Authorization).
//  2. Persiste TODO evento bruto em v8_webhook_logs (auditoria + replay).
//  3. Trata `webhook.test` e `webhook.registered` (handshake da V8) atualizando
//     v8_webhook_registrations.
//  4. Para `private.consignment.consult.updated`: faz upsert em v8_simulations
//     por consult_id. Se não houver linha, cria uma "fora de lote" para o
//     CPF aparecer mesmo sem ter sido disparado por nós (caso Maicon).
//  5. Para `private.consignment.operation.created/updated`: upsert em
//     v8_operations_local.
//  6. Sempre responde 200 — falhar aqui faria a V8 reentregar e duplicar trabalho.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { writeAuditLog } from "../_shared/auditLog.ts";
import { packPayloadForAudit, safeHeaders } from "../_shared/v8AuditPayload.ts";
import {
  mapV8ConsultStatus,
  extractConsultExtras,
  applyConsultExtras,
  isKnownConsultStatus,
  isKnownOperationStatus,
} from "../_shared/v8Status.ts";
import { validateV8WebhookPayload } from "./payloadSchema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Wrapper para preservar nome legado nas chamadas internas. */
function mapV8StatusToInternal(v8Status?: string): string | null {
  return mapV8ConsultStatus(v8Status);
}

/**
 * Reprocessa um payload V8 dentro do mesmo handler (usado pelo replay_pending).
 * Retorna { processed, action, processError }.
 */
async function processV8Payload(
  supabase: any,
  payload: Record<string, unknown>,
  url: URL,
): Promise<{ processed: boolean; action: string; processError: string | null }> {
  const typeParam = (url.searchParams.get("type") || "").toLowerCase();
  const payloadType = String((payload as any)?.type ?? "").toLowerCase();
  const pathHint = url.pathname.toLowerCase();
  const eventType: "consult" | "operation" | "registration" =
    payloadType.startsWith("webhook.") ? "registration" :
    typeParam === "operation" || payloadType.includes("operation") || pathHint.includes("operation") || (payload as any)?.operationId
      ? "operation"
      : "consult";

  const consultId = String(
    (payload as any)?.consultId ??
      (payload as any)?.consult_id ??
      (payload as any)?.id ??
      "",
  ) || null;
  const operationId = String(
    (payload as any)?.operationId ?? (payload as any)?.operation_id ?? "",
  ) || null;
  const v8SimulationId = String(
    (payload as any)?.id_simulation ?? (payload as any)?.simulation_id ?? "",
  ) || null;
  const v8Status = String((payload as any)?.status ?? "") || null;

  let processed = false;
  let processError: string | null = null;
  let action = "noop";

  try {
    if (payloadType === "webhook.test" || payloadType === "webhook.registered") {
      const regType = typeParam === "operation" || pathHint.includes("operation") ? "operation" : "consult";
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payloadType === "webhook.test") {
        updates.last_test_received_at = new Date().toISOString();
        action = "test";
      } else {
        updates.last_confirm_received_at = new Date().toISOString();
        updates.last_status = "success";
        action = "registered";
      }
      await supabase.from("v8_webhook_registrations").update(updates).eq("webhook_type", regType);
      processed = true;
    } else if (eventType === "consult" && consultId) {
      const internalStatus = mapV8StatusToInternal(v8Status ?? undefined);
      const extras = extractConsultExtras(payload);

      // GUARD 1: ler estado atual antes de sobrescrever — webhook não pode regredir
      // (failed → pending) nem promover (any → success) sem valores monetários reais.
      const { data: currentRow } = await supabase
        .from("v8_simulations")
        .select("id, status, released_value, installment_value, simulation_strategy, installments, error_kind")
        .eq("consult_id", consultId)
        .maybeSingle();

      if (currentRow) {
        const safeUpdates: Record<string, unknown> = {
          raw_response: payload,
          last_webhook_at: new Date().toISOString(),
          webhook_status: v8Status,
        };
        applyConsultExtras(safeUpdates, extras);
        if (v8SimulationId) safeUpdates.v8_simulation_id = v8SimulationId;

        const wantsSuccess = internalStatus === "success";
        const wantsPending = internalStatus === "pending";
        const hasRealValues = currentRow.released_value != null && currentRow.installment_value != null;

        // ESTRATÉGIA webhook_only: o webhook V8 já traz simulationLimit (faixa).
        // Promovemos sim_value_max → released_value e sim_installments_max → installments
        // para que a tabela mostre o MÁXIMO da faixa (igual sistema antigo do print).
        // Isso é uma ESTIMATIVA — quando o operador rodar /simulate via "Simular selecionados",
        // os valores reais sobrescrevem.
        const isWebhookOnly = currentRow.simulation_strategy === "webhook_only";
        // CASO ESPECIAL active_consult: linha foi criada como pending pq outra plataforma
        // já tinha consulta rodando. Quando ESSA consulta concluir e a V8 nos avisar, promovemos
        // usando os campos do simulationLimit — exatamente como webhook_only. Comportamento
        // idêntico, apenas o gatilho é diferente.
        const isActiveConsultRecovery = currentRow.error_kind === "active_consult";
        const valueMax = extras.simValueMax;
        const instMax = extras.simInstallmentsMax;
        const canPromoteFromLimit = (isWebhookOnly || isActiveConsultRecovery)
          && valueMax != null && instMax != null;

        if (wantsSuccess && canPromoteFromLimit) {
          // Estima parcela: valueMax distribuído em instMax meses (sem juros — apenas referência visual).
          // O valor REAL vem do /simulate sob demanda.
          safeUpdates.released_value = valueMax;
          safeUpdates.installments = instMax;
          safeUpdates.installment_value = Number((valueMax / instMax).toFixed(2));
          safeUpdates.total_value = valueMax;
          safeUpdates.status = "success";
          safeUpdates.processed_at = new Date().toISOString();
          safeUpdates.simulate_status = "not_started"; // operador ainda pode "Simular" para ter valor real
          if (isActiveConsultRecovery) {
            safeUpdates.error_kind = null;
            safeUpdates.error_message = null;
          }
        } else if (wantsSuccess && hasRealValues) {
          // legacy_sync — valores já vieram do /simulate síncrono
          safeUpdates.status = "success";
          safeUpdates.processed_at = new Date().toISOString();
        } else if (internalStatus === "failed" && isActiveConsultRecovery) {
          // Consulta antiga foi rejeitada na V8 — promove a linha para failed com motivo claro
          safeUpdates.status = "failed";
          safeUpdates.error_message = "Consulta antiga rejeitada na V8";
          safeUpdates.processed_at = new Date().toISOString();
        } else if (internalStatus === "failed" && currentRow.status !== "success") {
          safeUpdates.status = "failed";
          safeUpdates.processed_at = new Date().toISOString();
        } else if (wantsPending && currentRow.status === "pending") {
          // mantém pending
        }

        const { error: updErr } = await supabase
          .from("v8_simulations")
          .update(safeUpdates)
          .eq("id", currentRow.id);

        if (updErr) processError = updErr.message;
        else { processed = true; action = canPromoteFromLimit && wantsSuccess ? (isActiveConsultRecovery ? "consult_promoted_active_consult" : "consult_promoted_webhook_only") : "consult_upsert"; }
      } else {
        // Sem linha local → cria "órfã" (CPF criado direto na V8, fora do simulador)
        const insertRow: Record<string, unknown> = {
          consult_id: consultId,
          v8_simulation_id: v8SimulationId,
          status: internalStatus ?? "pending",
          webhook_status: v8Status,
          last_webhook_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          raw_response: payload,
          name: "(via webhook V8)",
          cpf: "",
          installments: 0,
          is_orphan: true,
        };
        applyConsultExtras(insertRow, extras);
        const { error: insErr } = await supabase.from("v8_simulations").insert(insertRow);
        if (insErr) processError = insErr.message;
        else { processed = true; action = "consult_insert_orphan"; }
      }
    } else if (eventType === "operation" && operationId) {
      const { error: upErr } = await supabase
        .from("v8_operations_local")
        .upsert(
          {
            operation_id: operationId,
            consult_id: consultId,
            v8_simulation_id: v8SimulationId,
            status: v8Status,
            raw_payload: payload,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "operation_id" },
        );
      if (upErr) processError = upErr.message;
      else { processed = true; action = "operation_upsert"; }
    }
  } catch (err) {
    processError = (err as Error)?.message || String(err);
  }

  return { processed, action, processError };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // --- Action: replay_pending — reprocessa logs pendentes dos últimos 7 dias
  // Aceita POST com body { action: "replay_pending" } OU GET ?action=replay_pending
  const url = new URL(req.url);
  let actionParam = url.searchParams.get("action");
  let bodyForReplay: any = null;

  if (req.method === "POST") {
    try {
      const cloned = req.clone();
      const txt = await cloned.text();
      if (txt) {
        bodyForReplay = JSON.parse(txt);
        if (bodyForReplay?.action) actionParam = bodyForReplay.action;
      }
    } catch { /* não é JSON, segue fluxo de webhook */ }
  }

  if (actionParam === "replay_pending") {
    const limit = Math.min(Number(bodyForReplay?.limit ?? 500), 500);
    const { data: logs, error: logsErr } = await supabase
      .from("v8_webhook_logs")
      .select("id, payload")
      .eq("processed", false)
      .gte("received_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .order("received_at", { ascending: true })
      .limit(limit);

    if (logsErr) {
      return new Response(JSON.stringify({ ok: false, error: logsErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let success = 0;
    let failed = 0;
    for (const log of logs ?? []) {
      const result = await processV8Payload(supabase, (log.payload as any) ?? {}, url);
      if (result.processed && !result.processError) {
        await supabase
          .from("v8_webhook_logs")
          .update({ processed: true, process_error: null })
          .eq("id", log.id);
        success++;
      } else {
        await supabase
          .from("v8_webhook_logs")
          .update({ process_error: result.processError ?? "noop (no consult/operation id)" })
          .eq("id", log.id);
        failed++;
      }
    }

    await writeAuditLog(supabase, {
      action: "v8_webhook_replay_pending",
      category: "simulator",
      success: failed === 0,
      details: { total: logs?.length ?? 0, success, failed, limit },
    });

    return new Response(
      JSON.stringify({ ok: true, total: logs?.length ?? 0, success, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Coleta payload bruto + headers seguros
  let rawText = "";
  let payload: Record<string, unknown> = {};
  try {
    rawText = bodyForReplay ? JSON.stringify(bodyForReplay) : await req.text();
    payload = bodyForReplay ?? (rawText ? JSON.parse(rawText) : {});
  } catch (_) {
    payload = { _parse_error: true, raw: rawText.slice(0, 2000) };
  }

  const headersObj: Record<string, string> = {};
  for (const [k, v] of req.headers.entries()) {
    if (k.toLowerCase() === "authorization" || k.toLowerCase() === "cookie") continue;
    headersObj[k] = v;
  }

  // --- Validação Zod (etapa 2 / item 2): falha cedo em payloads malformados.
  // Sempre retornamos 200 — V8 não deve reentregar lixo. Apenas registramos
  // em audit_logs + v8_webhook_logs para diagnóstico no painel.
  const validation = validateV8WebhookPayload(payload);
  if (!validation.ok) {
    try {
      const { data: invalidLog } = await supabase
        .from("v8_webhook_logs")
        .insert({
          event_type: "invalid",
          status: validation.reason,
          payload,
          headers: headersObj,
          processed: false,
          process_error: `zod_invalid:${validation.reason} — ${validation.errors.join(" | ")}`,
        })
        .select("id")
        .single();

      await writeAuditLog(supabase, {
        action: "v8_webhook_invalid_payload",
        category: "simulator",
        success: false,
        targetTable: "v8_webhook_logs",
        targetId: invalidLog?.id ?? null,
        details: {
          reason: validation.reason,
          errors: validation.errors,
          headers_safe: safeHeaders(headersObj),
          webhook_log_id: invalidLog?.id ?? null,
          ...packPayloadForAudit(payload, "payload_full"),
        },
      });
    } catch (logErr) {
      console.error("v8-webhook: failed to log invalid payload", logErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        validation_error: {
          reason: validation.reason,
          errors: validation.errors,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // --- Tipo do evento (query param ?type=, payload.type ou heurística por path)
  const typeParam = (url.searchParams.get("type") || "").toLowerCase();
  const payloadType = String((payload as any)?.type ?? "").toLowerCase();
  const pathHint = url.pathname.toLowerCase();
  const eventType: "consult" | "operation" | "registration" =
    payloadType.startsWith("webhook.") ? "registration" :
    typeParam === "operation" || payloadType.includes("operation") || pathHint.includes("operation") || (payload as any)?.operationId
      ? "operation"
      : "consult";

  // --- IDs (aceita variações snake_case/camelCase observadas em produção)
  const consultId = String(
    (payload as any)?.consultId ??
      (payload as any)?.consult_id ??
      (payload as any)?.id ??
      "",
  ) || null;
  const operationId = String(
    (payload as any)?.operationId ?? (payload as any)?.operation_id ?? "",
  ) || null;
  const v8SimulationId = String(
    (payload as any)?.id_simulation ?? (payload as any)?.simulation_id ?? "",
  ) || null;
  const v8Status = String((payload as any)?.status ?? "") || null;

  // --- 1. Persiste log bruto sempre
  let logId: string | null = null;
  try {
    const { data: logRow } = await supabase
      .from("v8_webhook_logs")
      .insert({
        event_type: eventType,
        consult_id: consultId,
        operation_id: operationId,
        v8_simulation_id: v8SimulationId,
        status: v8Status ?? payloadType,
        payload,
        headers: headersObj,
      })
      .select("id")
      .single();
    logId = logRow?.id ?? null;
  } catch (err) {
    console.error("v8-webhook: failed to insert log", err);
  }

  let processed = false;
  let processError: string | null = null;
  let action: "test" | "registered" | "consult_upsert" | "consult_insert_orphan" | "operation_upsert" | "noop" = "noop";

  try {
    // --- 2. Handshake de registro (webhook.test / webhook.registered)
    if (payloadType === "webhook.test" || payloadType === "webhook.registered") {
      const regType = typeParam === "operation" || pathHint.includes("operation") ? "operation" : "consult";
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payloadType === "webhook.test") {
        updates.last_test_received_at = new Date().toISOString();
        action = "test";
      } else {
        updates.last_confirm_received_at = new Date().toISOString();
        updates.last_status = "success";
        action = "registered";
      }
      await supabase
        .from("v8_webhook_registrations")
        .update(updates)
        .eq("webhook_type", regType);
      processed = true;
    }
    // --- 3. Eventos de consulta — usa MESMO guard do processV8Payload
    else if (eventType === "consult" && consultId) {
      const internalStatus = mapV8StatusToInternal(v8Status ?? undefined);
      const extras = extractConsultExtras(payload);

      const { data: currentRow } = await supabase
        .from("v8_simulations")
        .select("id, status, released_value, installment_value, simulation_strategy, error_kind")
        .eq("consult_id", consultId)
        .maybeSingle();

      if (currentRow) {
        const safeUpdates: Record<string, unknown> = {
          raw_response: payload,
          last_webhook_at: new Date().toISOString(),
          webhook_status: v8Status,
        };
        applyConsultExtras(safeUpdates, extras);
        if (v8SimulationId) safeUpdates.v8_simulation_id = v8SimulationId;

        const wantsSuccess = internalStatus === "success";
        const wantsPending = internalStatus === "pending";
        const hasRealValues = currentRow.released_value != null && currentRow.installment_value != null;
        const isWebhookOnly = (currentRow as any).simulation_strategy === "webhook_only";
        const isActiveConsultRecovery = (currentRow as any).error_kind === "active_consult";
        const valueMax = extras.simValueMax;
        const instMax = extras.simInstallmentsMax;
        const canPromoteFromLimit = (isWebhookOnly || isActiveConsultRecovery)
          && valueMax != null && instMax != null;

        if (wantsSuccess && canPromoteFromLimit) {
          safeUpdates.released_value = valueMax;
          safeUpdates.installments = instMax;
          safeUpdates.installment_value = Number((valueMax / instMax).toFixed(2));
          safeUpdates.total_value = valueMax;
          safeUpdates.status = "success";
          safeUpdates.processed_at = new Date().toISOString();
          safeUpdates.simulate_status = "not_started";
          if (isActiveConsultRecovery) {
            safeUpdates.error_kind = null;
            safeUpdates.error_message = null;
          }
        } else if (wantsSuccess && hasRealValues) {
          safeUpdates.status = "success";
          safeUpdates.processed_at = new Date().toISOString();
        } else if (internalStatus === "failed" && isActiveConsultRecovery) {
          safeUpdates.status = "failed";
          safeUpdates.error_message = "Consulta antiga rejeitada na V8";
          safeUpdates.processed_at = new Date().toISOString();
        } else if (internalStatus === "failed" && currentRow.status !== "success") {
          safeUpdates.status = "failed";
          safeUpdates.processed_at = new Date().toISOString();
        } else if (wantsPending && currentRow.status === "pending") {
          // mantém pending
        }
        // Bloqueia: success sem valores; pending sobre failed/success.

        const { error: updErr } = await supabase
          .from("v8_simulations")
          .update(safeUpdates)
          .eq("id", currentRow.id);

        if (updErr) processError = updErr.message;
        else { processed = true; action = canPromoteFromLimit && wantsSuccess ? "consult_promoted_from_limit" : "consult_upsert"; }
      } else {
        // Sem linha local → cria "órfã" para o operador ver via tela de consultas/replay.
        // CRÍTICO: marcar is_orphan=true para satisfazer o check constraint
        // v8_sim_owner_or_orphan (is_orphan OR (batch_id IS NOT NULL AND created_by IS NOT NULL)).
        // Sem essa flag o INSERT é rejeitado e o evento é perdido (regressão histórica).
        const insertRow: Record<string, unknown> = {
          consult_id: consultId,
          v8_simulation_id: v8SimulationId,
          status: internalStatus ?? "pending",
          webhook_status: v8Status,
          last_webhook_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          raw_response: payload,
          name: "(via webhook V8)",
          cpf: "",
          installments: 0,
          is_orphan: true,
        };
        applyConsultExtras(insertRow, extras);
        const { error: insErr } = await supabase.from("v8_simulations").insert(insertRow);
        if (insErr) processError = insErr.message;
        else { processed = true; action = "consult_insert_orphan"; }
      }
    }
    // --- 4. Eventos de operação (proposta) — vocabulário oficial:
    // generating_ccb | formalization | analysis | manual_analysis | awaiting_call |
    // processing | paid | canceled | awaiting_cancel | pending | refunded | rejected
    else if (eventType === "operation" && operationId) {
      const opStatusKnown = isKnownOperationStatus(v8Status);
      const { error: upErr } = await supabase
        .from("v8_operations_local")
        .upsert(
          {
            operation_id: operationId,
            consult_id: consultId,
            v8_simulation_id: v8SimulationId,
            status: v8Status,
            raw_payload: payload,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "operation_id" },
        );
      if (upErr) processError = upErr.message;
      else {
        processed = true;
        action = "operation_upsert";
        if (!opStatusKnown && v8Status) {
          // Não bloqueia, só anota — assim a doc oficial pode evoluir e nós descobrimos.
          processError = `unknown_operation_status:${v8Status}`;
        }
      }
    }
    // --- 5. Status de consulta desconhecido (defensivo)
    else if (eventType === "consult" && v8Status && !isKnownConsultStatus(v8Status)) {
      processError = `unknown_consult_status:${v8Status}`;
    }
  } catch (err) {
    processError = (err as Error)?.message || String(err);
  }

  // --- Marca log como processado (best-effort)
  if (logId) {
    await supabase
      .from("v8_webhook_logs")
      .update({ processed, process_error: processError })
      .eq("id", logId)
      .then(() => undefined, () => undefined);
  }

  // --- Auditoria estruturada (apenas para eventos reais, não handshake de teste)
  if (action !== "test" && action !== "registered") {
    await writeAuditLog(supabase, {
      action: `v8_webhook_${eventType}`,
      category: "simulator",
      success: processed && !processError,
      targetTable: eventType === "operation" ? "v8_operations_local" : "v8_simulations",
      targetId: consultId ?? operationId,
      details: {
        action,
        consult_id: consultId,
        operation_id: operationId,
        v8_simulation_id: v8SimulationId,
        v8_status: v8Status,
        payload_type: payloadType,
        processed,
        process_error: processError,
        payload_keys: Object.keys(payload || {}),
        headers_safe: safeHeaders(headersObj),
        webhook_log_id: logId,
        ...packPayloadForAudit(payload, "payload_full"),
      },
    });
  }

  // --- Sempre 200 (V8 não deve reentregar)
  return new Response(
    JSON.stringify({ ok: true, processed, action, log_id: logId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
