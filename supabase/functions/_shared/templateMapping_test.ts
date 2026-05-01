import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  replaceVariables,
  resolveParameter,
  applyComponentMapping,
  suggestAutoMapping,
} from "./templateMapping.ts";

Deno.test("replaceVariables — substitutes named keys case-insensitive", () => {
  const out = replaceVariables("Olá {{nome}}, seu CPF {{CPF}}", { nome: "João", cpf: "123" });
  assertEquals(out, "Olá João, seu CPF 123");
});

Deno.test("replaceVariables — keeps placeholder when value missing or empty", () => {
  assertEquals(replaceVariables("Oi {{nome}}", { nome: null }), "Oi {{nome}}");
  assertEquals(replaceVariables("Oi {{nome}}", { nome: "" }), "Oi {{nome}}");
  assertEquals(replaceVariables("Oi {{nome}}", {}), "Oi {{nome}}");
});

Deno.test("resolveParameter — text type applies {{var}} substitution from lead", () => {
  const r = resolveParameter({ type: "text", text: "Olá {{nome}}" }, { nome: "Maria" });
  assertEquals(r, { type: "text", text: "Olá Maria" });
});

Deno.test("resolveParameter — lead_field replaces by lead value", () => {
  const r = resolveParameter({ type: "lead_field", field: "nome" }, { nome: "Carlos" });
  assertEquals(r, { type: "text", text: "Carlos" });
});

Deno.test("resolveParameter — lead_field falls back to em-dash when null", () => {
  const r = resolveParameter({ type: "lead_field", field: "nome" }, { nome: null });
  assertEquals(r, { type: "text", text: "—" });
});

Deno.test("resolveParameter — lead_field falls back when lead is null", () => {
  const r = resolveParameter({ type: "lead_field", field: "nome" }, null);
  assertEquals(r, { type: "text", text: "—" });
});

Deno.test("applyComponentMapping — substitutes nested params with lead data", () => {
  const components = [
    { type: "header", parameters: [{ type: "text", text: "Pedido {{id}}" }] },
    { type: "body", parameters: [
      { type: "lead_field", field: "nome" },
      { type: "text", text: "fixo" },
    ]},
  ];
  const result = applyComponentMapping(components as any, { nome: "Ana", id: "42" });
  assertEquals(result[0].parameters?.[0], { type: "text", text: "Pedido 42" });
  assertEquals(result[1].parameters?.[0], { type: "text", text: "Ana" });
  assertEquals(result[1].parameters?.[1], { type: "text", text: "fixo" });
});

Deno.test("applyComponentMapping — returns deep copy (does not mutate input)", () => {
  const original = [{ type: "body", parameters: [{ type: "lead_field", field: "nome" }] }];
  applyComponentMapping(original as any, { nome: "X" });
  assertEquals(original[0].parameters?.[0], { type: "lead_field", field: "nome" });
});

Deno.test("applyComponentMapping — handles null/undefined gracefully", () => {
  assertEquals(applyComponentMapping(null, { nome: "x" }), []);
  assertEquals(applyComponentMapping(undefined, { nome: "x" }), []);
});

Deno.test("suggestAutoMapping — returns 'nome' for single-var greeting", () => {
  assertEquals(suggestAutoMapping("Olá {{1}}, tudo bem?", 1), "nome");
  assertEquals(suggestAutoMapping("Bom dia {{1}}", 1), "nome");
});

Deno.test("suggestAutoMapping — returns null for non-greeting or multiple vars", () => {
  assertEquals(suggestAutoMapping("Seu pedido {{1}} foi enviado", 1), null);
  assertEquals(suggestAutoMapping("Olá {{1}}, valor {{2}}", 2), null);
});
