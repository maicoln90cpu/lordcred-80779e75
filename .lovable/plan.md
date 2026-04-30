
## Problema

1. **Tooltips**: Os botões "Cancelar lote" e "Cancelar tudo" já têm tooltips, mas o pedido é garantir que estejam claros e completos.
2. **Persistência draft-batch**: O mapa `draftId <-> batchId` vive apenas em `useState` (campo `activeBatchId` dentro de cada `V8DraftSlot`). Se o usuário recarregar a página, o `activeBatchId` é `null` no localStorage porque o `saveDrafts` já salva os drafts inteiros (incluindo `activeBatchId`). **Porém**, o auto-switch via Realtime perde a referência porque o `setDrafts` dentro do listener `postgres_changes` compara `batchName` com drafts que podem ter sido resetados. Solução: salvar um mapa auxiliar `v8:draft-batch-map` no localStorage e usá-lo para restaurar o estado na inicialização.
3. **Card de progresso não aparece**: O `BatchProgressTable` só renderiza quando `activeBatchId` é truthy (linha 593). Quando o "Executar todos em sequência" enfileira os lotes via `queueAllDrafts`, ele **não** seta `activeBatchId` em nenhum draft --- apenas cria lotes no banco com status `queued`. O auto-switch listener espera um UPDATE para `processing`, mas o primeiro lote da fila pode demorar até 1 min (cron). Além disso, se o `batchName` do draft não bater exatamente com o nome do batch no banco, o `find` falha silenciosamente.

## Plano (etapa única)

### 1. Tooltips dos botões (BatchActionsBar.tsx)

Os tooltips já existem e são detalhados. Vou apenas revisar o texto para ficar mais direto e leigo:

- **Cancelar lote**: "Para novas consultas. CPFs já enviados para a V8 continuam sendo ouvidos (não desperdiça consulta paga). Resultados com sucesso são preservados."
- **Cancelar tudo**: "Para TUDO imediatamente. Ignora inclusive resultados de CPFs que já foram enviados para a V8 (consultas pagas serão perdidas). Use só em emergência."

### 2. Persistir mapa draftId <-> batchId (V8NovaSimulacaoTab.tsx + v8DraftSlots.ts)

- O `saveDrafts` já serializa `activeBatchId` dentro de cada draft para o localStorage. O problema é que o listener Realtime faz `setDrafts` com um `find` por `batchName` que pode não encontrar o draft correto se o nome foi limpo após enfileirar.
- **Solução**: Criar um mapa auxiliar `v8:draft-batch-map` (`Record<string, string>` = `{ [draftId]: batchId }`).
  - Quando `queueAllDrafts` retorna resultados com `status='queued'`, gravar no mapa o `draftId -> batchId` (precisa que `queueAllDrafts` retorne o `batchId` --- hoje não retorna, vou adicionar).
  - Na inicialização do componente, ler o mapa e restaurar `activeBatchId` nos drafts correspondentes.
  - No listener Realtime, usar o mapa para encontrar o draft correto (em vez de depender de `batchName`).
  - Quando batch completa/cancela, remover do mapa.

### 3. Mostrar card de progresso automaticamente (V8NovaSimulacaoTab.tsx + v8RunAllDrafts.ts + v8-clt-api)

- **v8RunAllDrafts.ts**: `queueAllDrafts` precisa retornar o `batchId` criado no backend. Adicionar campo `batchId` ao `RunAllItemResult`.
- **v8-clt-api** (action `queue_batch`): Já retorna `data.batch_id` na resposta. Basta propagá-lo.
- **V8NovaSimulacaoTab.tsx**:
  - Após `queueAllDrafts`, para cada resultado `queued`, setar `activeBatchId` no draft correspondente e salvar no mapa localStorage.
  - Isso faz o `BatchProgressTable` renderizar imediatamente (condição `activeBatchId` truthy).
  - O auto-switch Realtime continua funcionando para trocar de aba quando o batch muda para `processing`.
  - Invocar `v8-scheduled-launcher` imediatamente após enfileirar para não esperar 1 min.

### Arquivos editados

| Arquivo | Mudança |
|---------|---------|
| `src/components/v8/nova-simulacao/BatchActionsBar.tsx` | Revisar texto dos tooltips |
| `src/lib/v8DraftSlots.ts` | Funções `loadDraftBatchMap`, `saveDraftBatchMap`, `removeDraftBatchEntry` |
| `src/lib/v8RunAllDrafts.ts` | Retornar `batchId` no `RunAllItemResult` |
| `src/components/v8/V8NovaSimulacaoTab.tsx` | (a) Após `queueAllDrafts`, setar `activeBatchId` nos drafts + salvar mapa. (b) Na inicialização, restaurar mapa. (c) No listener Realtime, usar mapa ao invés de `batchName`. (d) Invocar launcher após enfileirar. |

### Checklist manual pós-implementação

1. Criar 3 rascunhos (A=1 CPF, B=2 CPFs, C=3 CPFs).
2. Clicar "Executar todos em sequência" --- confirmar.
3. Verificar que o card "Progresso do Lote" aparece imediatamente na aba do rascunho A com 1 CPF.
4. Ao concluir o lote A, a aba deve mudar automaticamente para B e mostrar 2 CPFs.
5. Recarregar a página durante a execução --- o progresso deve continuar visível.
6. Testar "Cancelar lote" e "Cancelar tudo" --- ler os tooltips e confirmar que estão claros.
