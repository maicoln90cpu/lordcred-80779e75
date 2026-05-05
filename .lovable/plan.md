## Objetivo
Adicionar uma 4ª aba **Semana** no calendário do RH (`/admin/hr` → Calendário), no mesmo molde do Google Agenda da imagem: 7 colunas (Dom–Sáb) × eixo Y de horários, com eventos posicionados por horário e duração.

## Antes vs Depois
- **Antes**: 3 views — Mês, Lista, Agenda (30 dias).
- **Depois**: 4 views — Mês, **Semana** (nova), Lista, Agenda. A view Semana exibe a grade semanal estilo Google Calendar com navegação de semana (← Hoje →), mantendo os mesmos filtros (Candidatos/Colaboradores) e o botão "Novo evento".

## Escopo da nova view (Semana)

### Layout
```
              DOM 3  SEG 4  TER 5  QUA 6  QUI 7  SEX 8  SAB 9
GMT-03   ┌─────────────────────────────────────────────────────┐
 7 AM    │                                                      │
 8 AM    │                                                      │
 9 AM    │                                                      │
10 AM    │                          [SISTEMA PONTO 10:30-11:30] │
11 AM    │                                                      │
...      │ [Apresentação 14:00] (segunda)                       │
└─────────────────────────────────────────────────────────────┘
```
- Cabeçalho sticky com dias da semana + número do dia (dia atual destacado em círculo azul, igual Google).
- Coluna fixa esquerda com horários (00:00 → 23:00, slots de 1h, altura 48px cada).
- Linha vermelha "now indicator" no dia/hora atual.
- Eventos renderizados como blocos absolutamente posicionados:
  - `top` = (hora_inicio em minutos / 60) × 48px
  - `height` = duração em minutos × (48/60), mínimo 24px
  - cor da borda esquerda + fundo translúcido pelo `EVENT_TYPE_TOKEN` (já existente)
  - eventos sobrepostos no mesmo dia dividem largura (algoritmo simples de "lanes")
- Click em evento → abre o mesmo dialog de edição já existente.
- Click em slot vazio → abre dialog de criação pré-preenchendo data/hora.

### Toolbar da view Semana
- Botões `← Hoje →` para navegar semana (`addWeeks/subWeeks`).
- Label "Semana de DD/MM – DD/MM/YYYY" (locale ptBR).
- Filtro Candidatos/Colaboradores e badge total — herdados do toolbar pai (já existente).

## Arquivos

### Novo: `src/components/hr/HRCalendarWeekView.tsx` (~220 linhas)
Componente da view semana. Props iguais às outras views (`events`, `loading`, `candidateNameById`, `onEdit`, `onDelete`) + `onCreateAt(date: Date)` para criar evento por click em slot vazio. Internamente:
- estado `weekStart` (segunda como início pode ficar Domingo p/ paridade Google → uso `startOfWeek(date, { weekStartsOn: 0 })`).
- `useMemo` para mapear eventos por dia e calcular lanes.
- usa tokens HSL semânticos (`--primary`, `--border`, `--muted-foreground`, `EVENT_TYPE_TOKEN`).
- timezone: parse com `parseISO` (já vem ISO em -03:00, regra do projeto mantida).

### Editado: `src/components/hr/HRCalendarTab.tsx`
- Adicionar tipo `'week'` em `CalendarView`.
- Novo `<TabsTrigger value="week">` com ícone `CalendarRange` entre **Mês** e **Lista**.
- Novo bloco `{view === 'week' && <HRCalendarWeekView ... />}` passando `onCreateAt` que reaproveita `openCreate` adaptado.
- Pequeno refactor: extrair `openCreateAt(date: Date)` para aceitar data específica.

## Detalhes técnicos
- **Sem nova dependência**: usa apenas `date-fns` (já no projeto: `startOfWeek`, `addDays`, `addWeeks`, `subWeeks`, `isSameDay`, `differenceInMinutes`).
- **Performance**: grid renderizado com CSS grid 8 colunas (1 horários + 7 dias); eventos absolutos dentro de cada coluna.
- **Acessibilidade**: cada evento é `<button>` com aria-label "título às HH:mm".
- **Responsivo**: scroll horizontal abaixo de 900px (a tela do RH é admin/desktop-first, igual Mês).
- **Cores**: nada hardcoded — apenas tokens HSL.

## Vantagens
- Visualização por horário no estilo familiar Google Calendar.
- Navegação semana-a-semana sem perder filtros.
- Reutiliza dialog de edição/criação existente — zero duplicação.

## Desvantagens / Trade-offs
- Algoritmo de sobreposição é simples (lanes lado-a-lado); 5+ eventos no mesmo horário ficam estreitos. Aceitável para volume real do RH.
- Eventos all-day não existem hoje no schema; ficam fora desta view (mesmo comportamento das outras 3).

## Checklist manual (validar após implementação)
1. Abrir `/admin/hr` → aba **Calendário**.
2. Clicar na nova aba **Semana** → grade aparece com a semana atual, dia de hoje destacado.
3. Eventos existentes aparecem no slot correto (verificar com um evento de teste 14:00–15:00).
4. Click em evento → dialog de edição abre.
5. Click em slot vazio (ex.: terça 10h) → dialog de criação abre com data/hora pré-preenchidas.
6. Botões `←` `Hoje` `→` navegam semanas mantendo filtro Candidato/Colaborador.
7. Tema dark: cores legíveis, linha "now" visível.

## Pendências / Futuro (apenas do que será implementado)
- Drag-to-resize / drag-to-move de eventos (futuro).
- Suporte a eventos multi-dia (futuro — exige campo `all_day` no schema).
- Sincronização Google Calendar (já mencionado no rodapé da view Mês como roadmap).

## Prevenção de regressão
- Testes Vitest opcionais para a função pura `computeEventLanes(events, day)` (algoritmo de overlap) em `src/lib/__tests__/hrWeekViewLanes.test.ts`.
- Não altera schema, não toca `types.ts` (read-only respeitado).
- Não altera as views existentes (Mês/Lista/Agenda) — apenas adiciona aba.
