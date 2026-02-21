## Plano: 10 Correções WhatsApp - Dividido em 2 Etapas

---

### ✅ ETAPA 1 - CONCLUÍDA

1. ✅ **Áudios antigos** - Estado amigável "Áudio indisponível" em vez de ícone de erro
2. ✅ **Chip 2 notificações** - Subscription global de unread para TODOS os chips
3. ✅ **Tiques de status** - ✓ (enviado), ✓✓ (entregue), ✓✓ azul (lido) + webhook messages_update
4. ✅ **Confirmação de leitura** - Sempre envia mark-read ao abrir chat (removida condição unreadCount > 0)
5. ✅ **Filtro não lidas** - Botão "Não lidas" na barra de filtros da sidebar
6. ✅ **Botão configurações** - Movido para dropdown do chip com ícone engrenagem

---

### 🔲 ETAPA 2 - PENDENTE

4. **Criação e gerenciamento de etiquetas** - Dialog para criar/editar/excluir etiquetas + sincronização UazAPI
5. **Etiquetas no menu de 3 pontos** - Adicionar opção de etiquetas no context menu do chat
6. **Pré-carregar dados no dialog de configurações** - Buscar dados atuais do perfil ao abrir
10. **Gerenciar etiquetas no dropdown** - Opção "Gerenciar Etiquetas" no filtro de etiquetas

Arquivos a modificar na Etapa 2:
- `ChatSidebar.tsx` - Adicionar "Gerenciar Etiquetas" no dropdown
- `ManageLabelsDialog.tsx` - Criar dialog completo
- `WhatsAppProfileDialog.tsx` - Pré-carregar dados
- `uazapi-api/index.ts` - Action edit-label
