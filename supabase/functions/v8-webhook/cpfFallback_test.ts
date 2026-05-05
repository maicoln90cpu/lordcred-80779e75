import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractCpfFromPayload,
  isValidCpf,
  isWithinFallbackWindow,
  isCandidateEligible,
  type FallbackCandidate,
} from "./cpfFallback.ts";

Deno.test("extractCpfFromPayload - data.document", () => {
  assertEquals(extractCpfFromPayload({ data: { document: "123.456.789-09" } }), "12345678909");
});

Deno.test("extractCpfFromPayload - workerData.document raiz", () => {
  assertEquals(extractCpfFromPayload({ workerData: { document: "98765432100" } }), "98765432100");
});

Deno.test("extractCpfFromPayload - data.workerData.document aninhado", () => {
  assertEquals(extractCpfFromPayload({ data: { workerData: { document: "111.222.333-44" } } }), "11122233344");
});

Deno.test("extractCpfFromPayload - vazio retorna string vazia", () => {
  assertEquals(extractCpfFromPayload({}), "");
  assertEquals(extractCpfFromPayload(null), "");
});

Deno.test("isValidCpf - aceita 11 dígitos", () => {
  assert(isValidCpf("12345678909"));
});

Deno.test("isValidCpf - rejeita formatos inválidos", () => {
  assert(!isValidCpf(""));
  assert(!isValidCpf("123"));
  assert(!isValidCpf("12345678901234"));
  assert(!isValidCpf("abc12345678"));
});

Deno.test("isWithinFallbackWindow - dentro de 15 min", () => {
  const now = Date.now();
  const created = new Date(now - 5 * 60 * 1000).toISOString();
  assert(isWithinFallbackWindow(created, now));
});

Deno.test("isWithinFallbackWindow - fora de 15 min", () => {
  const now = Date.now();
  const created = new Date(now - 20 * 60 * 1000).toISOString();
  assert(!isWithinFallbackWindow(created, now));
});

Deno.test("isWithinFallbackWindow - data inválida retorna false", () => {
  assert(!isWithinFallbackWindow("not-a-date"));
});

const baseCandidate = (overrides: Partial<FallbackCandidate> = {}): FallbackCandidate => ({
  id: "sim-1",
  cpf: "12345678909",
  status: "pending",
  consult_id: null,
  batch_id: "batch-1",
  created_at: new Date().toISOString(),
  ...overrides,
});

Deno.test("isCandidateEligible - candidato válido passa", () => {
  assert(isCandidateEligible(baseCandidate()));
});

Deno.test("isCandidateEligible - status diferente de pending falha", () => {
  assert(!isCandidateEligible(baseCandidate({ status: "success" })));
  assert(!isCandidateEligible(baseCandidate({ status: "failed" })));
});

Deno.test("isCandidateEligible - já tem consult_id falha", () => {
  assert(!isCandidateEligible(baseCandidate({ consult_id: "abc" })));
});

Deno.test("isCandidateEligible - sem batch_id falha (órfã, não casa)", () => {
  assert(!isCandidateEligible(baseCandidate({ batch_id: null })));
});

Deno.test("isCandidateEligible - CPF inválido falha", () => {
  assert(!isCandidateEligible(baseCandidate({ cpf: "123" })));
});

Deno.test("isCandidateEligible - mais antigo que 15 min falha", () => {
  const old = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  assert(!isCandidateEligible(baseCandidate({ created_at: old })));
});
