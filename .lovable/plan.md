Plano para corrigir e completar a Semana do Calendário RH

Objetivo: deixar a aba Semana estável no estilo Google Calendar, sem precisar apertar F5, com faixa Dia inteiro controlada, editável e arrastável.

1. Corrigir o bug do drag n drop que volta para a data anterior

Problema identificado:
- O PATCH no Supabase está salvando com sucesso.
- Porém a tela usa um estado local antigo enquanto aguarda realtime/refetch.
- Como `hr_calendar_events` não está na publicação `supabase_realtime`, o evento não chega de volta automaticamente.
- Depois de 1,5s o estado otimista é limpo e o card volta visualmente para a data antiga.

Correção planejada:
- Fazer `createEvent`, `updateEvent` e `deleteEvent` atualizarem a lista local imediatamente após sucesso no banco.
- Fazer `updateEvent` retornar a linha atualizada via `.select().single()` e substituir o item no estado.
- Remover o comportamento que limpa o otimista “no escuro” antes de o dado real chegar.
- Prevenir clique acidental após arrastar, para o evento não abrir edição depois do drop.
- Ajustar o drag para usar estado/ref mais estável, evitando reprocessamentos desnecessários enquanto o mouse se move.

2. Ativar realtime de verdade para `hr_calendar_events`

Correção de banco planejada:
- Criar uma migration idempotente para adicionar `hr_calendar_events` à publicação realtime:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'hr_calendar_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_calendar_events;
  END IF;
END $$;
```

- Também aplicar `REPLICA IDENTITY FULL` para updates/deletes terem payload mais completo no realtime:

```sql
ALTER TABLE public.hr_calendar_events REPLICA IDENTITY FULL;
```

Correção de frontend planejada:
- Manter assinatura realtime no hook, mas torná-la mais útil:
  - INSERT: inserir/atualizar evento local.
  - UPDATE: substituir evento local.
  - DELETE: remover evento local.
  - fallback: refetch silencioso, sem colocar a tela inteira em “Carregando...”.
- Resultado esperado: criar, editar, excluir e arrastar aparecem na tela na hora, sem F5.

3. Agrupar a faixa Dia inteiro com botão “+N mais”

Como ficará:
- A faixa Dia inteiro terá limite visual fixo, por exemplo 2 linhas visíveis.
- Se houver mais eventos do que cabe em um dia, aparecerá um botão `+N mais` naquele dia.
- Ao clicar em `+N mais`, abrirá um popover compacto com os eventos ocultos daquele dia.
- Isso evita empilhamento infinito e impede a faixa de crescer demais.

Molde visual:

```text
Dia inteiro | [Evento longo ocupando seg-ter-qua] [Evento]
            | [Outro evento]                 [+3 mais]
```

4. Edição rápida na faixa Dia inteiro, sem dialog completo

Como ficará:
- Ao clicar em um bloco da faixa Dia inteiro, abrirá um popover pequeno, não o dialog grande.
- Campos do popover:
  - Título
  - Data de início
  - Data de fim
  - Botão Salvar
  - Botão Cancelar
- A alteração atualizará o calendário imediatamente.
- O dialog completo continuará existindo para eventos normais com horário e para criação completa.

5. Drag-to-move e drag-to-resize para eventos Dia inteiro

Como ficará na faixa superior:
- Arrastar o bloco pelo meio: move o intervalo inteiro para outros dias.
  - Exemplo: evento de 04 a 18 movido +2 dias vira 06 a 20.
- Arrastar a borda esquerda: altera o dia inicial.
- Arrastar a borda direita: altera o dia final.
- Snap será por dia inteiro, não por 15 minutos.
- O intervalo mínimo será 1 dia.
- O evento continuará com `all_day: true` e datas normalizadas:
  - início: `00:00 -03:00`
  - fim: `23:59 -03:00`

6. Organização técnica para não aumentar mais um componente gigante

Hoje `HRCalendarWeekView.tsx` já está grande. Para seguir a regra do projeto de componentes menores, a implementação será organizada assim:

- `src/hooks/useHRCalendarEvents.ts`
  - estado local imediato + realtime robusto.

- `src/components/hr/HRCalendarWeekView.tsx`
  - fica como orquestrador da semana.
  - remove parte da complexidade da faixa Dia inteiro.

- Novo componente planejado:
  - `src/components/hr/HRCalendarAllDayBand.tsx`
  - renderiza faixa Dia inteiro, agrupamento `+N mais`, popovers e drag horizontal.

- Novo helper planejado, se necessário:
  - `src/components/hr/hrCalendarWeekUtils.ts`
  - funções puras de datas/layout, como cálculo de colunas, lanes e normalização de horário São Paulo.

Observação importante:
- Não vou editar `src/integrations/supabase/types.ts`, pois a regra do projeto diz que esse arquivo é read-only.

7. Validação manual após implementar

Checklist:
1. Abrir `/admin/hr` → Calendário → Semana.
2. Criar evento novo e confirmar que aparece na hora, sem F5.
3. Editar título/data de um evento e confirmar atualização imediata.
4. Excluir evento e confirmar que some na hora.
5. Arrastar evento com horário de terça para quinta e confirmar que não volta para terça.
6. Redimensionar evento com horário e confirmar que duração salva.
7. Criar vários eventos Dia inteiro no mesmo dia e confirmar que aparece `+N mais`.
8. Clicar em `+N mais` e confirmar lista dos ocultos.
9. Clicar em um evento Dia inteiro e editar título/início/fim no popover compacto.
10. Arrastar evento Dia inteiro entre dias e confirmar que o intervalo é preservado.
11. Redimensionar borda esquerda/direita de evento Dia inteiro e confirmar novo intervalo.
12. Abrir em outra aba/sessão, criar/editar evento e confirmar atualização realtime.

Antes vs Depois

Antes:
- Drag parecia salvar, mas depois piscava e voltava.
- Criar/editar/excluir dependia de F5 em alguns casos.
- Faixa Dia inteiro podia empilhar eventos indefinidamente.
- Evento Dia inteiro só abria o dialog completo.
- Dia inteiro não tinha drag/resize.

Depois:
- Drag salva e permanece no lugar correto.
- Criar, editar e excluir atualizam a tela imediatamente e também via realtime.
- Faixa Dia inteiro fica compacta com `+N mais`.
- Edição rápida de título e intervalo direto na faixa.
- Eventos Dia inteiro podem ser movidos e redimensionados horizontalmente.

Vantagens e desvantagens

Vantagens:
- Corrige a causa raiz do F5 e do evento voltando.
- Interface mais próxima do Google Calendar.
- Menos scroll e menos poluição visual no topo.
- Operação mais rápida para editar eventos de vários dias.

Desvantagens/cuidados:
- A faixa Dia inteiro terá mais lógica de interação, então precisa de validação manual cuidadosa.
- Drag/resize por mouse será priorizado; suporte touch/mobile pode ficar para ajuste posterior se necessário.
- Realtime depende da migration ser aplicada no banco.

Pendências futuras, se quiser evoluir depois

- Suporte touch/mobile para drag.
- Sincronização real com Google Calendar.
- Teste automatizado específico para layout de eventos sobrepostos/multi-dia.

Prevenção de regressão

- Funções de cálculo de faixa Dia inteiro ficarão isoladas em helper/componente próprio.
- Realtime será habilitado por migration idempotente.
- O hook manterá atualização local imediata, então mesmo se realtime atrasar, a tela não volta para o estado antigo.
- O checklist acima cobre os cenários que quebraram: drag entre dias, criação sem F5 e muitos eventos Dia inteiro.