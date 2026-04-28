import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Glossário leigo dos status V8 + classes internas do LordCred.
 * Acionado por ícone "?" no header das abas Histórico, Consultas e Nova Simulação.
 */
const ROWS: Array<{ status: string; meaning: string; action: string; tone?: 'ok' | 'wait' | 'bad' | 'warn' }> = [
  { status: 'WAITING_CONSENT', meaning: 'Termo criado, aguardando autorização interna.', action: 'Aguardar — o sistema autoriza sozinho.', tone: 'wait' },
  { status: 'CONSENT_APPROVED', meaning: 'Termo autorizado. V8 está consultando o averbador.', action: 'Aguardar resultado.', tone: 'wait' },
  { status: 'SUCCESS', meaning: 'Consulta concluída com margem disponível.', action: 'Trabalhar o lead / rodar simulação financeira.', tone: 'ok' },
  { status: 'REJECTED', meaning: 'Cliente sem margem ou inelegível para o produto.', action: 'Descartar lead.', tone: 'bad' },
  { status: 'WAITING_*', meaning: 'Outras etapas intermediárias da V8.', action: 'Aguardar.', tone: 'wait' },
  { status: 'temporary_v8', meaning: 'Instabilidade ou rate limit da V8.', action: 'Usar botão "Retentar falhados".', tone: 'warn' },
  { status: 'analysis_pending', meaning: 'V8 ainda processando do lado dela.', action: 'Aguardar ou usar "Buscar resultados pendentes".', tone: 'warn' },
  { status: 'active_consult', meaning: 'Já existe consulta ativa para este CPF.', action: 'Sistema busca status automaticamente; manualmente use "Ver status na V8".', tone: 'warn' },
];

const TONE: Record<NonNullable<(typeof ROWS)[number]['tone']>, string> = {
  ok: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  wait: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  warn: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
};

export function V8StatusGlossary() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-3.5 h-3.5" />
          O que cada status significa?
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[460px] p-0">
        <div className="p-3 border-b">
          <h4 className="text-sm font-semibold">Glossário de status V8</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ciclo: <strong>Consulta</strong> (margem) → <strong>Simulação</strong> (parcela/valor) → <strong>Operação</strong> (contrato).
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {ROWS.map((row) => (
            <div key={row.status} className="p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={row.tone ? TONE[row.tone] : ''}>
                  {row.status}
                </Badge>
              </div>
              <div className="text-foreground">{row.meaning}</div>
              <div className="text-muted-foreground italic">→ {row.action}</div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t bg-muted/30 text-[11px] text-muted-foreground space-y-1">
          <div>
            💰 <strong>Margem Disponível</strong> = valor livre mensal do trabalhador (vem da V8). É o teto de parcela CLT que ele pode contratar.
          </div>
          <div>
            🧮 <strong>Margem LordCred</strong> = cálculo interno de 5% sobre o valor liberado. NÃO é enviada à V8.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
