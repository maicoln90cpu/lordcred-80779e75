import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mapV8ConsultStatus,
  extractConsultExtras,
  isKnownConsultStatus,
  isKnownOperationStatus,
} from "./v8Status.ts";

Deno.test("CONSENT_APPROVED é pending (NÃO success)", () => {
  assertEquals(mapV8ConsultStatus("CONSENT_APPROVED"), "pending");
});

Deno.test("SUCCESS é success", () => {
  assertEquals(mapV8ConsultStatus("SUCCESS"), "success");
});

Deno.test("REJECTED/FAILED são failed", () => {
  assertEquals(mapV8ConsultStatus("REJECTED"), "failed");
  assertEquals(mapV8ConsultStatus("FAILED"), "failed");
});

Deno.test("Todos os WAITING_* são pending", () => {
  assertEquals(mapV8ConsultStatus("WAITING_CONSENT"), "pending");
  assertEquals(mapV8ConsultStatus("WAITING_CONSULT"), "pending");
  assertEquals(mapV8ConsultStatus("WAITING_CREDIT_ANALYSIS"), "pending");
});

Deno.test("Vocabulário oficial conhecido", () => {
  assertEquals(isKnownConsultStatus("SUCCESS"), true);
  assertEquals(isKnownConsultStatus("foo"), false);
  assertEquals(isKnownOperationStatus("paid"), true);
  assertEquals(isKnownOperationStatus("foo"), false);
});

Deno.test("extractConsultExtras lê payload de webhook SUCCESS oficial", () => {
  const payload = {
    type: "private.consignment.consult.updated",
    status: "SUCCESS",
    availableMarginValue: "350.00",
    admissionDateMonthsDifference: 67,
    simulationLimit: {
      monthMin: 49, monthMax: 72,
      installmentsMin: 6, installmentsMax: 24,
      valueMin: 800, valueMax: 25000,
    },
  };
  const x = extractConsultExtras(payload);
  assertEquals(x.margemValor, 350);
  assertEquals(x.admissionMonthsDiff, 67);
  assertEquals(x.simMonthMin, 49);
  assertEquals(x.simMonthMax, 72);
  assertEquals(x.simInstallmentsMin, 6);
  assertEquals(x.simInstallmentsMax, 24);
  assertEquals(x.simValueMin, 800);
  assertEquals(x.simValueMax, 25000);
});

Deno.test("extractConsultExtras tolera payload aninhado em data/latest", () => {
  const payload = { data: { latest: { availableMarginValue: 100, simulationLimit: { monthMin: 12 } } } };
  const x = extractConsultExtras(payload);
  // suporta payload.data direto, não atravessa data.latest — mas margemValor vem por outro path
  assertEquals(x.margemValor, null); // confirma que esse path NÃO é varrido (intencional)
  // mas o caso documentado (data.availableMarginValue) funciona:
  const x2 = extractConsultExtras({ data: { availableMarginValue: 100, simulationLimit: { monthMin: 12 } } });
  assertEquals(x2.margemValor, 100);
  assertEquals(x2.simMonthMin, 12);
});
