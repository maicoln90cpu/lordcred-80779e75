

# Plano: Correção Contrato + Consolidação Corban

## Problema 1: Contrato Visualizar — Tela Cinza e PDF em Branco

### Diagnóstico
A edge function `downloadPdfProxy` busca o PDF da ClickSign via URL construída (`/accounts/{id}/download/packs/direct/{docId}?kind=original|signed`). A resposta pode ser uma página HTML de redirecionamento (não o PDF real), resultando em base64 de um HTML — por isso o iframe mostra cinza e o download gera arquivo em branco.

Além disso, o `ContractViewerDialog` cria o Blob URL **fora** de `useMemo`/`useEffect`, recriando-o a cada render e potencialmente causando leaks de memória.

### Correção

**Edge Function `clicksign-api/index.ts`:**
- Na função `downloadPdfProxy`, após o fetch, validar que o `Content-Type` da resposta contém `application/pdf`. Se não for PDF (ex: HTML de redirect), seguir redirecionamentos manualmente ou extrair a URL real do HTML.
- Adicionar `redirect: 'follow'` no fetch para garantir que redirecionamentos sejam seguidos automaticamente.
- Validar os primeiros bytes do ArrayBuffer: um PDF válido começa com `%PDF`. Se não começar, logar erro e retornar mensagem clara.
- Deploy automático da edge function.

**Frontend `ContractViewerDialog.tsx`:**
- Mover criação do Blob URL para `useMemo` com dependência em `pdfBase64`, evitando recriações.
- Usar `useEffect` para revogar o URL quando o componente desmonta ou o base64 muda.
- Adicionar tratamento de erro: se `pdfBase64` não gerar Blob válido, mostrar mensagem "Erro ao carregar PDF" em vez de tela cinza.

### Como ficará
Ao clicar "Visualizar Contrato", o PDF abrirá corretamente dentro do modal. Se houver erro na ClickSign, o sistema mostrará mensagem explicativa em vez de tela cinza.

---

## Problema 2: Consolidação de Dados Corban

### O que será feito

**1. Migration — Tabela `corban_propostas_snapshot`**

```text
Colunas:
  id (uuid PK)
  snapshot_date (timestamptz, default now())
  proposta_id (text)
  cpf (text)
  nome (text)
  banco (text)
  produto (text)
  status (text)
  valor_liberado (numeric)
  valor_parcela (numeric)
  prazo (text)
  vendedor_nome (text)
  data_cadastro (text)
  convenio (text)
  raw_data (jsonb)
  created_by (uuid)

RLS: Privileged can ALL, Authenticated can SELECT
Índices: snapshot_date, status, banco
```

**Cleanup automático:** Função SQL `cleanup_old_corban_snapshots()` que remove snapshots > 90 dias + cron job diário.

**2. CorbanPropostas.tsx — Botão "Salvar Snapshot"**

Adicionar botão que:
- Busca propostas padrão dos últimos 30 dias via API Corban
- Normaliza os dados
- Insere no banco `corban_propostas_snapshot` com o `user.id` como `created_by`
- Mostra toast com quantidade salva

**3. CorbanDashboard.tsx — Seção de Analytics**

Nova seção abaixo dos cards de navegação com:

- **Gráfico de evolução por status** (BarChart, últimos 30 dias de snapshots agrupados por semana + status)
- **Ranking de vendedores** (BarChart horizontal, top 10 por valor_liberado somado)
- **Distribuição por banco** (PieChart com cores do padrão COLORS)
- **Top status com valores** (tabela simples com status, quantidade e valor agregado)
- **KPIs avançados** em 3 cards:
  - Taxa de aprovação (aprovadas/total × 100%)
  - Ticket médio (valor total / quantidade)
  - Prazo médio (média dos prazos numéricos)

Todos os gráficos usam Recharts (já instalado e usado em Performance, ChipMonitor, etc.).

Os dados vêm da tabela `corban_propostas_snapshot` via query Supabase no frontend, filtrados pelos últimos 30 dias.

### Arquivos alterados
| Arquivo | Ação |
|---------|------|
| `supabase/functions/clicksign-api/index.ts` | Corrigir `downloadPdfProxy` |
| `src/components/partners/ContractViewerDialog.tsx` | Corrigir Blob URL lifecycle |
| Migration SQL (nova) | Criar `corban_propostas_snapshot` + cleanup cron |
| `src/pages/admin/CorbanPropostas.tsx` | Botão "Salvar Snapshot" |
| `src/pages/admin/CorbanDashboard.tsx` | Seção de analytics com gráficos |

### Vantagens
- Contrato funcional: elimina tela cinza e downloads vazios
- Histórico Corban persistido para comparação temporal
- Dashboard executivo com métricas reais
- Cleanup automático evita crescimento descontrolado do banco

### Desvantagens
- Snapshots ocupam espaço (mitigado pelo cleanup de 90 dias)
- KPIs dependem de snapshots salvos manualmente (não é automático)

### Etapas de implementação
1. Corrigir contrato (edge function + frontend)
2. Migration da tabela snapshot + cron
3. Botão "Salvar Snapshot" no CorbanPropostas
4. Dashboard analytics no CorbanDashboard

