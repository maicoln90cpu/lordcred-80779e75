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
  // Handle various response shapes from NewCorban
  let items: any[] = [];
  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (rawData.data && Array.isArray(rawData.data)) {
    items = rawData.data;
  } else if (rawData.propostas && Array.isArray(rawData.propostas)) {
    items = rawData.propostas;
  } else if (typeof rawData === 'object') {
    // Try to find first array property
    for (const key of Object.keys(rawData)) {
      if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
        items = rawData[key];
        break;
      }
    }
  }
  return items;
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

    // Fetch proposals from last 60 days, trying 'envio' first then 'cadastro' as fallback.
    // The NewCorban API expects tipo='envio' (per docs/integration memory) — 'cadastro' returns empty.
    const now = new Date();
    const startWindow = new Date(now);
    startWindow.setDate(startWindow.getDate() - 60);

    async function fetchWithTipo(tipo: 'envio' | 'cadastro'): Promise<any[]> {
      const allItems: any[] = [];
      let pagina = 1;
      const maxPages = 20; // safety cap (20 * ~500 = 10k proposals)

      while (pagina <= maxPages) {
        const payload = {
          auth: { username: CORBAN_USERNAME, password: CORBAN_PASSWORD, empresa: CORBAN_EMPRESA },
          requestType: 'getPropostas',
          filters: {
            status: [],
            data: { tipo, startDate: formatDate(startWindow), endDate: formatDate(now) },
            pagina,
          },
        };

        const r = await fetch(`${CORBAN_API_URL}/api/propostas/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!r.ok) {
          console.error(`[corban-snapshot-cron] tipo=${tipo} page=${pagina} status=${r.status}`);
          break;
        }

        const raw = await r.json();
        const pageItems = normalizePropostas(raw);
        console.log(`[corban-snapshot-cron] tipo=${tipo} page=${pagina} → ${pageItems.length} items`);

        if (pageItems.length === 0) break;
        allItems.push(...pageItems);
        if (pageItems.length < 100) break; // last page heuristic
        pagina++;
      }

      return allItems;
    }

    console.log(`[corban-snapshot-cron] Fetching window ${formatDate(startWindow)} → ${formatDate(now)}`);

    let items = await fetchWithTipo('envio');
    if (items.length === 0) {
      console.log('[corban-snapshot-cron] tipo=envio empty, trying tipo=cadastro fallback');
      items = await fetchWithTipo('cadastro');
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
