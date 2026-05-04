## Objetivo
Trazer 3 melhorias ao chat em `/whatsapp` (vale para chips Meta e UazAPI):

1. **Shift+Enter** quebra linha; **Enter** envia (igual chat interno).
2. **Ticks de status** (✓ enviada, ✓✓ entregue, ✓✓ azul lida) visíveis nas mensagens.
3. **Corrigir erro "Instabilidade ao enviar mídia"** ao mandar áudio em chip Meta.

---

## Diagnóstico

### 1) Shift+Enter
Hoje `ChatInput.tsx` (linha 602) usa `<Input>` (single-line), que não suporta quebra de linha. O `onKeyDown` já trata `Enter` sem shift como envio, mas com `<Input>` o Shift+Enter não gera `\n`.

### 2) Ticks de status
Já existe lógica em `MessageBubble.tsx` (linhas 240-250):
- `sent` → ✓ cinza
- `delivered` → ✓✓ cinza
- `read` → ✓✓ azul

E o `meta-webhook` (linhas 274-313) atualiza status corretamente. **Porém** o status não está aparecendo claramente na imagem enviada pelo usuário — provavelmente porque:
- Mensagens recém-enviadas ficam em `pending/sent` e o webhook de status do Meta às vezes só dispara quando o chip está com webhook configurado direito.
- Falta um indicador de "pending" (relógio) para feedback imediato antes do `sent`.

### 3) Erro de áudio na Meta
`ChatInput.tsx` grava com `audio/webm;codecs=opus` (linha 298), mas o `whatsapp-gateway` (linhas 373-374) força MIME `audio/ogg` no upload para Meta. **A Meta valida o container real do arquivo** — webm enviado como ogg é rejeitado, gerando o "Instabilidade ao enviar mídia".

Meta aceita áudio em: `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr`, `audio/ogg` (apenas codec opus, mono). O navegador raramente grava ogg/opus puro — só Firefox.

---

## Plano

### Frontend — `src/components/whatsapp/ChatInput.tsx`

**A. Shift+Enter (item 1)**
- Trocar `<Input>` por `<Textarea>` (shadcn) com `rows={1}` e auto-resize via `onInput` ajustando `style.height`.
- `onKeyDown`: `Enter` sem shift = `handleSend()` + `preventDefault`; `Shift+Enter` deixa o comportamento padrão (quebra linha).
- Manter aparência atual (mesma altura inicial, mesmo border/rounded). Limitar a `max-h-32` com `overflow-auto` para não quebrar layout.

**B. Gravação de áudio (item 3)**
- Detectar suporte e escolher melhor MIME, em ordem:
  1. `audio/ogg;codecs=opus` (Firefox)
  2. `audio/mp4;codecs=mp4a.40.2` (Safari, alguns Chromium)
  3. `audio/webm;codecs=opus` (fallback Chrome/Edge — só usado para chips UazAPI; para Meta convertemos)
- Anexar o MIME real no `mediaPreview` (novo campo `mimeType`) e propagar via `onSendMedia`.

### Frontend — `src/components/whatsapp/ChatWindow.tsx` e `src/hooks/useChatActions.ts`
- Estender assinatura de `sendMedia` para aceitar `mimeType?: string` opcional, repassando ao edge `whatsapp-gateway`.

### Backend — `supabase/functions/whatsapp-gateway/index.ts` (case `send-media`)
- Para `mediaType === 'ptt' | 'audio'`:
  - Se vier `mimeType` do client e for um dos suportados pela Meta (`audio/ogg`, `audio/mp4`, `audio/aac`, `audio/mpeg`, `audio/amr`) → usar esse MIME no upload.
  - Se vier `audio/webm` (não suportado pela Meta) → **transcodar no Deno** usando `ffmpeg.wasm` é pesado; alternativa pragmática: rejeitar com mensagem clara "Seu navegador grava em formato webm; use Firefox ou Safari para enviar áudio para chips Meta" **OU** subir para Storage e enviar como `document` (.webm) — não é PTT mas chega.
  - **Decisão recomendada**: tentar upload com `audio/ogg` quando for `webm` (alguns chips aceitam pelo conteúdo opus puro); se a Meta retornar erro, fazer fallback automático para enviar como **documento** (`.ogg`) para que o áudio chegue ao destinatário com aviso amigável no toast ("Áudio enviado como anexo").
- Mensagem de erro humanizada (não mais "Instabilidade ao enviar mídia" genérico) — incluir motivo da Meta no toast quando vier `error.message`.

### Frontend — `src/components/whatsapp/MessageBubble.tsx` (item 2 — feedback visual)
- Adicionar caso `status === 'pending'` → ícone de relógio (Clock) cinza claro, para o vendedor saber que a mensagem está sendo entregue.
- Manter ✓ / ✓✓ / ✓✓ azul. Garantir que o estado inicial pós-envio é `sent` (já é no `useChatMessages` linha 231 — está como `pending`, ótimo).
- Adicionar `title` (tooltip) em cada ícone: "Pendente", "Enviada", "Entregue", "Lida".

### Documentação / Memória
- Atualizar `docs/META-WHATSAPP-SETUP.md` com a limitação de codec de áudio do navegador.
- Adicionar memória `mem://features/whatsapp-audio-meta-codec` documentando a regra de fallback.

---

## Detalhes técnicos
- `Textarea` precisa de `ref` tipado como `HTMLTextAreaElement` — atualizar `inputRef`.
- `auto-resize`: `e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'`.
- `MediaRecorder.isTypeSupported(mime)` para escolha de codec.
- No edge function, tipo do upload: usar `mime` recebido em vez de mapa fixo.

## Pendências / fora do escopo
- Transcodificação real webm→ogg/opus no servidor (exigiria worker FFmpeg dedicado; pode entrar em etapa 2 se o fallback "documento" não for suficiente).
- Retransmissão automática quando webhook de status atrasa.

## Checklist manual após implementar
1. Em `/whatsapp`, abrir conversa Meta, digitar e pressionar Shift+Enter — deve quebrar linha; Enter envia.
2. Enviar mensagem de texto — deve aparecer ✓ imediatamente, ✓✓ ao chegar, ✓✓ azul ao ser lida.
3. Gravar áudio em chip Meta:
   - Chrome/Edge: deve enviar como áudio se Meta aceitar; se cair fallback, vem como anexo .ogg + toast informativo.
   - Firefox/Safari: deve enviar como áudio normal (PTT).
4. Mesmos passos em chip UazAPI — não pode haver regressão (continua mandando webm).

## Prevenção de regressão
- Teste Vitest novo para `pickAudioMime()` (helper extraído) garantindo prioridade ogg > mp4 > webm.
- Teste de integração leve para `whatsapp-gateway send-media` validando que MIME do cliente é respeitado.
