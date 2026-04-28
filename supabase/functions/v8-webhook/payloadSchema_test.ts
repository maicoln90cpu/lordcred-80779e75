// Testes Deno do schema Zod do webhook V8.
// Roda automaticamente no `supabase--test_edge_functions`.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateV8WebhookPayload } from "./payloadSchema.ts";

Deno.test("aceita handshake webhook.test", () => {
  const r = validateV8WebhookPayload({ type: "webhook.test" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.kind, "handshake");
});

Deno.test("aceita handshake webhook.registered", () => {
  const r = validateV8WebhookPayload({ type: "webhook.registered" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.kind, "handshake");
});

Deno.test("aceita evento de consulta com consultId", () => {
  const r = validateV8WebhookPayload({
    consultId: "abc-123",
    status: "SUCCESS",
    availableMarginValue: "150.00",
  });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.kind, "consult");
});

Deno.test("aceita evento de consulta com consult_id (snake_case)", () => {
  const r = validateV8WebhookPayload({ consult_id: "abc-123", status: "FAILED" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.kind, "consult");
});

Deno.test("aceita evento de operação com operationId", () => {
  const r = validateV8WebhookPayload({ operationId: "op-1", status: "paid" });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.kind, "operation");
});

Deno.test("rejeita payload vazio", () => {
  const r = validateV8WebhookPayload({});
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "empty_payload");
});

Deno.test("rejeita array no top-level", () => {
  const r = validateV8WebhookPayload([{ consultId: "x" }]);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "not_object");
});

Deno.test("rejeita string que não é JSON", () => {
  const r = validateV8WebhookPayload("isso não é json {");
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "parse_error");
});

Deno.test("rejeita null", () => {
  const r = validateV8WebhookPayload(null);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "not_object");
});

Deno.test("rejeita objeto sem identificador nem handshake", () => {
  const r = validateV8WebhookPayload({ status: "SUCCESS", foo: "bar" });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "no_identifier");
});

Deno.test("aceita string JSON válida", () => {
  const r = validateV8WebhookPayload('{"consultId":"x","status":"SUCCESS"}');
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.kind, "consult");
});
