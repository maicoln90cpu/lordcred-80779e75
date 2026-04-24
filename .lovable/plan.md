
# Plano aprovado em 2 etapas (sequência)

## ETAPA 1 — Variação % nos KPIs do Extrato (V1 + V2)

### Objetivo
Cada um dos 4 cards do Extrato (Propostas, Total Liberado, Comissão, Ticket Médio) ganha um indicador `▲ +12,5% vs período anterior` (verde para alta, vermelho para queda, cinza para neutro/sem base).

### Lógica inteligente de comparação
- **Se há semanas filtradas (N semanas)** → compara com as N semanas imediatamente anteriores (cronologicamente).
- **Se nenhuma semana filtrada** → compara mês corrente vs mês anterior (baseado em `sale_date`).
- Filtros de vendedor e produto são respeitados nos dois períodos (comparação justa).
- Variação `null` quando o período anterior tem 0 (mostra "—" em cinza, evita divisão por zero).

### Arquivos
- **NOVO** `src/components/commissions/KpiDelta.tsx` — componente compartilhado (usado por V1 e V2).
- `src/components/commissions/ExtratoTab.tsx` — adiciona cálculo do "previous period" e passa para os 4 cards.
- `src/components/commissions-v2/ExtratoTab.tsx` — mesma alteração espelhada.

### Componente KpiDelta (esqueleto)
```tsx
<KpiDelta current={totalValue} previous={prevTotalValue} format="brl" />
// renderiza: ▲ +12,5%  (verde)  ou  ▼ -3,1% (vermelho)  ou  — (cinza)
```

---

## ETAPA 2 — Destravar webhooks V8 (logs verdes)

### Diagnóstico confirmado
Os 806 logs "Erro" são webhooks da V8 chegando para `consult_id`s de CPFs **antigos/externos** (criados direto na V8, antes da integração). Quando o handler tenta criar a linha "órfã" em `v8_simulations`, esbarra em:
- `batch_id` NOT NULL ❌
- `created_by` NOT NULL ❌

### Mudanças

#### 2.1 Migração SQL
- `ALTER TABLE v8_simulations ALTER COLUMN batch_id DROP NOT NULL;`
- `ALTER TABLE v8_simulations ALTER COLUMN created_by DROP NOT NULL;`
- `ALTER TABLE v8_simulations ADD COLUMN IF NOT EXISTS is_orphan boolean NOT NULL DEFAULT false;`
- **Constraint de proteção** (impede regressão silenciosa do simulador):
  ```sql
  ALTER TABLE v8_simulations
  ADD CONSTRAINT v8_sim_owner_or_orphan
  CHECK (is_orphan = true OR (batch_id IS NOT NULL AND created_by IS NOT NULL));
  ```
- **RLS**: política adicional para admin/master enxergarem órfãos (`is_orphan = true AND is_privileged(auth.uid())`).

#### 2.2 Edge function `v8-webhook`
- No insert do "órfão", marcar `is_orphan = true`.
- Retorno permanece sempre 200 (V8 não desabilita a URL).

#### 2.3 Edge function `v8-webhook` — nova action `replay_pending`
- Lê `v8_webhook_logs` com `processed = false AND created_at >= now() - interval '7 days'`.
- Para cada log, reprocessa o payload pela mesma lógica do handler.
- Marca `processed = true` em sucesso, registra contadores em `audit_logs`.
- Limite de 500 por execução (paginação) para não estourar timeout.

#### 2.4 UI aba Consultas V8 (`V8ConsultasTab.tsx`)
- Badge cinza "Órfão" para `is_orphan = true`.
- Filtro padrão: esconder órfãos (toggle "Incluir órfãos da V8").
- Botão **"Reprocessar webhooks pendentes"** (master/admin) que chama a action `replay_pending`.

### Arquivos
- **NOVA migração** em `supabase/migrations/`.
- `supabase/functions/v8-webhook/index.ts`.
- `src/components/v8/V8ConsultasTab.tsx`.

---

## Checklist manual (após deploy das 2 etapas)

### Etapa 1
- [ ] Abrir `/admin/commissions-v2` → aba Extrato → ver 4 cards com variação `▲/▼` colorida.
- [ ] Selecionar 2 semanas → conferir que comparação mostra "vs 2 semanas anteriores" (verificar valor batendo manualmente em uma).
- [ ] Limpar semanas → variação muda para "vs mês anterior".
- [ ] Filtrar por vendedor → variação se mantém justa (mesmo vendedor nos dois períodos).
- [ ] Repetir em `/admin/commissions` (V1).

### Etapa 2
- [ ] Abrir `/admin/audit-logs` → ações `v8_webhook_consult` recentes devem virar **Sucesso** (verde).
- [ ] Aba Consultas V8 → clicar "Reprocessar pendentes" → ver toast com contagem (esperado próximo de 806 vindos dos últimos 7 dias).
- [ ] Marcar toggle "Incluir órfãos" → ver CPFs antigos da V8 (incluindo o do Maicon) listados com badge "Órfão".
- [ ] Mandar nova simulação pelo simulador → confirmar que continua funcionando normal (linha **não-órfã**).

---

## Pendências futuras (sugestões, só do que foi implementado)
- **Etapa 1**: gráfico de tendência (sparkline) ao lado de cada KPI, mostrando últimas 8 semanas/meses.
- **Etapa 2**: tela "Adoção de órfão" — botão para vincular um CPF órfão a um vendedor/lote retroativo.
- **Etapa 2**: cron diário de alerta — se webhooks pendentes voltarem a passar de 50 em 24h, notifica o canal RH/Operações.

---

## Prevenção de regressão
- **Etapa 1**: KpiDelta puro recebe só `current` e `previous` → testável isoladamente; nenhum risco de quebrar tabela existente.
- **Etapa 2**: 
  - Constraint `v8_sim_owner_or_orphan` garante que linhas não-órfãs continuam exigindo `batch_id + created_by` (nada muda no fluxo do simulador).
  - Audit log de cada `replay_pending` com contagem (sucesso/falha) para auditoria.
  - Resposta 200 mantida no webhook (V8 nunca desabilita a URL por timeout).
