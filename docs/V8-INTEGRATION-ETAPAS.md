# V8 Simulador — Plano de 6 Etapas (consolidado)

> Documento técnico das 6 etapas do refactor V8 entregue em abril/2026.
> Complementa `docs/V8-INTEGRATION.md` (visão de domínio) e `docs/V8-ETAPA2-REALTIME.md` (realtime).

---

## Etapa 1 — Correções rápidas (UX/A11y) ✅

**Entregue:**
- `DialogTitle` + `DialogDescription` `sr-only` em `src/components/ui/command.tsx` (zera warnings Radix em todo o projeto, não só V8).
- `V8RealtimeStatusBar`: colapsa para pílula verde "V8 estável" quando não há lote ativo, retentativa nem fila pendente.
- `CreateOperationDialog`: tag de origem no header (`Origem: Simulação V8` esmeralda / `Origem: Lead` azul / `Em branco` outline) baseada em `prefill.consultId` e `prefill.leadId`.

**Prevenção de regressão:** `CreateOperationDialog.origin.test.tsx` cobre as 4 combinações de prefill.

---

## Etapa 2 — Modularização do `V8NovaSimulacaoTab` ✅

**Antes:** 1 arquivo de **1.158 linhas**.
**Depois:** orquestrador de **243 linhas** + 4 sub-componentes + 1 hook.

```
src/components/v8/nova-simulacao/
  ├─ BatchCreatePanel.tsx       # form de criação de lote
  ├─ BatchProgressTable.tsx     # tabela com coluna Parcelas
  ├─ BatchActionsBar.tsx        # Simular / Retentar / Cancelar
  └─ BatchAnimations.tsx        # contadores realtime
src/hooks/useV8BatchOperations.ts  # handleStart / handleRetryFailed / handleCancel
```

**Prevenção de regressão:** `V8NovaSimulacaoTab.smoke.test.tsx` renderiza o tab vazio para garantir que a árvore monta sem crash após qualquer refactor futuro.

---

## Etapa 3 — KPIs + Busca global ✅

- `V8KpisBar.tsx`: 4 cards (Simulações hoje, Propostas hoje, Ticket médio, Aprovação %) recalculando a cada 60s. "Hoje" usa `America/Sao_Paulo` com sufixo `-03:00` (regra de ouro do projeto).
- `V8OperacoesTab.tsx`: filtro persistido em `?q=...` via `useSearchParams` — links compartilháveis preservam contexto.

**Prevenção de regressão:** `V8KpisBar.helpers.test.ts` cobre o cálculo de `startOfTodaySaoPauloIso` (incluindo o caso UTC-vira-dia-novo-mas-SP-ainda-é-anterior) e formatação BRL.

---

## Etapa 4 — Lead validation + Upload checklist + Thumbnails ✅

- **Fast-track de Lead:** se `prefill.leadId` sem `consultId`, surge botão "Consultar V8 agora" no `CreateOperationDialog`. Operador não precisa sair do form.
- **Checklist visual:** `CreateOperationDocsSection.tsx` mostra para cada arquivo: thumbnail 48px (imagem) ou ícone PDF, status (⏳ pending / 🔄 uploading / ✅ ok / ❌ error) e upload sequencial via `uploadPendingDocs`.

**Prevenção de regressão:** `CreateOperationDocsSection.checklist.test.ts` cobre as transições de status e os predicados `isAllUploaded`/`hasErrors`.

---

## Etapa 5 — Otimização + Cleanup + PEP ✅

- `V8LimitsBadge`: migrado para **React Query** com `staleTime: 60s`. Mesmo CPF aparecendo em várias listas não dispara N requisições.
- **PEP obrigatório:** `Profissão` vira `required` quando o toggle PEP está ativo (evita 422 da V8).
- **Cron diário:** migration cria função + `pg_cron` que apaga `v8_operation_drafts` com mais de 30 dias e ainda não submetidos. Roda 03:00 UTC.

---

## Etapa 6 — Documentação + Testes ✅

- Este documento (`V8-INTEGRATION-ETAPAS.md`) consolida o que cada etapa entregou e onde encontrar a prevenção de regressão.
- Suíte Vitest cobre helpers das etapas 1, 3 e 4 (puros, sem mock de Supabase) + smoke test do orquestrador da Etapa 2.
- Rodar tudo: `bunx vitest run src/components/v8/__tests__`.

---

## Mapa rápido de arquivos novos/alterados

| Etapa | Arquivos chave |
|---|---|
| 1 | `ui/command.tsx`, `V8RealtimeStatusBar.tsx`, `CreateOperationDialog.tsx` |
| 2 | `nova-simulacao/*`, `useV8BatchOperations.ts`, `V8NovaSimulacaoTab.tsx` |
| 3 | `V8KpisBar.tsx`, `V8OperacoesTab.tsx`, `pages/admin/V8Simulador.tsx` |
| 4 | `CreateOperationDocsSection.tsx`, `CreateOperationDialog.tsx` |
| 5 | `V8LimitsBadge.tsx`, migration `cleanup_v8_operation_drafts` |
| 6 | `docs/V8-INTEGRATION-ETAPAS.md`, `__tests__/*` |
