
# Plano — 4 ajustes + relatório de comissões V2

## 1) V8 Simulador — Histórico e persistência da Nova Simulação

**Problema atual**
- A mensagem de erro instrui "use Retentar para tentar novamente", mas o botão **não existe** na aba Histórico (só na Nova Simulação).
- Ao sair da aba "Nova Simulação", o estado em memória (lista de CPFs em processamento) é perdido — quando volta, fica vazio.

**O que farei**
- **Botão "Retentar falhados" no `V8HistoricoTab`** (dentro de cada lote expandido, no topo da tabela). Reaproveita o cron `v8-retry-cron` invocando-o sob demanda com `batch_id`, e respeita as mesmas regras (`shouldAutoRetry` — só `temporary_v8` / `analysis_pending`, dentro do `max_auto_retry_attempts`).
- **Persistência da Nova Simulação**: salvar o `currentBatchId` em `localStorage` (`v8:current-batch`) e, ao remontar o componente, recarregar as linhas via `useV8BatchSimulations(batchId)`. Assim, trocar de aba/recarregar a página não perde a tela.
- Atualizar o texto do erro para apontar corretamente: "Aguarde — o sistema vai retentar automaticamente. Você também pode usar o botão **Retentar falhados** acima."

## 2) Chat Interno — Shift+Enter quebra linha

**Hoje**: `InternalChat.tsx` usa `<Input>` (single-line). Enter envia, Shift+Enter não faz nada porque Input não suporta multi-linha.

**Mudança**: trocar por `<Textarea>` com `rows={1}` + auto-resize (até ~5 linhas), mantendo:
- `Enter` → envia
- `Shift+Enter` → quebra linha
- `Ctrl/Cmd+V` de imagem → continua funcionando (handler `onPaste` preservado)

## 3) Tickets — Anexar print/arquivo

**Hoje**: Dialog "Novo Ticket" tem só título, descrição e prioridade. Sem upload.

**Mudança**:
- Adicionar campo "Anexo (opcional)" no `BroadcastCreateDialog`-like dialog de novo ticket: aceita imagens (png/jpg/webp) e PDF, até 10MB.
- Upload para bucket `ticket-attachments` (criar via migration, RLS: ler quem tem acesso ao ticket; gravar = autor do ticket / privileged).
- Adicionar coluna `attachment_url text` e `attachment_name text` em `support_tickets` (migration).
- No painel do ticket, mostrar miniatura clicável (imagem) ou link de download (PDF).
- (Bonus) permitir anexar também nas **respostas** do ticket (`ticket_messages.attachment_url`) — opcional, marcar como pendência se quiser deixar para depois.

## 4) Relatório de divergências — Comissões Parceiros V2

A planilha enviada tem 75 linhas (FGTS à esquerda, CLT à direita). Já comparei amostras com `commission_rates_fgts_v2` e `commission_rates_clt_v2` e há **3 tipos de problema** óbvios:

**A. Duplicatas no banco V2 (CLT)** — exemplo: `Banco C6` 6m sem seguro aparece **3 vezes** com `rate=1.5`, `1.50`, `1.5`. C6 12m sem seguro aparece 3x com `2`, `2.00`, `2`. Causa: imports repetidos sem dedupe.

**B. Tabelas faltando no V2** vs planilha:
- FGTS: `LOTUS 1+ Com Seguro` (12%), `LOTUS 2+ Com Seguro` (10.5%), `LOTUS 3+ Com Seguro` (9.5%), `LOTUS 4+ Com Seguro` (7.5%), `LOTUS 1R+/2R+/3R+/4R+`, `LOTUS SEM TAC`, faixas `R$ 0,01–250` (20.5%) e `251–999.999,99` (17%).
- CLT: `MERCANTIL` e `MERCANTIL C/ SEG`, todas as `FACTA NOVO GOLD/SMART`, `V8 6/12/24/36`, `PRESENÇA 6/12/24/36`, `HUB SONHO/FOCO/CARTADA CLT`, `PRATA 6/12/24-36`, `HAPPY 12/18/24/36` (com e sem seg), `ZILICRED` (todas), `QUALIBANK 6/12/18/24/36`.

**C. Valores divergentes** — ex: planilha diz `FACTA GOLD PLUS 2 anos = 6.35%`, banco tem `17%`. Planilha `LOTUS 1+ = 11%`, banco bate (11). Planilha `PARANA 1x = 4%`, banco tem `14%`. Há claramente confusão entre **nomenclatura de prazo** (1 ano vs 1 parcela) e **escala de %** (alguns valores no banco parecem estar 2,5x acima).

**Entrega**
- Script Python compara cada linha da planilha com a tabela V2 (FGTS e CLT separados), gera um XLSX em `/mnt/documents/comissoes-v2-divergencias.xlsx` com 4 abas:
  1. **FGTS - Divergências** (coluna: planilha % vs banco %, status, sugestão)
  2. **CLT - Divergências**
  3. **Faltando no banco** (linhas da planilha sem correspondência V2)
  4. **Duplicatas** (entradas duplicadas em V2 a remover)
- Relatório também em Markdown no chat com top 10 itens críticos e o **SQL exato** para corrigir cada um (UPDATE/DELETE/INSERT).
- **Não vou alterar dados sem sua aprovação** — o relatório é diagnóstico; após você revisar, gero a migration de correção.

---

## Detalhes técnicos

- **v8-retry-cron**: já aceita `batch_id` opcional? Verificar; se não, adicionar parâmetro e filtro `WHERE batch_id = $1`.
- **localStorage chave**: `v8:current-batch:{user_id}` para isolar entre usuários.
- **Textarea auto-resize**: usar `useRef` + `el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'` no `onChange`, com `max-h-32`.
- **Bucket `ticket-attachments`**: público=false, signed URL de 1h ao exibir.
- **Migration tickets**: `ALTER TABLE support_tickets ADD COLUMN attachment_url text, attachment_name text;`
- **Comparador de taxas**: normalização (uppercase + strip + remover acentos + match fuzzy via `difflib.get_close_matches` com cutoff 0.85) — fundamental para casar "PARANA C/ SEGURO" com `PARANA BANCO has_insurance=true`.

## Pendências (após este plano)
- Correção de fato dos dados V2 (depende da sua revisão do relatório).
- Anexos em respostas do ticket (item 3, marcado como bonus).

## Prevenção de regressão
- Vitest para `shouldAutoRetry` já cobre. Adicionar caso para `retryFailedFromHistory(batchId)`.
- Constraint `UNIQUE(bank, table_key, term_min, term_max, has_insurance, min_value, max_value, effective_date)` em `commission_rates_clt_v2` e `_fgts_v2` para impedir novas duplicatas.
