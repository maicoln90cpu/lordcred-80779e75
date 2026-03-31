# LordCred — Sistema de Auditoria de Comissões

## Visão Geral

O módulo de Relatório de Comissões (`/admin/commission-reports`) é um sistema de auditoria que cruza quatro fontes de dados para calcular e comparar comissões esperadas vs recebidas. Acessível na sidebar como "Relatório de Comissões".

---

## Arquitetura de Dados

### Tabelas de Import (via Ctrl+V paste)

| Tabela | Fonte | Descrição |
|---|---|---|
| `cr_relatorio` | Planilha "Relatório" | **Fonte primária** — vendas com dados do contrato |
| `cr_geral` | Planilha "Geral" | Produção geral (cms_rep = comissão recebida) |
| `cr_repasse` | Planilha "Repasse" | Dados de repasse (cms_rep_favorecido) |
| `cr_seguros` | Planilha "Seguros" | Comissões de seguro (valor_comissao) |

### Tabelas de Regras (configuração manual)

| Tabela | Descrição |
|---|---|
| `cr_rules_clt` | Regras CLT: banco, tabela_chave, seguro, prazo_min/max, taxa, data_vigencia |
| `cr_rules_fgts` | Regras FGTS: banco, tabela_chave, seguro, min_valor/max_valor, taxa, data_vigencia |

### Tabelas de Histórico

| Tabela | Descrição |
|---|---|
| `cr_historico_gestao` | Fechamentos (nome, período, totais) |
| `cr_historico_detalhado` | Contratos individuais de cada fechamento |
| `import_batches` | Controle de lotes de importação |

---

## Fluxo de Import

```
Usuário cola dados (Ctrl+V) → clipboardParser.ts analisa TSV
→ Preview com contagem de registros
→ Click "Importar" → cria import_batch + insere registros
→ Detecção de duplicatas por batch_id
```

### Particularidades por módulo

- **Geral/Repasse**: Headers com pontos (ex: `Cód. Contrato`) são normalizados removendo pontos
- **Seguros**: Parsing headerless (dados sem cabeçalho, 8 colunas fixas)
- **Relatório**: CPF preservado como texto (evita notação científica `9.67E+10`)
- **Datas**: Formato Excel (número serial) convertido para timestamp com timezone São Paulo

---

## Motor de Cálculo — Comissão Esperada

### Identificação do Produto

```
cr_relatorio.produto:
  - "FGTS" → usa motor FGTS
  - "Crédito do Trabalhador" → usa motor CLT
  - Outros → retorna 0
```

### CLT: extractTableKeyCLT → findCLTRate

**Extração da chave de tabela** (`extractTableKeyCLT`):

| Banco | Lógica |
|---|---|
| Hub Credito | Busca palavras-chave: "SONHO" → "SONHO", "FOCO" → "FOCO NO CORBAN", "36X COM SEGURO" → "36X COM SEGURO", "FLEX" → "FLEX" |
| Lotus Mais | Último caractere da tabela (ex: "TABELA A" → "A") |
| Ole / Facta | Busca "COM SEGURO" ou "SEM SEGURO" no campo tabela |
| Presença Bank | Busca "Seguro 2" → "Seguro 2 Parcelas", "Seguro 4" → "Seguro 4 Parcelas" |
| C6 Bank | Busca "Seguro 2" ou "Seguro 4" → mesma lógica de Presença |
| Outros | `"*"` (wildcard — soma todas as regras aplicáveis) |

**Busca da taxa** (`findCLTRate`):

```
1. Filtra cr_rules_clt por banco + data_vigencia ≤ data_pago (mais recente)
2. Se chave específica encontrada:
   → Soma taxas onde tabela_chave = chave AND prazo_min ≤ prazo ≤ prazo_max AND seguro match
3. Se chave = "*":
   → Soma TODAS as taxas onde tabela_chave = "*" AND prazo/seguro match
4. Comissão = taxa_total × valor_liberado
5. Exceção Mercantil: base = valor_liberado / 0.7
```

### FGTS: extractTableKeyFGTS → findFGTSRate

**Extração da chave de tabela** (`extractTableKeyFGTS`):

| Banco | Lógica |
|---|---|
| Lotus Mais | Último caractere da tabela |
| Paraná Banco | Busca "SEGURO" → "SEGURO", "PARANA" → "PARANA", senão `"*"` |
| Outros | `"*"` (wildcard) |

**Busca da taxa** (`findFGTSRate`):

```
1. Filtra cr_rules_fgts por banco + data_vigencia ≤ data_pago (mais recente)
2. Busca taxa base: tabela_chave = "*" AND min_valor ≤ valor ≤ max_valor AND seguro match
3. Busca taxa específica: tabela_chave = chave (se ≠ "*") AND mesmos filtros
4. Soma as duas taxas
5. Comissão = taxa_total × valor_liberado
```

### Seguro Match Logic

```
Regra seguro = "Ambos" → sempre match
Regra seguro = "Sim" → match se contrato tem seguro = "Sim"
Regra seguro = "Não" → match se contrato tem seguro ≠ "Sim"
```

---

## Cross-Reference — Comissão Recebida

A comissão recebida é obtida cruzando o `num_contrato` (de cr_relatorio) com:

1. **cr_geral**: `cod_contrato` → `cms_rep`
2. **cr_repasse**: `cod_contrato` → `cms_rep` + `cms_rep_favorecido`
3. **cr_seguros**: Soma `valor_comissao` do mesmo batch/período

```
Recebida = geral.cms_rep + repasse.cms_rep + repasse.cms_rep_favorecido + seguros.valor_comissao
```

---

## Timezone

Todos os cálculos de data usam `America/Sao_Paulo`:

```typescript
function toSaoPauloDate(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : d;
  const sp = date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(sp);
}
```

Filtros de período no Resumo usam range inclusivo:
- Data início: `>= dia 00:00:00 SP`
- Data fim: `< dia+1 00:00:00 SP`

---

## Abas do Módulo

| Aba | Função |
|---|---|
| **Geral** | Visualizar dados importados de produção geral |
| **Repasse** | Visualizar dados de repasse |
| **Seguros** | Visualizar dados de seguros |
| **Relatório** | Visualizar vendas + comissão esperada calculada + recebida cruzada |
| **Resumo** | Filtros de período, KPIs, resumo por banco, tabela detalhada |
| **Indicadores** | Acurácia Global, Perda Acumulada, Taxa Média por banco |
| **Regras CLT** | CRUD de regras de comissão CLT |
| **Regras FGTS** | CRUD de regras de comissão FGTS |
| **Hist. Importações** | Histórico de lotes importados (com deleção) |
| **Histórico** | Fechamentos salvos (expandir para ver contratos) |
| **Divergências** | Contratos com |diferença| > R$0.01 |

---

## Indicadores (KPIs)

- **Acurácia Global**: % de contratos onde |esperada - recebida| < R$1.00
- **Perda Acumulada**: Soma das diferenças negativas (recebida < esperada)
- **Ganho Extra**: Soma das diferenças positivas (recebida > esperada)
- **Taxa Média por Banco**: Média da taxa de comissão por banco
- **Breakdown por banco**: Tabela com acurácia, perda e taxa média individuais

---

## Ver Também

- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [INSTRUCOES.md](./INSTRUCOES.md) — Manual de uso
- [PRD.md](./PRD.md) — Requisitos do produto
