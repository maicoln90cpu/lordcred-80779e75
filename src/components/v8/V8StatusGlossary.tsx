import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Glossário leigo dos status V8 (vocabulário OFICIAL — doc V8 abr/2026).
 * Acionado por ícone "?" no header das abas Histórico, Consultas e Nova Simulação.
 *
 * Mantenha SINCRONIZADO com `supabase/functions/_shared/v8Status.ts`.
 */

type Tone = 'ok' | 'wait' | 'bad' | 'warn';
type Row = { status: string; meaning: string; action: string; tone?: Tone };

/** Status oficiais do ciclo de CONSULTA de margem. */
const CONSULT_ROWS: Row[] = [
  { status: 'WAITING_CONSENT', meaning: 'Termo de consentimento criado, aguardando autorização.', action: 'Aguardar — sistema autoriza sozinho.', tone: 'wait' },
  { status: 'CONSENT_APPROVED', meaning: 'Termo autorizado. V8 vai iniciar a consulta na Dataprev.', action: 'Aguardar — ainda NÃO é resultado final.', tone: 'wait' },
  { status: 'WAITING_CONSULT', meaning: 'Aguardando retorno da consulta Dataprev.', action: 'Aguardar.', tone: 'wait' },
  { status: 'WAITING_CREDIT_ANALYSIS', meaning: 'Aguardando análise de crédito da V8.', action: 'Aguardar.', tone: 'wait' },
  { status: 'SUCCESS', meaning: 'Consulta concluída com margem disponível. RESULTADO FINAL POSITIVO.', action: 'Trabalhar o lead / rodar simulação financeira.', tone: 'ok' },
  { status: 'REJECTED', meaning: 'Rejeitada na análise de crédito ou sem margem. Resultado final negativo.', action: 'Descartar lead.', tone: 'bad' },
  { status: 'FAILED', meaning: 'Falha técnica no processamento.', action: 'Usar "Retentar falhados" se classificada como instabilidade.', tone: 'bad' },
];

/** Status oficiais do ciclo de OPERAÇÃO/proposta. */
export const OPERATION_ROWS: Row[] = [
  { status: 'generating_ccb', meaning: 'V8 está gerando a CCB (cédula de crédito).', action: 'Aguardar.', tone: 'wait' },
  { status: 'formalization', meaning: 'CCB pronta — em processo de formalização (assinatura).', action: 'Acompanhar assinatura.', tone: 'wait' },
  { status: 'analysis', meaning: 'Em análise automatizada da V8.', action: 'Aguardar.', tone: 'wait' },
  { status: 'manual_analysis', meaning: 'Em análise manual da V8 (mesa).', action: 'Aguardar — pode demorar.', tone: 'wait' },
  { status: 'awaiting_call', meaning: 'V8 vai entrar em contato com o cliente.', action: 'Avisar o cliente para atender ligação V8.', tone: 'warn' },
  { status: 'processing', meaning: 'Pagamento sendo processado.', action: 'Aguardar liberação do dinheiro.', tone: 'wait' },
  { status: 'paid', meaning: 'PAGO — dinheiro liberado para o cliente. Comissão a caminho.', action: 'Conferir extrato e fechar venda.', tone: 'ok' },
  { status: 'pending', meaning: 'Pendente — aguardando alguma ação.', action: 'Verificar detalhes na V8.', tone: 'wait' },
  { status: 'awaiting_cancel', meaning: 'Solicitação de cancelamento em processamento.', action: 'Aguardar confirmação.', tone: 'warn' },
  { status: 'canceled', meaning: 'Cancelada (pelo cliente, parceiro ou V8).', action: '—', tone: 'bad' },
  { status: 'rejected', meaning: 'Recusada na análise final da V8.', action: 'Descartar.', tone: 'bad' },
  { status: 'refunded', meaning: 'Estornada após pagamento.', action: 'Investigar com financeiro.', tone: 'bad' },
];

/** Classes internas LordCred (não vêm da V8). */
const INTERNAL_ROWS: Row[] = [
  { status: 'temporary_v8', meaning: 'Instabilidade ou rate limit da V8 (HTTP 429/503).', action: 'Botão "Retentar falhados".', tone: 'warn' },
  { status: 'analysis_pending', meaning: 'V8 ainda processando do lado dela.', action: '"Buscar resultados pendentes".', tone: 'warn' },
  { status: 'active_consult', meaning: 'Já existe consulta ativa na V8 para este CPF.', action: 'Sistema busca status sozinho; ou "Ver status na V8".', tone: 'warn' },
];

const TONE: Record<Tone, string> = {
  ok: 'bg-success/15 text-success border-success/30',
  wait: 'bg-info/15 text-info border-info/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  warn: 'bg-warning/15 text-warning border-warning/30',
};

export function getV8OperationTone(status?: string | null): Tone | undefined {
  return OPERATION_ROWS.find((row) => row.status === status)?.tone;
}

export function getV8ToneClass(tone?: Tone) {
  return tone ? TONE[tone] : '';
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="divide-y">
      <div className="px-3 py-2 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {rows.map((row) => (
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
  );
}

export function V8StatusGlossary() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-3.5 h-3.5" />
          O que cada status significa?
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[480px] p-0">
        <div className="p-3 border-b">
          <h4 className="text-sm font-semibold">Glossário de status V8 (oficial)</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ciclo: <strong>Consulta</strong> (margem) → <strong>Simulação</strong> (parcela/valor) → <strong>Operação</strong> (contrato).
          </p>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <Section title="🔍 Consulta de Margem" rows={CONSULT_ROWS} />
          <Section title="📄 Operação (Proposta)" rows={OPERATION_ROWS} />
          <Section title="⚙️ Status internos LordCred" rows={INTERNAL_ROWS} />
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
