## Correções na view Semana do RH

### Problema
Eventos com `ends_at` longo (ex.: "Início 15 dias depois" criando evento que dura dias) inflam a altura do bloco para milhares de px → grid renderiza scroll vertical gigante e células minúsculas.

### Verificação do plano original
Reli o plano aprovado anterior. Tudo foi implementado:
- ✅ Aba "Semana" entre Mês e Lista (ícone CalendarRange)
- ✅ Grid 7 dias × 24h com sticky header
- ✅ Dia atual destacado em círculo (primary)
- ✅ Linha vermelha "now indicator"
- ✅ Eventos posicionados por horário/duração + lanes p/ overlap
- ✅ Click em slot vazio cria evento com data/hora preenchida
- ✅ Click em evento abre dialog de edição
- ✅ Botões ← Hoje → de navegação semanal
- ✅ Filtros e badge herdados do toolbar pai
- ✅ Tokens HSL, sem cores hardcoded
- ⚠️ Faltou: **clamp de eventos longos ao dia visível** (causa do bug atual)
- 🔮 Pendentes futuros (já documentados): drag-to-move, all-day, sync Google.

### Correções (Etapa única)

**Arquivo**: `src/components/hr/HRCalendarWeekView.tsx`

1. **Clamp de duração**: em `layoutDay`, limitar `startMin`/`endMin` ao intervalo `[0, 1440]`. Eventos multi-dia mostram apenas a fatia daquele dia (mesma lógica do Google Calendar).
2. **Filtrar eventos fora do dia**: descartar itens cuja janela não intersecta o dia.
3. **Altura máxima da grade**: a grade interna fica fixa em `24 * HOUR_PX = 1152px` — o scroll do container externo (`maxHeight: 70vh`) já existe e passa a funcionar corretamente quando os eventos não inflam mais o conteúdo.
4. **Default sem `ends_at`**: subir de 30 min para 60 min (mais visível e padrão Google).
5. **Robustez extra**: adicionar `overflow-hidden` na coluna do dia para prevenir vazamento caso algum cálculo escape.

### Antes vs Depois
- Antes: evento com 15 dias de duração = bloco de ~17.000px → scroll quilométrico, slots ilegíveis.
- Depois: mesmo evento aparece como faixa do início do dia até 23:59 (clampado), grid mantém altura natural de 24h.

### Vantagens / Desvantagens
- ✅ Suporta eventos multi-dia sem quebrar layout (mostra fatia diária).
- ✅ Compatível com schema atual (sem coluna `all_day`).
- ⚠️ Eventos multi-dia ainda não são marcados visualmente como "contínuos" (faixa horizontal no topo) — fica para futuro.

### Checklist manual
1. `/admin/hr` → aba Calendário → Semana.
2. Verificar que o scroll vertical voltou ao tamanho normal (24h apenas).
3. Eventos longos aparecem clampados (ex.: "Início 15 dias..." aparece na coluna do dia 4, do horário inicial até 23:59).
4. Eventos curtos seguem normais (ex.: 09:00–10:00).
5. Click em evento ainda abre edição.
6. Click em slot vazio ainda cria evento.

### Pendências
- Agora: nenhuma.
- Futuro: faixa visual all-day no topo p/ eventos multi-dia, drag-to-move/resize, sync Google.

### Prevenção de regressão
- Função `layoutDay` continua pura — testável.
- Clamp explícito ao `dayEndMin = 24*60` evita qualquer overflow no DOM.
- `overflow-hidden` na coluna como cinto de segurança.
