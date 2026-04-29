import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Etapa 2 (item C) — Glossário visual em cima da tabela "Progresso do Lote".
 * Diferente do Popover global em V8StatusGlossary (que cobre TODOS os ciclos),
 * este card foca SÓ nos status que aparecem nas linhas do lote durante a execução,
 * com vocabulário leigo e ação esperada.
 *
 * Preferência de aberto/fechado é persistida em localStorage (`v8_legend_open`)
 * para não atrapalhar quem já decorou.
 */

const STORAGE_KEY = 'v8_batch_legend_open';

type Row = {
  label: string;
  tone: 'wait' | 'ok' | 'bad' | 'warn';
  meaning: string;
  action: string;
};

const ROWS: Row[] = [
  {
    label: 'Pendente',
    tone: 'wait',
    meaning: 'Linha entrou na fila do servidor mas ainda não recebeu resposta da V8 (consulta acabou de ser disparada).',
    action: 'Aguardar — entre 2s e 30s normalmente.',
  },
  {
    label: 'Aguardando V8',
    tone: 'wait',
    meaning: 'Servidor já chamou a V8, agora espera o webhook chegar (a V8 processa o CPF e devolve o resultado de forma assíncrona).',
    action: 'Aguardar webhook. Se passar de 2 min sem resposta, o auto-retry reabre a consulta.',
  },
  {
    label: 'Consulta ativa',
    tone: 'warn',
    meaning: 'Já existia uma consulta deste CPF aberta na V8 (de outro lote, mesmo que de outro vendedor).',
    action: 'Não fazer nada — sistema promove sozinho assim que a antiga concluir. Auto-retry NÃO ajuda aqui.',
  },
  {
    label: 'Falha',
    tone: 'bad',
    meaning: 'Algo deu errado no caminho até a V8 (instabilidade, rate limit 429, 5xx, timeout). Erro TÉCNICO, não decisão.',
    action: 'Auto-retry continua tentando até o limite configurado. Se passar do limite, clicar "Retentar falhados".',
  },
  {
    label: 'Rejeitado',
    tone: 'bad',
    meaning: 'A V8 respondeu com sucesso, mas a resposta dela foi NEGATIVA (cliente não tem margem, política recusou, dados inválidos). Decisão FINAL.',
    action: 'Descartar lead — auto-retry NÃO ajuda. Se for "dados inválidos", corrigir cadastro e dispará-lo de novo manualmente.',
  },
];

const TONE: Record<Row['tone'], string> = {
  wait: 'bg-info/15 text-info border-info/30',
  ok: 'bg-success/15 text-success border-success/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  warn: 'bg-warning/15 text-warning border-warning/30',
};

export default function BatchStatusLegend() {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem(STORAGE_KEY);
    // Default: aberto na primeira vez, depois respeita preferência.
    return v === null ? true : v === '1';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  }, [open]);

  return (
    <div className="rounded-md border bg-muted/20">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 h-9 px-3 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Info className="w-3.5 h-3.5" />
        O que cada status significa nesta tabela?
        {!open && <span className="text-muted-foreground ml-auto">(clique para abrir)</span>}
      </Button>
      {open && (
        <div className="border-t px-3 py-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {ROWS.map((r) => (
            <div key={r.label} className="text-[11px] space-y-1 p-2 rounded bg-background border border-border/40">
              <Badge variant="outline" className={TONE[r.tone]}>
                {r.label}
              </Badge>
              <div className="text-foreground leading-snug">{r.meaning}</div>
              <div className="text-muted-foreground italic leading-snug">→ {r.action}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
