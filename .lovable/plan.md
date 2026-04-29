## Diagnóstico do erro persistente na importação

### O que confirmei investigando o código e o banco

1. **Não existe mais nenhum `.upsert()` com `onConflict` apontando para `commission_rates_clt_v2` ou `commission_rates_fgts_v2`** em todo o projeto (verificado com `rg`). O `rateUpsert.ts` faz pre-fetch + INSERT/UPDATE manual.
2. **O índice único do banco é case-sensitive** em `bank` e `table_key` — confirmado:
   `CREATE UNIQUE INDEX commission_rates_clt_v2_uniq ON (bank, COALESCE(table_key,''), term_min, term_max, has_insurance, effective_date)`
3. **O screenshot mostra a mensagem "there is no unique or exclusion constraint matching the ON CONFLICT specification"** — essa mensagem **só aparece quando o cliente envia `ON CONFLICT`**. Como o código atual não faz isso, **o erro veio de bundle antigo carregado no navegador** (cache, antes do último deploy entrar).

### Por que ainda assim o upsert manual pode falhar em casos extremos

Existem 2 cenários remanescentes que NÃO geram a mensagem do screenshot, mas geram `duplicate key value violates unique constraint`:

- **Caixa diferente entre planilha e banco**: planilha traz `Facta / Gold`, banco tem `FACTA / GOLD`. Meu `rateKey()` normaliza para uppercase e acha match → UPDATE ok. **Mas o INSERT de uma linha realmente nova com `bank='Facta'` cria duplicata para o índice case-sensitive** se já existir `FACTA` no banco.
- **Planilha com duplicatas internas exatas pelo índice**: hoje meu dedup local resolve.

A solução robusta é **normalizar bank e table_key para UPPERCASE no payload** antes do INSERT/UPDATE, garantindo que tudo grava em maiúsculas no banco — o que também alinha com a função `calculate_commission_v2` que usa `UPPER(NEW.bank)`.

---

## Plano de implementação

### 1. Normalizar bank/table_key no upsert (corrige a causa real do erro)
- Em `src/components/commissions-v2/rateUpsert.ts`: aplicar `.trim().toUpperCase()` em `bank` e `table_key` no payload de INSERT.
- Em `RatesCLTTab.parseImportData` e `RatesFGTSTab.parseImportData`: idem no parser.
- Resultado: índice único e leitura da função de cálculo passam a usar a mesma representação canônica.

### 2. Mover botão "Limpar todas as vendas" para Zona de Perigo
- Em `src/components/commissions-v2/BaseTab.tsx`: remover o botão do header.
- Em `src/components/commissions-v2/ConfigTab.tsx`: já tem a Zona de Perigo (criado no turno anterior). Confirmar que o botão está lá com confirmação por "CONFIRMAR" e remover qualquer duplicata.

### 3. Aplicar contador "X novas / Y substituídas" no preview do FGTS V2
- Em `RatesFGTSTab.tsx` (linha 281): exibir o `importStats` (já calculado via `useEffect`) no preview, igual ao CLT.

### 4. Garantir que o botão "Importar" abre a planilha correta
- Verificar que o input file dispara abertura nativa (já está implementado, mas o screenshot mostra "Nenhum arquivo selecionado" — provavelmente o usuário ainda não clicou em "Procurar"). Sem mudança de código.

---

## Detalhes técnicos

```ts
// rateUpsert.ts — antes do INSERT/UPDATE
const norm = (r: RateRow): RateRow => ({
  ...r,
  bank: (r.bank || '').trim().toUpperCase(),
  table_key: r.table_key ? r.table_key.trim().toUpperCase() : null,
});
// aplicar em toInsert e em rows do UPDATE payload
```

Esse mesmo `norm()` deve ser aplicado nos dois tabs no `parseImportData` para que o preview já mostre o que será gravado.

### Arquivos editados
- `src/components/commissions-v2/rateUpsert.ts` (normalização)
- `src/components/commissions-v2/RatesCLTTab.tsx` (parser + remover SmartPaste se quiser; mantenho)
- `src/components/commissions-v2/RatesFGTSTab.tsx` (parser + contador no preview)
- `src/components/commissions-v2/BaseTab.tsx` (remover botão duplicado se existir)

### Não vou fazer (escopo enxuto)
- Mexer no `SmartPasteRatesButton` (ele faz `.insert()` simples; se der duplicata, reporta erro normal — pode ser próximo passo).
- Criar migração para tornar o índice `LOWER(bank), LOWER(table_key)` (alternativa mais invasiva — só se a normalização no client não bastar em algum caso futuro).

---

## Validação manual após implementação

1. Ir em `/admin/commissions-v2` → aba "Taxas CLT".
2. Clicar em "Importar" → escolher a planilha que falhou hoje.
3. Conferir no preview os contadores "X novas / Y substituídas".
4. Clicar em "Importar N taxas". Toast deve mostrar "X nova(s) inserida(s) · Y substituída(s)" sem erro.
5. Repetir o mesmo teste em "Taxas FGTS V2".
6. Em "Configurações" → "Zona de Perigo": confirmar que o botão "Limpar todas as vendas" está lá e exige digitar `CONFIRMAR`.

## Prevenção de regressão
- Adicionar caso de teste em `RatesCLTTab.parseImport.test.ts`: garantir que `bank` e `table_key` saem em UPPERCASE.
- Adicionar caso: planilha com `Facta`/`facta` deve produzir mesma chave canônica.

## Antes vs depois
- Antes: importação podia falhar por divergência de caixa entre planilha e banco; FGTS V2 sem contadores no preview; botão de limpeza duplicado.
- Depois: importação determinística (tudo em UPPERCASE); preview de FGTS V2 igual ao CLT; botão de limpeza só na Zona de Perigo.

## Pendências
- Migração opcional para case-insensitive no índice se aparecerem mais cenários no futuro.
- SmartPasteRatesButton ainda usa `.insert()` puro — se o usuário começar a colar texto livre, vale aplicar mesmo `upsertRates` lá.
