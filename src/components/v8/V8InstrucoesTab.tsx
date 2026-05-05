/**
 * V8InstrucoesTab — Manual técnico interno do Simulador V8.
 *
 * Documenta TODAS as automações, fluxos, edge functions, tabelas e
 * troubleshooting do módulo V8. Linguagem leiga + acordeões por categoria.
 *
 * Atualize esta tela sempre que mudar o comportamento de:
 *   - launcher / watchdog / reconciler
 *   - webhook V8 / fast-path
 *   - auto-best worker
 *   - limpezas automáticas
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Zap, Shield, Workflow, Database, Settings, AlertTriangle, ArrowRight } from 'lucide-react';

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function V8InstrucoesTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <strong>Manual interno do Simulador V8.</strong> Tudo que o sistema faz sozinho está aqui:
          como uma simulação vira proposta, quem aciona quem, em que cron job, com que intervalo
          e o que fazer quando algo trava. Sempre que mudarmos uma automação, esta página é atualizada.
        </div>
      </div>

      {/* ===================== FLUXO PRINCIPAL ===================== */}
      <Section icon={Workflow} title="Fluxo principal — do CPF colado até a proposta">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="f1">
            <AccordionTrigger>1. Você cola CPFs em "Nova Simulação"</AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p>Cada aba de rascunho já abre com os defaults: <Badge variant="outline">CLT Acelera</Badge>{' '}
              <Badge variant="outline">48 parcelas</Badge> <Badge variant="outline">Sem valor</Badge>{' '}
              <Badge variant="outline">Auto-melhor ON</Badge>.</p>
              <p>Ao clicar <strong>Iniciar lote</strong>, criamos:</p>
              <ul className="list-disc ml-5">
                <li>1 linha em <code>v8_batches</code> (status <code>queued</code>).</li>
                <li>N linhas em <code>v8_simulations</code> (uma por CPF, status <code>queued</code>).</li>
              </ul>
              <p>Nada é enviado para a V8 ainda. O launcher é quem dispara.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="f2">
            <AccordionTrigger>2. Launcher dispara a V8 (cron 1 min + fast-path)</AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p><strong>Edge function:</strong> <code>v8-scheduled-launcher</code></p>
              <p><strong>Roda:</strong> a cada 1 minuto (pg_cron) <em>+</em> imediatamente após cada
              webhook V8 (fast-path, ~2s).</p>
              <p><strong>O que faz:</strong></p>
              <ul className="list-disc ml-5">
                <li>Lê <code>v8_settings.max_concurrent_batches_per_owner</code> (1 a 3, default 2)
                  e respeita esse limite por operador.</li>
                <li>Pega CPFs <code>queued</code> do lote, marca como <code>pending</code>,
                  grava <code>attempt_count++</code> e <code>last_attempt_at</code>.</li>
                <li>POSTa para a V8 respeitando o throttle <code>consult_throttle_ms</code>
                  (default 1200 ms).</li>
                <li>Se a V8 devolver erro definitivo, move para <code>failed</code> com
                  <code>error_kind</code> apropriado. Não fica zumbi.</li>
              </ul>
              <p className="text-muted-foreground">⚡ Cache de <code>v8_configs</code> em memória
              do worker por 60s — acelera o disparo.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="f3">
            <AccordionTrigger>3. V8 responde por webhook</AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p><strong>Edge function:</strong> <code>v8-webhook</code> (público, sem JWT —
              autenticação é por path-token).</p>
              <p>Cada resposta atualiza a <code>v8_simulations</code> e:</p>
              <ul className="list-disc ml-5">
                <li>Se foi a última pendente do lote → marca <code>completed_at = now()</code>{' '}
                  no batch <strong>na hora</strong> (não espera o watchdog).</li>
                <li>Dispara o launcher por <code>fetch + EdgeRuntime.waitUntil</code> para
                  começar o próximo lote em ~2s.</li>
                <li>Aciona o auto-best (se <code>autoBest=true</code> no rascunho).</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="f4">
            <AccordionTrigger>4. Auto-melhor escolhe a melhor proposta</AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p><strong>Edge function:</strong> <code>v8-auto-best-worker</code> (cron 1 min).</p>
              <p>Varre N <code>v8_auto_best_jobs</code> com status <code>queued</code> em uma
              chamada SQL única e processa em batch. Pré-carrega todos os{' '}
              <code>v8_configs_cache</code> distintos do lote em uma só query.</p>
              <p>Quando encontra a melhor combinação (tabela × prazo × valor), grava{' '}
                <code>chosen_config_id</code> + <code>chosen_simulation_id</code> e libera o
                botão "Criar operação".</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="f5">
            <AccordionTrigger>5. Watchdog e reconciler (rede de segurança)</AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p><strong>v8-orphan-reconciler</strong> (cron 2 min): se um lote ficou em{' '}
                <code>processing</code> sem nenhum CPF pendente, fecha como <code>completed</code>{' '}
                ou <code>stuck</code>. Distingue:</p>
              <ul className="list-disc ml-5">
                <li><strong>completed:</strong> 100% das simulações chegaram a status final.</li>
                <li><strong>stuck:</strong> zerou o tempo (&gt;2h) sem nenhum dispatch — sinal de problema.</li>
              </ul>
              <p><strong>Promoção de zumbis:</strong> simulações em <code>queued</code>{' '}
                há &gt;30 min são redespachadas automaticamente.</p>
              <p><strong>Botão "Forçar dispatch":</strong> por linha ou por lote, ignora dedupe
                e força reenvio para a V8.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      {/* ===================== AGILIDADE ===================== */}
      <Section icon={Zap} title="Otimizações de agilidade (Etapas 2 e 3)">
        <ul className="text-sm space-y-2 list-disc ml-5">
          <li><strong>Paralelismo de lotes:</strong> até 3 lotes do mesmo operador simultâneos
            (config <code>max_concurrent_batches_per_owner</code>). Default 2.</li>
          <li><strong>Fast-path do webhook:</strong> latência entre lotes caiu de até 60s para ~2s.</li>
          <li><strong>Pré-promoção otimista:</strong> batch fecha como <code>completed</code> no
            momento do último webhook, não no próximo ciclo do watchdog.</li>
          <li><strong>Auto-best em batch:</strong> 1 chamada SQL para todos os jobs do lote +
            cache pré-carregado de configs.</li>
          <li><strong>Cache de settings (60s):</strong> launcher não consulta DB a cada CPF.</li>
        </ul>
      </Section>

      {/* ===================== AUTOMACOES AGENDADAS ===================== */}
      <Section icon={Settings} title="Automações agendadas (pg_cron)">
        <div className="rounded-md border overflow-hidden text-sm">
          <table className="w-full">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left px-2 py-1.5">Job</th>
                <th className="text-left px-2 py-1.5">Frequência</th>
                <th className="text-left px-2 py-1.5">O que faz</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">v8-scheduled-launcher</td><td className="px-2 py-1.5">a cada 1 min</td><td className="px-2 py-1.5">Dispara CPFs queued para a V8.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">v8-auto-best-worker</td><td className="px-2 py-1.5">a cada 1 min</td><td className="px-2 py-1.5">Escolhe a melhor proposta de cada lote.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">v8-orphan-reconciler</td><td className="px-2 py-1.5">a cada 2 min</td><td className="px-2 py-1.5">Fecha lotes órfãos / detecta stuck.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">v8-active-consult-poller</td><td className="px-2 py-1.5">a cada 1 min</td><td className="px-2 py-1.5">Pulling de status para consultas em análise.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">v8-retry-cron</td><td className="px-2 py-1.5">a cada 1 min</td><td className="px-2 py-1.5">Reagenda CPFs com erro temporário.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">v8-webhook-replay-pending</td><td className="px-2 py-1.5">06h UTC</td><td className="px-2 py-1.5">Reprocessa webhooks que falharam.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">cleanup-audit-logs-daily</td><td className="px-2 py-1.5">03h15 UTC</td><td className="px-2 py-1.5">Apaga audit_logs &gt; 1 dia.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">cleanup-v8-operation-drafts</td><td className="px-2 py-1.5">03h UTC</td><td className="px-2 py-1.5">Limpa rascunhos de operação V8 antigos.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">cleanup-webhook-logs</td><td className="px-2 py-1.5">04h UTC</td><td className="px-2 py-1.5">Apaga webhook_logs (UazAPI + V8) &gt; 1 dia.</td></tr>
              <tr className="border-t"><td className="px-2 py-1.5 font-mono">cleanup_old_logs_daily</td><td className="px-2 py-1.5">06h UTC</td><td className="px-2 py-1.5">Limpeza geral complementar.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Status em tempo real: aba <strong>Configurações → Saúde do banco</strong>.
        </p>
      </Section>

      {/* ===================== TABELAS ===================== */}
      <Section icon={Database} title="Tabelas principais do módulo V8">
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            ['v8_batches', 'Lote de simulações (status: queued/processing/completed/stuck/failed/cancelled).'],
            ['v8_simulations', 'CPF individual, request, response, status, attempt_count, last_attempt_at.'],
            ['v8_simulations_audit', 'View materializada para reconciliação.'],
            ['v8_webhook_logs', 'Toda resposta da V8 que chega por webhook (retenção 1 dia).'],
            ['v8_settings', 'Configuração global: throttle, paralelismo, retries, etc.'],
            ['v8_configs / v8_configs_cache', 'Tabelas oficiais da V8 + cache local pré-fetch.'],
            ['v8_auto_best_jobs', 'Fila do worker auto-melhor.'],
            ['v8_operations', 'Operações criadas a partir de uma simulação aprovada.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-md border p-2.5">
              <div className="font-mono text-xs font-semibold">{t}</div>
              <div className="text-xs text-muted-foreground mt-1">{d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===================== ROLES ===================== */}
      <Section icon={Shield} title="Permissões e roles">
        <ul className="text-sm space-y-1 list-disc ml-5">
          <li><strong>master / admin / manager</strong> (privilegiados): veem todos os lotes,
            podem forçar dispatch, alterar configurações e limpar tabelas técnicas.</li>
          <li><strong>support / seller</strong>: veem apenas os próprios lotes; não acessam configurações.</li>
          <li>Botão "Forçar dispatch" exige privilégio.</li>
        </ul>
      </Section>

      {/* ===================== TROUBLESHOOTING ===================== */}
      <Section icon={AlertTriangle} title="Troubleshooting rápido">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="t1">
            <AccordionTrigger>Lote travado em "processing" há horas</AccordionTrigger>
            <AccordionContent className="text-sm space-y-2">
              <p>1. Veja a coluna <em>Pendentes</em> na tabela do lote.</p>
              <p>2. Se &gt;0 e <em>last_attempt_at</em> é antigo, clique em{' '}
                <strong>Forçar dispatch (lote)</strong>.</p>
              <p>3. Se =0, o reconciler vai fechar como <code>completed</code> em até 2 min.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="t2">
            <AccordionTrigger>Status "stuck" apareceu</AccordionTrigger>
            <AccordionContent className="text-sm">
              Indica que o lote ficou &gt;2h sem nenhum dispatch. Cheque saúde do banco e logs
              do <code>v8-scheduled-launcher</code>.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="t3">
            <AccordionTrigger>Próximo lote demora a iniciar</AccordionTrigger>
            <AccordionContent className="text-sm">
              Aumente <code>max_concurrent_batches_per_owner</code> em Configurações
              (até 3). Default 2 já roda 2 lotes em paralelo do mesmo operador.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="t4">
            <AccordionTrigger>Banco crescendo demais</AccordionTrigger>
            <AccordionContent className="text-sm">
              Use o card <strong>Saúde do banco</strong> e clique em "Limpar agora". Para
              recuperar espaço físico, rode <code>VACUUM FULL</code> no SQL Editor.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <ArrowRight className="w-3.5 h-3.5" />
        Atualize esta página sempre que mudar uma automação V8.
      </div>
    </div>
  );
}
