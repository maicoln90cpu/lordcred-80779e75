

## Plano: 3 Correções — Encaminhamento de Mídia, Templates no Chat, Templates com Mídia

### 1. Encaminhamento de áudio/mídia não funciona

**Problema:** O `forward-message` no edge function só usa `/send/text`. Quando a mensagem original é áudio, imagem ou vídeo, não há texto para enviar — o sistema falha silenciosamente.

**Solução:**
- **`supabase/functions/uazapi-api/index.ts`**: No case `forward-message`, detectar se a mensagem tem mídia. Quando `mediaType` estiver presente (e for diferente de text/chat), primeiro fazer download da mídia via `/message/download` usando o `messageId`, depois re-enviar via `/send/media` para o destinatário. Manter fallback para `/send/text` quando for mensagem de texto puro.
- **`src/components/whatsapp/ForwardDialog.tsx`**: Passar `mediaType` e `hasMedia` no body da chamada à edge function para que o backend saiba o tipo de conteúdo.
- **`src/components/whatsapp/MessageContextMenu.tsx`**: Garantir que `mediaType` já é passado no `MessageData`.

### 2. Templates não acessíveis no chat WhatsApp

**Problema:** Não existe nenhum componente no `/whatsapp` para buscar e inserir templates da tabela `message_templates`. O vendedor não tem acesso a eles.

**Solução:**
- **Novo componente `src/components/whatsapp/TemplatePicker.tsx`**: Dialog/popover que busca templates ativos da tabela `message_templates`, exibe agrupados por categoria com busca, e ao clicar insere o texto no campo de mensagem. Para templates com mídia (item 3), enviar diretamente via `onSendMedia`.
- **`src/components/whatsapp/ChatInput.tsx`**: Adicionar botão (ícone `FileText`) ao lado do input que abre o TemplatePicker. Receber callback `onUseTemplate` que preenche o campo de texto ou envia mídia.

### 3. Templates com suporte a mídia (imagem e áudio)

**Problema:** A tabela `message_templates` só tem `content` (texto). Não suporta mídia anexada.

**Solução:**
- **Migration SQL**: Adicionar 3 colunas à tabela `message_templates`:
  - `media_url TEXT` — URL do arquivo no storage
  - `media_type TEXT` — tipo (image, audio)
  - `media_filename TEXT` — nome original do arquivo
- **Storage bucket**: Criar bucket `template-media` público para armazenar as mídias dos templates.
- **`src/pages/admin/Templates.tsx`**: No dialog de criação/edição, adicionar campo de upload de imagem ou áudio. Fazer upload para o bucket `template-media`, salvar a URL no campo `media_url`.
- **`src/components/whatsapp/TemplatePicker.tsx`**: Quando o template tiver `media_url`, ao selecionar, buscar o arquivo, converter para base64, e chamar `onSendMedia` com o texto como caption.

### Arquivos modificados
1. `supabase/functions/uazapi-api/index.ts` — forward com download+reenvio de mídia
2. `src/components/whatsapp/ForwardDialog.tsx` — passar mediaType no body
3. **Novo:** `src/components/whatsapp/TemplatePicker.tsx` — seletor de templates no chat
4. `src/components/whatsapp/ChatInput.tsx` — botão para abrir TemplatePicker
5. `src/pages/admin/Templates.tsx` — upload de mídia no formulário
6. **Migration SQL** — colunas media_url, media_type, media_filename + bucket template-media

