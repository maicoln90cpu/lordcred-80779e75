
## Correcao: Race Condition na Troca de Chips e Conversas

### Causa Raiz Identificada

O problema NAO e de dados incorretos no banco. A tabela `conversations` tem os registros corretos (Maicoln Douglas pertence ao chip "Wpp 1" com id `fc818d1f`).

O bug e uma **race condition classica** no React:

1. Usuario seleciona chip A (Wpp 1) -> `fetchChats()` inicia chamada API para chip A
2. Usuario troca para chip B (wpp 2) -> `useEffect` limpa estado e inicia `fetchChats()` para chip B
3. A resposta da API de chip A chega DEPOIS da troca -> `setChats(chipA_data)` sobrescreve o estado com dados do chip errado
4. Agora a sidebar mostra conversas do chip A enquanto o chip B esta selecionado

O mesmo problema acontece no `ChatWindow.tsx` — ao clicar em uma conversa, a resposta de uma busca anterior pode sobrescrever as mensagens exibidas com mensagens de outro chat.

### Correcao

Adicionar um mecanismo de "stale request detection" em ambos os componentes. Usar uma ref para rastrear o chipId/chatId ativo e ignorar respostas de requisicoes obsoletas.

---

### Detalhes Tecnicos

**Arquivo 1: `src/components/whatsapp/ChatSidebar.tsx`**

- Adicionar `activeChipRef = useRef(chipId)` que e atualizado imediatamente quando `chipId` muda
- No `fetchChats`, apos receber a resposta da API, verificar se `activeChipRef.current === chipId` antes de chamar `setChats()`
- Se o chipId mudou durante a requisicao, descartar a resposta silenciosamente
- Tambem proteger o `setCachedChats` para nao salvar cache com chipId errado

```text
Antes (bugado):
  fetchChats() {
    const response = await fetch(...)
    setChats(response.data.chats)  // <-- executa mesmo se chip mudou
  }

Depois (corrigido):
  fetchChats() {
    const currentChip = chipId  // captura o chip da closure
    const response = await fetch(...)
    if (activeChipRef.current !== currentChip) return  // <-- descarta resposta obsoleta
    setChats(response.data.chats)
  }
```

**Arquivo 2: `src/components/whatsapp/ChatWindow.tsx`**

- Adicionar `activeChatRef = useRef(chat?.remoteJid)` e `activeChipRef = useRef(chipId)`
- No `fetchMessages`, apos resposta da API, verificar se o chat/chip ativo ainda e o mesmo
- Proteger tambem o callback do realtime subscription
- Quando `chat` muda, limpar `messages` imediatamente (ja acontece no useEffect linha 163-172, mas a protecao contra race condition esta faltando)

**Arquivo 3: `src/hooks/useMessageCache.ts`**

- Nenhuma alteracao necessaria — o cache ja e indexado por chipId, o problema e apenas no `setChats`/`setMessages`

---

### Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `ChatSidebar.tsx` | Adicionar `activeChipRef`, verificar antes de `setChats` |
| `ChatWindow.tsx` | Adicionar `activeChatRef` + `activeChipRef`, verificar antes de `setMessages` |

Duas alteracoes cirurgicas que resolvem o problema na raiz sem mudar a logica de cache ou a API.
