

## Plano de Correcoes - 5 Itens

### 1. Fluxo de Cancelar/Reconectar no dialog de chip desconectado

**Problema atual**: Ao clicar em um chip offline, aparece o dialog "Chip Desconectado". O botao "Cancelar" fecha o dialog sem fazer nada. O botao "Reconectar" navega para `/chips` e mostra um toast generico.

**Correcao**:
- **Cancelar**: Ao clicar, selecionar o chip mesmo assim (permitir ver conversas do banco), mas marcar o chip como offline internamente. O `ChatWindow` deve detectar que o chip esta offline e desabilitar o campo de envio, mostrando uma barra no lugar do input: "Reconecte para atualizar conversas e enviar mensagens" com botao de reconectar.
- **Reconectar**: Em vez de navegar para `/chips`, abrir o `ChipConnectDialog` diretamente passando a instancia existente para gerar QR code na propria tela do WhatsApp.

**Arquivos**:
- `ChipSelector.tsx`: Alterar o "Cancelar" para chamar `onSelectChip(chip.id)` e fechar o dialog. Alterar o "Reconectar" para abrir `ChipConnectDialog` com o nome da instancia existente (modo reconexao, sem criar nova instancia).
- `ChipConnectDialog.tsx`: Adicionar prop `reconnectInstanceName` para pular o step de formulario e ir direto ao QR code.
- `ChatWindow.tsx`: Verificar `chip.status` ao carregar e se offline, desabilitar input e mostrar barra de reconexao.

---

### 2. Dropdown de chips offline - opcoes Remover e Reconectar

**Problema atual**: O dropdown (seta para baixo) de chips offline mostra "Configuracoes" e "Desconectar" - opcoes que nao fazem sentido para um chip ja offline.

**Correcao**: Quando o chip NAO esta conectado, mostrar opcoes diferentes:
- **Reconectar**: Abre o `ChipConnectDialog` com a instancia existente para gerar QR code direto
- **Remover chip**: Remove o chip do header (deleta do banco via `supabase.from('chips').delete()`)

**Arquivos**: `ChipSelector.tsx`

---

### 3. Carregamento de mensagens antigas (sync-history)

**Problema atual**: Ao conectar um novo chip, so aparecem mensagens trocadas apos a integracao. O `sync-history` existe mas NAO e chamado automaticamente ao conectar um chip.

**Correcao**: 
- No `ChatSidebar.tsx` ou `WhatsApp.tsx`, ao detectar que um chip acabou de ser conectado (ou ao selecionar um chip pela primeira vez), chamar `supabase.functions.invoke('sync-history', { body: { chipId } })` em background.
- Mostrar um indicador sutil no topo da sidebar: "Sincronizando mensagens anteriores..." com spinner, que desaparece quando o sync termina.
- O `sync-history` ja busca os ultimos 10 dias de mensagens e faz upsert no banco.

**Arquivos**: 
- `ChatSidebar.tsx`: Adicionar chamada ao `sync-history` ao montar com novo chip e indicador visual de sincronizacao.

---

### 4. Arquivamento nao sincroniza com WhatsApp

**Problema atual**: O sistema arquiva localmente (coluna `is_archived` no banco) e chama `archive-chat` no `uazapi-api` que faz `POST /chat/archive`. Porem a conversa nao aparece arquivada no celular. Possivelmente o endpoint ou formato do body esta incorreto.

**Correcao**:
- Adicionar log detalhado no `archive-chat` para ver a resposta da UazAPI
- Verificar se o `chatid` esta sendo enviado no formato correto (deve ser `numero@s.whatsapp.net`)
- Se o endpoint retorna erro, mostrar feedback ao usuario no frontend

**Arquivos**: `uazapi-api/index.ts` (action `archive-chat`)

---

### 5. Criacao de etiquetas com erro

**Causa raiz encontrada nos logs**: O endpoint `POST /label/edit` retorna `500: "No session"`. Isso significa que o chip usado para criar a etiqueta (`2f0980a5-35cd-4f75-9cb8-edb6acca75aa`) NAO tem uma sessao ativa no WhatsApp. A criacao de etiquetas requer um chip conectado.

**Correcao**:
- No `ManageLabelsDialog.tsx`, antes de tentar criar/editar etiqueta, verificar se o chip esta conectado (`chips.status = 'connected'`). Se nao estiver, mostrar mensagem informando que o chip precisa estar conectado.
- Melhorar a mensagem de erro: em vez de "Erro ao criar etiqueta" generico, mostrar "Chip desconectado - conecte o WhatsApp para gerenciar etiquetas".
- Remover os casts `as any` das queries de labels (a tabela agora existe no schema).

**Arquivos**: `ManageLabelsDialog.tsx`

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1a | `ChipSelector.tsx` | Cancelar: seleciona o chip offline; Reconectar: abre ChipConnectDialog em modo reconexao |
| 1b | `ChipConnectDialog.tsx` | Nova prop `reconnectInstanceName` para pular form e ir direto ao QR |
| 1c | `ChatWindow.tsx` | Se chip offline, substituir ChatInput por barra de "Reconecte para enviar mensagens" |
| 2 | `ChipSelector.tsx` | Dropdown offline: "Reconectar" e "Remover chip" em vez de "Configuracoes"/"Desconectar" |
| 3 | `ChatSidebar.tsx` | Chamar sync-history ao selecionar chip, mostrar indicador de sincronizacao |
| 4 | `uazapi-api/index.ts` | Adicionar logs no archive-chat e validar formato do chatid |
| 5 | `ManageLabelsDialog.tsx` | Verificar status do chip antes de criar label; melhorar mensagens de erro |

