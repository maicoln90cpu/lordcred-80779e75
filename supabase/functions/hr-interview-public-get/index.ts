import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ||
      (req.method === "POST"
        ? (await req.json().catch(() => ({}))).token
        : null);

    if (!token || typeof token !== "string" || token.length < 8) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("hr_interview_tokens")
      .select("id, interview_id, candidate_id, stage, expires_at, used_at, is_active")
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

    // Get candidate basic info
    const { data: candidate } = await supabase
      .from("hr_candidates")
      .select("id, full_name")
      .eq("id", tokenRow.candidate_id)
      .maybeSingle();

    // Get questions for this stage
    const { data: questions } = await supabase
      .from("hr_questions")
      .select("id, text, order_num, stage")
      .eq("stage", tokenRow.stage)
      .order("order_num", { ascending: true });

    // Existing answers (if interview was already partially answered)
    const { data: answers } = await supabase
      .from("hr_interview_answers")
      .select("question_id, answer")
      .eq("interview_id", tokenRow.interview_id);

    const answersMap: Record<string, string> = {};
    (answers || []).forEach((a: any) => {
      if (a.question_id) answersMap[a.question_id] = a.answer || "";
    });

    return new Response(
      JSON.stringify({
        success: true,
        already_submitted: !!tokenRow.used_at,
        candidate: candidate ? { id: candidate.id, full_name: candidate.full_name } : null,
        stage: tokenRow.stage,
        questions: questions || [],
        answers: answersMap,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("hr-interview-public-get error:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
