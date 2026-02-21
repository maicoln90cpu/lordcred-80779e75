

## Plano de Correcoes - 3 Problemas Criticos

### Problema 1: Etiquetas criadas mas nao aparecem

**Causa raiz encontrada**: A tabela `labels` NAO EXISTE no banco de dados. Todas as queries a `labels` estao falhando silenciosamente porque usam `(supabase as any)`. O toast "Etiqueta criada" aparece porque a chamada ao endpoint `/label/edit` da UazAPI pode retornar sucesso, mas o armazenamento local falha completamente.

Alem disso, a coluna `label_ids` NAO EXISTE na tabela `conversations`, entao a associacao de etiquetas a chats tambem nao funciona.

**Correcao**:
1. Criar a tabela `labels` com colunas: `id` (uuid), `chip_id` (uuid), `label_id` (text), `name` (text), `color_hex` (text), `created_at` (timestamptz) e UNIQUE constraint em `(chip_id, label_id)`
2. Adicionar coluna `label_ids` (text[]) na tabela `conversations`
3. Adicionar RLS policies para que usuarios vejam labels dos seus chips
4. Adicionar coluna `is_archived` na tabela `conversations` (necessaria tambem para o problema 3)

---

### Problema 2: Chips desconectados sem feedback

**Causa raiz encontrada**: O `ChipSelector.tsx` (linha 61) filtra chips com `.eq('status', 'connected')`, entao chips desconectados simplesmente desaparecem do seletor. O usuario nao recebe nenhum aviso. O banner de desconectado no `ChatWindow` so aparece quando uma mensagem falha ao enviar.

**Correcao**:
1. No `ChipSelector.tsx`, remover o filtro `.eq('status', 'connected')` e mostrar TODOS os chips do tipo whatsapp
2. Ao clicar em um chip que nao esta connected, mostrar um dialog informando que esta desconectado com opcoes de "Reconectar (Gerar QR Code)" ou "Cancelar"
3. Chips desconectados terao um indicador visual (icone ou cor diferente) no seletor

---

### Problema 3: Arquivamento nao persiste entre trocas de chip

**Causa raiz encontrada**: A coluna `is_archived` NAO EXISTE na tabela `conversations`. A query `UPDATE conversations SET is_archived = ...` falha silenciosamente. Quando o usuario troca de chip e volta, os dados sao carregados do banco sem o campo, entao todas aparecem como nao-arquivadas.

**Correcao**:
1. Adicionar coluna `is_archived` (boolean, default false) na tabela `conversations`
2. Verificar que o endpoint `archive-chat` no `uazapi-api` esta enviando o body correto para a UazAPI (`chatid` e `archive` fields)

---

### Detalhes Tecnicos - Implementacao

**Migration SQL** (uma unica migracao):

```text
-- 1. Criar tabela labels
CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL,
  label_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  color_hex text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(chip_id, label_id)
);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- RLS: usuarios veem labels dos seus chips
CREATE POLICY "Users can view their chip labels"
  ON public.labels FOR SELECT
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their chip labels"
  ON public.labels FOR ALL
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all labels"
  ON public.labels FOR ALL
  USING (is_admin());

-- 2. Adicionar colunas faltantes em conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS label_ids text[] DEFAULT '{}';
```

**Alteracoes em arquivos frontend**:

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `src/components/whatsapp/ChipSelector.tsx` | Remover filtro `status='connected'`; mostrar todos os chips whatsapp; ao clicar em chip desconectado, abrir dialog com opcao de reconectar (gerar QR) ou cancelar |
| 2 | `src/components/whatsapp/ChatSidebar.tsx` | Remover cast `as any` para queries de labels (tabela agora existe); queries de `is_archived` agora funcionam |
| 3 | `src/components/whatsapp/ManageLabelsDialog.tsx` | Remover cast `as any` para queries de labels |

**Alteracoes em edge functions**:

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `supabase/functions/uazapi-api/index.ts` | No `archive-chat`, verificar se o response da UazAPI indica sucesso real antes de atualizar o DB; adicionar log do response |

