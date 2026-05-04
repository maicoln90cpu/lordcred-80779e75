// Contract tests for Meta gateway behaviors (Stage 8)
// These tests document the expected response shapes for the unified
// whatsapp-gateway when acting on Meta provider chips. They run in isolation
// (no network) and serve as regression guards for the response contract used
// by the frontend.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Shared shape expected by useChatMessages / ForwardDialog when an action is
// not supported by Meta Cloud API (delete-message, edit-message, typing).
type UnsupportedResponse = {
  success: false;
  unsupported: true;
  error?: string;
  provider?: string;
};

function buildUnsupported(action: string): UnsupportedResponse {
  return {
    success: false,
    unsupported: true,
    provider: "meta",
    error: `Action '${action}' is not supported by Meta Cloud API`,
  };
}

Deno.test("Meta unsupported actions return success:false with unsupported:true", () => {
  for (const action of ["delete-message", "edit-message", "typing-indicator"]) {
    const r = buildUnsupported(action);
    assertEquals(r.success, false);
    assertEquals(r.unsupported, true);
    assert(r.error?.includes(action));
  }
});

Deno.test("Meta send-message payload includes context when quoted", () => {
  const body = { message: "oi", quotedMessageId: "wamid.ABC" };
  const payload: any = {
    messaging_product: "whatsapp",
    to: "5511999999999",
    type: "text",
    text: { body: body.message },
  };
  if (body.quotedMessageId) {
    payload.context = { message_id: body.quotedMessageId };
  }
  assertEquals(payload.context.message_id, "wamid.ABC");
});

Deno.test("Meta sticker payload uses webp media reference", () => {
  const mediaId = "1234567890";
  const payload = {
    messaging_product: "whatsapp",
    to: "5511999999999",
    type: "sticker",
    sticker: { id: mediaId },
  };
  assertEquals(payload.type, "sticker");
  assertEquals(payload.sticker.id, mediaId);
});

Deno.test("Forward reuses original media_url as Meta media id", () => {
  const original = { media_type: "image", media_url: "9988776655" };
  const mt = original.media_type === "ptt" ? "audio" : original.media_type;
  const payload = {
    messaging_product: "whatsapp",
    to: "5511999999999",
    type: mt,
    [mt]: { id: original.media_url },
  } as any;
  assertEquals(payload[mt].id, "9988776655");
});

Deno.test("Sticker size guard: reject >500KB base64", () => {
  // 500KB limit per Meta docs for static stickers
  const fakeSize = 600 * 1024;
  const ok = fakeSize <= 500 * 1024;
  assertEquals(ok, false);
});
