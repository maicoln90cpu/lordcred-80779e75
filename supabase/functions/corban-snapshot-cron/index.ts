import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORBAN_API_URL = Deno.env.get('CORBAN_API_URL') || '';
const CORBAN_USERNAME = Deno.env.get('CORBAN_USERNAME') || '';
const CORBAN_PASSWORD = Deno.env.get('CORBAN_PASSWORD') || '';
const CORBAN_EMPRESA = Deno.env.get('CORBAN_EMPRESA') || '';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function normalizePropostas(rawData: any): any[] {
  if (!rawData) return [];
  // 1. Direct array
  if (Array.isArray(rawData)) return rawData;
  // 2. Common wrappers
  if (rawData.data && Array.isArray(rawData.data)) return rawData.data;
  if (rawData.propostas && Array.isArray(rawData.propostas)) return rawData.propostas;
  // 3. Keyed-object (NewCorban returns proposals as { "<id>": {...}, "<id2>": {...} })
  if (typeof rawData === 'object') {
    const entries = Object.entries(rawData);
    const numericEntries = entries.filter(([k]) => /^\d+$/.test(k));
    if (numericEntries.length > 0) {
      return numericEntries.map(([id, value]) => ({
        proposta_id: id,
        ...(typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}),
      }));
    }
    // 4. Fallback: first array property
    for (const key of Object.keys(rawData)) {
      if (Array.isArray(rawData[key]) && rawData[key].length > 0) return rawData[key];
    }
  }
  return [];
}

function extractField(item: any, ...paths: string[]): any {
  for (const path of paths) {
    const parts = path.split('.');
    let val = item;
    for (const p of parts) {
      val = val?.[p];
      if (val === undefined || val === null) break;
    }
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[corban-snapshot-cron] Starting automated snapshot...');

    if (!CORBAN_API_URL || !CORBAN_USERNAME || !CORBAN_PASSWORD || !CORBAN_EMPRESA) {
      throw new Error('Corban credentials not configured');
    }

    // Match exact payload format used by corban-api/getPropostas (proven to return data).
    // NewCorban API quirks: max window = 31 days, tipo='cadastro', no top-level pagination.
    // Strategy: split last 60 days into 2 windows of 30 days each.
    const now = new Date();
    const w1End = new Date(now);
    const w1Start = new Date(now); w1Start.setDate(w1Start.getDate() - 30);
    const w2End = new Date(w1Start); w2End.setDate(w2End.getDate() - 1);
    const w2Start = new Date(w2End); w2Start.setDate(w2Start.getDate() - 30);

    const windows: Array<[Date, Date]> = [[w1Start, w1End], [w2Start, w2End]];

    async function fetchWindow(start: Date, end: Date): Promise<any[]> {
      const payload = {
        auth: { username: CORBAN_USERNAME, password: CORBAN_PASSWORD, empresa: CORBAN_EMPRESA },
        requestType: 'getPropostas',
        filters: {
          status: [],
          data: { tipo: 'cadastro', startDate: formatDate(start), endDate: formatDate(end) },
        },
      };

      const r = await fetch(`${CORBAN_API_URL}/api/propostas/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      if (!r.ok) {
        console.error(`[corban-snapshot-cron] HTTP ${r.status} for ${formatDate(start)}→${formatDate(end)}: ${text.slice(0, 200)}`);
        return [];
      }

      let raw: any;
      try { raw = JSON.parse(text); } catch {
        console.error(`[corban-snapshot-cron] Non-JSON response: ${text.slice(0, 200)}`);
        return [];
      }

      if (raw?.error === true) {
        console.error(`[corban-snapshot-cron] API error: ${raw.mensagem || JSON.stringify(raw).slice(0, 200)}`);
        return [];
      }

      const pageItems = normalizePropostas(raw);
      console.log(`[corban-snapshot-cron] ${formatDate(start)}→${formatDate(end)}: ${pageItems.length} items (raw keys: ${Object.keys(raw || {}).join(',').slice(0, 100)})`);
      return pageItems;
    }

    let items: any[] = [];
    for (const [s, e] of windows) {
      const got = await fetchWindow(s, e);
      items.push(...got);
    }

    console.log(`[corban-snapshot-cron] TOTAL collected: ${items.length} proposals`);

    if (items.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: 'No proposals found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map to snapshot rows
    const rows = items.map((item: any) => ({
      proposta_id: extractField(item, 'id', 'proposta_id', 'propostaId') as string | null,
      cpf: extractField(item, 'cpf', 'cliente.cpf', 'pessoais.cpf') as string | null,
      nome: extractField(item, 'nome', 'cliente.nome', 'pessoais.nome', 'cliente_nome') as string | null,
      banco: extractField(item, 'banco', 'banco_nome', 'instituicao') as string | null,
      produto: extractField(item, 'produto', 'produto_nome') as string | null,
      status: extractField(item, 'status', 'status_id') as string | null,
      valor_liberado: parseFloat(extractField(item, 'valor_liberado', 'valorLiberado', 'vlr_liberado') || '0') || null,
      valor_parcela: parseFloat(extractField(item, 'valor_parcela', 'valorParcela', 'vlr_parcela') || '0') || null,
      prazo: String(extractField(item, 'prazo', 'prazos') || ''),
      vendedor_nome: extractField(item, 'vendedor', 'vendedor_nome', 'equipe.vendedor') as string | null,
      data_cadastro: extractField(item, 'data_cadastro', 'dataCadastro', 'created_at') as string | null,
      convenio: extractField(item, 'convenio', 'convenio_nome') as string | null,
      raw_data: item,
      created_by: null,
      updated_at: new Date().toISOString(),
    }));

    // Upsert in batches of 500 (deduplicate by proposta_id)
    const BATCH_SIZE = 500;
    let upsertedTotal = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      // Filter out rows without proposta_id (can't upsert without unique key)
      const withId = batch.filter((r: any) => r.proposta_id);
      const withoutId = batch.filter((r: any) => !r.proposta_id);

      if (withId.length > 0) {
        const { error } = await supabaseAdmin
          .from('corban_propostas_snapshot')
          .upsert(withId, { onConflict: 'proposta_id' });
        if (error) {
          console.error(`[corban-snapshot-cron] Upsert batch error:`, error);
          throw new Error(`Upsert error: ${error.message}`);
        }
      }
      if (withoutId.length > 0) {
        const { error } = await supabaseAdmin
          .from('corban_propostas_snapshot')
          .insert(withoutId);
        if (error) {
          console.error(`[corban-snapshot-cron] Insert batch error:`, error);
        }
      }
      upsertedTotal += batch.length;
    }

    console.log(`[corban-snapshot-cron] Snapshot saved: ${upsertedTotal} proposals (upsert, no cleanup).`);

    return new Response(JSON.stringify({ success: true, count: upsertedTotal }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[corban-snapshot-cron] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
