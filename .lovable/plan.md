
# Plano — Chat Meta (/whatsapp): áudio nativo, ticks azuis e mídia visível

Foco em 4 correções funcionais (1, 2, 3, 4) e 2 já implementadas (5, 6 — apenas validação).

---

## 1) Transcodificar webm → ogg/opus no edge (PTT nativo na Meta)

**Antes**: Chrome/Edge gravam em `audio/webm;codecs=opus`. A Meta rejeita esse container, então hoje o gateway degrada para "documento". O destinatário recebe um anexo `.webm` (não toca como mensagem de voz no app oficial).

**Depois**: O `whatsapp-gateway` (`send-media`) detecta entrada webm/opus e remuxa para um container OGG/Opus aceito pela Meta, mantendo o mesmo stream Opus (sem reencode). PTT chega como mensagem de voz nativa na Meta.

**Como (técnico)**:
- Implementar remux WebM→OGG manual em Deno puro (parse EBML mínimo + escrita Ogg/Opus). Isso evita FFmpeg WASM (pesado para edge function, ~25MB). Já existem ports JS leves (~30KB) que faremos inline no diretório `supabase/functions/whatsapp-gateway/lib/webmToOgg.ts`.
- Fallback de segurança: se o remux falhar, mantém a degradação atual para documento (com toast).
- Atualizar `metaAudioAllow` para incluir `audio/ogg;codecs=opus` após remux.
- Telemetria: log `audio_remux_success|fallback_document` em `webhook_logs`.

**Alternativa rejeitada**: forçar Chrome a gravar `audio/mp4` — não é suportado nativamente em Chrome/Edge desktop (só Safari/iOS).

---

## 2) Tooltip Radix nos ticks de status

**Antes**: `MessageBubble.tsx` usa apenas `aria-label`. Alguns navegadores não exibem tooltip nativo.

**Depois**: Envolver cada ícone (`Check`, `CheckCheck`, `Clock`) em `<Tooltip>`/`<TooltipTrigger>`/`<TooltipContent>` do shadcn (Radix). Textos: "Pendente", "Enviada", "Entregue", "Lida".

**Técnico**: garantir `<TooltipProvider>` no layout do chat (ou local com `delayDuration={300}`) para evitar custo global.

---

## 3) Status "lida" (VV azul) não está atualizando

**Diagnóstico provável** (sem evidência no banco ainda — confirmaremos com logs):
- A lógica em `meta-webhook` (`handleMetaStatus`) já trata `read` e a regra de downgrade está correta (atualiza de `sent`/`delivered` para `read`).
- Causas possíveis a verificar:
  1. **Subscrição do webhook**: o app Meta precisa estar inscrito no campo `messages` da WABA (já está) **e** o número precisa ter `read receipts` habilitado pelo destinatário (configuração do usuário final). Se ele desabilitou "Confirmações de leitura" no WhatsApp dele, a Meta nunca envia o evento `read`.
  2. **Realtime UI**: mesmo quando o banco atualiza `status='read'`, o React pode estar usando cache otimista que sobrescreve o valor recebido. Verificar `useChatMessages` ao receber update de `message_history`.
  3. **Match por `message_id`**: se a `messages.[0].id` (wamid) salva no envio difere do `status.id` recebido pela Meta (sufixos), o update silenciosamente não casa.

**Ações**:
- Adicionar log no `meta-webhook` antes do `update`: `console.log('Meta read for', messageId, 'rows updated:', count)` usando `.select('id', { count: 'exact' })`.
- Inspecionar `message_history` por `status='read'` em chips Meta para confirmar se o webhook está chegando.
- Garantir que `useChatMessages` não está sobrescrevendo `status` ao mesclar realtime updates (manter sempre o valor com `statusRank` mais alto no client também).

---

## 4) Áudios enviados aparecem como "Mídia indisponível"

**Causa raiz**: `MediaRenderer.downloadMedia` chama **sempre** `uazapi-api` (`action: download-media`), independentemente do provider do chip. Mensagens enviadas/recebidas via Meta não têm registro na UazAPI → retorna vazio → cai no estado `error` → mostra "Mídia indisponível — conteúdo anterior à integração".

**Correção**:
- `MediaRenderer` precisa receber/descobrir o `provider` do chip (já existe `chips.provider`).
- Roteamento:
  - `provider='meta'` → invocar `whatsapp-gateway` com `action: 'download-media'` e o `mediaId` (que é a `media_url` salva no `message_history` — atualmente armazenamos o `media_id` da Meta nessa coluna).
  - `provider='uazapi'` (ou ausente) → mantém chamada atual.
- A resposta do `whatsapp-gateway/download-media` já vem em `data.base64` (data URL pronta para `<audio src>`/`<img src>`). Adaptar parser:
  ```ts
  const url = response.data?.fileURL || response.data?.base64;
  ```
- Texto de erro: trocar "conteúdo anterior à integração" por "Mídia indisponível — clique para tentar novamente" (mais honesto).

**Técnico extra**: passar `provider` via prop em `MessageBubble` → `MediaRenderer`. Como já temos `chipId`, podemos resolver via cache leve (`useChips` já em memória) sem nova prop, mas a prop é mais previsível.

---

## 5) Testes `audioMime.test.ts` (já implementado)

Validar que os 4 casos rodam:
```
bunx vitest run src/lib/__tests__/audioMime.test.ts
```
Sem alteração planejada.

---

## 6) Toast `degradedToDocument` (já implementado)

Já em `useChatMessages`. Sem alteração — apenas confirmar que segue funcionando após a transcodificação (item 1) reduzir muito a frequência desse toast.

---

## Arquivos afetados

- `supabase/functions/whatsapp-gateway/index.ts` — remux webm→ogg + log de download-media
- `supabase/functions/whatsapp-gateway/lib/webmToOgg.ts` (novo)
- `supabase/functions/meta-webhook/index.ts` — log de rows updated em read
- `src/components/whatsapp/MessageBubble.tsx` — Tooltip Radix nos ticks
- `src/components/whatsapp/MediaRenderer.tsx` — roteamento por provider
- `src/hooks/useChatMessages.ts` — preservar maior `statusRank` em merge realtime

---

## Checklist manual após implementação

1. Gravar áudio no Chrome em chip Meta → destinatário deve receber **mensagem de voz** (não anexo).
2. Passar mouse sobre o tick de uma mensagem → tooltip "Enviada"/"Entregue"/"Lida".
3. Enviar mensagem Meta para um número com leitura confirmada habilitada → ver VV azul aparecer.
4. Áudios já enviados na conversa carregam e tocam (sem "Mídia indisponível").
5. `bunx vitest run src/lib/__tests__/audioMime.test.ts` → 4 testes passando.

## Pendências futuras

- Cache de mídia da Meta no Supabase Storage (hoje cada visualização re-baixa via Graph API — gera custo).
- Suporte a stickers Meta no `MediaRenderer`.

## Prevenção de regressão

- Teste Deno em `whatsapp-gateway/webmToOgg_test.ts` com fixture webm pequena.
- Console log explícito no `meta-webhook` ao receber `read` (facilita auditoria).
- Prop `provider` obrigatória em `MediaRenderer` (TypeScript impede chamar UazAPI em chip Meta).
