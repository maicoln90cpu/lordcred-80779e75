
## Plano de Correcoes - 4 Problemas Criticos

### Problema 1: Imagem do perfil nao sendo carregada no dialog de configuracoes

**Causa raiz**: O `WhatsAppProfileDialog.tsx` carrega o nome do perfil via `get-profile-name`, mas nao carrega a foto atual do perfil. Nao existe uma acao para buscar a foto existente. Alem disso, os endpoints de Business estao com URLs erradas:
- Codigo atual: `GET /business/get` -- Correto: `POST /business/get/profile`
- Codigo atual: `POST /business/update` -- Correto: `POST /business/update/profile`

**Correcao**:
1. No `WhatsAppProfileDialog.tsx`, ao abrir o dialog, buscar a foto de perfil atual (pode usar o `profile_pic_url` do chip no banco, ou chamar o endpoint de status que retorna dados do perfil)
2. Corrigir os endpoints de Business no `uazapi-api/index.ts`:
   - `get-business-profile`: mudar de `GET /business/get` para `POST /business/get/profile`
   - `update-business-profile`: mudar de `POST /business/update` para `POST /business/update/profile`

**Arquivos**: `supabase/functions/uazapi-api/index.ts`, `src/components/whatsapp/WhatsAppProfileDialog.tsx`

---

### Problema 2: Icone azul para mensagens lidas nao funcionando

**Causa raiz**: O mapeamento de status no webhook (`evolution-webhook/index.ts`) ja foi expandido com os codigos corretos. Porem a estrutura do payload da UazAPI para `messages_update` pode nao estar sendo parseada corretamente. A linha 217 tenta extrair updates de `payload.updates`, `payload.data`, ou `payload.message`, mas o formato real da UazAPI pode ser diferente (ex: o update pode estar diretamente no `payload` com campo `messageid` e `state`/`ack`).

**Correcao**:
1. Adicionar log mais detalhado no webhook para capturar o payload completo
2. Melhorar o parsing para tentar mais formatos: verificar se o `messageid` e `state`/`ack` estao diretamente no payload raiz
3. O codigo ja tem um fallback para `[payload]` na linha 220, mas precisa garantir que os campos estao sendo extraidos corretamente em todos os cenarios

**Arquivos**: `supabase/functions/evolution-webhook/index.ts`

---

### Problema 3: Criar etiqueta desconecta o WhatsApp

**Causa raiz**: O endpoint `POST /label/edit` da UazAPI pode estar retornando um erro quando chamado para CRIAR etiqueta (sem `id`). Se a UazAPI retorna um status 500 (sessao invalida), a edge function propaga esse erro. Mais critico: o `ManageLabelsDialog` apos criar a etiqueta, chama `fetch-labels` que faz `GET /labels`. Se qualquer dessas chamadas falhar com "sessao invalida", pode haver um efeito cascata que marca o chip como desconectado.

O mais provavel e que a criacao de label requer que o campo `name` seja passado, mas o formato pode nao estar correto. Segundo a documentacao, o endpoint exige `name` e opcionalmente `color` e `id`.

**Correcao**:
1. Adicionar try-catch robusto no `edit-label` action para que erros da UazAPI nao propaguem como 500
2. Verificar se o formato do body esta correto conforme a documentacao
3. No `ManageLabelsDialog`, adicionar tratamento de erro que NAO cause efeitos colaterais no estado de conexao do chip
4. Proteger a chamada `fetch-labels` pos-criacao com try-catch

**Arquivos**: `supabase/functions/uazapi-api/index.ts`, `src/components/whatsapp/ManageLabelsDialog.tsx`

---

### Problema 4: Nenhum feedback sobre chip desconectado + chips param de funcionar

**Causa raiz**: O botao "Reconectar" no banner de chip desconectado chama `action: 'connect-instance'`, mas essa acao NAO EXISTE no `uazapi-api/index.ts`. Isso cai no `default` case retornando `400: Invalid action`. Portanto o usuario nunca consegue reconectar.

Alem disso, apos criar etiquetas (problema 3), se a UazAPI entrar em estado de erro, ambos os chips podem parar de funcionar pois as chamadas subsequentes falham.

**Correcao**:
1. Criar a acao `connect-instance` no `uazapi-api/index.ts` que chama `POST /instance/connect` (igual ao flow do QR code mas sem aguardar QR)
2. Garantir que o banner de desconectado apareca corretamente quando qualquer acao falha com erro de conexao
3. Adicionar verificacao periodica do status do chip no frontend para detectar desconexoes automaticamente

**Arquivos**: `supabase/functions/uazapi-api/index.ts`, `src/components/whatsapp/ChatWindow.tsx`

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1a | `uazapi-api/index.ts` | Corrigir endpoints Business: `/business/get` para `/business/get/profile` (POST), `/business/update` para `/business/update/profile` (POST) |
| 1b | `WhatsAppProfileDialog.tsx` | Carregar foto atual do perfil ao abrir (buscar do banco `chips` ou `conversations`) |
| 2 | `evolution-webhook/index.ts` | Melhorar parsing do payload `messages_update` para cobrir mais formatos |
| 3a | `uazapi-api/index.ts` | Adicionar try-catch no `edit-label` para nao propagar erros como 500 |
| 3b | `ManageLabelsDialog.tsx` | Adicionar tratamento de erro robusto nas chamadas de criacao/edicao |
| 4a | `uazapi-api/index.ts` | Criar acao `connect-instance` que chama `POST /instance/connect` |
| 4b | `ChatWindow.tsx` | Verificar que a acao de reconexao usa `connect-instance` corretamente |

Apos as alteracoes, a edge function `uazapi-api` e `evolution-webhook` precisarao ser redeployadas.
