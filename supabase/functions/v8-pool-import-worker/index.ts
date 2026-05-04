// Worker leve: lê o arquivo do Storage como CSV em STREAMING (linha por linha),
// memória constante (~20 MB) mesmo para milhões de linhas.
// O frontend converte XLSX/XLSM -> CSV antes de subir, evitando parse pesado aqui.

import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 2000;

function cleanCpf(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}
function isValidCpf(cpf: string): boolean {
  return cpf.length === 11 && !/^(\d)\1+$/.test(cpf);
}
function parseDate(v: unknown): string | null {
  if (!v) return null;
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

function normHeader(h: string): string {
  return h.toLowerCase().trim().replace(/^\ufeff/, '').replace(/[_\s"]/g, '');
}

// CSV parser simples (suporta aspas e vírgula/ponto-e-vírgula)
function detectDelimiter(line: string): string {
  const c = (line.match(/,/g) || []).length;
  const sc = (line.match(/;/g) || []).length;
  return sc > c ? ';' : ',';
}
function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const EXTRA_KEYS = ['genero', 'sexo', 'banco', 'agencia', 'conta', 'mae', 'observacao', 'idade', 'origem'];

interface ColMap {
  cpf: number;
  nome: number;
  telefone: number;
  nascimento: number;
  extras: Array<{ idx: number; name: string }>;
}

function buildColMap(headers: string[]): ColMap {
  const norm = headers.map(normHeader);
  const find = (cands: string[]) => {
    for (const c of cands) {
      const i = norm.findIndex((h) => h === c || h.includes(c));
      if (i >= 0) return i;
    }
    return -1;
  };
  const extras: Array<{ idx: number; name: string }> = [];
  norm.forEach((h, idx) => {
    if (EXTRA_KEYS.some((k) => h.includes(k))) extras.push({ idx, name: headers[idx] });
  });
  return {
    cpf: find(['cpf', 'documento', 'document']),
    nome: find(['nome', 'name', 'fullname']),
    telefone: find(['telefone', 'phone', 'celular', 'fone']),
    nascimento: find(['datanascimento', 'nascimento', 'dtnasc', 'birthdate']),
    extras,
  };
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

    if (impErr || !imp) throw new Error('Import não encontrado');
    if (!imp.storage_path) throw new Error('Storage path ausente');
    if (imp.status === 'completed') {
      return new Response(JSON.stringify({ success: true, message: 'Já concluído' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Worker só aceita CSV (frontend converte antes de subir)
    if (!imp.storage_path.toLowerCase().endsWith('.csv')) {
      throw new Error('Worker só processa CSV. O frontend deve converter XLSX/XLSM antes do upload.');
    }

    await supabase.from('v8_contact_pool_imports')
      .update({ status: 'processing', progress_percent: 1 })
      .eq('id', importId);

    // Inicia processamento em background (não bloqueia resposta)
    const job = (async () => {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from('v8-contact-pool')
          .download(imp.storage_path!);
        if (dlErr || !blob) throw new Error('Falha ao baixar: ' + dlErr?.message);

        const reader = blob.stream().pipeThrough(new TextDecoderStream('utf-8')).getReader();

        let buffer = '';
        let headers: string[] | null = null;
        let colMap: ColMap | null = null;
        let delim = ',';
        const seen = new Set<string>();
        let invalid = 0;
        let inserted = 0;
        let duplicates = 0;
        let processed = 0;
        let pendingChunk: any[] = [];

        const flush = async () => {
          if (pendingChunk.length === 0) return;
          const chunk = pendingChunk;
          pendingChunk = [];
          const { data: ins, error: insErr } = await supabase
            .from('v8_contact_pool')
            .upsert(chunk, { onConflict: 'cpf', ignoreDuplicates: true })
            .select('id');
          if (insErr) {
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
          await supabase.from('v8_contact_pool_imports')
            .update({
              processed_count: processed,
              inserted_count: inserted,
              duplicate_count: duplicates,
              invalid_count: invalid,
              row_count: processed,
              progress_percent: Math.min(99, Math.max(2, Math.round((processed / Math.max(processed + 1000, 10000)) * 100))),
            })
            .eq('id', importId!);
        };

        const processLine = (line: string) => {
          if (!line.trim()) return;
          if (!headers) {
            delim = detectDelimiter(line);
            headers = parseCsvLine(line, delim);
            colMap = buildColMap(headers);
            if (colMap.cpf < 0) throw new Error('Coluna CPF não encontrada no CSV');
            return;
          }
          const cells = parseCsvLine(line, delim);
          const cpf = cleanCpf(cells[colMap!.cpf]);
          if (!isValidCpf(cpf)) { invalid++; return; }
          if (seen.has(cpf)) return;
          seen.add(cpf);
          processed++;

          const extra: Record<string, any> = {};
          for (const e of colMap!.extras) {
            const v = cells[e.idx];
            if (v !== undefined && v !== '') extra[e.name] = v;
          }

          pendingChunk.push({
            cpf,
            full_name: colMap!.nome >= 0 && cells[colMap!.nome]
              ? String(cells[colMap!.nome]).trim().slice(0, 200) : null,
            phone: colMap!.telefone >= 0 && cells[colMap!.telefone]
              ? cleanCpf(cells[colMap!.telefone]) : null,
            birth_date: colMap!.nascimento >= 0 ? parseDate(cells[colMap!.nascimento]) : null,
            extra,
            source_file: imp.file_name,
            source_batch_id: imp.id,
            imported_by: imp.imported_by,
          });
        };

        // Stream linha por linha
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let nl: number;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).replace(/\r$/, '');
            buffer = buffer.slice(nl + 1);
            try { processLine(line); } catch (e) {
              throw new Error('Erro na linha ' + (processed + invalid + 2) + ': ' + (e as Error).message);
            }
            if (pendingChunk.length >= CHUNK_SIZE) await flush();
          }
        }
        if (buffer.trim()) processLine(buffer);
        await flush();

        await supabase.from('v8_contact_pool_imports')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            processed_count: processed,
            inserted_count: inserted,
            duplicate_count: duplicates,
            invalid_count: invalid,
            row_count: processed,
            progress_percent: 100,
          })
          .eq('id', importId!);
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        console.error('[worker bg] erro:', msg);
        await supabase.from('v8_contact_pool_imports')
          .update({ status: 'failed', error_message: msg.slice(0, 500) })
          .eq('id', importId!);
      }
    })();

    // @ts-ignore — EdgeRuntime existe em produção
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(job);
    }

    return new Response(JSON.stringify({ success: true, started: true, import_id: importId }), {
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
