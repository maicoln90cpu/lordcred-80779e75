

## Ordenar conversas por mensagens e exibir horario na sidebar

### Mudancas necessarias

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

#### 1. Ordenacao: conversas com mensagens primeiro

A ordenacao atual (linha 423-429) ja ordena por `lastMessageAt` decrescente, mas conversas sem mensagem (`lastMessage` vazio) que tenham `last_message_at` setado pelo sync aparecem misturadas. A nova logica:

- Fixadas primeiro (manter)
- Conversas com `lastMessage` nao-vazio antes das sem mensagem
- Dentro de cada grupo, ordenar por `lastMessageAt` decrescente (mais recente primeiro)

#### 2. Formatacao do horario mais completa

A funcao `formatTime` (linha 451-460) ja existe e renderiza no lugar certo (linha 635-637). Melhorar para mostrar:

- Hoje: "14:32"
- Ontem: "Ontem"
- Esta semana: dia da semana ("Seg", "Ter", etc.)
- Mais antigo: "dd/mm/yyyy"

### Detalhes tecnicos

| # | Local | Alteracao |
|---|-------|-----------|
| 1 | `sortedChats` (linha 423-429) | Adicionar criterio: conversas com `lastMessage` nao-vazio primeiro |
| 2 | `formatTime` (linha 451-460) | Adicionar "Ontem" e dia da semana para datas recentes |

