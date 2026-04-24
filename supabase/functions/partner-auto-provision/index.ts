// Edge function: cria usuário automaticamente quando um parceiro é aprovado (pipeline_status='ativo').
// Disparada via trigger DB notify_partner_approved + pg_net.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "12345";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Resposta segura: nunca quebra o save do parceiro — sempre 200
  const ok = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const partnerId = String(body?.partner_id || "").trim();

    if (!partnerId) {
      return ok({ success: false, fallback: true, error: "partner_id ausente" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Carregar parceiro (inclui pix_pj)
    const { data: partner, error: partErr } = await admin
      .from("partners")
      .select("id, nome, email, auto_user_id, pix_pj, cnpj, cpf")
      .eq("id", partnerId)
      .maybeSingle();

    if (partErr || !partner) {
      return ok({ success: false, fallback: true, error: "parceiro não encontrado" });
    }

    if (partner.auto_user_id) {
      return ok({ success: true, already_provisioned: true, user_id: partner.auto_user_id });
    }

    const email = String(partner.email || "").trim().toLowerCase();
    const nome = String(partner.nome || "").trim();
    if (!email) {
      return ok({ success: false, fallback: true, error: "parceiro sem email" });
    }

    // 2) Verificar se o email já existe em auth.users (lista paginada)
    let existingUserId: string | null = null;
    let page = 1;
    while (true) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) break;
      const found = list.users.find((u) => (u.email || "").toLowerCase() === email);
      if (found) { existingUserId = found.id; break; }
      if (list.users.length < 200) break;
      page += 1;
      if (page > 25) break; // segurança
    }

    let userId = existingUserId;
    let created = false;

    if (!userId) {
      // 3) Criar usuário com senha padrão
      const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { name: nome, source: "partner_auto_provision" },
      });
      if (createErr || !createRes?.user) {
        return ok({ success: false, fallback: true, error: createErr?.message || "falha ao criar usuário" });
      }
      userId = createRes.user.id;
      created = true;
    }

    // 4) Garantir profile (handle_new_user pode ter criado, mas garantimos nome + must_change_password)
    await admin
      .from("profiles")
      .upsert(
        { user_id: userId, email, name: nome || email, must_change_password: created },
        { onConflict: "user_id" },
      );

    // 5) Garantir role 'seller' (ignora se já existir pela UNIQUE)
    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "seller" }, { onConflict: "user_id,role" });

    // 6) Vincular auto_user_id no parceiro
    await admin.from("partners").update({ auto_user_id: userId }).eq("id", partnerId);

    // 7) Audit
    await admin.from("audit_logs").insert({
      action: "partner_auto_provisioned",
      target_table: "partners",
      target_id: partnerId,
      details: { email, user_id: userId, created, default_password_used: created },
    });

    return ok({ success: true, user_id: userId, created });
  } catch (err) {
    return ok({ success: false, fallback: true, error: (err as Error).message });
  }
});
