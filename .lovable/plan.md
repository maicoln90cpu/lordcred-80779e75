## Diagnóstico do erro

Investiguei no banco a Gabriele e o Paulo:

| CPF | Margem | sim_month_min | config_id |
|---|---|---|---|
| Gabriele | R$ 148,93 | 24 | `ea0642f0...` |
| Paulo | R$ 80,78 | 24 | `ea0642f0...` |

E no `v8_configs_cache` essa config_id **NÃO EXISTE** (cache só tem 6 entries de outras tabelas).

**Causa raiz**: o botão tenta carregar `number_of_installments` da tabela no cache local. Como a tabela não está cacheada, retorna array vazio → cai no toast "Tabela não tem prazos compatíveis com a margem mínima da V8".

A mensagem de erro é enganosa — o problema não é prazo incompatível, é **cache incompleto**.

---

## Correção (Bloco D — fallback de tabela)

**Arquivo**: `src/components/v8/FindBestProposalButton.tsx`

### Mudança 1 — fallback de parcelas
Quando a config_id não está no cache, usar conjunto padrão CLT V8:
```ts
const DEFAULT_CLT_INSTALLMENTS = [6, 8, 10, 12, 18, 24, 36, 46];
```
A V8 valida na chamada real de qualquer jeito — se o prazo for inválido para a tabela específica, a V8 recusa e o toast informa com a mensagem real.

### Mudança 2 — mensagem de erro mais precisa
Trocar "Tabela não tem prazos compatíveis com a margem mínima da V8" por algo que reflita a realidade:
- Se o filtro `n >= minMonth` zerar tudo → "Nenhum prazo da tabela atende ao mínimo da V8 (24x). Margem muito baixa."

### Comportamento esperado após fix
- **Gabriele** (margem 148,93, min 24): vai testar [24, 36, 46], escolher 46x com valor ~R$ 3.500. V8 deve aceitar.
- **Paulo** (margem 80,78, min 24): vai testar [24, 36, 46], escolher 46x com valor ~R$ 1.900. V8 deve aceitar (no outro sistema deu R$ 971 em 24x — bem dentro do que conseguimos).

---

## Pendência paralela (não bloqueia esse fix)

A `v8_configs_cache` está desatualizada — config `ea0642f0...` é usada em produção mas não está cacheada. Precisamos:
1. Verificar onde o cache é populado.
2. Forçar refresh (pode ser uma função separada futura).

Por enquanto, o fallback resolve o problema imediato.

---

## Checklist manual após fix

1. Abrir card da **Gabriele** → clicar "🔍 Encontrar proposta viável" → toast deve mostrar "Simulando V8: 46x · valor ~R$ 3.5xx..." → resultado.
2. Repetir com **Paulo** → toast com 46x · ~R$ 1.9xx.
3. Se a V8 recusar (taxa real maior que estimada), toast vai dizer o motivo da V8 — não falha silenciosamente.
4. Conferir no banco que `simulate_status` mudou para `success`.

## Prevenção de regressão

- Adicionar teste no `v8FindBestProposal.test.ts`: quando `installmentOptions = DEFAULT_CLT_INSTALLMENTS` e margem 80,78, retorna combinação válida ≥ R$ 500.
- Comentário no código explicando por que existe o fallback (caso config não exista no cache).
