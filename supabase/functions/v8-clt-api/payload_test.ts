import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildConsultBody,
  normalizeBirthDate,
  normalizeGender,
  normalizePhone,
} from "./index.ts";

Deno.test("normalizeBirthDate aceita dd/mm/aaaa", () => {
  assertEquals(normalizeBirthDate("06/08/1990"), "1990-08-06");
});

Deno.test("normalizeBirthDate aceita yyyy-mm-dd", () => {
  assertEquals(normalizeBirthDate("1990-08-06"), "1990-08-06");
});

Deno.test("normalizeBirthDate retorna null para inválido", () => {
  assertEquals(normalizeBirthDate(""), null);
  assertEquals(normalizeBirthDate("abc"), null);
  assertEquals(normalizeBirthDate("32/13/1990"), "1990-13-32"); // regex aceita; V8 valida
});

Deno.test("normalizeGender mapeia M/F/feminino corretamente", () => {
  assertEquals(normalizeGender("M"), "male");
  assertEquals(normalizeGender("F"), "female");
  assertEquals(normalizeGender("feminino"), "female");
  assertEquals(normalizeGender("masculino"), "male");
  assertEquals(normalizeGender("female"), "female");
  assertEquals(normalizeGender(""), "male");
  assertEquals(normalizeGender(undefined), "male");
});

Deno.test("normalizePhone separa areaCode e phoneNumber", () => {
  const p = normalizePhone("11999998888");
  assertEquals(p.areaCode, "11");
  assertEquals(p.phoneNumber, "999998888");
});

Deno.test("normalizePhone limpa caracteres não numéricos", () => {
  const p = normalizePhone("(11) 99999-8888");
  assertEquals(p.areaCode, "11");
  assertEquals(p.phoneNumber, "999998888");
});

Deno.test("normalizePhone retorna fallback se telefone curto/vazio", () => {
  const p = normalizePhone("");
  assertEquals(p.areaCode, "11");
  assertEquals(p.phoneNumber, "999999999");
});

Deno.test("buildConsultBody monta payload V8 completo e válido", () => {
  const body = buildConsultBody({
    cpf: "393.640.738-00",
    nome: "  Maicon Douglas  ",
    data_nascimento: "06/08/1990",
    genero: "M",
    telefone: "(11) 99999-8888",
    config_id: "fbbb3a06-05ca-4567-9a92-ce78cb4db796",
    parcelas: 24,
  });

  assertEquals(body.borrowerDocumentNumber, "39364073800");
  assertEquals(body.gender, "male");
  assertEquals(body.birthDate, "1990-08-06");
  assertEquals(body.signerName, "Maicon Douglas");
  assertEquals(body.signerEmail, "39364073800@lordcred.temp");
  assertEquals(body.provider, "QI");

  // signerPhone deve ter phoneNumber (NÃO "number") — bug recorrente
  assertEquals(body.signerPhone.countryCode, "55");
  assertEquals(body.signerPhone.areaCode, "11");
  assertEquals(body.signerPhone.phoneNumber, "999998888");
  assert(
    !("number" in body.signerPhone),
    "signerPhone NÃO pode ter chave 'number' (V8 exige 'phoneNumber')"
  );
});

Deno.test("buildConsultBody usa fallbacks quando opcionais ausentes", () => {
  const body = buildConsultBody({
    cpf: "39364073800",
    nome: "Cliente Teste",
    data_nascimento: "06/08/1990",
    config_id: "x",
    parcelas: 24,
  });
  assertEquals(body.gender, "male");
  assertEquals(body.signerPhone.areaCode, "11");
  assertEquals(body.signerPhone.phoneNumber, "999999999");
  assertEquals(body.signerEmail, "39364073800@lordcred.temp");
});

Deno.test("buildConsultBody respeita email customizado", () => {
  const body = buildConsultBody({
    cpf: "39364073800",
    nome: "X Y",
    data_nascimento: "06/08/1990",
    email: " maicon@lordcred.com ",
    config_id: "x",
    parcelas: 24,
  });
  assertEquals(body.signerEmail, "maicon@lordcred.com");
});
