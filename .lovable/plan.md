

## Plano: 4 Melhorias na Interface WhatsApp

---

### 1. Etiquetas - Onde encontrar e melhorar acesso

**Situacao atual**: As etiquetas JA estao implementadas, mas estao "escondidas" no botao de menu (tres pontinhos verticais) que so aparece ao passar o mouse sobre uma conversa na sidebar. O botao "Etiquetas" na barra de filtros tambem so aparece se existem labels sincronizadas do WhatsApp.

**Problema**: A funcionalidade esta pouco visivel. 

**Correcao**:
- Mover a opcao de etiquetar para um local mais visivel: adicionar um icone de etiqueta diretamente na conversa (ao lado do menu de tres pontos) que aparece no hover
- Manter tambem no menu de contexto (tres pontos) como esta
- Garantir que o botao "Etiquetas" na barra de filtros apareca mesmo sem labels sincronizadas (para que o usuario possa criar novas)
- Adicionar opcao "Gerenciar Etiquetas" no dropdown que permite criar novas etiquetas (POST /label/edit)

---

### 2. Foto de perfil dos contatos

**Viabilidade na UazAPI**: SIM. O endpoint `POST /chat/details` retorna o campo `image` (URL da foto) e `imagePreview` (miniatura). O endpoint `POST /chat/find` tambem retorna esses campos no modelo Chat.

**Implementacao**:
- Adicionar coluna `profile_pic_url` na tabela `conversations` (migracao SQL)
- No webhook (`evolution-webhook`), ao processar mensagens, salvar `chat.image` ou `chat.imagePreview` na conversa
- No `sync-history`, ao sincronizar chats, buscar e salvar as fotos de perfil
- No `ChatSidebar.tsx`, usar a `profile_pic_url` da conversa para exibir a foto no avatar circular
- Fallback: se nao tiver foto, manter o avatar com a inicial do nome (como esta hoje)

---

### 3. Nome do contato com fallback inteligente

**Prioridade de exibicao** (conforme UazAPI):
1. `contact_name` (nome salvo na agenda do WhatsApp)
2. `wa_name` (nome do perfil WhatsApp / WhatsApp Business)
3. Numero formatado: +55 DDD TELEFONE (ex: +55 48 9811-9529)

**Implementacao**:
- Adicionar coluna `wa_name` na tabela `conversations` para armazenar o nome do perfil WhatsApp separadamente do `contact_name`
- No webhook, salvar `chat.wa_contactName` em `contact_name` e `chat.wa_name` em `wa_name`
- No `ChatSidebar.tsx`, alterar a logica de exibicao do nome:
  ```text
  Nome exibido = contact_name || wa_name || formatPhone(phone)
  ```
- Funcao `formatPhone`: formatar numero como "+55 48 9811-9529" a partir do JID

---

### 4. Configuracoes do WhatsApp - Funcionalidades adicionais

**Documentacao UazAPI confirma suporte para**:
- Nome do perfil (`POST /profile/name`) - JA IMPLEMENTADO
- Foto do perfil (`POST /profile/image`) - JA IMPLEMENTADO
- **Recado/Status** (texto embaixo do nome): via `POST /instance/privacy` o campo `status` controla quem ve, mas nao ha endpoint direto para alterar o texto do recado. Porem, pode-se usar o endpoint de presenca
- **Configuracoes de Privacidade** (`GET /instance/privacy` + `POST /instance/privacy`):
  - Quem pode ver foto de perfil (all/contacts/none)
  - Quem pode ver visto por ultimo (all/contacts/none)  
  - Quem pode ver status online (all/match_last_seen)
  - Confirmacao de leitura (all/none)
  - Quem pode adicionar a grupos (all/contacts/contact_blacklist)
  - Quem pode fazer chamadas (all/known)
- **Perfil Business** (se for WhatsApp Business - EXPERIMENTAL):
  - Descricao da empresa
  - Endereco
  - Email
  - Categoria do negocio
  - Website

**Implementacao no WhatsAppProfileDialog.tsx**:
- Adicionar secao "Privacidade" com toggles/selects para cada configuracao
- Ao abrir o dialog, buscar configuracoes atuais via `GET /instance/privacy`
- Ao alterar, enviar via `POST /instance/privacy`
- Adicionar secao "Perfil Business" (condicional, so aparece se isBusiness = true)

---

### Detalhes Tecnicos

**Migracao SQL**:
```text
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_pic_url text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS wa_name text;
```

**Arquivos a modificar**:

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Adicionar `profile_pic_url` e `wa_name` em conversations |
| `evolution-webhook/index.ts` | Salvar `image`, `wa_name` do chat ao fazer upsert na conversations |
| `uazapi-api/index.ts` | Novas actions: `get-privacy`, `set-privacy`, `get-business-profile`, `update-business-profile` |
| `ChatSidebar.tsx` | Exibir foto de perfil do contato, melhorar logica de nome com fallback, melhorar visibilidade das etiquetas |
| `WhatsAppProfileDialog.tsx` | Adicionar secao de privacidade e perfil business |
| `sync-history/index.ts` | Ao sincronizar chats, salvar `image` e `wa_name` na conversa |

**Ordem de implementacao**:
1. Migracao SQL (adicionar colunas)
2. Webhook + sync para salvar foto e wa_name
3. Sidebar: foto de perfil + nome com fallback + etiquetas mais visiveis
4. Dialog: privacidade + business profile
5. Deploy edge functions

