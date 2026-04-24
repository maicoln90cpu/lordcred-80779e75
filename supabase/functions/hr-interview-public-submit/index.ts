import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AnswerInput {
  question_id: string;
  answer: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { token, answers } = body as {
      token?: string;
      answers?: AnswerInput[];
    };

    if (!token || typeof token !== "string" || token.length < 8) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: "Respostas inválidas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("hr_interview_tokens")
      .select("id, interview_id, candidate_id, stage, expires_at, is_active, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "Link não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tokenRow.is_active) {
      return new Response(
        JSON.stringify({ error: "Link revogado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Link expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch all questions for this stage to validate question_ids and snapshot text
    const { data: questions } = await supabase
      .from("hr_questions")
      .select("id, text, stage")
      .eq("stage", tokenRow.stage);

    const validQuestionMap = new Map<string, string>();
    (questions || []).forEach((q: any) => validQuestionMap.set(q.id, q.text));

    // Filter to only valid question_ids and sanitize answers
    const sanitized = answers
      .filter((a) => a && typeof a.question_id === "string" && validQuestionMap.has(a.question_id))
      .map((a) => ({
        interview_id: tokenRow.interview_id,
        question_id: a.question_id,
        answer: typeof a.answer === "string" ? a.answer.slice(0, 5000) : "",
        question_text_snapshot: validQuestionMap.get(a.question_id) || null,
      }));

    if (sanitized.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma resposta válida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete existing answers for this interview, then insert fresh
    const { error: delErr } = await supabase
      .from("hr_interview_answers")
      .delete()
      .eq("interview_id", tokenRow.interview_id);

    if (delErr) {
      console.error("delete answers error:", delErr);
      return new Response(
        JSON.stringify({ error: "Erro ao limpar respostas anteriores" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insErr } = await supabase
      .from("hr_interview_answers")
      .insert(sanitized);

    if (insErr) {
      console.error("insert answers error:", insErr);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar respostas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark token as used (but keep active=true so candidate can review until revoked)
    await supabase
      .from("hr_interview_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Fire-and-forget: notify the HR group channel in internal chat.
    // The token row carries created_by — use it as message author when available.
    try {
      const { data: tokenFull } = await supabase
        .from("hr_interview_tokens")
        .select("created_by")
        .eq("id", tokenRow.id)
        .maybeSingle();

      await supabase.rpc("hr_notify_interview_submitted", {
        _candidate_id: tokenRow.candidate_id,
        _stage: tokenRow.stage,
        _author_id: tokenFull?.created_by ?? null,
      });
    } catch (notifyErr) {
      console.warn("hr_notify_interview_submitted failed:", notifyErr);
    }

    return new Response(
      JSON.stringify({ success: true, saved: sanitized.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("hr-interview-public-submit error:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
