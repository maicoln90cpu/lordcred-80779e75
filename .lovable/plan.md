# Plano — 3 ajustes (V2 + V8 Histórico)

## 1) Remover botão "Pré-preencher 28 taxas"

**Por que:** as 28 taxas já não são fonte da verdade — a planilha oficial (que acabamos de migrar) tem regras diferentes (PARANA achatado em 2 linhas, LOTUS com mais variantes, FACTA com Novo Gold/Smart, etc.). Se alguém clicar nesse botão hoje, ele **insere 28 linhas duplicadas/erradas** por cima da base limpa que acabamos de subir, e o `UNIQUE INDEX` criado vai bloquear parte e deixar inconsistência.

**O que fazer:**
- Em `src/components/commissions-v2/RatesFGTSTab.tsx`:
  - Remover o array `PRESET_RATES` (linhas 19–48).
  - Remover a função `prefillPresets` (linhas 114–121).
  - Remover o botão `<Button ... onClick={prefillPresets}>Pré-preencher 28 taxas</Button>` (linha 185).
  - Remover o ícone `Sparkles` do import (linha 11) se ficar sem uso.
  - Trocar a mensagem de estado vazio (linha 210) para: *"Nenhuma taxa cadastrada — use 'Importar' ou 'Colar Inteligente' para subir as taxas oficiais."*

---

## 2) Indicadores e Metas em V2 mostram dados (mesmo com base vazia)

**Causa real:** `CommIndicadores.tsx` e `CommMetas.tsx` estão lendo da tabela **`commission_sales` (V1)**, não de `commission_sales_v2`. Por isso, mesmo com V2 zerada, aparecem 31 vendas, R$ 3.046,68, ranking de vendedores, faixas de bônus etc. — são os dados do V1 vazando para a sandbox.

**Diagnóstico confirmado no banco:**
- `commission_sales` (V1) = 189 linhas
- `commission_sales_v2` = 0 linhas

**O que fazer (sem quebrar V1):** os mesmos componentes são usados em `/admin/commissions` (V1) e `/admin/commissions-v2` (V2). Solução: aceitar uma prop opcional `tableName` (default `'commission_sales'`) e propagá-la para os 2 selects.

- Em `CommIndicadores.tsx`:
  - Adicionar prop `tableName?: 'commission_sales' | 'commission_sales_v2'` (default `'commission_sales'`).
  - Trocar `supabase.from('commission_sales')` por `supabase.from(tableName)`.
- Em `CommMetas.tsx`:
  - Mesma prop, mesma troca na linha 64 (e em qualquer outra leitura de `commission_sales`/`commission_settings`/`commission_bonus_tiers`/`commission_annual_rewards` que esteja hardcoded — vou auditar e versionar para `_v2` quando aplicável).
- Em `src/pages/admin/CommissionsV2.tsx`:
  - Passar `tableName="commission_sales_v2"` para `<CommIndicadores />` e `<CommMetas />`.
  - Para Metas, também passar as tabelas espelho `_v2` de settings/bonus/annual rewards (auditar `CommMetas.tsx` e expor essas props se necessário).
- Em `src/pages/admin/Commissions.tsx` (V1): nada muda — usa o default.

**Resultado esperado em V2 após o ajuste:**
- Vendas Abril = 0, Comissão Abril = R$ 0,00, Top Vendedor = "—", Banco Destaque = "—".
- Faixas de Bônus = todas em 0 contratos.
- Quando o usuário usar "📋 Copiar V1 → V2" ou cadastrar vendas direto no V2, os números aparecem corretamente.

---

## 3) Botão "Retentar" no header de cada lote (Histórico V8)

**Hoje:** o botão "Retentar falhados" só aparece **dentro** do detalhe expandido do lote, depois de clicar para abrir.
**Quero:** mostrar também no header colapsado, ao lado dos badges (status / X/Y ok / %), com a contagem de falhas retentáveis. Assim o usuário retenta sem precisar abrir cada lote.

**O que fazer em `src/components/v8/V8HistoricoTab.tsx`:**
- Criar um pequeno hook/componente `BatchRetryButton({ batchId })` que:
  - Carrega contagem de simulações `failed` com `kind` retentável (mesma lógica do `BatchDetail`, mas só `count` — query leve).
  - Se contagem > 0, renderiza botão `<RefreshCw /> Retentar (N)` no header.
  - Ao clicar (com `e.stopPropagation()` para não expandir/colapsar), chama `supabase.functions.invoke('v8-retry-cron', { body: { batch_id, manual: true } })` igual ao detalhe.
- Inserir esse botão no header do lote (entre os badges de "ok" e "%").
- Reutilizar o toast existente.

**Alternativa mais simples (se preferir):** em vez de query separada por lote, expandir `useV8Batches` para retornar `failed_retriable_count` por lote (uma única RPC/agregação). Recomendado se houver muitos lotes (evita N queries). Posso fazer isso via uma RPC `get_v8_batches_with_retriable()` ou um segundo `select` agrupado.

**Decisão pendente — pergunta para você:** prefere a opção (a) query leve por lote no header (simples, mais requests) ou (b) agregação única no hook `useV8Batches` (mais eficiente, exige migração)? Default sugerido: **(a)** se você costuma ter < 30 lotes visíveis; **(b)** se passar disso. Confirma qual aplico.

---

## Arquivos afetados
- `src/components/commissions-v2/RatesFGTSTab.tsx` (remoção)
- `src/components/commission-reports/CommIndicadores.tsx` (prop tableName)
- `src/components/commission-reports/CommMetas.tsx` (prop tableName + aux tables)
- `src/pages/admin/CommissionsV2.tsx` (passar props _v2)
- `src/components/v8/V8HistoricoTab.tsx` (botão no header)
- (opcional) `src/hooks/useV8Batches.ts` se escolher opção (b)

## Prevenção de regressão
- Criar teste leve (vitest) garantindo que `CommIndicadores` chama `supabase.from(tableName)` com a prop recebida — evita alguém futuro reverter para hardcoded.
- Comentário no topo de `CommIndicadores.tsx` e `CommMetas.tsx`: *"Sempre receba `tableName` via prop — não hardcodar `commission_sales`, senão V2 vaza dados de V1."*

## Checklist manual após aplicar
1. Abrir `/admin/commissions-v2` → aba **Indicadores**: tudo zerado.
2. Aba **Metas**: todos vendedores com 0 contratos, R$ 0,00.
3. Aba **Taxas FGTS**: o botão "Pré-preencher 28 taxas" não existe mais; estado vazio mostra a nova mensagem.
4. Abrir `/admin/commissions` (V1): Indicadores e Metas continuam mostrando os 189 registros normalmente.
5. Em `/admin/v8-simulador` → Histórico: lotes com falhas retentáveis mostram o botão "Retentar (N)" direto no card, sem precisar expandir. Clicar dispara a retentativa e mostra toast.
