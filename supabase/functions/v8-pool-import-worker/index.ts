// Worker em background para importar grandes planilhas (XLSX/XLSM/CSV) no pool V8.
// Baixa o arquivo do Storage, faz parse em memória (Deno aguenta planilhas até ~100MB),
// e faz upsert em chunks de 5000. Atualiza progresso em v8_contact_pool_imports.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 5000;

function cleanCpf(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}
function isValidCpf(cpf: string): boolean {
  return cpf.length === 11 && !/^(\d)\1+$/.test(cpf);
}
function parseDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? '19' + y : y;
    return `${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}
function pickField(row: Record<string, any>, names: string[]): any {
  const keys = Object.keys(row);
  for (const n of names) {
    const target = n.toLowerCase().replace(/[_\s]/g, '');
    const k = keys.find((k) => k.toLowerCase().trim().replace(/[_\s]/g, '') === target);
    if (k && row[k] !== undefined && row[k] !== '' && row[k] !== null) return row[k];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let importId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    importId = body?.import_id ?? null;
    if (!importId) {
      return new Response(JSON.stringify({ success: false, error: 'import_id obrigatório' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: imp, error: impErr } = await supabase
      .from('v8_contact_pool_imports')
      .select('id, storage_path, file_name, imported_by, status')
      .eq('id', importId)
      .single();

    if (impErr || !imp) throw new Error('Import não encontrado: ' + impErr?.message);
    if (!imp.storage_path) throw new Error('Storage path ausente — arquivo não foi enviado.');
    if (imp.status === 'completed') {
      return new Response(JSON.stringify({ success: true, message: 'Já concluído.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('v8_contact_pool_imports')
      .update({ status: 'processing', progress_percent: 1 })
      .eq('id', importId);

    // 1) Baixa arquivo
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from('v8-contact-pool')
      .download(imp.storage_path);
    if (dlErr || !fileBlob) throw new Error('Erro ao baixar arquivo: ' + dlErr?.message);

    const buf = await fileBlob.arrayBuffer();

    // 2) Parse (xlsx/xlsm/csv — SheetJS detecta pelo conteúdo)
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const totalRows = json.length;
    await supabase.from('v8_contact_pool_imports')
      .update({ row_count: totalRows, progress_percent: 5 })
      .eq('id', importId);

    // 3) Normaliza + dedup
    const seen = new Set<string>();
    const valid: Array<Record<string, any>> = [];
    let invalid = 0;

    for (const row of json) {
      const cpf = cleanCpf(pickField(row, ['cpf', 'documento', 'document']));
      if (!isValidCpf(cpf)) { invalid++; continue; }
      if (seen.has(cpf)) continue;
      seen.add(cpf);

      const name = pickField(row, ['nome', 'name', 'fullname', 'nomecompleto']);
      const phone = pickField(row, ['telefone', 'phone', 'celular', 'fone']);
      const birth = pickField(row, ['datanascimento', 'birthdate', 'nascimento', 'dtnasc']);

      // extra enxuto: mantém só campos úteis que não viram colunas próprias
      const extra: Record<string, any> = {};
      const extraFields = ['genero', 'sexo', 'banco', 'agencia', 'conta', 'mae', 'mae_nome', 'observacao', 'idade', 'origem'];
      for (const k of Object.keys(row)) {
        const norm = k.toLowerCase().trim().replace(/[_\s]/g, '');
        if (extraFields.some((f) => norm.includes(f))) {
          extra[k] = row[k];
        }
      }

      valid.push({
        cpf,
        full_name: name ? String(name).trim().slice(0, 200) : null,
        phone: phone ? cleanCpf(phone) : null,
        birth_date: parseDate(birth),
        extra,
        source_file: imp.file_name,
        source_batch_id: imp.id,
        imported_by: imp.imported_by,
      });
    }

    await supabase.from('v8_contact_pool_imports')
      .update({ invalid_count: invalid, progress_percent: 10 })
      .eq('id', importId);

    // 4) Upsert em chunks
    let inserted = 0;
    let duplicates = 0;
    let processed = 0;

    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const chunk = valid.slice(i, i + CHUNK_SIZE);
      const { data: ins, error: insErr } = await supabase
        .from('v8_contact_pool')
        .upsert(chunk, { onConflict: 'cpf', ignoreDuplicates: true })
        .select('id');

      if (insErr) {
        console.error('[worker] chunk error:', insErr.message);
        // tenta um a um para isolar
        for (const p of chunk) {
          const { error: e1 } = await supabase.from('v8_contact_pool')
            .upsert(p, { onConflict: 'cpf', ignoreDuplicates: true });
          if (!e1) inserted++; else duplicates++;
        }
      } else {
        const ic = ins?.length || 0;
        inserted += ic;
        duplicates += chunk.length - ic;
      }
      processed += chunk.length;

      // 10% para parsing já consumido + 90% restantes para upsert
      const pct = Math.min(99, 10 + Math.round((processed / valid.length) * 90));
      await supabase.from('v8_contact_pool_imports')
        .update({
          processed_count: processed,
          inserted_count: inserted,
          duplicate_count: duplicates,
          progress_percent: pct,
        })
        .eq('id', importId);
    }

    await supabase.from('v8_contact_pool_imports')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        processed_count: valid.length,
        inserted_count: inserted,
        duplicate_count: duplicates,
        invalid_count: invalid,
        progress_percent: 100,
      })
      .eq('id', importId);

    return new Response(JSON.stringify({
      success: true,
      total: totalRows, inserted, duplicates, invalid,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.error('[v8-pool-import-worker] erro:', msg);
    if (importId) {
      await supabase.from('v8_contact_pool_imports')
        .update({ status: 'failed', error_message: msg.slice(0, 500) })
        .eq('id', importId);
    }
    return new Response(JSON.stringify({ success: false, error: msg, fallback: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
